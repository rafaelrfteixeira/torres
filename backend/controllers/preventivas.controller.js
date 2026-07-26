/**
 * preventivas.controller.js — Controller de Preventivas Área Comum
 *
 * Handlers:
 *   GET  /api/preventivas/dispositivos  → Lista dispositivos da Matriz Mestra (Excel)
 *   POST /api/preventivas/salvar        → Orquestração completa (Excel + Histórico + OS Condicional)
 *
 * Integra com Microsoft Graph API para:
 *   - Ler planilha Excel (Matriz Mestra) via download + parse local
 *   - Atualizar célula "Realizado 2026" via Excel API
 *   - Criar itens em Microsoft Lists (Histórico e Corretivas)
 */

const { getGraphClient } = require('../services/graphClient');
const XLSX = require('xlsx');

// -------------------------------------------------
// Cache em memória para Matriz Mestra
// -------------------------------------------------
const _preventivasCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// -------------------------------------------------
// Mapa de meses em português → número
// -------------------------------------------------
const MESES_MAP = {
  'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3,
  'abril': 4, 'maio': 5, 'junho': 6,
  'julho': 7, 'agosto': 8, 'setembro': 9,
  'outubro': 10, 'novembro': 11, 'dezembro': 12,
  'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
  'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12,
};

/**
 * Converte URL de compartilhamento em Sharing Token (Base64 URL-safe + prefixo u!)
 */
function encodeSharingUrl(url) {
  const cleanUrl = url.split('?')[0];
  const base64 = Buffer.from(cleanUrl, 'utf-8').toString('base64');
  const base64UrlSafe = base64
    .replace(/=+$/, '')
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
  return `u!${base64UrlSafe}`;
}

/**
 * Faz download de um arquivo via Graph API e retorna o buffer.
 */
async function downloadExcelViaGraph(accessToken, sharingUrl) {
  const sharingToken = encodeSharingUrl(sharingUrl);
  const baseUrl = 'https://graph.microsoft.com/v1.0';

  // Resolver driveItem
  console.log('📡 [Preventivas] Resolvendo driveItem via shares...');
  const driveItemRes = await fetch(`${baseUrl}/shares/${sharingToken}/driveItem`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'redeemSharingLink',
    },
  });

  if (!driveItemRes.ok) {
    const err = await driveItemRes.text();
    throw new Error(`Falha ao resolver driveItem: [${driveItemRes.status}] ${err}`);
  }

  const driveItem = await driveItemRes.json();
  const driveId = driveItem.parentReference?.driveId;
  const itemId = driveItem.id;

  if (!driveId || !itemId) {
    throw new Error('driveId ou itemId não encontrados na Matriz Mestra');
  }

  console.log(`📁 [Preventivas] Arquivo: ${driveItem.name} (driveId=${driveId}, itemId=${itemId})`);

  // Download do conteúdo
  const downloadRes = await fetch(`${baseUrl}/drives/${driveId}/items/${itemId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!downloadRes.ok) {
    const err = await downloadRes.text();
    throw new Error(`Falha no download da Matriz Mestra: [${downloadRes.status}] ${err}`);
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    driveId,
    itemId,
    fileName: driveItem.name,
  };
}

/**
 * Parseia o buffer Excel da Matriz Mestra.
 * Colunas esperadas: Pavimento, Laço, Tipo, Descrição, Mês Manutenção, Realizado 2026
 */
function parseMatrizMestra(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Nenhuma aba encontrada na Matriz Mestra');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`📊 [Preventivas] ${rows.length} linhas lidas da aba "${sheetName}"`);
  if (rows.length <= 1) return { dispositivos: [], headerRowIdx: 0, colMap: {} };

  // Encontrar linha de cabeçalho
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row || row.length <= 1) continue;
    const cells = row.map((h) => String(h || '').trim().toLowerCase());
    const hasPavimento = cells.some((h) => h.includes('pavimento') || h.includes('piso'));
    const hasDescricao = cells.some((h) => h.includes('descrição') || h.includes('descricao'));
    const hasMes = cells.some((h) => h.includes('mês') || h.includes('mes') || h.includes('manutenção'));
    if ([hasPavimento, hasDescricao, hasMes].filter(Boolean).length >= 2) {
      headerRowIdx = i;
      break;
    }
  }

  const header = rows[headerRowIdx].map((h) => String(h || '').trim().toLowerCase());
  console.log(`📋 [Preventivas] Cabeçalho (linha ${headerRowIdx}):`, JSON.stringify(rows[headerRowIdx]));

  // Detectar índices de colunas
  const colMap = {
    pavimento: header.findIndex((h) => h.includes('pavimento') || h.includes('piso')),
    laco: header.findIndex((h) => h.includes('laço') || h.includes('laco')),
    tipo: header.findIndex((h) => h.includes('tipo') && !h.includes('dispositivo')),
    descricao: header.findIndex((h) => h.includes('descrição') || h.includes('descricao')),
    mesMantencao: header.findIndex((h) => h.includes('mês') || h.includes('mes') || h.includes('manutenção')),
    realizado: header.findIndex((h) => h.includes('realizado')),
  };

  // Fallback posicional
  if (colMap.pavimento === -1) colMap.pavimento = 0;
  if (colMap.laco === -1) colMap.laco = 1;
  if (colMap.tipo === -1) colMap.tipo = 2;
  if (colMap.descricao === -1) colMap.descricao = 3;
  if (colMap.mesMantencao === -1) colMap.mesMantencao = 4;
  if (colMap.realizado === -1) colMap.realizado = 5;

  console.log('🔍 [Preventivas] Índices de colunas:', colMap);

  const mesAtual = new Date().getMonth() + 1; // 1-12

  const dispositivos = rows.slice(headerRowIdx + 1)
    .filter((row) => row && row.length > 0)
    .map((row, index) => {
      const pavimento = row[colMap.pavimento] != null ? String(row[colMap.pavimento]).trim() : '';
      const laco = row[colMap.laco] != null ? String(row[colMap.laco]).trim() : '';
      const tipo = row[colMap.tipo] != null ? String(row[colMap.tipo]).trim() : '';
      const descricao = row[colMap.descricao] != null ? String(row[colMap.descricao]).trim() : '';
      const mesTexto = row[colMap.mesMantencao] != null ? String(row[colMap.mesMantencao]).trim().toLowerCase() : '';
      const realizadoRaw = row[colMap.realizado] != null ? String(row[colMap.realizado]).trim().toLowerCase() : '';

      const mesNumero = MESES_MAP[mesTexto] || parseInt(mesTexto) || 0;
      const realizado = realizadoRaw === 'sim' || realizadoRaw === 's' || realizadoRaw === 'yes';

      // Calcular status
      let status = 'realizado';
      if (!realizado) {
        if (mesNumero > 0 && mesNumero < mesAtual) {
          status = 'atrasado';
        } else if (mesNumero === mesAtual) {
          status = 'pendente';
        } else if (mesNumero > mesAtual) {
          status = 'futuro'; // Ainda não é mês de manutenção
        } else {
          status = 'pendente'; // Fallback
        }
      }

      return {
        rowIndex: headerRowIdx + 1 + index, // Linha real no Excel (0-indexed)
        realizadoColIndex: colMap.realizado,
        pavimento,
        laco,
        tipo,
        descricao,
        mesMantencao: mesTexto,
        mesNumero,
        realizado,
        status,
      };
    })
    .filter((d) => d.descricao !== ''); // Ignorar linhas sem descrição

  console.log(`✅ [Preventivas] ${dispositivos.length} dispositivos parseados`);
  return { dispositivos, headerRowIdx, colMap };
}

// =====================================================
// Cache de Site ID e List IDs (compartilhado entre handlers)
// =====================================================
let _cachedSiteId = null;
const _listIdCache = new Map();

async function resolveSharePointIds(graphClient, targetListName) {
  const { SHAREPOINT_HOSTNAME, SHAREPOINT_SITE_PATH } = process.env;

  if (!SHAREPOINT_HOSTNAME || !SHAREPOINT_SITE_PATH || !targetListName) {
    throw new Error(
      '⚠️  Variáveis SharePoint não configuradas ou nome da lista ausente. ' +
      'Preencha SHAREPOINT_HOSTNAME e SHAREPOINT_SITE_PATH no .env.'
    );
  }

  if (!_cachedSiteId) {
    console.log(`🔍 [Preventivas] Resolvendo Site ID: ${SHAREPOINT_HOSTNAME}:${SHAREPOINT_SITE_PATH}`);
    const site = await graphClient
      .api(`/sites/${SHAREPOINT_HOSTNAME}:${SHAREPOINT_SITE_PATH}`)
      .get();
    _cachedSiteId = site.id;
    console.log(`✅ [Preventivas] Site ID: ${_cachedSiteId}`);
  }

  if (!_listIdCache.has(targetListName)) {
    console.log(`🔍 [Preventivas] Resolvendo List ID: "${targetListName}"`);
    const allLists = await graphClient
      .api(`/sites/${_cachedSiteId}/lists`)
      .get();

    const found = (allLists.value || []).find(
      (l) => l.displayName === targetListName || l.name === targetListName
    );

    if (!found) {
      const available = (allLists.value || [])
        .map((l) => `"${l.displayName}" (name: ${l.name})`)
        .join('\n  ');
      throw new Error(
        `Lista "${targetListName}" não encontrada.\nListas disponíveis:\n  ${available}`
      );
    }

    _listIdCache.set(targetListName, found.id);
    console.log(`✅ [Preventivas] List ID: "${found.displayName}" → ${found.id}`);
  }

  return { siteId: _cachedSiteId, listId: _listIdCache.get(targetListName) };
}

// =====================================================
// HANDLER: GET /api/preventivas/dispositivos
// =====================================================
const getDispositivos = async (req, res, next) => {
  try {
    const accessToken = req.session?.accessToken;
    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    const tenantConfig = req.tenantConfig;
    const excelUrl = tenantConfig.excelPreventivasUrl;

    if (!excelUrl) {
      return res.status(400).json({
        success: false,
        message: `Planilha de preventivas não configurada para o tenant "${req.tenantSlug}".`,
      });
    }

    // Cache (ignorado se query.refresh for true)
    const refresh = req.query.refresh === 'true';
    const cached = _preventivasCache.get(excelUrl);
    if (!refresh && cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      console.log(`⚡ [Preventivas] Retornando ${cached.data.length} dispositivos do cache`);
      // Recalcular status pois o mês pode ter mudado
      const mesAtual = new Date().getMonth() + 1;
      const dispositivos = cached.data.map((d) => {
        if (d.realizado) return { ...d, status: 'realizado' };
        if (d.mesNumero > 0 && d.mesNumero < mesAtual) return { ...d, status: 'atrasado' };
        if (d.mesNumero === mesAtual) return { ...d, status: 'pendente' };
        if (d.mesNumero > mesAtual) return { ...d, status: 'futuro' };
        return { ...d, status: 'pendente' };
      });

      // Filtrar: apenas pendentes e atrasados (não realizados, não futuros)
      const filtered = dispositivos.filter((d) => d.status === 'pendente' || d.status === 'atrasado');

      return res.json({ success: true, data: filtered });
    }

    // Download e parse
    const { buffer } = await downloadExcelViaGraph(accessToken, excelUrl);
    const { dispositivos } = parseMatrizMestra(buffer);

    // Salvar no cache (todos, inclusive realizados, para poder invalidar depois)
    _preventivasCache.set(excelUrl, { data: dispositivos, timestamp: Date.now() });

    // Filtrar: apenas pendentes e atrasados
    const filtered = dispositivos.filter((d) => d.status === 'pendente' || d.status === 'atrasado');

    console.log(`📤 [Preventivas] Retornando ${filtered.length} dispositivos (pendentes/atrasados) de ${dispositivos.length} total`);

    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('❌ [Preventivas] Erro ao buscar dispositivos:', error.message);
    next(error);
  }
};

// =====================================================
// HANDLER: POST /api/preventivas/salvar
// =====================================================
const salvar = async (req, res, next) => {
  try {
    const accessToken = req.session?.accessToken;
    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    const tenantConfig = req.tenantConfig;
    const tenantSlug = req.tenantSlug;
    const formData = req.body;
    const graphClient = getGraphClient(accessToken);

    console.log('\n🚀 [Preventivas] Iniciando orquestração de salvamento...');
    console.log(`   Tenant: ${tenantSlug}`);
    console.log(`   Dispositivo: ${formData.descricao} (TAG: ${formData.tag})`);
    console.log(`   Status: ${formData.statusInspecao}`);

    // =========================================================
    // PASSO 1: Atualizar planilha Excel — "Realizado 2026" → "sim"
    // =========================================================
    console.log('\n📝 [Passo 1] Atualizando Excel — Realizado 2026...');
    try {
      const excelUrl = tenantConfig.excelPreventivasUrl;
      if (excelUrl) {
        const sharingToken = encodeSharingUrl(excelUrl);
        const baseUrl = 'https://graph.microsoft.com/v1.0';

        // Resolver driveItem
        const driveItemRes = await fetch(`${baseUrl}/shares/${sharingToken}/driveItem`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'redeemSharingLink',
          },
        });

        if (driveItemRes.ok) {
          const driveItem = await driveItemRes.json();
          const driveId = driveItem.parentReference?.driveId;
          const itemId = driveItem.id;

          if (driveId && itemId && formData.rowIndex !== undefined) {
            // A linha no Excel (1-indexed para a API). rowIndex já é 0-indexed da planilha.
            // A Excel API usa endereço A1, com linhas 1-indexed.
            const excelRow = formData.rowIndex + 1; // +1 porque Excel é 1-indexed
            const colLetter = getColumnLetter(formData.realizadoColIndex || 5); // Coluna F por default (0-indexed: 5)

            const cellAddress = `${colLetter}${excelRow}`;
            console.log(`   📍 Célula alvo: ${cellAddress}`);

            // Obter a primeira worksheet dinamicamente para evitar erro de itemAt(index=0)
            console.log('🔍 [Passo 1] Buscando worksheets da planilha...');
            const worksheetsRes = await fetch(`${baseUrl}/drives/${driveId}/items/${itemId}/workbook/worksheets`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });

            if (!worksheetsRes.ok) {
              const errText = await worksheetsRes.text();
              throw new Error(`Falha ao obter worksheets do Excel: [${worksheetsRes.status}] ${errText}`);
            }

            const worksheetsData = await worksheetsRes.json();
            const firstWorksheet = worksheetsData.value?.[0];
            if (!firstWorksheet) {
              throw new Error('Nenhuma aba encontrada na planilha do Excel.');
            }

            const sheetId = firstWorksheet.id;
            console.log(`   📄 Aba ativa: "${firstWorksheet.name}" (ID: ${sheetId})`);

            // Criar sessão de workbook para atualização usando o ID da aba correto
            const updateUrl = `${baseUrl}/drives/${driveId}/items/${itemId}/workbook/worksheets/${sheetId}/range(address='${cellAddress}')`;

            const patchRes = await fetch(updateUrl, {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                values: [['sim']],
              }),
            });

            if (patchRes.ok) {
              console.log(`   ✅ Excel atualizado: ${cellAddress} = "sim"`);
              // Invalidar cache
              _preventivasCache.delete(excelUrl);
            } else {
              const errBody = await patchRes.text();
              console.warn(`   ⚠️  Falha ao atualizar Excel [${patchRes.status}]: ${errBody}`);
            }
          }
        }
      }
    } catch (excelErr) {
      console.warn('   ⚠️  Erro no Passo 1 (Excel):', excelErr.message);
      // Não bloqueia o fluxo — continua com os próximos passos
    }

    // =========================================================
    // PASSO 2: Compor o Log de Checklist em JSON string
    // =========================================================
    console.log('\n📝 [Passo 2] Compondo Log de Checklist...');
    const checklistLog = JSON.stringify(formData.checklist || []);
    console.log(`   📋 Log: ${checklistLog.substring(0, 200)}...`);

    // =========================================================
    // PASSO 3: Salvar registro no List de Histórico de Preventivas
    // =========================================================
    console.log('\n📝 [Passo 3] Salvando registro no List de Histórico...');
    const listaHistorico = tenantConfig.listaHistoricoPreventivas;
    if (!listaHistorico) {
      throw new Error(`Lista de Histórico de Preventivas não configurada para o tenant "${tenantSlug}".`);
    }

    const { siteId, listId: historicoListId } = await resolveSharePointIds(graphClient, listaHistorico);

    const toIsoDate = (dateStr) => {
      if (!dateStr) return new Date().toISOString();
      if (dateStr.includes('T')) return dateStr;
      return `${dateStr}T00:00:00Z`;
    };

    // Mapear campos do formulário para colunas do List
    const historicoFields = {
      Title: formData.tag || '',
      Localizacao: formData.localizacao || formData.descricao || '',
      Data_Execucao: toIsoDate(formData.dataExecucao),
      Tipo_Dispositivo: formData.tipoDispositivo || 'Detector de Fumaça',
      Status_Inspecao: formData.statusInspecao || 'Funcionando',
      Log_Checklist: checklistLog || '[]',
      OS_Vinculada: '',
      Observacoes_Gerais: formData.observacoesGerais || '',
      Tecnico_Responsavel: formData.tecnicoResponsavel || '',
      Horario_Inicio: formData.horarioInicio || '',
      Horario_Termino: formData.horarioTermino || '',
      Total_Horas: formData.totalHoras || '',
    };

    // Incluir apenas se tiverem valor (evita erro em colunas Choice/Text opcionais)
    if (formData.gravidadeFalha) {
      historicoFields.Gravidade_Falha = formData.gravidadeFalha;
    }
    if (formData.descricaoDefeito) {
      historicoFields.Descricao_Defeito = formData.descricaoDefeito;
    }

    let historicoResult;
    try {
      historicoResult = await graphClient
        .api(`/sites/${siteId}/lists/${historicoListId}/items`)
        .post({ fields: historicoFields });
    } catch (histErr) {
      console.error('❌ [Passo 3] Erro ao salvar no Histórico:', histErr.message);
      if (histErr.body) console.error('   Body erro:', JSON.stringify(histErr.body));
      try {
        console.log('🔍 [Preventivas] Buscando colunas da lista de Histórico para depuração...');
        const cols = await graphClient.api(`/sites/${siteId}/lists/${historicoListId}/columns`).get();
        console.log('📋 Colunas da lista de Histórico (TESTE_PREVENTIVAS_APP):');
        (cols.value || []).forEach(c => {
          console.log(`   - "${c.displayName}" (nome interno: "${c.name}")`);
        });
      } catch (colErr) {
        console.error('   ⚠️ Falha ao buscar colunas de histórico:', colErr.message);
      }
      throw histErr;
    }

    const historicoItemId = historicoResult.id;
    console.log(`   ✅ Histórico salvo. ID: ${historicoItemId}`);

    // Salvar mídias na biblioteca do SharePoint e renderizar nas colunas Imagem_1 / Imagem_2
    let img1Name = formData.imagem1 ? `Hist_${historicoItemId}_Foto_01.jpg` : null;
    let img2Name = formData.imagem2 ? `Hist_${historicoItemId}_Foto_02.jpg` : null;

    let img1DriveData = null;
    let img2DriveData = null;

    if (formData.imagem1) {
      img1DriveData = await uploadImageToDrive(graphClient, siteId, img1Name, formData.imagem1);
    }
    if (formData.imagem2) {
      img2DriveData = await uploadImageToDrive(graphClient, siteId, img2Name, formData.imagem2);
    }

    if (img1DriveData || img2DriveData) {
      await updateImageColumnsWithDrive(graphClient, siteId, historicoListId, historicoItemId, img1DriveData, img2DriveData);
    }

    // =========================================================
    // PASSO 4: Condicional — Abrir OS Corretiva (se falha ou sem acesso)
    // =========================================================
    let osVinculada = '';
    const statusLower = (formData.statusInspecao || '').toLowerCase();
    const temFalha = statusLower.includes('defeito') || statusLower.includes('falha');
    const semAcesso = statusLower.includes('sem acesso');
    const checklistTemNao = (formData.checklist || []).some(
      (item) => item.status === 'nao' || item.status === 'não'
    );

    if (temFalha || semAcesso || checklistTemNao) {
      console.log('\n⚠️  [Passo 4] Falha/Sem Acesso detectado — Abrindo OS Corretiva...');

      const listaCorretivas = tenantConfig.listaCorretivas;
      if (listaCorretivas) {
        try {
          const { listId: corretivaListId } = await resolveSharePointIds(graphClient, listaCorretivas);

          // Definir título da OS
          let osTitulo = '';
          if (semAcesso) {
            osTitulo = `Preventiva Sem Acesso - Dispositivo: ${formData.descricao || formData.tag}`;
          } else {
            osTitulo = `Falha na Preventiva - Dispositivo: ${formData.descricao || formData.tag}`;
          }

          // Mapear gravidade para prioridade
          const prioridadeMap = {
            'baixa': 'Baixa',
            'media': 'Normal',
            'média': 'Normal',
            'alta': 'Alta',
            'critica': 'Crítico',
            'crítica': 'Crítico',
          };
          const prioridade = prioridadeMap[(formData.gravidadeFalha || '').toLowerCase()] || 'Normal';

          const corretivaFields = {
            Title: osTitulo,
            field_7: toIsoDate(formData.dataExecucao),                                 // Data relatada (dateTime ISO)
            field_2: 'Preventiva Mensal',                                             // Solicitante (choice)
            field_4: formData.descricaoDefeito || `Falha detectada durante preventiva do dispositivo ${formData.descricao}`, // Descrição do problema
            field_3: 'SDAI - Sistema Detecção Alarme Incêndio',                       // Categoria (choice)
            field_5: prioridade,                                                      // Prioridade (choice)
            field_6: 'Pendente',                                                      // Status (choice)
          };

          const osResult = await graphClient
            .api(`/sites/${siteId}/lists/${corretivaListId}/items`)
            .post({ fields: corretivaFields });

          osVinculada = osResult.id || '';
          console.log(`   ✅ OS Corretiva aberta. ID: ${osVinculada}`);

          // Preencher o campo numérico "OS" (field_0) na própria Ordem Corretiva
          if (osVinculada) {
            try {
              console.log(`   🔢 Preenchendo campo OS (field_0) com o número: ${osVinculada}...`);
              await graphClient
                .api(`/sites/${siteId}/lists/${corretivaListId}/items/${osVinculada}/fields`)
                .update({ field_0: Number(osVinculada) });
              console.log('   ✅ Campo OS (field_0) atualizado com sucesso!');
            } catch (fieldErr) {
              console.warn('   ⚠️ Erro ao atualizar campo OS (field_0):', fieldErr.message);
            }
          }

          // Salvar mídias da OS Corretiva na biblioteca do SharePoint e renderizar nas colunas
          if (osVinculada) {
            let osImg1Name = formData.imagem1 ? `OS_${osVinculada}_Foto_01.jpg` : null;
            let osImg2Name = formData.imagem2 ? `OS_${osVinculada}_Foto_02.jpg` : null;

            let osImg1DriveData = null;
            let osImg2DriveData = null;

            if (formData.imagem1) {
              osImg1DriveData = await uploadImageToDrive(graphClient, siteId, osImg1Name, formData.imagem1);
            }
            if (formData.imagem2) {
              osImg2DriveData = await uploadImageToDrive(graphClient, siteId, osImg2Name, formData.imagem2);
            }

            if (osImg1DriveData || osImg2DriveData) {
              await updateImageColumnsWithDrive(graphClient, siteId, corretivaListId, osVinculada, osImg1DriveData, osImg2DriveData);
            }
          }

          // Atualizar retroativamente o campo OS_Vinculada no Histórico
          if (osVinculada && historicoItemId) {
            console.log(`   🔗 Vinculando OS ${osVinculada} ao Histórico ${historicoItemId}...`);
            await graphClient
              .api(`/sites/${siteId}/lists/${historicoListId}/items/${historicoItemId}/fields`)
              .update({ OS_Vinculada: String(osVinculada) });
            console.log('   ✅ OS vinculada ao histórico com sucesso.');
          }
        } catch (osErr) {
          console.error('   ❌ Erro ao abrir OS Corretiva:', osErr.message);
          try {
            console.log('🔍 [Preventivas] Buscando colunas da lista de Corretivas para depuração...');
            const cols = await graphClient.api(`/sites/${siteId}/lists/${corretivaListId}/columns`).get();
            console.log('📋 Colunas da lista de Corretivas:');
            (cols.value || []).forEach(c => {
              console.log(`   - "${c.displayName}" (nome interno: "${c.name}")`);
            });
          } catch (colErr) {
            console.error('   ⚠️ Falha ao buscar colunas para debug:', colErr.message);
          }
          // Não bloqueia — a preventiva já foi salva
        }
      } else {
        console.warn('   ⚠️  Lista de Corretivas não configurada para este tenant.');
      }
    } else {
      console.log('\n✅ [Passo 4] Sem falhas — OS Corretiva não necessária.');
    }

    // =========================================================
    // RESPOSTA
    // =========================================================
    console.log('\n🎉 [Preventivas] Orquestração concluída com sucesso!');

    res.status(201).json({
      success: true,
      message: osVinculada
        ? 'Preventiva salva e OS Corretiva aberta com sucesso!'
        : 'Preventiva salva com sucesso!',
      data: {
        historicoId: historicoItemId,
        osVinculada: osVinculada || null,
      },
    });
  } catch (error) {
    console.error('❌ [Preventivas] Erro na orquestração:', error.message);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: `Erro da Graph API: ${error.message}`,
        code: error.code,
      });
    }

    next(error);
  }
};

/**
 * GET /api/preventivas/debug-columns
 * Endpoint auxiliar para ver as colunas de qualquer lista no SharePoint.
 */
const debugColumns = async (req, res, next) => {
  try {
    const accessToken = req.session?.accessToken;
    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    const tenantConfig = req.tenantConfig;
    const targetListName = req.query.list || tenantConfig.listaCorretivas;

    if (!targetListName) {
      return res.status(400).json({ success: false, message: 'Lista não configurada para o tenant.' });
    }

    const graphClient = getGraphClient(accessToken);
    const { siteId, listId } = await resolveSharePointIds(graphClient, targetListName);

    const columnsResponse = await graphClient
      .api(`/sites/${siteId}/lists/${listId}/columns`)
      .get();

    const columns = columnsResponse.value.map(col => ({
      displayName: col.displayName,
      internalName: col.name,
      type: col.text ? 'text' : col.boolean ? 'boolean' : col.number ? 'number' : col.dateTime ? 'dateTime' : col.choice ? 'choice' : 'other',
    }));

    res.json({ success: true, list: targetListName, columns });
  } catch (error) {
    console.error('❌ Erro no debug-columns:', error.message);
    next(error);
  }
};

/**
 * Extrai o conteúdo base64 bruto de um data URL (remove o cabeçalho data:image/jpeg;base64,)
 */
function getRawBase64(dataUrl) {
  if (!dataUrl) return null;
  if (dataUrl.includes(',')) {
    return dataUrl.split(',')[1];
  }
  return dataUrl;
}

/**
 * Extrai o caminho relativo no servidor a partir da webUrl retornada pelo SharePoint Drive API
 */
function getServerRelativeUrlFromWebUrl(webUrl) {
  if (!webUrl) return null;
  try {
    const url = new URL(webUrl);
    return decodeURIComponent(url.pathname);
  } catch (e) {
    return null;
  }
}

/**
 * Faz o upload da imagem para a Biblioteca de Mídia do SharePoint (/PreventivasImages)
 * e retorna o ID e caminhos relativos exatos extraídos da webUrl oficial do SharePoint.
 */
async function uploadImageToDrive(graphClient, siteId, fileName, base64Data) {
  const rawBase64 = getRawBase64(base64Data);
  if (!rawBase64) return null;

  const imageBuffer = Buffer.from(rawBase64, 'base64');
  console.log(`   📤 Salvando ${fileName} na biblioteca de mídia do SharePoint...`);

  try {
    const driveItem = await graphClient
      .api(`/sites/${siteId}/drive/root:/PreventivasImages/${fileName}:/content`)
      .put(imageBuffer);

    console.log(`   ✅ Imagem salva no Drive: ${driveItem.name} (ID: ${driveItem.id})`);

    const sharepointHostname = process.env.SHAREPOINT_HOSTNAME || 'torrescx.sharepoint.com';
    const serverUrl = `https://${sharepointHostname}`;
    const serverRelativeUrl = getServerRelativeUrlFromWebUrl(driveItem.webUrl) || `${process.env.SHAREPOINT_SITE_PATH || '/sites/Manutencao'}/Shared%20Documents/PreventivasImages/${encodeURIComponent(fileName)}`;

    console.log(`   📍 Caminho relativo real extraído: ${serverRelativeUrl}`);

    return {
      id: driveItem.id,
      fileName: fileName,
      serverUrl: serverUrl,
      serverRelativeUrl: serverRelativeUrl,
    };
  } catch (err) {
    console.warn(`   ⚠️ Erro ao salvar imagem no Drive para renderização:`, err.message);
    return null;
  }
}

/**
 * Atualiza as colunas de Imagem (Imagem_1 e Imagem_2) do item com o objeto JSON de Thumbnail nativo do SharePoint.
 */
async function updateImageColumnsWithDrive(graphClient, siteId, listId, itemId, img1Data, img2Data) {
  const fieldsUpdate = {};

  if (img1Data) {
    fieldsUpdate.Imagem_1 = JSON.stringify({
      type: 'thumbnail',
      fileName: img1Data.fileName,
      nativeFile: {},
      fieldName: 'Imagem_1',
      serverUrl: img1Data.serverUrl,
      serverRelativeUrl: img1Data.serverRelativeUrl,
      id: img1Data.id,
    });
  }

  if (img2Data) {
    fieldsUpdate.Imagem_2 = JSON.stringify({
      type: 'thumbnail',
      fileName: img2Data.fileName,
      nativeFile: {},
      fieldName: 'Imagem_2',
      serverUrl: img2Data.serverUrl,
      serverRelativeUrl: img2Data.serverRelativeUrl,
      id: img2Data.id,
    });
  }

  if (Object.keys(fieldsUpdate).length === 0) return;

  console.log(`   🖼️ Renderizando imagens nas colunas Imagem_1 / Imagem_2 do item ${itemId}...`);
  try {
    await graphClient
      .api(`/sites/${siteId}/lists/${listId}/items/${itemId}/fields`)
      .update(fieldsUpdate);
    console.log('   ✅ Colunas de imagem configuradas com sucesso! As thumbnails serão renderizadas no SharePoint.');
  } catch (err) {
    console.error('   ❌ Falha ao vincular thumbnails às colunas:', err.message);
  }
}

/**
 * Converte índice de coluna (0-indexed) em letra de coluna do Excel.
 * 0 = A, 1 = B, ..., 25 = Z, 26 = AA, etc.
 */
function getColumnLetter(index) {
  let letter = '';
  let num = index;
  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter;
    num = Math.floor(num / 26) - 1;
  }
  return letter;
}

module.exports = { getDispositivos, salvar, debugColumns };
