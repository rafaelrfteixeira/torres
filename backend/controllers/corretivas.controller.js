/**
 * corretivas.controller.js — Controller para Gestão de Corretivas / Ocorrências
 *
 * Handlers:
 *   GET /api/corretivas?tenant=<tenant>   → Lista todas as ocorrências/corretivas do tenant
 *   PUT /api/corretivas/:id?tenant=<tenant> → Atualiza resolução, status, imagem 3 e data do atendimento
 */

const { getGraphClient } = require('../services/graphClient');

// Cache em memória de Site ID, List IDs e Mapeamento de Colunas
let _cachedSiteId = null;
const _listIdCache = new Map();
const _columnMapCache = new Map();

/**
 * Resolve os IDs do SharePoint Site e List
 */
async function resolveSharePointIds(graphClient, targetListName) {
  const { SHAREPOINT_HOSTNAME, SHAREPOINT_SITE_PATH } = process.env;

  if (!SHAREPOINT_HOSTNAME || !SHAREPOINT_SITE_PATH || !targetListName) {
    throw new Error(
      '⚠️ Variáveis SharePoint não configuradas ou nome da lista ausente. ' +
      'Preencha SHAREPOINT_HOSTNAME e SHAREPOINT_SITE_PATH no .env.'
    );
  }

  if (!_cachedSiteId) {
    console.log(`🔍 [Corretivas] Resolvendo Site ID: ${SHAREPOINT_HOSTNAME}:${SHAREPOINT_SITE_PATH}`);
    const site = await graphClient
      .api(`/sites/${SHAREPOINT_HOSTNAME}:${SHAREPOINT_SITE_PATH}`)
      .get();
    _cachedSiteId = site.id;
    console.log(`✅ [Corretivas] Site ID: ${_cachedSiteId}`);
  }

  if (!_listIdCache.has(targetListName)) {
    console.log(`🔍 [Corretivas] Resolvendo List ID: "${targetListName}"`);
    const allLists = await graphClient
      .api(`/sites/${_cachedSiteId}/lists`)
      .get();

    const foundItem = (allLists.value || []).find(
      (l) => l.displayName === targetListName || l.name === targetListName
    );

    if (!foundItem) {
      const available = (allLists.value || [])
        .map((l) => `"${l.displayName}" (name: ${l.name})`)
        .join('\n  ');
      throw new Error(
        `Lista "${targetListName}" não encontrada.\nListas disponíveis:\n  ${available}`
      );
    }

    _listIdCache.set(targetListName, foundItem.id);
    console.log(`✅ [Corretivas] List ID: "${foundItem.displayName}" → ${foundItem.id}`);
  }

  return { siteId: _cachedSiteId, listId: _listIdCache.get(targetListName) };
}

/**
 * Mapeia dinamicamente os nomes internos das colunas no SharePoint
 * e retorna o conjunto de colunas existentes.
 */
async function getListColumnMapping(graphClient, siteId, listId, listName) {
  if (_columnMapCache.has(listName)) {
    return _columnMapCache.get(listName);
  }

  console.log(`\n======================================================`);
  console.log(`🔍 [Corretivas] INSPECIONANDO COLUNAS DA LISTA "${listName}"`);
  console.log(`======================================================`);

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
      console.log(`  📌 Coluna: "${col.displayName}" | internalName: "${name}"`);
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

      // DATA DE ATENDIMENTO (Não deve conter "resolução", "parecer" ou "problema")
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

      // RESOLUÇÃO DO PROBLEMA (Não deve conter "data")
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

    // Evitar colisão entre dataAtendimento e resolucao
    if (mapping.dataAtendimento && mapping.dataAtendimento === mapping.resolucao) {
      console.warn(`⚠️ [Corretivas] Conflito detectado: dataAtendimento e resolucao apontavam para a mesma coluna "${mapping.dataAtendimento}". Separando...`);
      mapping.dataAtendimento = mapping.existingInternalNames.has('field_8') ? 'field_8' : null;
    }

    console.log('📌 [Corretivas] Mapeamento Final de Colunas:', mapping);
    console.log(`======================================================\n`);

    _columnMapCache.set(listName, mapping);
    return mapping;
  } catch (err) {
    console.warn('⚠️ [Corretivas] Falha ao inspecionar colunas:', err.message);
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
      existingInternalNames: new Set(),
    };
  }
}

/**
 * Converte data URL base64 para dados brutos
 */
function getRawBase64(dataUrl) {
  if (!dataUrl) return null;
  if (dataUrl.includes(',')) {
    return dataUrl.split(',')[1];
  }
  return dataUrl;
}

/**
 * Extrai o caminho relativo no servidor a partir da webUrl retornada pelo SharePoint
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
 * Faz o upload de imagem para a Biblioteca de Mídia (/PreventivasImages)
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
    const serverRelativeUrl =
      getServerRelativeUrlFromWebUrl(driveItem.webUrl) ||
      `${process.env.SHAREPOINT_SITE_PATH || '/sites/Manutencao'}/Shared%20Documents/PreventivasImages/${encodeURIComponent(fileName)}`;

    return {
      id: driveItem.id,
      fileName: fileName,
      serverUrl: serverUrl,
      serverRelativeUrl: serverRelativeUrl,
    };
  } catch (err) {
    console.warn(`   ⚠️ Erro ao salvar imagem no Drive:`, err.message);
    return null;
  }
}

/**
 * Auxiliar para parsear objetos/strings de thumbnail do SharePoint
 */
function parseImageField(rawField) {
  if (!rawField) return null;
  const sharepointHostname = process.env.SHAREPOINT_HOSTNAME || 'torrescx.sharepoint.com';
  const defaultServerUrl = `https://${sharepointHostname}`;

  let obj = null;
  if (typeof rawField === 'object') {
    obj = { ...rawField };
  } else {
    try {
      obj = JSON.parse(rawField);
    } catch (e) {
      obj = { serverRelativeUrl: rawField, url: rawField };
    }
  }

  if (!obj) return null;

  const serverUrl = obj.serverUrl || defaultServerUrl;
  let relUrl = obj.serverRelativeUrl || obj.url || '';

  if (relUrl && !relUrl.startsWith('http')) {
    if (!relUrl.startsWith('/')) relUrl = '/' + relUrl;
    obj.fullUrl = `${serverUrl}${relUrl}`;
  } else if (relUrl) {
    obj.fullUrl = relUrl;
  } else {
    obj.fullUrl = null;
  }

  return obj;
}

/**
 * HANDLER: GET /api/corretivas?tenant=<tenant>
 * Lista todas as ocorrências/corretivas registradas
 */
const getCorretivas = async (req, res, next) => {
  try {
    const accessToken = req.session?.accessToken;
    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    const tenantConfig = req.tenantConfig;
    const targetListName = tenantConfig.listaCorretivas;

    if (!targetListName) {
      return res.json({
        success: true,
        data: [],
        message: `Lista de Corretivas não configurada para o tenant "${req.tenantSlug}".`,
      });
    }

    const graphClient = getGraphClient(accessToken);
    const { siteId, listId } = await resolveSharePointIds(graphClient, targetListName);
    const colMap = await getListColumnMapping(graphClient, siteId, listId, targetListName);

    console.log(`📡 [Corretivas] Buscando itens da lista "${targetListName}"...`);
    const response = await graphClient
      .api(`/sites/${siteId}/lists/${listId}/items`)
      .expand('fields')
      .top(500)
      .get();

    const rawItems = response.value || [];
    console.log(`📋 [Corretivas] ${rawItems.length} itens encontrados.`);

    const corretivas = rawItems.map((item) => {
      const f = item.fields || {};

      let dataAtend = colMap.dataAtendimento && f[colMap.dataAtendimento] ? f[colMap.dataAtendimento] : '';
      let resol = colMap.resolucao && f[colMap.resolucao] ? f[colMap.resolucao] : '';

      // Garantir que dataAtendimento não contenha texto livre de resolução
      if (dataAtend && !/\d/.test(String(dataAtend))) {
        if (!resol) resol = String(dataAtend);
        dataAtend = '';
      }

      return {
        id: item.id,
        osNumber: colMap.osNumber && f[colMap.osNumber] != null ? String(f[colMap.osNumber]) : item.id,
        titulo: f[colMap.title] || f.Title || 'Sem Título',
        dataRelatada: (colMap.dataRelatada && f[colMap.dataRelatada]) || f.field_7 || item.createdDateTime || '',
        solicitante: (colMap.solicitante && f[colMap.solicitante]) || f.field_2 || 'Preventiva Mensal',
        categoria: (colMap.categoria && f[colMap.categoria]) || f.field_3 || 'SDAI - Sistema Detecção Alarme Incêndio',
        descricaoDefeito: (colMap.descricao && f[colMap.descricao]) || f.field_4 || '',
        prioridade: (colMap.prioridade && f[colMap.prioridade]) || f.field_5 || 'Normal',
        status: (colMap.status && f[colMap.status]) || f.field_6 || 'Pendente',
        dataAtendimento: dataAtend,
        resolucaoProblema: resol,
        imagem1: parseImageField(f[colMap.imagem1] || f.Imagem_1),
        imagem2: parseImageField(f[colMap.imagem2] || f.Imagem_2),
        imagem3: parseImageField(f[colMap.imagem3] || f.Imagem_3),
      };
    });

    // Ordenar por ID decrescente (mais recentes primeiro)
    corretivas.sort((a, b) => Number(b.id) - Number(a.id));

    res.json({ success: true, data: corretivas });
  } catch (error) {
    console.error('❌ [Corretivas] Erro ao buscar ocorrências:', error.message);
    next(error);
  }
};

/**
 * HANDLER: PUT /api/corretivas/:id?tenant=<tenant>
 * Atualiza resolução, status, imagem 3 e data do atendimento (hoje)
 */
const updateCorretiva = async (req, res, next) => {
  try {
    const accessToken = req.session?.accessToken;
    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    const { id } = req.params;
    const { status, resolucaoProblema, imagem3 } = req.body;
    const tenantConfig = req.tenantConfig;
    const targetListName = tenantConfig.listaCorretivas;

    if (!targetListName) {
      return res.status(400).json({
        success: false,
        message: `Lista de Corretivas não configurada para o tenant "${req.tenantSlug}".`,
      });
    }

    console.log(`\n🚀 [Corretivas] Atualizando ocorrência ID ${id}...`);
    console.log(`   Status: ${status}`);
    console.log(`   Resolução: ${resolucaoProblema ? resolucaoProblema.substring(0, 100) : '(vazio)'}`);

    const graphClient = getGraphClient(accessToken);
    const { siteId, listId } = await resolveSharePointIds(graphClient, targetListName);
    const colMap = await getListColumnMapping(graphClient, siteId, listId, targetListName);

    // Timestamp ISO atual do momento da execução (evita offset de fuso horário em colunas DateTime)
    const todayIsoDate = new Date().toISOString();

    const fieldsCandidate = {};

    if (status && colMap.status) {
      fieldsCandidate[colMap.status] = status;
    }

    if (colMap.dataAtendimento) {
      fieldsCandidate[colMap.dataAtendimento] = todayIsoDate;
    }

    if (resolucaoProblema !== undefined) {
      if (colMap.resolucao) {
        fieldsCandidate[colMap.resolucao] = resolucaoProblema;
      }
    }

    // Processar upload da Imagem_3 se fornecida
    if (imagem3) {
      const imgName = `OS_${id}_Foto_03.jpg`;
      const imgData = await uploadImageToDrive(graphClient, siteId, imgName, imagem3);

      if (imgData) {
        const imgColName = colMap.imagem3 || 'Imagem_3';
        fieldsCandidate[imgColName] = JSON.stringify({
          type: 'thumbnail',
          fileName: imgData.fileName,
          nativeFile: {},
          fieldName: imgColName,
          serverUrl: imgData.serverUrl,
          serverRelativeUrl: imgData.serverRelativeUrl,
          id: imgData.id,
        });
        console.log(`   🖼️ Coluna ${imgColName} configurada para o item ${id}`);
      }
    }

    // Filtrar apenas campos que REALMENTE existem na lista do SharePoint
    const safeFieldsUpdate = {};
    for (const [key, value] of Object.entries(fieldsCandidate)) {
      if (colMap.existingInternalNames.has(key) || key === 'Title') {
        safeFieldsUpdate[key] = value;
      } else {
        console.warn(`   ⚠️ Ignorando atualização da coluna "${key}" pois ela não existe na lista SharePoint "${targetListName}".`);
      }
    }

    console.log('   📝 Atualizando campos válidos no SharePoint List:', safeFieldsUpdate);

    if (Object.keys(safeFieldsUpdate).length > 0) {
      await graphClient
        .api(`/sites/${siteId}/lists/${listId}/items/${id}/fields`)
        .update(safeFieldsUpdate);
      console.log(`✅ [Corretivas] Ocorrência ID ${id} atualizada com sucesso!`);
    } else {
      console.warn('   ⚠️ Nenhum campo válido para atualização no SharePoint.');
    }

    res.json({
      success: true,
      message: 'Ocorrência atualizada com sucesso!',
      data: {
        id,
        dataAtendimento: todayIsoDate,
        status,
      },
    });
  } catch (error) {
    console.error('❌ [Corretivas] Erro ao atualizar ocorrência:', error.message);
    next(error);
  }
};

module.exports = {
  getCorretivas,
  updateCorretiva,
};
