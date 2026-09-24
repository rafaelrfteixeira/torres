/**
 * corretivasReportService.js — Serviço de Geração do Relatório Executivo de Corretivas e Ocorrências
 *
 * Responsável por:
 *  - Coletar itens da lista de Corretivas do Microsoft Lists / SharePoint do tenant
 *  - Mapear dinamicamente colunas (OS, Título, Solicitante, Categoria, Descrição, Criticidade, Status, Data, Resolução, Imagens)
 *  - Filtrar por competência (mês e ano de referência)
 *  - Calcular KPIs executivos (Total, Pendentes, Em Andamento, Aguardando Peça, Concluídas, Taxa de Resolução)
 *  - Gerar gráficos SVG vetoriais nítidos (Donut por Categoria e Barras de Status)
 *  - Detectar dinamicamente os sistemas/categorias implantados para o subtítulo do relatório
 *  - Anexar as fotos registradas (Imagem_1, Imagem_2, Imagem_3)
 *  - Renderizar template HTML homologado em formato A4 Paisagem para visualização e impressão PDF
 */

const fs = require('fs');
const path = require('path');

const NOME_MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Retorna string Data URI Base64 para um caminho de imagem local
 */
function getLocalImageBase64(relativePath) {
  if (!relativePath) return null;
  try {
    const fileName = String(relativePath).split('/').pop().split('\\').pop();
    const candidates = [
      path.resolve(__dirname, relativePath),
      path.resolve(process.cwd(), relativePath),
      path.resolve(process.cwd(), 'frontend/public', fileName),
      path.resolve(__dirname, '../../frontend/public', fileName),
      path.resolve(__dirname, '../../docs', fileName),
      path.resolve(process.cwd(), 'docs', fileName),
    ];
    for (const fullPath of candidates) {
      if (fs.existsSync(fullPath)) {
        const buffer = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).substring(1) || 'png';
        return `data:image/${ext};base64,${buffer.toString('base64')}`;
      }
    }
  } catch (err) {
    console.warn(`⚠️ [CorretivasReport] Erro ao carregar imagem local (${relativePath}):`, err.message);
  }
  return null;
}

/**
 * Converte qualquer objeto ou string de imagem do SharePoint em URL absoluta
 */
function parseImageField(rawField) {
  if (!rawField) return null;
  const sharepointHostname = process.env.SHAREPOINT_HOSTNAME || 'torrescx.sharepoint.com';
  const defaultServerUrl = `https://${sharepointHostname}`;

  let obj = null;
  if (typeof rawField === 'object') {
    obj = { ...rawField };
  } else if (typeof rawField === 'string') {
    const trimmed = rawField.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image')) {
      return trimmed;
    }
    try {
      obj = JSON.parse(trimmed);
    } catch (e) {
      if (trimmed.length > 5) {
        return trimmed.startsWith('/') ? `${defaultServerUrl}${trimmed}` : `${defaultServerUrl}/${trimmed}`;
      }
      return null;
    }
  }

  if (!obj) return null;
  const serverUrl = obj.serverUrl || defaultServerUrl;
  let relUrl = obj.serverRelativeUrl || obj.url || '';
  if (relUrl) {
    if (relUrl.startsWith('http://') || relUrl.startsWith('https://') || relUrl.startsWith('data:image')) {
      return relUrl;
    }
    if (!relUrl.startsWith('/')) relUrl = '/' + relUrl;
    return `${serverUrl}${relUrl}`;
  }
  return null;
}

let _cachedSiteId = null;
const _listIdCache = new Map();
const _columnMapCache = new Map();

/**
 * Resolve Site ID e List ID do SharePoint
 */
async function resolveSharePointIds(graphClient, targetListName) {
  const { SHAREPOINT_HOSTNAME, SHAREPOINT_SITE_PATH } = process.env;

  if (!SHAREPOINT_HOSTNAME || !SHAREPOINT_SITE_PATH || !targetListName) {
    throw new Error('⚠️ Variáveis SharePoint não configuradas ou nome da lista ausente.');
  }

  if (!_cachedSiteId) {
    const site = await graphClient
      .api(`/sites/${SHAREPOINT_HOSTNAME}:${SHAREPOINT_SITE_PATH}`)
      .get();
    _cachedSiteId = site.id;
  }

  if (!_listIdCache.has(targetListName)) {
    const allLists = await graphClient
      .api(`/sites/${_cachedSiteId}/lists`)
      .get();

    const targetClean = targetListName.trim().toLowerCase();
    const found = (allLists.value || []).find((l) => {
      const disp = (l.displayName || '').trim().toLowerCase();
      const nm = (l.name || '').trim().toLowerCase();
      return (
        disp === targetClean ||
        nm === targetClean ||
        disp === `cc-${targetClean}` ||
        `cc-${disp}` === targetClean
      );
    });

    if (!found) {
      throw new Error(`Lista "${targetListName}" não encontrada no SharePoint.`);
    }

    _listIdCache.set(targetListName, found.id);
  }

  return { siteId: _cachedSiteId, listId: _listIdCache.get(targetListName) };
}

/**
 * Mapeia dinamicamente as colunas do List de Corretivas
 */
async function getListColumnMapping(graphClient, siteId, listId, listName) {
  if (_columnMapCache.has(listName)) {
    return _columnMapCache.get(listName);
  }

  const mapping = {
    osNumber: null,
    title: 'Title',
    solicitante: null,
    categoria: null,
    descricao: null,
    prioridade: null,
    status: null,
    dataRelatada: null,
    dataAtendimento: null,
    resolucao: null,
    imagem1: 'Imagem_1',
    imagem2: 'Imagem_2',
    imagem3: 'Imagem_3',
    existingInternalNames: new Set(),
  };

  try {
    const columnsRes = await graphClient
      .api(`/sites/${siteId}/lists/${listId}/columns`)
      .get();

    const columns = columnsRes.value || [];

    columns.forEach((col) => {
      const disp = (col.displayName || '').toLowerCase().trim();
      const name = col.name;
      mapping.existingInternalNames.add(name);

      if (name === 'field_0' || disp === 'os' || disp === 'número os' || disp === 'numero os') {
        mapping.osNumber = name;
      }
      if (name === 'field_2' || disp === 'solicitante') {
        mapping.solicitante = name;
      }
      if (name === 'field_3' || disp === 'categoria') {
        mapping.categoria = name;
      }
      if (name === 'field_4' || disp.includes('descrição do problema') || disp.includes('descricao do problema') || (disp.includes('descrição') && !disp.includes('resolução') && !disp.includes('parecer'))) {
        mapping.descricao = name;
      }
      if (
        name === 'field_5' ||
        disp === 'prioridade' ||
        disp === 'criticidade' ||
        disp.includes('prioridade') ||
        disp.includes('criticidade') ||
        disp.includes('severidade') ||
        disp.includes('urgencia') ||
        disp.includes('urgência')
      ) {
        mapping.prioridade = name;
      }
      if (name === 'field_6' || disp === 'status') {
        mapping.status = name;
      }
      if (name === 'field_7' || disp.includes('data relatada') || disp.includes('data de abertura') || disp.includes('data abertura')) {
        mapping.dataRelatada = name;
      }
      if (!disp.includes('resolução') && !disp.includes('resolucao') && !disp.includes('parecer') && !disp.includes('problema')) {
        if (
          disp.includes('atendimento') ||
          disp.includes('conclusão') ||
          disp.includes('conclusao') ||
          disp === 'data da solução' ||
          name === 'field_8' ||
          name === 'Data_Atendimento'
        ) {
          mapping.dataAtendimento = name;
        }
      }
      if (!disp.includes('data')) {
        if (
          disp.includes('resolução') ||
          disp.includes('resolucao') ||
          disp.includes('parecer') ||
          disp.includes('solução do problema') ||
          disp.includes('solucao do problema') ||
          name === 'field_9' ||
          name === 'Resolucao_do_Problema' ||
          name === 'Parecer_Tecnico'
        ) {
          mapping.resolucao = name;
        }
      }
      if (name === 'Imagem_1' || disp === 'imagem 1' || disp === 'imagem_1') mapping.imagem1 = name;
      if (name === 'Imagem_2' || disp === 'imagem 2' || disp === 'imagem_2') mapping.imagem2 = name;
      if (name === 'Imagem_3' || disp === 'imagem 3' || disp === 'imagem_3') mapping.imagem3 = name;
    });

    if (!mapping.osNumber && mapping.existingInternalNames.has('field_0')) mapping.osNumber = 'field_0';
    if (!mapping.solicitante && mapping.existingInternalNames.has('field_2')) mapping.solicitante = 'field_2';
    if (!mapping.categoria && mapping.existingInternalNames.has('field_3')) mapping.categoria = 'field_3';
    if (!mapping.descricao && mapping.existingInternalNames.has('field_4')) mapping.descricao = 'field_4';
    if (!mapping.prioridade && mapping.existingInternalNames.has('field_5')) mapping.prioridade = 'field_5';
    if (!mapping.status && mapping.existingInternalNames.has('field_6')) mapping.status = 'field_6';
    if (!mapping.dataRelatada && mapping.existingInternalNames.has('field_7')) mapping.dataRelatada = 'field_7';
    if (!mapping.dataAtendimento && mapping.existingInternalNames.has('field_8')) mapping.dataAtendimento = 'field_8';
    if (!mapping.resolucao && mapping.existingInternalNames.has('field_9')) mapping.resolucao = 'field_9';

    if (mapping.dataAtendimento && mapping.dataAtendimento === mapping.resolucao) {
      mapping.dataAtendimento = mapping.existingInternalNames.has('field_8') ? 'field_8' : null;
    }

    _columnMapCache.set(listName, mapping);
    return mapping;
  } catch (err) {
    console.warn('⚠️ [CorretivasReport] Falha ao inspecionar colunas:', err.message);
    return {
      osNumber: 'field_0',
      title: 'Title',
      solicitante: 'field_2',
      categoria: 'field_3',
      descricao: 'field_4',
      prioridade: 'field_5',
      status: 'field_6',
      dataRelatada: 'field_7',
      dataAtendimento: 'field_8',
      resolucao: 'field_9',
      imagem1: 'Imagem_1',
      imagem2: 'Imagem_2',
      imagem3: 'Imagem_3',
    };
  }
}

/**
 * Extrai ano e mês de um registro de ocorrência
 */
function extractYearMonth(dateVal, osNumber, createdDate) {
  let str = '';
  if (typeof dateVal === 'object' && dateVal !== null) {
    str = String(dateVal.dateTime || '');
  } else {
    str = String(dateVal || '').trim();
  }

  if (str) {
    const ddmmyyyy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (ddmmyyyy) {
      return { year: parseInt(ddmmyyyy[3], 10), month: parseInt(ddmmyyyy[2], 10) };
    }
    const yyyymmdd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyymmdd) {
      return { year: parseInt(yyyymmdd[1], 10), month: parseInt(yyyymmdd[2], 10) };
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }
  }

  if (osNumber) {
    const s = String(osNumber).trim();
    const match = s.match(/^(\d{4})(\d{2})\d{2}/);
    if (match) {
      const y = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (y >= 2020 && y <= 2035 && m >= 1 && m <= 12) {
        return { year: y, month: m };
      }
    }
  }

  if (createdDate) {
    const d = new Date(createdDate);
    if (!isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }
  }

  return null;
}

/**
 * Formata data no padrão DD/MM/AAAA
 */
function formatDate(dateVal, createdDate) {
  let str = '';
  if (typeof dateVal === 'object' && dateVal !== null) {
    str = String(dateVal.dateTime || '');
  } else {
    str = String(dateVal || '').trim();
  }

  if (!str && createdDate) {
    str = String(createdDate);
  }

  if (!str) return '-';

  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    return str.substring(0, 10);
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  return str;
}

/**
 * Converte data para timestamp para ordenação decrescente
 */
function getDateTimestamp(dateVal, osNumber, createdDate) {
  let str = '';
  if (typeof dateVal === 'object' && dateVal !== null) {
    str = String(dateVal.dateTime || '');
  } else {
    str = String(dateVal || '').trim();
  }

  if (str) {
    const ddmmyyyy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (ddmmyyyy) {
      return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`).getTime();
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  if (createdDate) {
    const d = new Date(createdDate);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  if (osNumber) {
    const digits = String(osNumber).replace(/\D/g, '');
    if (digits.length >= 8) {
      return parseInt(digits.substring(0, 8), 10);
    }
    return parseInt(digits || '0', 10);
  }

  return 0;
}

/**
 * Normaliza o status para as 4 categorias visuais
 */
function normalizeStatus(statusStr) {
  if (!statusStr) return { label: 'Pendente', key: 'pendente', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' };
  const s = String(statusStr)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (s.includes('conclu') || s.includes('finaliz') || s.includes('resolv') || s.includes('fechad')) {
    return { label: 'Concluído', key: 'concluido', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
  }
  if (s.includes('andamento') || s.includes('execuc') || s.includes('atend')) {
    return { label: 'Em andamento', key: 'andamento', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
  }
  if (s.includes('peca') || s.includes('material') || s.includes('aguard')) {
    return { label: 'Aguardando peça', key: 'aguardando', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
  }
  return { label: 'Pendente', key: 'pendente', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
}

/**
 * Normaliza categoria técnica
 */
function normalizeCategory(catStr) {
  if (!catStr) return 'SDAI';
  const s = String(catStr).toUpperCase();
  if (s.includes('BMS') || s.includes('AUTOMAÇÃO') || s.includes('AUTOMACAO')) return 'BMS';
  if (s.includes('SDAI') || s.includes('INCÊNDIO') || s.includes('INCENDIO') || s.includes('DETECÇÃO')) return 'SDAI';
  if (s.includes('SCA') || s.includes('ACESSO')) return 'SCA';
  if (s.includes('CFTV') || s.includes('CAMERA') || s.includes('CÂMERA')) return 'CFTV';
  return catStr.trim();
}

/**
 * Normaliza criticidade/prioridade
 */
function normalizeCriticidade(critVal) {
  let s = '';
  if (typeof critVal === 'object' && critVal !== null) {
    s = String(critVal.Value || critVal.label || critVal.name || (Array.isArray(critVal) ? critVal[0] : '') || '');
  } else {
    s = String(critVal || '');
  }

  const clean = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (clean.includes('critic') || clean.includes('urgente') || clean.includes('emergencia') || clean.includes('alta prioridade') || clean === '1') {
    return { label: 'Crítico', key: 'critico', class: 'criticidade-critico' };
  }
  if (clean.includes('alta') || clean.includes('alto') || clean === '2') {
    return { label: 'Alta', key: 'alta', class: 'criticidade-alta' };
  }
  if (clean.includes('normal') || clean.includes('media') || clean.includes('medio') || clean === '3') {
    return { label: 'Normal', key: 'normal', class: 'criticidade-normal' };
  }
  if (clean.includes('baixa') || clean.includes('baixo') || clean === '4') {
    return { label: 'Baixa', key: 'baixa', class: 'criticidade-baixa' };
  }

  if (!clean) {
    return { label: 'Normal', key: 'normal', class: 'criticidade-normal' };
  }

  return { label: 'Normal', key: 'normal', class: 'criticidade-normal' };
}

/**
 * Formata código da OS (ex: 10 -> OS-010, OS-001 -> OS-001)
 */
function formatOSNumber(osVal, id) {
  if (!osVal && id) return `OS-${String(id).padStart(3, '0')}`;
  const str = String(osVal || '').trim();
  if (!str) return `OS-${String(id || '001').padStart(3, '0')}`;
  if (str.toUpperCase().startsWith('OS-')) return str.toUpperCase();
  if (/^\d+$/.test(str)) {
    return `OS-${str.padStart(3, '0')}`;
  }
  return `OS-${str}`;
}

/**
 * Gera Gráfico Donut em SVG puro para Categoria de Ativos
 */
function generateDonutChartSVG(categoryCounts, total) {
  if (total === 0) {
    return `
      <div style="display: flex; align-items: center; justify-content: center; height: 180px; color: #94a3b8; font-size: 13px;">
        Sem registros de chamados no período
      </div>
    `;
  }

  const PALETTE = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];
  const categories = Object.keys(categoryCounts);

  // Raio e centro dimensionados para caber perfeitamente no container sem overflow
  const size = 135;
  const cx = 67.5;
  const cy = 67.5;
  const r = 46;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * r;

  let currentOffset = 0;
  const slices = categories.map((cat, idx) => {
    const count = categoryCounts[cat];
    const pct = count / total;
    const strokeDash = pct * circumference;
    const strokeSpace = circumference - strokeDash;
    const color = PALETTE[idx % PALETTE.length];
    const offset = currentOffset;
    currentOffset += strokeDash;

    return `
      <circle
        cx="${cx}"
        cy="${cy}"
        r="${r}"
        fill="transparent"
        stroke="${color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${strokeDash.toFixed(2)} ${strokeSpace.toFixed(2)}"
        stroke-dashoffset="-${offset.toFixed(2)}"
      />
    `;
  }).join('');

  // Legenda
  const legendItems = categories.map((cat, idx) => {
    const count = categoryCounts[cat];
    const pct = Math.round((count / total) * 100);
    const color = PALETTE[idx % PALETTE.length];
    return `
      <div style="display: flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 600; color: #334155;">
        <span style="display: inline-block; width: 9px; height: 9px; border-radius: 2px; background-color: ${color};"></span>
        <span>${cat} <span style="color: #64748b; font-weight: 500;">(${count} • ${pct}%)</span></span>
      </div>
    `;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 4px 0;">
      <div style="position: relative; width: ${size}px; height: ${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg);">
          ${slices}
        </svg>
        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
          <span style="font-size: 19px; font-weight: 800; color: #0f172a; line-height: 1;">${total}</span>
          <span style="font-size: 8.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px;">Total</span>
        </div>
      </div>
      <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 8px;">
        ${legendItems}
      </div>
    </div>
  `;
}

/**
 * Gera Gráfico de Barras em SVG puro para Distribuição de Status
 */
function generateBarChartSVG(statusCounts) {
  const bars = [
    { label: 'Concluído', count: statusCounts.concluido || 0, color: '#059669' },
    { label: 'Em andamento', count: statusCounts.andamento || 0, color: '#f59e0b' },
    { label: 'Pendente', count: statusCounts.pendente || 0, color: '#ef4444' },
    { label: 'Aguardando peça', count: statusCounts.aguardando || 0, color: '#8b5cf6' },
  ];

  const maxCount = Math.max(...bars.map(b => b.count), 4);
  const chartWidth = 560;
  const chartHeight = 160;
  const leftPadding = 36;
  const rightPadding = 20;
  const topPadding = 22;
  const bottomPadding = 30;

  const usableWidth = chartWidth - leftPadding - rightPadding;
  const usableHeight = chartHeight - topPadding - bottomPadding;
  const sectionWidth = usableWidth / bars.length;
  const barWidth = 62; // Barra mais larga e expressiva

  // Grid lines horizontais e valores do eixo Y
  const gridSteps = 4;
  let gridLines = '';
  for (let i = 0; i <= gridSteps; i++) {
    const val = Math.round((maxCount / gridSteps) * i);
    const y = topPadding + usableHeight - (i / gridSteps) * usableHeight;
    gridLines += `
      <line x1="${leftPadding}" y1="${y}" x2="${chartWidth - rightPadding}" y2="${y}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="${i === 0 ? 'none' : '3 3'}" />
      <text x="${leftPadding - 8}" y="${y + 3.5}" font-size="9.5" font-weight="600" fill="#94a3b8" text-anchor="end" font-family="'Inter', sans-serif">${val}</text>
    `;
  }

  // Barras e rótulos distribuídos ao longo de toda a largura
  const barsSVG = bars.map((bar, idx) => {
    const x = leftPadding + idx * sectionWidth + (sectionWidth - barWidth) / 2;
    const h = (bar.count / maxCount) * usableHeight;
    const y = topPadding + usableHeight - h;

    return `
      <!-- Barra com cantos arredondados -->
      <rect
        x="${x}"
        y="${y}"
        width="${barWidth}"
        height="${Math.max(h, 3)}"
        rx="5"
        fill="${bar.color}"
      />
      <!-- Valor numérico em destaque acima da barra -->
      ${bar.count > 0 ? `
        <text
          x="${x + barWidth / 2}"
          y="${y - 6}"
          font-size="12"
          font-weight="800"
          fill="#0f172a"
          text-anchor="middle"
          font-family="'Inter', sans-serif"
        >${bar.count}</text>
      ` : `
        <text
          x="${x + barWidth / 2}"
          y="${topPadding + usableHeight - 6}"
          font-size="10.5"
          font-weight="600"
          fill="#cbd5e1"
          text-anchor="middle"
          font-family="'Inter', sans-serif"
        >0</text>
      `}
      <!-- Rótulo do status abaixo da barra -->
      <text
        x="${x + barWidth / 2}"
        y="${chartHeight - 8}"
        font-size="10.5"
        font-weight="700"
        fill="#475569"
        text-anchor="middle"
        font-family="'Inter', sans-serif"
      >${bar.label}</text>
    `;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; padding-top: 4px;">
      <svg width="100%" height="160" viewBox="0 0 ${chartWidth} ${chartHeight}" style="max-width: ${chartWidth}px; width: 100%; overflow: visible;">
        ${gridLines}
        ${barsSVG}
      </svg>
    </div>
  `;
}

/**
 * Extrai o nome de arquivo de anexo moderno do SharePoint (Reserved_ImageAttachment_...)
 */
function extractAttachmentFileName(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed.fileName || parsed.name || null;
      } catch (e) {
        return null;
      }
    }
    if (trimmed.includes('Reserved_ImageAttachment_')) {
      const m = trimmed.match(/Reserved_ImageAttachment_[^"'\s\)]+/);
      return m ? m[0] : null;
    }
  } else if (typeof val === 'object' && val !== null) {
    return val.fileName || val.name || null;
  }
  return null;
}

/**
 * Extrai o GUID do site SharePoint a partir do ID retornado pela Graph API
 */
function getSharePointSiteGuid(siteId) {
  if (!siteId) return '';
  if (siteId.includes(',')) {
    const parts = siteId.split(',');
    return parts.slice(1).join(',');
  }
  return siteId;
}

/**
 * Resolve a URL final ou Base64 para exibição de imagens das OSs
 * Para Imagem_3, suporta as duas formas:
 *  1. Diretamente no List (Reserved_ImageAttachment_... ou anexo de item)
 *  2. Carregada pelo APP (salva na biblioteca /PreventivasImages/ do SharePoint)
 */
/**
 * Busca imagem na biblioteca de documentos do Drive (/PreventivasImages/...) usada pelo APP
 */
async function fetchFromDrive(candidateFileName, serverRelativeUrl, hostname, sitePath, accessToken, graphClient, siteId) {
  if (!candidateFileName) return null;

  // 1. Tentar Graph API do Drive
  if (graphClient && siteId) {
    try {
      const driveItem = await graphClient
        .api(`/sites/${siteId}/drive/root:/PreventivasImages/${encodeURIComponent(candidateFileName)}`)
        .select('id,@microsoft.graph.downloadUrl')
        .get();

      const downloadUrl = driveItem && driveItem['@microsoft.graph.downloadUrl'];
      if (downloadUrl) {
        const fetchRes = await fetch(downloadUrl);
        if (fetchRes.ok) {
          const buffer = await fetchRes.arrayBuffer();
          const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
          return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
        }
      }
    } catch (err) {
      // Tentar obter conteúdo binário direto via Graph
      try {
        const bin = await graphClient
          .api(`/sites/${siteId}/drive/root:/PreventivasImages/${encodeURIComponent(candidateFileName)}:/content`)
          .responseType('arraybuffer')
          .get();
        if (bin && bin.byteLength > 0) {
          return `data:image/jpeg;base64,${Buffer.from(bin).toString('base64')}`;
        }
      } catch (err2) {}
    }
  }

  // 2. Tentar baixar via URLs diretas do SharePoint com Bearer token
  const candidateUrls = [
    `https://${hostname}${sitePath}/Documentos%20Compartilhados/PreventivasImages/${encodeURIComponent(candidateFileName)}`,
    `https://${hostname}${sitePath}/Shared%20Documents/PreventivasImages/${encodeURIComponent(candidateFileName)}`,
    serverRelativeUrl ? (serverRelativeUrl.startsWith('http') ? serverRelativeUrl : `https://${hostname}${serverRelativeUrl.startsWith('/') ? '' : '/'}${serverRelativeUrl}`) : null,
    `https://${hostname}${sitePath}/_api/web/GetFileByServerRelativeUrl('${sitePath}/Documentos%20Compartilhados/PreventivasImages/${encodeURIComponent(candidateFileName)}')/$value`,
    `https://${hostname}${sitePath}/_api/web/GetFileByServerRelativeUrl('${sitePath}/Shared%20Documents/PreventivasImages/${encodeURIComponent(candidateFileName)}')/$value`,
  ].filter(Boolean);

  if (accessToken) {
    for (const url of candidateUrls) {
      try {
        const cleanUrl = encodeURI(decodeURI(url));
        const fetchRes = await fetch(cleanUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (fetchRes.ok) {
          const buffer = await fetchRes.arrayBuffer();
          const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
          return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
        }
      } catch (err) {}
    }
  }

  return null;
}

/**
 * Busca imagem nos anexos diretos do SharePoint Lists (Reserved_ImageAttachment_... ou anexo de item)
 */
async function fetchFromListAttachment(val, candidateFileName, serverRelativeUrl, itemId, siteGuid, listId, hostname, sitePath, accessToken) {
  const attachmentFileName = extractAttachmentFileName(val) || candidateFileName;
  let directUrl = null;

  if (attachmentFileName) {
    directUrl = `https://${hostname}${sitePath}/_api/v2.1/sites('${siteGuid}')/lists('${listId}')/items('${itemId}')/attachments('${encodeURIComponent(attachmentFileName)}')/thumbnails/0/c600x600/content?prefer=noredirect,closestavailablesize`;
  } else if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
    directUrl = val;
  } else if (serverRelativeUrl) {
    directUrl = serverRelativeUrl.startsWith('http') ? serverRelativeUrl : `https://${hostname}${serverRelativeUrl.startsWith('/') ? '' : '/'}${serverRelativeUrl}`;
  }

  if (directUrl && accessToken && directUrl.includes('sharepoint.com')) {
    try {
      const fetchRes = await fetch(directUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (fetchRes.ok) {
        const buffer = await fetchRes.arrayBuffer();
        const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
        const base64Str = Buffer.from(buffer).toString('base64');
        return `data:${contentType};base64,${base64Str}`;
      }
    } catch (err) {
      console.warn(`⚠️ [CorretivasReport] Falha ao baixar anexo SharePoint (${directUrl}):`, err.message);
    }
  }

  return directUrl;
}

/**
 * Resolve a URL final ou Base64 para exibição de imagens das OSs
 * Para Imagem_3, suporta as duas formas:
 *  1. Diretamente no List (Reserved_ImageAttachment_... ou anexo de item)
 *  2. Carregada pelo APP (salva na biblioteca /PreventivasImages/ do SharePoint)
 */
async function resolvePhotoUrl(val, itemId, siteGuid, listId, accessToken, fieldName = '', graphClient = null, siteId = '') {
  if (!val) return null;
  const hostname = process.env.SHAREPOINT_HOSTNAME || 'torrescx.sharepoint.com';
  const sitePath = process.env.SHAREPOINT_SITE_PATH || '/sites/Manutencao';

  // Identifica se é o campo Imagem_3 (somente ele deve ter as 2 vias de busca)
  const isImagem3 = fieldName === 'Imagem_3' || fieldName === 'imagem3' || (typeof fieldName === 'string' && fieldName.toLowerCase().includes('imagem_3'));

  // Se já for data URL
  if (typeof val === 'string' && val.startsWith('data:image')) {
    return val;
  }

  // 1. Extração do objeto ou string
  let parsedObj = null;
  let rawStr = '';

  if (typeof val === 'object' && val !== null) {
    parsedObj = val;
  } else if (typeof val === 'string') {
    rawStr = val.trim();
    if (rawStr.startsWith('{') && rawStr.endsWith('}')) {
      try {
        parsedObj = JSON.parse(rawStr);
      } catch (e) {
        parsedObj = null;
      }
    }
  }

  if (parsedObj && typeof parsedObj.url === 'string' && parsedObj.url.startsWith('data:image')) {
    return parsedObj.url;
  }

  // 2. Extração de nomes de arquivos candidatos e caminhos
  let candidateFileName = null;
  let serverRelativeUrl = null;

  if (parsedObj) {
    candidateFileName = parsedObj.fileName || parsedObj.name || null;
    serverRelativeUrl = parsedObj.serverRelativeUrl || parsedObj.url || null;
  } else if (rawStr) {
    if (rawStr.includes('Reserved_ImageAttachment_')) {
      const m = rawStr.match(/Reserved_ImageAttachment_[^"'\s\)]+/);
      candidateFileName = m ? m[0] : null;
    } else if (rawStr.includes('/') || rawStr.includes('\\')) {
      const parts = rawStr.split(/[/\\]/);
      candidateFileName = decodeURIComponent(parts[parts.length - 1].split('?')[0]);
      serverRelativeUrl = rawStr;
    } else {
      candidateFileName = rawStr;
    }
  }

  // Identificar se a origem parece ser do APP (/PreventivasImages/ ou nome customizado sem prefixo Reserved)
  const isAppUpload = isImagem3 && (
    (serverRelativeUrl && serverRelativeUrl.includes('PreventivasImages')) ||
    (rawStr && rawStr.includes('PreventivasImages')) ||
    (candidateFileName && !candidateFileName.startsWith('Reserved_ImageAttachment_'))
  );

  // =========================================================================
  // CASO EXCLUSIVO: Imagem_3 (Suporte às 2 formas com fallback recíproco)
  // =========================================================================
  if (isImagem3) {
    if (isAppUpload) {
      // Forma A (APP): Busca na pasta PreventivasImages do SharePoint Drive
      const driveImg = await fetchFromDrive(candidateFileName, serverRelativeUrl, hostname, sitePath, accessToken, graphClient, siteId);
      if (driveImg) return driveImg;

      // Fallback para Forma B (Direto no List)
      const listImg = await fetchFromListAttachment(val, candidateFileName, serverRelativeUrl, itemId, siteGuid, listId, hostname, sitePath, accessToken);
      if (listImg && listImg.startsWith('data:image')) return listImg;

      // Fallback de URL direta do APP caso Base64 não tenha sido obtido
      return `https://${hostname}${sitePath}/Documentos%20Compartilhados/PreventivasImages/${encodeURIComponent(candidateFileName)}`;
    } else {
      // Forma B (Direto no List): Busca nos anexos do item da lista
      const listImg = await fetchFromListAttachment(val, candidateFileName, serverRelativeUrl, itemId, siteGuid, listId, hostname, sitePath, accessToken);
      if (listImg && listImg.startsWith('data:image')) return listImg;

      // Fallback para Forma A (APP / PreventivasImages)
      const driveImg = await fetchFromDrive(candidateFileName, serverRelativeUrl, hostname, sitePath, accessToken, graphClient, siteId);
      if (driveImg) return driveImg;

      return listImg;
    }
  }

  // =========================================================================
  // DEMAIS CAMPOS (Imagem_1, Imagem_2, Imagem_4): Mantêm exclusivamente Forma B (List)
  // =========================================================================
  return await fetchFromListAttachment(val, candidateFileName, serverRelativeUrl, itemId, siteGuid, listId, hostname, sitePath, accessToken);
}

/**
 * Gera o indicador visual de Proatividade vs. Reatividade
 */
function generateProactivityGaugeHTML(proactiveCount, reactiveCount, total) {
  if (total === 0) {
    return `<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 20px;">Sem dados de demandas no período.</div>`;
  }
  const proactivePct = Math.round((proactiveCount / total) * 100);
  const reactivePct = 100 - proactivePct;

  return `
    <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 8px; text-align: center;">
          <div style="font-size: 9.5px; font-weight: 800; color: #166534; text-transform: uppercase;">Proativo (Torres Cx)</div>
          <div style="font-size: 24px; font-weight: 800; color: #15803d; line-height: 1.1; margin: 4px 0;">${proactivePct}%</div>
          <div style="font-size: 9.5px; color: #166534; font-weight: 600;">${proactiveCount} chamados antecipados</div>
        </div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 8px; text-align: center;">
          <div style="font-size: 9.5px; font-weight: 800; color: #92400e; text-transform: uppercase;">Reativo (Operação/Mall)</div>
          <div style="font-size: 24px; font-weight: 800; color: #b45309; line-height: 1.1; margin: 4px 0;">${reactivePct}%</div>
          <div style="font-size: 9.5px; color: #92400e; font-weight: 600;">${reactiveCount} solicitações externas</div>
        </div>
      </div>

      <!-- Barra proporcional dividida -->
      <div style="margin-top: 12px;">
        <div style="display: flex; height: 14px; border-radius: 7px; overflow: hidden; background: #e2e8f0;">
          <div style="width: ${proactivePct}%; background-color: #10b981;" title="Proativo: ${proactivePct}%"></div>
          <div style="width: ${reactivePct}%; background-color: #f59e0b;" title="Reativo: ${reactivePct}%"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #64748b; font-weight: 600; margin-top: 5px;">
          <span>🟢 Detecção em Rotinas Técnicas (${proactivePct}%)</span>
          <span>🟠 Demandas de Campo (${reactivePct}%)</span>
        </div>
      </div>

      <!-- Nota de governança -->
      <div style="background: #f8fafc; border-left: 3px solid #10b981; padding: 6px 10px; border-radius: 0 4px 4px 0; margin-top: 10px; font-size: 9.5px; color: #334155; line-height: 1.35;">
        <strong>Eficácia Preventiva:</strong> Falhas identificadas antecipadamente pela engenharia reduzem paralisações e evitam transtornos à operação.
      </div>
    </div>
  `;
}

/**
 * Gera o gráfico de barras horizontais dos Solicitantes ("Quem Mais Solicita")
 */
function generateRequestersHorizontalBarsHTML(requestersList, total) {
  if (requestersList.length === 0) {
    return `<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 20px;">Sem solicitantes registrados.</div>`;
  }

  const maxCount = Math.max(...requestersList.map(r => r.count), 1);
  const PALETTE = ['#2563eb', '#0891b2', '#059669', '#d97706', '#7c3aed', '#db2777'];

  const rows = requestersList.slice(0, 5).map((req, idx) => {
    const color = PALETTE[idx % PALETTE.length];
    const barWidthPct = Math.max(Math.round((req.count / maxCount) * 100), 8);

    return `
      <div style="margin-bottom: 7px;">
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px;">
          <span style="font-weight: 700; color: #1e293b; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${idx + 1}. ${req.name}
          </span>
          <span style="font-weight: 600; color: #64748b;">
            <strong style="color: #0f172a;">${req.count}</strong> chamado${req.count > 1 ? 's' : ''} (${req.percentage}%)\n          </span>
        </div>
        <div style="height: 9px; width: 100%; background: #f1f5f9; border-radius: 5px; overflow: hidden;">
          <div style="height: 100%; width: ${barWidthPct}%; background-color: ${color}; border-radius: 5px;"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; justify-content: flex-start; height: 100%; padding-top: 4px;">
      ${rows}
    </div>
  `;
}

/**
 * Gera a Matriz de Criticidade Operacional
 */
function generateCriticalityMatrixHTML(critCounts, total) {
  const critico = critCounts.critico || 0;
  const alta = critCounts.alta || 0;
  const normal = critCounts.normal || 0;
  const baixa = critCounts.baixa || 0;

  const pctCritico = total > 0 ? Math.round((critico / total) * 100) : 0;
  const pctAlta = total > 0 ? Math.round((alta / total) * 100) : 0;
  const pctNormal = total > 0 ? Math.round((normal / total) * 100) : 0;
  const pctBaixa = total > 0 ? Math.round((baixa / total) * 100) : 0;

  const statusAlert = critico === 0
    ? `<span style="color: #15803d; font-weight: 700;">✅ Risco Controlado:</span> Nenhum chamado impeditivo no período.`
    : `<span style="color: #b91c1c; font-weight: 700;">⚠️ Atenção:</span> ${critico} chamado(s) crítico(s) demandaram intervenção urgente.`;

  return `
    <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 4px;">
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 4px; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 800; color: #dc2626; text-transform: uppercase;">Crítico</div>
          <div style="font-size: 20px; font-weight: 800; color: #b91c1c; line-height: 1.1; margin: 2px 0;">${critico}</div>
          <div style="font-size: 9px; color: #7f1d1d; font-weight: 600;">${pctCritico}%</div>
        </div>
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 8px 4px; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 800; color: #ea580c; text-transform: uppercase;">Alta</div>
          <div style="font-size: 20px; font-weight: 800; color: #c2410c; line-height: 1.1; margin: 2px 0;">${alta}</div>
          <div style="font-size: 9px; color: #9a3412; font-weight: 600;">${pctAlta}%</div>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 4px; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 800; color: #2563eb; text-transform: uppercase;">Normal</div>
          <div style="font-size: 20px; font-weight: 800; color: #1d4ed8; line-height: 1.1; margin: 2px 0;">${normal}</div>
          <div style="font-size: 9px; color: #1e40af; font-weight: 600;">${pctNormal}%</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 4px; text-align: center;">
          <div style="font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase;">Baixa</div>
          <div style="font-size: 20px; font-weight: 800; color: #334155; line-height: 1.1; margin: 2px 0;">${baixa}</div>
          <div style="font-size: 9px; color: #475569; font-weight: 600;">${pctBaixa}%</div>
        </div>
      </div>

      <!-- Barra de Distribuição de Risco -->
      <div style="margin-top: 10px;">
        <div style="display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: #e2e8f0;">
          <div style="width: ${pctCritico}%; background-color: #ef4444;" title="Crítico"></div>
          <div style="width: ${pctAlta}%; background-color: #f97316;" title="Alta"></div>
          <div style="width: ${pctNormal}%; background-color: #3b82f6;" title="Normal"></div>
          <div style="width: ${pctBaixa}%; background-color: #94a3b8;" title="Baixa"></div>
        </div>
      </div>

      <div style="font-size: 9.5px; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 4px; margin-top: 10px;">
        ${statusAlert}
      </div>
    </div>
  `;
}

/**
 * Gera a seção de Aging do Backlog Ativo
 */
function generateBacklogAgingHTML(activeItems, now) {
  if (activeItems.length === 0) {
    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #f0fdf4; border: 1px dashed #86efac; border-radius: 6px; padding: 20px; text-align: center;">
        <span style="font-size: 26px; margin-bottom: 4px;">🎉</span>
        <span style="font-size: 13px; font-weight: 800; color: #15803d;">Backlog Zerado!</span>
        <span style="font-size: 10.5px; color: #166534; margin-top: 2px;">Todas as ordens de serviço do período foram 100% concluídas.</span>
      </div>
    `;
  }

  const buckets = {
    ate7: 0,
    de8a15: 0,
    de16a30: 0,
    mais30: 0,
  };

  const activeWithAging = activeItems.map((item) => {
    let itemDate = item.timestamp ? new Date(item.timestamp) : now;
    if (isNaN(itemDate.getTime())) itemDate = now;
    const diffMs = Math.max(0, now.getTime() - itemDate.getTime());
    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (dias <= 7) buckets.ate7++;
    else if (dias <= 15) buckets.de8a15++;
    else if (dias <= 30) buckets.de16a30++;
    else buckets.mais30++;

    return {
      ...item,
      dias,
    };
  });

  // Ordenar chamados do backlog em ordem decrescente de idade (maior tempo em aberto primeiro)
  activeWithAging.sort((a, b) => {
    if (b.dias !== a.dias) {
      return b.dias - a.dias;
    }
    return a.timestamp - b.timestamp;
  });

  const listRows = activeWithAging.slice(0, 4).map((item) => {
    let agingBadgeClass = 'aging-green';
    if (item.dias > 30) agingBadgeClass = 'aging-red';
    else if (item.dias > 15) agingBadgeClass = 'aging-orange';
    else if (item.dias > 7) agingBadgeClass = 'aging-yellow';

    return `
      <tr style="border-bottom: 1px solid #f1f5f9; font-size: 9.5px;">
        <td style="padding: 4px 6px; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #0f172a;">${item.os}</td>
        <td style="padding: 4px 6px; color: #334155; max-width: 170px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.titulo}</td>
        <td style="padding: 4px 6px; text-align: center;">
          <span class="status-pill status-${item.status.key}" style="font-size: 8px; padding: 1px 5px;">${item.status.label}</span>
        </td>
        <td style="padding: 4px 6px; text-align: right;">
          <span class="${agingBadgeClass}" style="font-weight: 700; font-size: 9px; padding: 1.5px 5px; border-radius: 3px;">${item.dias} dia${item.dias !== 1 ? 's' : ''}</span>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
      <!-- 4 Faixas de Aging -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 5px; padding: 5px; text-align: center;">
          <div style="font-size: 8px; font-weight: 700; color: #166534;">0 a 7 dias</div>
          <div style="font-size: 14px; font-weight: 800; color: #15803d;">${buckets.ate7}</div>
        </div>
        <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 5px; padding: 5px; text-align: center;">
          <div style="font-size: 8px; font-weight: 700; color: #854d0e;">8 a 15 dias</div>
          <div style="font-size: 14px; font-weight: 800; color: #a16207;">${buckets.de8a15}</div>
        </div>
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 5px; padding: 5px; text-align: center;">
          <div style="font-size: 8px; font-weight: 700; color: #9a3412;">16 a 30 dias</div>
          <div style="font-size: 14px; font-weight: 800; color: #c2410c;">${buckets.de16a30}</div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 5px; padding: 5px; text-align: center;">
          <div style="font-size: 8px; font-weight: 700; color: #991b1b;">> 30 dias</div>
          <div style="font-size: 14px; font-weight: 800; color: #b91c1c;">${buckets.mais30}</div>
        </div>
      </div>

      <!-- Tabela resumida de chamados do backlog -->
      <div style="flex: 1; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8fafc; font-size: 8.5px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0;">
              <th style="padding: 3px 6px; text-align: left;">OS</th>
              <th style="padding: 3px 6px; text-align: left;">Título</th>
              <th style="padding: 3px 6px; text-align: center;">Status</th>
              <th style="padding: 3px 6px; text-align: right;">Idade</th>
            </tr>
          </thead>
          <tbody>
            ${listRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Gera o subtítulo dinâmico baseado nos sistemas/categorias encontradas e no tenant
 */
function buildDynamicSubtitle(tenantConfig, categoriesFound, tenantName) {
  // Categorias encontradas na lista
  const catSet = new Set(categoriesFound.map(c => normalizeCategory(c)));

  // Também verificar tenantConfig para sistemas implantados
  if (tenantConfig.listaSDAI) catSet.add('SDAI');
  if (tenantConfig.listaBMS) catSet.add('BMS');

  const names = [];
  if (catSet.has('SDAI')) names.push('Sistemas de Detecção, Alarme de Incêndio (SDAI)');
  if (catSet.has('BMS')) names.push('Automação BMS');
  if (catSet.has('SCA')) names.push('Controle de Acesso (SCA)');
  if (catSet.has('CFTV')) names.push('Circuito Fechado de TV (CFTV)');

  // Outras categorias customizadas
  for (const cat of catSet) {
    if (!['SDAI', 'BMS', 'SCA', 'CFTV'].includes(cat)) {
      names.push(cat);
    }
  }

  const systemsString = names.length > 0 ? names.join(' & ') : 'Sistemas de Manutenção Especializada';
  return `${tenantName} — ${systemsString}`;
}

/**
 * Função principal de geração do Relatório Executivo de Corretivas
 */
async function generateMonthlyCorretivasReport(graphClient, accessToken, tenantConfig, mes, ano, sistemaFiltro) {
  const listName = tenantConfig.listaCorretivas;
  const tenantName = tenantConfig.name || 'Shopping';
  const nomeMesStr = NOME_MESES[Number(mes)] || mes;

  if (!listName) {
    throw new Error(`Lista de Corretivas não configurada para o tenant "${tenantConfig.name || 'solicitado'}".`);
  }

  const { siteId, listId } = await resolveSharePointIds(graphClient, listName);
  const colMap = await getListColumnMapping(graphClient, siteId, listId, listName);

  console.log(`📡 [CorretivasReport] Buscando registros da lista "${listName}"...`);
  const response = await graphClient
    .api(`/sites/${siteId}/lists/${listId}/items`)
    .expand('fields')
    .top(999)
    .get();

  const rawItems = response.value || [];
  console.log(`📋 [CorretivasReport] ${rawItems.length} registros obtidos do SharePoint.`);

  // Mapear itens brutos
  const allParsed = rawItems.map((item) => {
    const f = item.fields || {};

    let dataAtend = colMap.dataAtendimento && f[colMap.dataAtendimento] ? f[colMap.dataAtendimento] : '';
    let resol = colMap.resolucao && f[colMap.resolucao] ? f[colMap.resolucao] : '';
    if (dataAtend && !/\d/.test(String(dataAtend))) {
      if (!resol) resol = String(dataAtend);
      dataAtend = '';
    }

    const dataRelatada = (colMap.dataRelatada && f[colMap.dataRelatada]) || f.field_7 || item.createdDateTime || '';
    const osRaw = colMap.osNumber && f[colMap.osNumber] != null ? f[colMap.osNumber] : (f.field_0 || item.id);
    const osFormatted = formatOSNumber(osRaw, item.id);

    const ym = extractYearMonth(dataRelatada, osRaw, item.createdDateTime) ||
      extractYearMonth(dataAtend, null, null) ||
      extractYearMonth(item.createdDateTime, null, null);

    const rawCategory = (colMap.categoria && f[colMap.categoria]) || f.field_3 || 'SDAI';
    const normalizedCategory = normalizeCategory(rawCategory);

    const rawStatus = (colMap.status && f[colMap.status]) || f.field_6 || 'Pendente';
    const statusObj = normalizeStatus(rawStatus);

    const rawPrioridade = (colMap.prioridade && f[colMap.prioridade]) ||
      f.field_5 ||
      f.Prioridade ||
      f.Criticidade ||
      f.criticidade ||
      f.prioridade ||
      f.Priority ||
      'Normal';
    const criticidadeObj = normalizeCriticidade(rawPrioridade);

    const titulo = f[colMap.title] || f.Title || 'Manutenção Corretiva';
    const descricao = (colMap.descricao && f[colMap.descricao]) || f.field_4 || '';

    const solicitanteRaw = (colMap.solicitante && f[colMap.solicitante]) || f.field_2 || f.Solicitante || '';
    const solicitante = typeof solicitanteRaw === 'string' ? solicitanteRaw.trim() : (solicitanteRaw?.displayName || '');

    return {
      id: item.id,
      os: osFormatted,
      titulo,
      descricao,
      solicitante,
      categoria: normalizedCategory,
      rawCategory,
      criticidade: criticidadeObj,
      status: statusObj,
      dataRelatada,
      dataFormatada: formatDate(dataRelatada, item.createdDateTime),
      dataAtendimento: formatDate(dataAtend, null),
      resolucao: typeof resol === 'string' ? resol.trim() : '',
      timestamp: getDateTimestamp(dataRelatada, osRaw, item.createdDateTime),
      yearMonth: ym,
      rawFields: f,
    };
  });

  // Filtrar pelo mês e ano de competência
  let filtered = allParsed.filter((item) => {
    if (!item.yearMonth) return false;
    return item.yearMonth.month === Number(mes) && item.yearMonth.year === Number(ano);
  });

  // Filtro opcional por sistema se fornecido
  if (sistemaFiltro && sistemaFiltro !== 'todos' && sistemaFiltro !== 'geral') {
    const sUpper = sistemaFiltro.toUpperCase();
    filtered = filtered.filter((item) => item.categoria.includes(sUpper));
  }

  // Ordenação cronológica decrescente (mais recentes primeiro)
  filtered.sort((a, b) => b.timestamp - a.timestamp);

  console.log(`✅ [CorretivasReport] ${filtered.length} ocorrências filtradas para ${nomeMesStr}/${ano}.`);

  // Resolver fotos das ordens de serviço (baixando como base64 no backend para exibição segura)
  const siteGuid = getSharePointSiteGuid(siteId);
  for (const item of filtered) {
    const photos = [];
    const f = item.rawFields || {};

    const colPairs = [
      { val: f[colMap.imagem1] || f.Imagem_1, label: 'Antes / Diagnóstico', fieldName: 'Imagem_1' },
      { val: f[colMap.imagem2] || f.Imagem_2, label: 'Em Atendimento', fieldName: 'Imagem_2' },
      { val: f[colMap.imagem3] || f.Imagem_3, label: 'Resolução / Final', fieldName: 'Imagem_3' },
      { val: f[colMap.imagem4] || f.Imagem_4, label: 'Evidência Adicional', fieldName: 'Imagem_4' },
    ];

    for (const pair of colPairs) {
      if (pair.val) {
        const photoUrl = await resolvePhotoUrl(
          pair.val,
          item.id,
          siteGuid,
          listId,
          accessToken,
          pair.fieldName,
          graphClient,
          siteId
        );
        if (photoUrl) {
          photos.push({ url: photoUrl, label: pair.label });
        }
      }
    }
    item.resolvedPhotos = photos;
  }

  // Cálculos de KPIs
  const totalChamados = filtered.length;
  const statusCounts = {
    concluido: 0,
    andamento: 0,
    pendente: 0,
    aguardando: 0,
  };

  const categoryCounts = {};
  const allCategoriesSet = new Set();

  filtered.forEach((item) => {
    statusCounts[item.status.key] = (statusCounts[item.status.key] || 0) + 1;
    categoryCounts[item.categoria] = (categoryCounts[item.categoria] || 0) + 1;
    allCategoriesSet.add(item.categoria);
  });

  // Taxa de resolução
  const taxaResolucao = totalChamados > 0
    ? Math.round((statusCounts.concluido / totalChamados) * 100)
    : 0;

  // 1. Proatividade vs Reatividade (Baseado estritamente em QUEM abriu a solicitação)
  let proactiveCount = 0;
  let reactiveCount = 0;

  filtered.forEach((item) => {
    const sol = (item.solicitante || '').toLowerCase().trim();
    // Demandas abertas pela própria Torres Cx ou técnicos em rondas preventivas são Proativas
    const isTorresProactive = sol.includes('torres') ||
                              sol.includes('técnico') ||
                              sol.includes('tecnico') ||
                              sol.includes('preventiva') ||
                              sol.includes('ronda');
    if (isTorresProactive) {
      proactiveCount++;
    } else {
      reactiveCount++;
    }
  });

  // 2. Ranking de Solicitantes ("Quem Mais Solicita")
  const requesterCounts = {};
  filtered.forEach((item) => {
    const req = item.solicitante || 'Não Informado';
    requesterCounts[req] = (requesterCounts[req] || 0) + 1;
  });

  const requestersList = Object.entries(requesterCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalChamados > 0 ? Math.round((count / totalChamados) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 3. Matriz de Criticidade Operacional
  const critCounts = {
    critico: 0,
    alta: 0,
    normal: 0,
    baixa: 0,
  };

  filtered.forEach((item) => {
    const k = item.criticidade?.key || 'normal';
    if (critCounts[k] !== undefined) {
      critCounts[k]++;
    } else {
      critCounts.normal++;
    }
  });

  // 4. Aging do Backlog Ativo
  const activeItems = filtered.filter((item) => item.status.key !== 'concluido');

  // Carregar Logos
  const torresLogoBase64 = getLocalImageBase64('logo_torres.png') ||
    getLocalImageBase64('logo.png') ||
    '/logo_torres.png';

  let clientLogoSrc = null;
  if (tenantConfig && tenantConfig.logo) {
    const cleanLogo = tenantConfig.logo.startsWith('/') ? tenantConfig.logo.substring(1) : tenantConfig.logo;
    clientLogoSrc = getLocalImageBase64(cleanLogo) || tenantConfig.logo;
  }

  const clientLogoHTML = clientLogoSrc ? `
    <img src="${clientLogoSrc}" alt="${tenantName}" class="header-client-logo" />
  ` : `
    <div class="header-client-text">${tenantName}</div>
  `;

  // Subtítulo dinâmico com base nos sistemas do cliente
  const dynamicSubtitle = buildDynamicSubtitle(tenantConfig, Array.from(allCategoriesSet), tenantName);

  // Data e hora de emissão
  const now = new Date();
  const dataEmissaoStr = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const horaEmissaoStr = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

  // Gerar SVGs dos gráficos da Página 1
  const donutChartHTML = generateDonutChartSVG(categoryCounts, totalChamados);
  const barChartHTML = generateBarChartSVG(statusCounts);

  // Gerar Módulos Executivos da Página 2
  const proactivityHTML = generateProactivityGaugeHTML(proactiveCount, reactiveCount, totalChamados);
  const requestersHTML = generateRequestersHorizontalBarsHTML(requestersList, totalChamados);
  const criticalityHTML = generateCriticalityMatrixHTML(critCounts, totalChamados);
  const backlogAgingHTML = generateBacklogAgingHTML(activeItems, now);

  // Renderizar Linhas da Tabela de Ordens de Serviço (Página 3 em diante)
  const tableRowsHTML = filtered.length > 0 ? filtered.map((item) => {
    const photos = item.resolvedPhotos || [];

    let photoGalleryHTML = '';
    if (photos.length > 0) {
      photoGalleryHTML = `
        <div class="os-photo-strip">
          ${photos.map((p) => `
            <div class="os-photo-item">
              <img src="${p.url}" alt="${p.label}" loading="lazy" />
              <span class="os-photo-tag">${p.label}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <tr class="table-activity-row">
        <td class="col-os">${item.os}</td>
        <td class="col-date">${item.dataFormatada}</td>
        <td class="col-title-desc">
          <div class="os-title">${item.titulo}</div>
          ${item.descricao ? `<div class="os-desc">${item.descricao}</div>` : ''}
        </td>
        <td class="col-cat">
          <span class="cat-pill">${item.categoria}</span>
        </td>
        <td class="col-crit">
          <span class="crit-badge ${item.criticidade.class}">${item.criticidade.label}</span>
        </td>
        <td class="col-status">
          <span class="status-pill status-${item.status.key}">${item.status.label}</span>
        </td>
        <td class="col-action">
          <div class="os-action-text">${item.resolucao || '<span class="text-muted">Ação de campo em andamento.</span>'}</div>
          ${photoGalleryHTML}
        </td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="7" class="empty-table-state">
        Nenhuma ordem de serviço corretiva registrada para a competência selecionada (${nomeMesStr} / ${ano}).
      </td>
    </tr>
  `;

  // Template HTML completo com estilo homologado A4 Paisagem
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Executivo de Ocorrências - ${tenantName} - ${nomeMesStr}/${ano}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600&display=swap');

    @page {
      size: A4 landscape;
      margin: 10mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      line-height: 1.4;
      font-size: 13px;
    }

    .report-wrapper {
      max-width: 1200px;
      margin: 0 auto;
      background: #ffffff;
    }

    /* ==========================================================================
       PÁGINA 1: PAINEL EXECUTIVO
       ========================================================================== */
    .page-container {
      background: #ffffff;
      padding: 10px 14px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .page-break {
      page-break-after: always;
      break-after: page;
    }

    /* Top Brand & Header */
    .header-top-row {
      display: grid;
      grid-template-columns: 180px 1fr 180px;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 16px;
    }

    .header-left {
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    .header-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 0 10px;
    }

    .header-right {
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .report-main-title {
      font-size: 21px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
      margin-bottom: 4px;
      text-align: center;
      line-height: 1.25;
    }

    .header-competence-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 4px;
    }

    .competence-badge {
      display: inline-block;
      padding: 3px 10px;
      background: #e0e7ff;
      color: #4338ca;
      font-size: 11px;
      font-weight: 700;
      border-radius: 4px;
    }

    .emitido-em {
      font-size: 10.5px;
      color: #94a3b8;
      font-weight: 500;
    }

    .header-torres-logo {
      height: 48px;
      max-width: 175px;
      object-fit: contain;
    }

    .header-client-logo {
      height: 48px;
      max-width: 175px;
      object-fit: contain;
    }

    .header-client-text {
      font-size: 14px;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      text-align: right;
    }

    /* ==========================================================================
       CARDS DE KPIS
       ========================================================================== */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 70px;
    }

    .kpi-card.kpi-total {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    .kpi-card.kpi-pendentes {
      background: #fef2f2;
      border-color: #fecaca;
    }
    .kpi-card.kpi-andamento {
      background: #fffbeb;
      border-color: #fde68a;
    }
    .kpi-card.kpi-aguardando {
      background: #f5f3ff;
      border-color: #ddd6fe;
    }
    .kpi-card.kpi-concluidas {
      background: #ecfdf5;
      border-color: #a7f3d0;
    }

    .kpi-label {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }

    .kpi-total .kpi-label { color: #475569; }
    .kpi-pendentes .kpi-label { color: #dc2626; }
    .kpi-andamento .kpi-label { color: #b45309; }
    .kpi-aguardando .kpi-label { color: #6d28d9; }
    .kpi-concluidas .kpi-label { color: #047857; }

    .kpi-val {
      font-size: 24px;
      font-weight: 800;
      line-height: 1;
    }

    .kpi-total .kpi-val { color: #0f172a; }
    .kpi-pendentes .kpi-val { color: #b91c1c; }
    .kpi-andamento .kpi-val { color: #b45309; }
    .kpi-aguardando .kpi-val { color: #6d28d9; }
    .kpi-concluidas .kpi-val { color: #047857; }

    /* ==========================================================================
       SEÇÃO DE GRÁFICOS (DASHBOARD)
       ========================================================================== */
    .charts-row {
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      gap: 12px;
      margin-bottom: 16px;
    }

    .chart-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      min-height: 235px;
      box-sizing: border-box;
    }

    .chart-header-title {
      font-size: 11px;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #e2e8f0;
    }

    /* Executive highlights strip */
    .highlights-row {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #0284c7;
      border-radius: 6px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      position: relative;
      z-index: 1;
    }

    .highlight-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .highlight-icon {
      font-size: 16px;
    }

    .highlight-text {
      font-size: 11px;
      color: #334155;
    }

    .highlight-text strong {
      color: #0f172a;
    }

    .highlight-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 700;
      background: #e0f2fe;
      color: #0369a1;
    }

    /* ==========================================================================
       PÁGINA 2: GOVERNANÇA, RANKING DE SOLICITANTES & GESTÃO DE RISCO
       ========================================================================== */
    .gov-row {
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .gov-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      min-height: 240px;
      box-sizing: border-box;
    }

    .aging-green { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .aging-yellow { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }
    .aging-orange { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
    .aging-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

    /* ==========================================================================
       PÁGINA 3 EM DIANTE: TABELA DE REGISTROS DE ATIVIDADES
       ========================================================================== */
    .table-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1.5px solid #0f172a;
    }

    .table-title {
      font-size: 12.5px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .table-subtitle {
      font-size: 10.5px;
      font-weight: 500;
      color: #64748b;
    }

    .activities-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    .activities-table thead {
      display: table-header-group;
    }

    .activities-table th {
      background-color: #f1f5f9;
      color: #475569;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 8px;
      text-align: left;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
    }

    .table-activity-row {
      border-bottom: 1px solid #e2e8f0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .table-activity-row:nth-child(even) {
      background-color: #fafafa;
    }

    .activities-table td {
      padding: 8px 8px;
      vertical-align: top;
      color: #1e293b;
    }

    .col-os {
      width: 80px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #0f172a;
      font-size: 11px;
      white-space: nowrap;
    }

    .col-date {
      width: 85px;
      color: #475569;
      font-weight: 500;
      white-space: nowrap;
    }

    .col-title-desc {
      width: 250px;
    }

    .os-title {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
      font-size: 11.5px;
    }

    .os-desc {
      font-size: 10px;
      color: #64748b;
      line-height: 1.35;
    }

    .col-cat {
      width: 75px;
      text-align: center;
    }

    .cat-pill {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #e2e8f0;
    }

    .col-crit {
      width: 85px;
      text-align: center;
    }

    .crit-badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: capitalize;
    }

    .criticidade-critico { background: #fee2e2; color: #991b1b; }
    .criticidade-alta { background: #ffedd5; color: #9a3412; }
    .criticidade-normal { background: #e0f2fe; color: #075985; }
    .criticidade-baixa { background: #f1f5f9; color: #475569; }

    .col-status {
      width: 110px;
      text-align: center;
    }

    .status-pill {
      display: inline-block;
      padding: 2.5px 8px;
      border-radius: 9999px;
      font-size: 9.5px;
      font-weight: 700;
      white-space: nowrap;
      border: 1px solid transparent;
    }

    .status-concluido {
      background: #ecfdf5;
      color: #047857;
      border-color: #a7f3d0;
    }

    .status-andamento {
      background: #fffbeb;
      color: #b45309;
      border-color: #fde68a;
    }

    .status-aguardando {
      background: #f5f3ff;
      color: #6d28d9;
      border-color: #ddd6fe;
    }

    .status-pendente {
      background: #fef2f2;
      color: #b91c1c;
      border-color: #fecaca;
    }

    .col-action {
      font-size: 10.5px;
      color: #334155;
      line-height: 1.4;
    }

    .os-action-text {
      margin-bottom: 4px;
    }

    .text-muted {
      color: #94a3b8;
      font-style: italic;
    }

    /* Galeria de Fotos / Evidências na Linha */
    .os-photo-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 5px;
      padding-top: 4px;
    }

    .os-photo-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 68px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      background: #ffffff;
      padding: 2px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .os-photo-item img {
      width: 64px;
      height: 48px;
      object-fit: cover;
      border-radius: 2px;
    }

    .os-photo-tag {
      font-size: 8px;
      font-weight: 600;
      color: #64748b;
      margin-top: 2px;
      text-align: center;
      line-height: 1.15;
      max-width: 64px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .empty-table-state {
      padding: 40px 10px;
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
      font-style: italic;
    }

    /* ==========================================================================
       RODAPÉ
       ========================================================================== */
    .report-footer {
      margin-top: auto;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9.5px;
      color: #94a3b8;
    }

    .footer-left strong {
      color: #64748b;
    }

    .footer-right strong {
      color: #64748b;
    }

    /* Ajustes específicos de impressão */
    @media print {
      body {
        background: #ffffff;
      }
      .page-container {
        padding: 0;
        min-height: auto;
      }
      .page-break {
        page-break-after: always;
      }
      .os-photo-item {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="report-wrapper">
    <!-- ==================================================================== -->
    <!-- PÁGINA 1: PAINEL EXECUTIVO & GRÁFICOS                                 -->
    <!-- ==================================================================== -->
    <div class="page-container page-break">
      <!-- Cabeçalho -->
      <div class="header-top-row">
        <div class="header-left">
          <img src="${torresLogoBase64}" alt="TorresCx" class="header-torres-logo" />
        </div>

        <div class="header-center">
          <h1 class="report-main-title">Relatório Executivo de Ocorrências & Chamados de Manutenção</h1>
          <div class="header-competence-row">
            <span class="competence-badge">Competência: ${nomeMesStr} / ${ano}</span>
            <span class="emitido-em">Painel Consolidado de Engenharia</span>
          </div>
        </div>

        <div class="header-right">
          ${clientLogoHTML}
        </div>
      </div>

      <!-- Linha de KPIs (5 Cards) -->
      <div class="kpi-row">
        <div class="kpi-card kpi-total">
          <span class="kpi-label">Total de Chamados</span>
          <span class="kpi-val">${totalChamados}</span>
        </div>
        <div class="kpi-card kpi-pendentes">
          <span class="kpi-label">Pendentes</span>
          <span class="kpi-val">${statusCounts.pendente}</span>
        </div>
        <div class="kpi-card kpi-andamento">
          <span class="kpi-label">Em Andamento</span>
          <span class="kpi-val">${statusCounts.andamento}</span>
        </div>
        <div class="kpi-card kpi-aguardando">
          <span class="kpi-label">Aguardando Peça</span>
          <span class="kpi-val">${statusCounts.aguardando}</span>
        </div>
        <div class="kpi-card kpi-concluidas">
          <span class="kpi-label">Concluídas</span>
          <span class="kpi-val">${statusCounts.concluido}</span>
        </div>
      </div>

      <!-- Seção de Gráficos (SVG Vetorial) -->
      <div class="charts-row">
        <div class="chart-container">
          <div class="chart-header-title">Volume por Categoria de Ativos</div>
          ${donutChartHTML}
        </div>
        <div class="chart-container">
          <div class="chart-header-title">Distribuição de Status Operacional</div>
          ${barChartHTML}
        </div>
      </div>

      <!-- Faixa de Destaques Executivos -->
      <div class="highlights-row">
        <div class="highlight-item">
          <span class="highlight-icon">🎯</span>
          <span class="highlight-text">
            Taxa de Resolução no Período: <strong>${taxaResolucao}%</strong>
            (${statusCounts.concluido} de ${totalChamados} chamados concluídos)
          </span>
        </div>
        <div class="highlight-item">
          <span class="highlight-icon">⏱️</span>
          <span class="highlight-text">
            Chamados Ativos em Acompanhamento: <strong>${statusCounts.pendente + statusCounts.andamento + statusCounts.aguardando}</strong>
          </span>
        </div>
        <div>
          <span class="highlight-badge">Painel Consolidado de Engenharia</span>
        </div>
      </div>

      <!-- Rodapé da Página 1 -->
      <div class="report-footer">
        <div class="footer-left">
          <strong>TorresCx</strong> — Gestão Inteligente e Manutenção Especializada
        </div>
        <div class="footer-right">
          <strong>${tenantName}</strong> — Engenharia Predial
        </div>
      </div>
    </div>

    <!-- ==================================================================== -->
    <!-- PÁGINA 2: GOVERNANÇA, RANKING DE SOLICITANTES & GESTÃO DE RISCO       -->
    <!-- ==================================================================== -->
    <div class="page-container page-break">
      <!-- Cabeçalho -->
      <div class="header-top-row">
        <div class="header-left">
          <img src="${torresLogoBase64}" alt="TorresCx" class="header-torres-logo" />
        </div>
        <div class="header-center">
          <h1 class="report-main-title">Relatório Executivo de Ocorrências & Chamados de Manutenção</h1>
          <div class="header-competence-row">
            <span class="competence-badge">Competência: ${nomeMesStr} / ${ano}</span>
            <span class="emitido-em">Painel de Governança, Solicitantes & Matriz de Risco</span>
          </div>
        </div>
        <div class="header-right">
          ${clientLogoHTML}
        </div>
      </div>

      <!-- Bloco 1: Proatividade vs Reatividade e Ranking de Solicitantes -->
      <div class="gov-row">
        <div class="gov-container">
          <div class="chart-header-title">Origem das Demandas: Proatividade vs. Reatividade</div>
          ${proactivityHTML}
        </div>
        <div class="gov-container">
          <div class="chart-header-title">Ranking de Demandas por Solicitante ("Quem Mais Solicita")</div>
          ${requestersHTML}
        </div>
      </div>

      <!-- Bloco 2: Matriz de Criticidade e Aging do Backlog Ativo -->
      <div class="gov-row">
        <div class="gov-container">
          <div class="chart-header-title">Matriz de Criticidade Operacional & Controle de Risco</div>
          ${criticalityHTML}
        </div>
        <div class="gov-container">
          <div class="chart-header-title">Aging do Backlog Ativo (Idade dos Chamados em Aberto)</div>
          ${backlogAgingHTML}
        </div>
      </div>

      <!-- Rodapé da Página 2 -->
      <div class="report-footer">
        <div class="footer-left">
          <strong>TorresCx</strong> — Gestão Inteligente e Manutenção Especializada
        </div>
        <div class="footer-right">
          <strong>${tenantName}</strong> — Engenharia Predial
        </div>
      </div>
    </div>

    <!-- ==================================================================== -->
    <!-- PÁGINA 3 EM DIANTE: REGISTROS DAS ATIVIDADES                          -->
    <!-- ==================================================================== -->
    <div class="page-container">
      <!-- Cabeçalho compacto para continuação -->
      <div class="header-top-row" style="margin-bottom: 10px; padding-bottom: 8px;">
        <div class="header-left">
          <img src="${torresLogoBase64}" alt="TorresCx" class="header-torres-logo" style="height: 38px;" />
        </div>
        <div class="header-center">
          <h2 style="font-size: 16px; font-weight: 800; color: #0f172a;">
            Relação Consolidada de Ordens de Serviço (${totalChamados})
          </h2>
          <div class="header-competence-row" style="margin-top: 2px;">
            <span class="competence-badge">Competência: ${nomeMesStr} / ${ano}</span>
            <span class="emitido-em">${tenantName} — Detalhamento Operacional</span>
          </div>
        </div>
        <div class="header-right">
          ${clientLogoHTML}
        </div>
      </div>

      <!-- Título da Tabela -->
      <div class="table-section-header">
        <span class="table-title">Registros Detalhados de Campo</span>
        <span class="table-subtitle">Classificação cronológica decrescente • Registros fotográficos anexados</span>
      </div>

      <!-- Tabela -->
      <table class="activities-table">
        <thead>
          <tr>
            <th class="col-os">OS</th>
            <th class="col-date">Data</th>
            <th class="col-title-desc">Título / Ativo</th>
            <th class="col-cat">Categoria</th>
            <th class="col-crit">Criticidade</th>
            <th class="col-status">Status</th>
            <th class="col-action">Ação / Resolução & Evidências</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHTML}
        </tbody>
      </table>

      <!-- Rodapé da Página de Atividades -->
      <div class="report-footer" style="margin-top: 20px;">
        <div class="footer-left">
          <strong>TorresCx</strong> — Gestão Inteligente e Manutenção Especializada
        </div>
        <div class="footer-right">
          <strong>${tenantName}</strong> — Engenharia Predial
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  generateMonthlyCorretivasReport,
};
