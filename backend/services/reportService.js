/**
 * reportService.js — Serviço de Geração do Relatório Técnico de Preventivas
 *
 * Coleta dados do Microsoft Lists (Histórico + Corretivas), realiza o cruzamento dos pontos,
 * calcula os KPIs de performance e interpola o template HTML homologado (modelo_preventiva.html).
 */

const fs = require('fs');
const path = require('path');
const { downloadExcelViaGraph, parseMatrizMestra } = require('./matrizMestraService');

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
    ];
    for (const fullPath of candidates) {
      if (fs.existsSync(fullPath)) {
        const buffer = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).substring(1) || 'png';
        return `data:image/${ext};base64,${buffer.toString('base64')}`;
      }
    }
  } catch (err) {
    console.warn(`⚠️ [ReportService] Erro ao carregar imagem local (${relativePath}):`, err.message);
  }
  return null;
}

/**
 * Normaliza e parseia um campo de imagem vindo do SharePoint / Graph API
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

/**
 * Resolve o Site ID e List ID do SharePoint
 */
async function resolveSharePointIds(graphClient, targetListName) {
  const { SHAREPOINT_HOSTNAME, SHAREPOINT_SITE_PATH } = process.env;

  if (!SHAREPOINT_HOSTNAME || !SHAREPOINT_SITE_PATH || !targetListName) {
    throw new Error('⚠️ Variáveis SharePoint não configuradas ou nome da lista ausente.');
  }

  const site = await graphClient
    .api(`/sites/${SHAREPOINT_HOSTNAME}:${SHAREPOINT_SITE_PATH}`)
    .get();

  const allLists = await graphClient
    .api(`/sites/${site.id}/lists`)
    .get();

  const found = (allLists.value || []).find(
    (l) => l.displayName === targetListName || l.name === targetListName
  );

  if (!found) {
    throw new Error(`Lista "${targetListName}" não encontrada no SharePoint.`);
  }

  return { siteId: site.id, listId: found.id };
}

/**
 * Busca histórico de preventivas da lista Microsoft Lists
 */
async function fetchPreventiveHistory(graphClient, tenantConfig, mes, ano) {
  const listName = tenantConfig.listaHistoricoPreventivas;
  if (!listName) return [];

  const { siteId, listId } = await resolveSharePointIds(graphClient, listName);

  // Buscar itens
  const res = await graphClient
    .api(`/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=999`)
    .get();

  const items = res.value || [];

  // Filtrar por Mês e Ano de Execução
  const filtered = items.filter((item) => {
    const fields = item.fields || {};
    const dateStr = fields.Data_Execucao || fields.Created;
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date.getMonth() + 1 === Number(mes) && date.getFullYear() === Number(ano);
  });

  return filtered.map((item) => {
    const f = item.fields || {};

    let logChecklist = [];
    if (f.Log_Checklist) {
      if (typeof f.Log_Checklist === 'string') {
        try {
          logChecklist = JSON.parse(f.Log_Checklist);
        } catch (e) {
          console.warn('⚠️ [ReportService] Erro ao parsear Log_Checklist:', e.message);
        }
      } else if (Array.isArray(f.Log_Checklist)) {
        logChecklist = f.Log_Checklist;
      }
    }

    const statusPonto = f.Status_Ponto || f.Status_Inspecao || 'Funcionando';

    // Format Data Execução (DD/MM/YYYY)
    let dataExecucao = '-';
    if (f.Data_Execucao) {
      const d = new Date(f.Data_Execucao);
      dataExecucao = isNaN(d.getTime()) ? f.Data_Execucao : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    }

    const horaInicio = f.Horario_Inicio || f.Hora_Inicio || '-';
    const horaFim = f.Horario_Termino || f.Hora_Fim || '-';
    let tempoTotal = f.Total_Horas || '-';
    if (tempoTotal === '-' && horaInicio !== '-' && horaFim !== '-') {
      tempoTotal = `${horaInicio} às ${horaFim}`;
    }

    return {
      id: item.id,
      tag: f.Title || f.TAG || 'TAG-N/A',
      descricao: f.Localizacao || f.Descricao || f.Tipo_Dispositivo || 'Dispositivo de Incêndio',
      statusPonto,
      dataExecucao,
      horaInicio,
      horaFim,
      tempoTotal,
      executor: f.Tecnico_Responsavel || f.Executor || 'Técnico TorresCx',
      logChecklist,
      foto1Url: parseImageField(f.Imagem_1 || f.Foto_1_URL),
      foto2Url: parseImageField(f.Imagem_2 || f.Foto_2_URL),
      osVinculadaId: f.OS_Vinculada || f.OS_Vinculada_ID || '',
      observacoes: f.Observacoes_Gerais || f.Observacoes || '',
    };
  });
}

let _cachedSiteId = null;
const _listIdCache = new Map();
const _columnMapCache = new Map();

/**
 * Mapeia dinamicamente as colunas da lista de Corretivas no SharePoint
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
    });

    columns.forEach((col) => {
      const disp = (col.displayName || '').toLowerCase().trim();
      const name = col.name;

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
      if (name === 'field_5' || disp === 'prioridade') {
        mapping.prioridade = name;
      }
      if (name === 'field_6' || disp === 'status') {
        mapping.status = name;
      }
      if (name === 'field_7' || disp.includes('data relatada') || disp.includes('data de abertura') || disp.includes('data abertura')) {
        mapping.dataRelatada = name;
      }

      // DATA DE ATENDIMENTO
      if (!disp.includes('resolução') && !disp.includes('resolucao') && !disp.includes('parecer') && !disp.includes('problema')) {
        if (
          disp.includes('atendimento') ||
          disp.includes('conclusão') ||
          disp.includes('conclusao') ||
          disp === 'data da solução' ||
          disp === 'data de solução' ||
          name === 'field_8' ||
          name === 'Data_Atendimento' ||
          name === 'Data_x0020_de_x0020_Atendimento'
        ) {
          mapping.dataAtendimento = name;
        }
      }

      // RESOLUÇÃO DO PROBLEMA
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

    // Fallbacks padrão se não mapeados
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
    console.warn('⚠️ [ReportService] Falha ao inspecionar colunas:', err.message);
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
 * Busca ordens corretivas vinculadas
 */
async function fetchCorretivas(graphClient, tenantConfig) {
  const listName = tenantConfig.listaCorretivas;
  if (!listName) return new Map();

  try {
    const { siteId, listId } = await resolveSharePointIds(graphClient, listName);
    const colMap = await getListColumnMapping(graphClient, siteId, listId, listName);

    const res = await graphClient
      .api(`/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=999`)
      .get();

    const items = res.value || [];
    const map = new Map();

    items.forEach((item) => {
      const f = item.fields || {};
      const osId = String((colMap.osNumber && f[colMap.osNumber] != null) ? f[colMap.osNumber] : (f.field_0 || item.id || ''));
      const status = (colMap.status && f[colMap.status]) || f.field_6 || f.Status || 'PENDENTE';
      const prioridade = (colMap.prioridade && f[colMap.prioridade]) || f.field_5 || f.Prioridade || 'Normal';

      // Descrição do Problema
      const descricaoDefeito = (colMap.descricao && f[colMap.descricao] != null)
        ? String(f[colMap.descricao]).trim()
        : (f.field_4 || f.Descricao_do_Problema || f.Descricao || f.Title || '');

      // Resolução do Problema (estritamente do List)
      let resolucao = (colMap.resolucao && f[colMap.resolucao] != null)
        ? String(f[colMap.resolucao]).trim()
        : (f.field_9 || f.Resolucao_do_Problema || f.Parecer_Tecnico || '');

      // Se for apenas um timestamp ISO de data, descarta
      if (typeof resolucao === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(resolucao.trim())) {
        resolucao = '';
      }

      const fotoResolucaoUrl = parseImageField((colMap.imagem3 && f[colMap.imagem3]) || f.Imagem_3 || f.Imagem_1 || f.Foto_Resolucao_URL);

      map.set(osId, {
        id: osId,
        status,
        prioridade,
        descricaoDefeito,
        resolucao: (typeof resolucao === 'string') ? resolucao.trim() : '',
        fotoResolucaoUrl,
      });
    });

    return map;
  } catch (err) {
    console.warn('⚠️ [ReportService] Falha ao buscar lista de corretivas:', err.message);
    return new Map();
  }
}

/**
 * Busca Matriz Mestra completa do tenant para conciliação de rotinas e passivos
 */
async function fetchMatrizMestra(accessToken, tenantConfig) {
  if (!tenantConfig.excelPreventivasUrl) {
    return [];
  }

  try {
    const { buffer } = await downloadExcelViaGraph(accessToken, tenantConfig.excelPreventivasUrl);
    const { dispositivos } = parseMatrizMestra(buffer);
    return dispositivos || [];
  } catch (err) {
    console.warn('⚠️ [ReportService] Não foi possível carregar a Matriz Mestra:', err.message);
    return [];
  }
}

/**
 * Gera a string HTML completa do relatório com base no modelo_preventiva.html homologado
 */
function generateHTMLReport({ tenantName, tenantConfig, mes, ano, sistema = 'sdai', kpis, history, corretivasMap }) {
  const nomeMesStr = NOME_MESES[Number(mes)] || mes;
  const sistemaUpper = String(sistema || 'sdai').toUpperCase();
  const dataEmissaoStr = new Date().toLocaleDateString('pt-BR');

  const SISTEMAS_MAP = {
    SDAI: 'Sistema de Detecção e Alarme de Incêndio',
    BMS: 'Sistema de Gerenciamento Predial',
    SCA: 'Sistema de Controle de Acesso',
  };
  const sistemaCompleto = SISTEMAS_MAP[sistemaUpper] || `Sistema de ${sistemaUpper}`;

  // Torres Logo (Fixo)
  const torresLogoBase64 = getLocalImageBase64('../../docs/logo_torres.png') ||
                           getLocalImageBase64('../../../docs/logo_torres.png') ||
                           getLocalImageBase64('../../frontend/public/logo.png') ||
                           '/logo.png';

  // Client Logo (Dinâmico por cliente/tenant)
  let clientLogoSrc = null;
  if (tenantConfig && tenantConfig.logo) {
    const cleanLogoPath = tenantConfig.logo.startsWith('/') ? tenantConfig.logo.substring(1) : tenantConfig.logo;
    clientLogoSrc = getLocalImageBase64(`../../frontend/public/${cleanLogoPath}`) ||
                    getLocalImageBase64(`../../docs/${cleanLogoPath}`) ||
                    tenantConfig.logo;
  }

  const clientLogoCoverHTML = clientLogoSrc ? `
    <img src="${clientLogoSrc}" alt="${tenantName}" class="cover-client-logo">
  ` : `
    <div class="cover-client-text-fallback">${tenantName}</div>
  `;

  // Renderizar Cartões de Dispositivos
  const deviceCardsHTML = history.length > 0 ? history.map((dev) => {
    const isNormal = dev.statusPonto.toLowerCase().includes('funcionando') || dev.statusPonto.toLowerCase() === 'normal';
    const badgeClass = isNormal ? 'exact-badge success' : 'exact-badge';
    const badgeText = isNormal ? 'Funcionando' : dev.statusPonto;

    // Checklist Rows — Usa a propriedade "atividade" vinda do JSON de Log_Checklist
    let checklistRowsHTML = '';
    if (dev.logChecklist.length > 0) {
      checklistRowsHTML = dev.logChecklist.map((chk) => {
        const itemDesc = chk.atividade || chk.item || chk.descricao || chk.pergunta || chk.nome || 'Item de Verificação';
        const st = String(chk.status || chk.resposta || '').toLowerCase();
        const isSim = st === 'sim' || st === 's' || st === 'true' || st === 'ok';

        return `
          <tr>
            <td>${itemDesc}</td>
            <td class="exact-table td status-col ${isSim ? 'sim' : 'nao'}">${isSim ? '✓ SIM' : '✖ NÃO'}</td>
          </tr>
        `;
      }).join('');
    } else if (dev.statusPonto.toLowerCase().includes('sem acesso')) {
      checklistRowsHTML = `
        <tr>
          <td>Acesso físico ao local e dispositivo</td>
          <td class="exact-table td status-col nao">✖ NÃO</td>
        </tr>
      `;
    } else {
      checklistRowsHTML = `
        <tr>
          <td colspan="2" style="color: #94a3b8; font-style: italic;">Inspeção validada no cronograma da Matriz Mestra.</td>
        </tr>
      `;
    }

    // Fotos
    // Fotos dinâmicas (renderiza apenas fotos existentes, sem placeholders vazios)
    const photos = [];
    if (dev.foto1Url) {
      photos.push({
        url: dev.foto1Url,
        label: 'Foto 1: Registro de Inspeção',
      });
    }
    if (dev.foto2Url) {
      photos.push({
        url: dev.foto2Url,
        label: 'Foto 2: Registro de Inspeção',
      });
    }

    let photosColumnHTML = '';
    const bodyGridClass = photos.length === 0 ? 'exact-body-grid no-photos' : 'exact-body-grid';

    if (photos.length > 0) {
      const columnClass = photos.length === 1 ? 'exact-photo-column single-photo' : 'exact-photo-column two-photos';
      const photosHTML = photos.map((p) => `
        <div class="exact-photo-wrapper">
          <img src="${p.url}" alt="${p.label}">
          <div class="exact-photo-footer-bar">${p.label}</div>
        </div>
      `).join('');

      photosColumnHTML = `
        <div class="${columnClass}">
          ${photosHTML}
        </div>
      `;
    }

    // Alert box se houver OS / Falha
    let osBoxHTML = '';
    if (!isNormal || dev.osVinculadaId) {
      const osData = dev.osVinculadaId ? corretivasMap.get(String(dev.osVinculadaId)) : null;
      const osStatusText = osData ? osData.status : 'PENDENTE';
      const osIdText = dev.osVinculadaId ? `OS Nº ${dev.osVinculadaId}` : 'OS em Acompanhamento';

      osBoxHTML = `
        <div class="exact-dashed-alert-box" style="margin-top: 10px;">
          <div class="left-info">
            ⚠️ <strong>Ação Corretiva Vinculada:</strong> ${osIdText} registrada no sistema para esta ocorrência.
          </div>
          <div class="right-status">Status OS: ${osStatusText.toUpperCase()}</div>
        </div>
      `;
    }

    const isAtrasadoBadge = dev.isAtrasado ? `
      <div class="exact-badge" style="background-color: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; font-size: 11px;">
        Recuperação (${dev.mesProgramadoNome || 'Mês Anterior'})
      </div>
    ` : '';

    return `
      <div class="device-card-exact">
        <div class="exact-header">
          <h2>TAG: ${dev.tag} <span>- ${dev.descricao}</span></h2>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${isAtrasadoBadge}
            <div class="${badgeClass}">${badgeText}</div>
          </div>
        </div>

        <div class="exact-meta-row">
          <span>Data Execução: <strong>${dev.dataExecucao}</strong></span>
          <span>Período: <strong>${dev.horaInicio} às ${dev.horaFim}</strong></span>
          <span>Tempo total: <strong>${dev.tempoTotal}</strong></span>
          <span>Executor: <strong>${dev.executor}</strong></span>
        </div>

        <div class="${bodyGridClass}">
          <!-- Checklist -->
          <div>
            <div class="exact-section-subtitle">Itens de Verificação Normativa</div>
            <table class="exact-table">
              ${checklistRowsHTML}
            </table>
          </div>

          <!-- Fotos (se houver) -->
          ${photosColumnHTML}
        </div>

        <!-- Footer do Card -->
        <div class="exact-card-footer">
          <div class="exact-obs-line">
            <strong>Observações de Campo:</strong> ${dev.observacoes || 'Sem observações adicionais.'}
          </div>
          ${osBoxHTML}
        </div>
      </div>
    `;
  }).join('') : `
    <div style="background: #ffffff; border: 1px dashed #cbd5e1; padding: 40px; text-align: center; color: #64748b; margin-bottom: 30px;">
      Nenhuma inspeção de preventiva registrada para o período selecionado (${nomeMesStr} / ${ano}).
    </div>
  `;

  // Renderizar Seção de Rastreabilidade Avançada (Apenas defeitos / sem acesso)
  const defectItems = history.filter((dev) => {
    const st = dev.statusPonto.toLowerCase();
    return st.includes('defeito') || st.includes('sem acesso') || st.includes('falha') || !!dev.osVinculadaId;
  });

  const trackingCardsHTML = defectItems.length > 0 ? defectItems.map((dev) => {
    const isSemAcesso = dev.statusPonto.toLowerCase().includes('sem acesso');
    const boxClass = isSemAcesso ? 'tracking-section-box sem-acesso' : 'tracking-section-box defeito';
    const badgeStyle = isSemAcesso ? 'background-color:#fee2e2; color:#7f1d1d;' : 'background-color:#fef3c7; color:#78350f;';

    const osData = dev.osVinculadaId ? corretivasMap.get(String(dev.osVinculadaId)) : null;
    const osNumText = dev.osVinculadaId || 'N/A';
    const osPrioridadeText = osData?.prioridade || 'Normal';
    const osStatusText = osData?.status || 'PENDENTE';

    // Relato técnico em campo: usa "Descrição do problema" do List de corretivas
    const relatoTecnicoEmCampo = osData?.descricaoDefeito || dev.observacoes || 'Registro de Não-Conformidade na inspeção.';

    // Status do checklist: extrai qual(is) item(ns) do checklist falhou(aram) na inspeção
    const failedChecklistItems = (dev.logChecklist || [])
      .filter((chk) => {
        const st = String(chk.status || chk.resposta || '').toLowerCase();
        return st === 'nao' || st === 'não' || st === 'false';
      })
      .map((chk) => chk.atividade || chk.item || chk.descricao || chk.pergunta || chk.nome)
      .filter(Boolean);

    let statusDoChecklist = '';
    if (isSemAcesso) {
      statusDoChecklist = 'Atividades não executadas devido a restrição de acesso ao local.';
    } else if (failedChecklistItems.length > 0) {
      statusDoChecklist = failedChecklistItems.join(', ');
    } else {
      statusDoChecklist = 'Pendência/Restrição identificada durante a verificação preventiva.';
    }

    // Resolução do problema: estritamente fiel ao List.
    // Se tiver texto no List, coloca exatamente o texto do List. Se não tiver texto, não coloca nada.
    const osFeedbackHTML = (osData?.resolucao && osData.resolucao.trim().length > 0) ? `
      <div class="track-os-feedback">
        "${osData.resolucao}"
      </div>
    ` : '';

    const isOsConcluida = osStatusText.toUpperCase() === 'CONCLUÍDA' || osStatusText.toUpperCase() === 'CONCLUIDA';

    const osPhotoHTML = osData?.fotoResolucaoUrl ? `
      <div class="track-os-photo">
        <img src="${osData.fotoResolucaoUrl}" alt="Resolução OS">
      </div>
    ` : `
      <div class="track-os-photo-placeholder">
        Foto da resolução pendente
      </div>
    `;

    return `
      <div class="${boxClass}">
        <div class="tracking-header-area">
          <div class="issue-title-area">
            <div class="track-dev-name">${dev.tag} - ${dev.descricao}</div>
            <div class="track-dev-date">Inspeção realizada em ${dev.dataExecucao} às ${dev.horaInicio}</div>
          </div>
          <span class="exact-badge" style="${badgeStyle}">${dev.statusPonto}</span>
        </div>
        <div class="tracking-split-grid">
          <div class="track-report-text">
            <p><strong>Relato Técnico em Campo:</strong> ${relatoTecnicoEmCampo}</p>
            <p><strong>Status do Checklist:</strong> ${statusDoChecklist}</p>
          </div>

          <div class="track-linked-os-card">
            <div class="track-os-details">
              <div class="track-os-title">⚙️ Ordem de Serviço Vinculada</div>
              <p style="margin-top: 2px;"><strong>OS Nº:</strong> ${osNumText} (Prioridade: ${osPrioridadeText})</p>
              <p><strong>Status Atual:</strong> <span class="exact-badge ${isOsConcluida ? 'success' : ''}" style="padding:2px 6px; font-size:9px;">${osStatusText}</span></p>
              ${osFeedbackHTML}
            </div>
            ${osPhotoHTML}
          </div>
        </div>
      </div>
    `;
  }).join('') : `
    <div style="background: #ffffff; border: 1px dashed #cbd5e1; padding: 25px; text-align: center; color: #64748b; margin-bottom: 20px;">
      Nenhuma ocorrência técnica ou ponto com não-conformidade registrado no período.
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Torres Cx - Relatório Técnico de Manutenção</title>
    <style>
        :root {
            --primary-red: #cc0000;
            --dark-blue: #1e293b;
            --accent-blue: #60a5fa;
            --text-main: #334155;
            --border-light: #e2e8f0;
            --success-green: #16a34a;
            --danger-red: #dc2626;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Arial, sans-serif;
        }

        body {
            background-color: #e2e8f0;
            color: var(--text-main);
            padding: 30px 15px;
        }

        .report-container {
            width: 100%;
            max-width: 1000px;
            background: #ffffff;
            margin: 0 auto;
            padding: 40px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            border-radius: 4px;
        }

        /* CAPA DE RELATÓRIO HOMOLOGADA */
        .cover-page-wrapper {
            position: relative;
            border-left: 5px solid #1d4ed8;
            padding-left: 35px;
            padding-top: 10px;
            padding-bottom: 20px;
            min-height: 980px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-after: always;
            margin-bottom: 40px;
        }

        .cover-top-header {
            text-align: center;
            padding-top: 15px;
            padding-bottom: 20px;
        }

        .cover-torres-logo {
            height: 75px;
            max-width: 280px;
            object-fit: contain;
            display: inline-block;
        }

        .cover-header-divider {
            width: 100%;
            height: 1px;
            background-color: #e2e8f0;
            margin-top: 20px;
            margin-bottom: 45px;
        }

        .cover-title-section {
            margin-top: 70px;
            margin-bottom: 45px;
        }

        .cover-main-title {
            font-size: 26px;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.35;
            margin-bottom: 25px;
            letter-spacing: -0.3px;
        }

        .cover-competence {
            font-size: 16px;
            color: #000000;
            margin-top: 20px;
        }

        .cover-competence strong {
            color: #000000;
            font-weight: 800;
        }

        .cover-client-logo-section {
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 35px 0 50px 0;
            min-height: 140px;
        }

        .cover-client-logo {
            max-height: 120px;
            max-width: 320px;
            object-fit: contain;
            display: block;
        }

        .cover-client-text-fallback {
            font-size: 24px;
            font-weight: 800;
            color: #1e293b;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* CARD DE METADADOS DA CAPA */
        .cover-meta-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 24px 28px;
            background: #ffffff;
            margin-top: auto;
        }

        .cover-meta-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .meta-card-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #000000;
        }

        .meta-card-val-main {
            font-size: 16px;
            font-weight: 800;
            color: #000000;
        }

        .meta-card-val {
            font-size: 14px;
            font-weight: 800;
            color: #000000;
        }

        .cover-meta-divider {
            height: 1px;
            border-bottom: 1px dashed #cbd5e1;
            margin: 16px 0;
        }

        .cover-meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 16px;
        }

        .section-title {
            font-size: 15px;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--dark-blue);
            margin: 35px 0 15px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .section-title::after {
            content: '';
            flex: 1;
            height: 1px;
            background-color: var(--border-light);
        }

        /* Indicadores Iniciais */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 20px;
        }

        .kpi-grid.kpi-grid-3 {
            grid-template-columns: repeat(3, 1fr);
        }

        .kpi-card {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 20px 10px;
            text-align: center;
        }

        .kpi-value {
            font-size: 32px;
            font-weight: 700;
            color: var(--dark-blue);
        }

        .kpi-value.color-green {
            color: #15803d;
        }

        .kpi-value.color-blue {
            color: #1d4ed8;
        }

        .kpi-value.color-amber {
            color: #b45309;
        }

        .kpi-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: #64748b;
            margin-top: 10px;
        }

        /* ESTRUTURA DO CARD DE DISPOSITIVO */
        .device-card-exact {
            border: 1px solid #cbd5e1;
            background: #ffffff;
            margin-bottom: 30px;
            page-break-inside: avoid;
        }

        .exact-header {
            background-color: var(--dark-blue);
            color: #ffffff;
            padding: 14px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .exact-header h2 {
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        .exact-header h2 span {
            color: var(--accent-blue);
            font-weight: 400;
            margin-left: 12px;
        }

        .exact-badge {
            background-color: #fef3c7;
            color: #78350f;
            padding: 5px 14px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .exact-badge.success {
            background-color: #dcfce7;
            color: #14532d;
        }

        .exact-meta-row {
            padding: 12px 20px;
            border-bottom: 1px solid var(--border-light);
            display: flex;
            gap: 30px;
            font-size: 13px;
            color: #475569;
        }

        .exact-meta-row span strong {
            color: #000000;
            font-weight: 600;
        }

        .exact-body-grid {
            display: grid;
            grid-template-columns: 1.25fr 1fr;
            gap: 30px;
            padding: 20px;
        }

        .exact-body-grid.no-photos {
            grid-template-columns: 1fr;
        }

        .exact-section-subtitle {
            font-size: 14px;
            font-weight: 700;
            color: var(--dark-blue);
            text-transform: uppercase;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-light);
            margin-bottom: 12px;
            letter-spacing: 0.5px;
        }

        .exact-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .exact-table td {
            padding: 9px 0;
            color: #334155;
            border-bottom: 1px solid #f1f5f9;
        }

        .exact-table td.status-col {
            text-align: right;
            font-weight: 700;
            white-space: nowrap;
            width: 80px;
        }

        .exact-table td.status-col.sim {
            color: var(--success-green);
        }

        .exact-table td.status-col.nao {
            color: var(--danger-red);
        }

        /* Galeria de Fotos */
        .exact-photo-column {
            display: flex;
            flex-direction: column;
            gap: 15px;
            height: 100%;
        }

        .exact-photo-wrapper {
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            overflow: hidden;
            background: #f8fafc;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .exact-photo-column.two-photos .exact-photo-wrapper {
            height: 175px;
        }

        .exact-photo-column.two-photos .exact-photo-wrapper img {
            width: 100%;
            height: 145px;
            object-fit: contain;
            background-color: #f1f5f9;
            display: block;
        }

        .exact-photo-column.single-photo .exact-photo-wrapper {
            height: 100%;
            min-height: 220px;
            max-height: 365px;
        }

        .exact-photo-column.single-photo .exact-photo-wrapper img {
            width: 100%;
            height: 100%;
            min-height: 190px;
            max-height: 335px;
            object-fit: contain;
            background-color: #f1f5f9;
            display: block;
        }

        .exact-photo-footer-bar {
            background-color: var(--dark-blue);
            color: #ffffff;
            font-size: 11px;
            padding: 6px 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Base do Card */
        .exact-card-footer {
            border-top: 1px solid var(--border-light);
            padding: 15px 20px;
            font-size: 13px;
        }

        .exact-obs-line {
            margin-bottom: 12px;
            color: #0f172a;
            line-height: 1.4;
        }

        .exact-dashed-alert-box {
            border: 1px dashed #f87171;
            background-color: #fff5f5;
            border-radius: 4px;
            padding: 10px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .exact-dashed-alert-box .left-info {
            color: #991b1b;
        }

        .exact-dashed-alert-box .left-info strong {
            font-weight: 700;
        }

        .exact-dashed-alert-box .right-status {
            color: #dc2626;
            font-weight: 700;
            text-transform: uppercase;
        }

        /* SEÇÃO FINAL: RASTREABILIDADE AVANÇADA */
        .tracking-section-box {
            border: 1px solid #cbd5e1;
            padding: 20px;
            margin-bottom: 20px;
            background: #ffffff;
            page-break-inside: avoid;
        }

        .tracking-section-box.defeito {
            border-left: 4px solid #ea580c;
        }

        .tracking-section-box.sem-acesso {
            border-left: 4px solid var(--danger-red);
        }

        .tracking-header-area {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
        }

        .track-dev-name {
            font-size: 14px;
            font-weight: 700;
            color: var(--dark-blue);
        }

        .track-dev-date {
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
        }

        .tracking-split-grid {
            display: grid;
            grid-template-columns: 1.2fr 1.3fr;
            gap: 20px;
        }

        .track-report-text p {
            font-size: 13px;
            margin-bottom: 10px;
            line-height: 1.4;
        }

        .track-linked-os-card {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 14px;
            font-size: 12px;
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 15px;
            align-items: start;
        }

        .track-os-details {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .track-os-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: var(--dark-blue);
        }

        .track-os-feedback {
            color: #475569;
            font-style: italic;
            border-top: 1px solid #cbd5e1;
            padding-top: 6px;
            margin-top: 6px;
        }

        .track-os-photo img {
            width: 85px;
            height: 85px;
            object-fit: contain;
            background-color: #f1f5f9;
            border-radius: 4px;
            border: 1px solid #cbd5e1;
            display: block;
        }

        .track-os-photo-placeholder {
            width: 85px;
            height: 85px;
            border: 1px dashed #cbd5e1;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
            background: #ffffff;
            padding: 5px;
        }

        .norm-footer {
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid #cbd5e1;
            font-size: 11px;
            color: #64748b;
            text-align: justify;
        }

        @media print {
            .cover-page-wrapper {
                page-break-after: always;
                min-height: 100vh;
                margin-bottom: 0;
                padding-bottom: 0;
            }

            body {
                background: none;
                padding: 0;
            }

            .report-container {
                box-shadow: none;
                padding: 0;
            }

            .device-card-exact,
            .tracking-section-box {
                page-break-inside: avoid;
            }
        }
    </style>
</head>

<body>

    <div class="report-container">

        <!-- CAPA PRINCIPAL HOMOLOGADA -->
        <div class="cover-page-wrapper">
            <div>
                <!-- Topo: Logo Torres Cx -->
                <div class="cover-top-header">
                    <img src="${torresLogoBase64}" alt="Torres Cx Sistemas de Automação" class="cover-torres-logo">
                </div>
                <div class="cover-header-divider"></div>

                <!-- Título Principal e Competência -->
                <div class="cover-title-section">
                    <h1 class="cover-main-title">
                        Relatório de Manutenção Preventiva do ${sistemaCompleto} - ${sistemaUpper}
                    </h1>
                    <p class="cover-competence">
                        Competência Operacional: <strong>${nomeMesStr}/${ano}</strong>
                    </p>
                </div>

                <!-- Logo do Cliente (Centralizado) -->
                <div class="cover-client-logo-section">
                    ${clientLogoCoverHTML}
                </div>
            </div>

            <!-- Card de Metadados Rodapé da Capa -->
            <div class="cover-meta-card">
                <div class="cover-meta-group">
                    <div class="meta-card-label">UNIDADE / PLANTA CLIENTE</div>
                    <div class="meta-card-val-main">${tenantName}</div>
                </div>

                <div class="cover-meta-divider"></div>

                <div class="cover-meta-grid">
                    <div class="cover-meta-group">
                        <div class="meta-card-label">SISTEMA / ESPECIALIDADE</div>
                        <div class="meta-card-val">${sistemaCompleto} (${sistemaUpper})</div>
                    </div>
                    <div class="cover-meta-group">
                        <div class="meta-card-label">DATA DE EMISSÃO</div>
                        <div class="meta-card-val">${dataEmissaoStr}</div>
                    </div>
                </div>

                <div class="cover-meta-group">
                    <div class="meta-card-label">RESPONSABILIDADE TÉCNICA</div>
                    <div class="meta-card-val">Torres Cx Engenharia LTDA</div>
                </div>
            </div>
        </div>

        <!-- Bloco 1: Indicadores da Rotina Programada -->
        <section class="section-title">Performance da Rotina Programada (${nomeMesStr} / ${ano})</section>
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-value">${kpis.dispositivosPlanejados}</div>
                <div class="kpi-label">Dispositivos Planejados</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${kpis.inspecionadosDoMes}</div>
                <div class="kpi-label">Realizados da Competência</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value color-green">${kpis.taxaAderencia}</div>
                <div class="kpi-label">Taxa de Aderência ao Plano</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value color-amber">${kpis.indiceConformidade}</div>
                <div class="kpi-label">Índice de Conformidade</div>
            </div>
        </div>

        <!-- Bloco 2: Recuperação de Passivo e Eficiência Global -->
        <section class="section-title">Recuperação de Passivo e Eficiência Global</section>
        <div class="kpi-grid kpi-grid-3">
            <div class="kpi-card">
                <div class="kpi-value color-blue">${kpis.atrasadosRecuperados}</div>
                <div class="kpi-label">Atrasados Recuperados no Mês</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${kpis.totalGeralInspecionados}</div>
                <div class="kpi-label">Total Geral de Ensaios no Mês</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value ${kpis.passivoRestante > 0 ? 'color-amber' : 'color-green'}">${kpis.passivoRestante}</div>
                <div class="kpi-label">Passivo Pendente Restante</div>
            </div>
        </div>

        <!-- Dossiê Principal -->
        <section class="section-title">Inspeções Detalhadas e Evidências por Ponto</section>

        ${deviceCardsHTML}

        <!-- SEÇÃO FINAL: RASTREABILIDADE AVANÇADA -->
        <section class="section-title">Rastreabilidade Avançada e Diagnósticos de Falha</section>

        ${trackingCardsHTML}

        <!-- Rodapé -->
        <footer class="norm-footer">
            * Este documento emite o parecer de conformidade situacional técnica com base nos ensaios executados por
            amostragem programada em conformidade com as exigências da norma regulamentadora <strong>NBR 17240</strong>. As
            pendências críticas listadas acima demandam acompanhamento cronológico através das Ordens de Serviço
            supracitadas.
        </footer>

    </div>

</body>

</html>`;
}

/**
 * Função principal para gerar o relatório mensal de preventivas em HTML
 */
async function generateMonthlyPreventiveReport(graphClient, accessToken, tenantConfig, mes, ano, sistema = 'sdai') {
  console.log(`📊 [ReportService] Gerando relatório para ${tenantConfig.name} - ${mes}/${ano}...`);

  // 1. Obter histórico de inspeções no período (mês/ano)
  const rawHistory = await fetchPreventiveHistory(graphClient, tenantConfig, mes, ano);
  console.log(`📋 [ReportService] ${rawHistory.length} inspeções encontradas no período`);

  // 2. Obter mapa de ordens corretivas
  const corretivasMap = await fetchCorretivas(graphClient, tenantConfig);
  console.log(`⚙️ [ReportService] ${corretivasMap.size} ordens corretivas mapeadas`);

  // 3. Obter Matriz Mestra (Excel) completa
  const todosDispositivos = await fetchMatrizMestra(accessToken, tenantConfig);
  const mesNum = Number(mes);

  // Planejados para o mês selecionado
  const planejadosDoMes = todosDispositivos.filter((d) => d.mesNumero === mesNum);
  const dispositivosPlanejados = planejadosDoMes.length;

  // Passivo de meses anteriores (1 até mesNum - 1)
  const passivoMesesAnteriores = todosDispositivos.filter((d) => d.mesNumero > 0 && d.mesNumero < mesNum);
  const passivoRestante = passivoMesesAnteriores.filter((d) => !d.realizado).length;

  // Classificar itens do histórico em 'Rotina do Mês' vs 'Recuperação de Atrasados'
  let atrasadosRecuperadosCount = 0;
  let inspecionadosDoMesCount = 0;

  const history = rawHistory.map((dev) => {
    const devTag = (dev.tag || '').trim().toUpperCase();
    const devDesc = (dev.descricao || '').trim().toUpperCase();

    // Match na Matriz Mestra por Descrição Exata > Tag (Pavimento + Laço) > Descrição Parcial
    let matched = null;
    if (devDesc) {
      matched = todosDispositivos.find((d) => (d.descricao || '').trim().toUpperCase() === devDesc);
    }
    if (!matched && devTag) {
      matched = todosDispositivos.find((d) => {
        const t = (d.pavimento && d.laco) ? `${d.pavimento} ${d.laco}` : (d.laco || d.descricao || '');
        return t.trim().toUpperCase() === devTag;
      });
    }
    if (!matched && devDesc) {
      matched = todosDispositivos.find((d) => {
        const dDesc = (d.descricao || '').trim().toUpperCase();
        return dDesc && (dDesc.includes(devDesc) || devDesc.includes(dDesc));
      });
    }

    const isAtrasado = Boolean(matched && matched.mesNumero > 0 && matched.mesNumero < mesNum);
    const mesProgramadoNome = matched && matched.mesNumero > 0 ? (NOME_MESES[matched.mesNumero] || `Mês ${matched.mesNumero}`) : '';

    if (isAtrasado) {
      atrasadosRecuperadosCount++;
    } else {
      inspecionadosDoMesCount++;
    }

    return {
      ...dev,
      isAtrasado,
      mesProgramadoNome,
      mesProgramadoNumero: matched?.mesNumero || mesNum,
    };
  });

  const totalGeralInspecionados = history.length;
  const inspecionadosDoMes = inspecionadosDoMesCount;
  const atrasadosRecuperados = atrasadosRecuperadosCount;

  // 4. Calcular KPIs
  const totalFuncionando = history.filter((d) => {
    const st = d.statusPonto.toLowerCase();
    return st.includes('funcionando') || st === 'normal';
  }).length;

  let taxaAderencia = '0%';
  if (dispositivosPlanejados > 0) {
    taxaAderencia = `${Math.min(100, Math.round((inspecionadosDoMes / dispositivosPlanejados) * 100))}%`;
  } else if (totalGeralInspecionados > 0) {
    taxaAderencia = '100%';
  } else {
    taxaAderencia = 'N/A';
  }

  let indiceConformidade = '0%';
  if (totalGeralInspecionados > 0) {
    indiceConformidade = `${Math.round((totalFuncionando / totalGeralInspecionados) * 100)}%`;
  } else {
    indiceConformidade = '100%';
  }

  const kpis = {
    dispositivosPlanejados,
    inspecionadosDoMes,
    taxaAderencia,
    indiceConformidade,
    atrasadosRecuperados,
    totalGeralInspecionados,
    passivoRestante,
  };

  // 5. Interpolar HTML
  const html = generateHTMLReport({
    tenantName: tenantConfig.name,
    tenantConfig,
    mes,
    ano,
    sistema,
    kpis,
    history,
    corretivasMap,
  });

  return html;
}

module.exports = {
  generateMonthlyPreventiveReport,
};
