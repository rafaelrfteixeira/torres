const { getGraphClient } = require('../services/graphClient');
const { generatePDFBase64 } = require('../services/pdfService');
const { sendChecklistEmail } = require('../services/emailService');

/**
 * Checklists Controller
 *
 * Recebe o JSON do formulário de inspeção do frontend,
 * mapeia os campos para as colunas do Microsoft Lists
 * e cria um novo item via Graph API.
 */

/**
 * Mapeia o JSON do formulário React para o formato
 * de colunas (fields) do Microsoft Lists.
 *
 * ⚠️  AJUSTE OS NOMES DAS COLUNAS conforme a sua lista
 *     no Microsoft Lists. Os nomes aqui devem corresponder
 *     exatamente ao "internal name" de cada coluna.
 */
function mapFormToListFields(formData) {
  const boolToSimNao = (sim, nao) => {
    if (sim) return 'Sim';
    if (nao) return 'Não';
    return '';
  };
  const boolToText = (val) => val ? 'Sim' : 'Não';
  // Telefone: campo é do tipo number no SharePoint — remove máscara e converte
  const toPhoneNumber = (val) => {
    if (!val) return null;
    const digits = String(val).replace(/\D/g, '');
    return digits ? Number(digits) : null;
  };

  const sistemas = formData.sistemas || {};

  return {
    // Identificação
    Title: formData.data ? formData.data.split('-').reverse().join('/') : '',
    field_1:  formData.loja || '',                              // Loja
    field_2:  formData.codigoLoja || '',                        // Código Loja

    // Responsável Loja
    field_3:  formData.responsavelLoja?.solicitante || '',       // Resp. Loja - Solicitante
    field_4:  toPhoneNumber(formData.responsavelLoja?.telefone),  // Resp. Loja - Telefone (number)
    field_5:  formData.responsavelLoja?.email || '',             // Resp. Loja - E-mail

    // Responsável Shopping
    field_6:  formData.responsavelShopping?.solicitante || '',   // Resp. Shopping - Solicitante
    field_7:  toPhoneNumber(formData.responsavelShopping?.telefone),  // Resp. Shopping - Telefone (number)
    field_8:  formData.responsavelShopping?.email || '',         // Resp. Shopping - E-mail

    // Tipo de Manutenção
    field_9:  boolToText(formData.manutencaoCorretiva),          // Manutenção Corretiva
    field_10: boolToText(formData.manutencaoPreventiva),         // Manutenção Preventiva
    field_11: formData.tipoLoja || '',                           // Tipo da Loja

    // Sistemas
    field_12: boolToSimNao(sistemas.alarme_do_shopping?.existenteSim,  sistemas.alarme_do_shopping?.existenteNao),   // Alarme Shopping - Existente
    field_13: boolToSimNao(sistemas.alarme_do_shopping?.funcionandoSim, sistemas.alarme_do_shopping?.funcionandoNao), // Alarme Shopping - Funcionando
    field_14: boolToSimNao(sistemas.alarme_da_loja?.existenteSim,       sistemas.alarme_da_loja?.existenteNao),       // Alarme Loja - Existente
    field_15: boolToSimNao(sistemas.alarme_da_loja?.funcionandoSim,     sistemas.alarme_da_loja?.funcionandoNao),     // Alarme Loja - Funcionando
    field_16: boolToSimNao(sistemas.comando_de_gás?.existenteSim,       sistemas.comando_de_gás?.existenteNao),       // Comando de Gás - Existente
    field_17: boolToSimNao(sistemas.comando_de_gás?.funcionandoSim,     sistemas.comando_de_gás?.funcionandoNao),     // Comando de Gás - Funcionando

    // Especificações
    field_18: formData.centralPropria === 'sim' ? 'Sim' : formData.centralPropria === 'nao' ? 'Não' : '',  // Central Própria
    field_19: Number(formData.especificacoes?.nDF) || 0,         // Nº DF
    field_20: Number(formData.especificacoes?.nDT) || 0,         // Nº DT
    field_21: Number(formData.especificacoes?.nAM) || 0,         // Nº AM
    field_22: Number(formData.especificacoes?.nSirenes) || 0,    // Nº Sirenes
    field_23: Number(formData.especificacoes?.nDG) || 0,         // Nº DG
    field_24: Number(formData.especificacoes?.nModulos) || 0,    // Nº Módulos
    field_25: Number(formData.especificacoes?.outrosDispositivos) || 0, // Outros Dispositivos

    // Observações
    field_26: formData.observacoes || '',

    // Status da Loja
    field_27: boolToText(formData.statusLoja?.['Sistema Funcionando Normalmente']),
    field_28: boolToText(formData.statusLoja?.['Sistema Funcionando Parcialmente']),
    field_29: boolToText(formData.statusLoja?.['Sistema com Defeito']),
    field_30: boolToText(formData.statusLoja?.['Não Possui Detecção']),
    field_31: formData.statusOutros || '',

    // Pendências
    field_32: boolToText(formData.pendencias?.['Necessário Abertura do Forro']),
    field_33: boolToText(formData.pendencias?.['Verificar Integridade do Cabo de Alimentação']),
    field_34: boolToText(formData.pendencias?.['Verificar Integridade do Cabo de Sinal']),
    field_35: boolToText(formData.pendencias?.['Interligar o Sistema da Loja com do Shopping']),
    field_36: boolToText(formData.pendencias?.['Necessário Verificar o Sistema da Loja']),
    field_37: boolToText(formData.pendencias?.['Troca de Dispositivo']),
    field_38: formData.pendenciasOutros || '',

    // Rodapé
    field_39: formData.engTecnico || '',
    field_40: formData.horarioInicio || '',
    field_41: formData.horarioTermino || '',
    field_42: formData.totalHoras || '',
    field_43: formData.aceitoPor || '',
  };
}

/**
 * Faz o caminho inverso: Mapeia as colunas do Microsoft Lists
 * para o JSON que o formulário React (react-hook-form) entende.
 */
function mapListFieldsToForm(fields) {
  return {
    data: fields.Title ? fields.Title.split('/').reverse().join('-') : '',
    loja:       fields.field_1 || '',
    codigoLoja: fields.field_2 || '',

    responsavelLoja: {
      solicitante: fields.field_3 || '',
      telefone:    String(fields.field_4 || ''),
      email:       fields.field_5 || '',
    },
    responsavelShopping: {
      solicitante: fields.field_6 || '',
      telefone:    String(fields.field_7 || ''),
      email:       fields.field_8 || '',
    },

    tipoManutencao: fields.field_9 === 'Sim' ? 'corretiva' : fields.field_10 === 'Sim' ? 'preventiva' : '',
    tipoLoja: fields.field_11 || '',

    sistemas: {
      alarme_do_shopping: {
        existenteSim:   fields.field_12 === 'Sim', existenteNao:    fields.field_12 === 'Não',
        funcionandoSim: fields.field_13 === 'Sim', funcionandoNao:  fields.field_13 === 'Não',
      },
      alarme_da_loja: {
        existenteSim:   fields.field_14 === 'Sim', existenteNao:    fields.field_14 === 'Não',
        funcionandoSim: fields.field_15 === 'Sim', funcionandoNao:  fields.field_15 === 'Não',
      },
      'comando_de_gás': {
        existenteSim:   fields.field_16 === 'Sim', existenteNao:    fields.field_16 === 'Não',
        funcionandoSim: fields.field_17 === 'Sim', funcionandoNao:  fields.field_17 === 'Não',
      },
    },

    centralPropria: fields.field_18 === 'Sim' ? 'sim' : fields.field_18 === 'Não' ? 'nao' : '',
    especificacoes: {
      nDF:               fields.field_19 || '',
      nDT:               fields.field_20 || '',
      nAM:               fields.field_21 || '',
      nSirenes:          fields.field_22 || '',
      nDG:               fields.field_23 || '',
      nModulos:          fields.field_24 || '',
      outrosDispositivos: fields.field_25 || '',
    },

    observacoes: fields.field_26 || '',

    statusLojaOpcao:
      fields.field_27 === 'Sim' ? 'Sistema Funcionando Normalmente'  :
      fields.field_28 === 'Sim' ? 'Sistema Funcionando Parcialmente' :
      fields.field_29 === 'Sim' ? 'Sistema com Defeito'              :
      fields.field_30 === 'Sim' ? 'Não Possui Detecção'              : '',
    statusOutros: fields.field_31 || '',

    pendencias: {
      'Necessário Abertura do Forro':                    fields.field_32 === 'Sim',
      'Verificar Integridade do Cabo de Alimentação':    fields.field_33 === 'Sim',
      'Verificar Integridade do Cabo de Sinal':          fields.field_34 === 'Sim',
      'Interligar o Sistema da Loja com do Shopping':    fields.field_35 === 'Sim',
      'Necessário Verificar o Sistema da Loja':          fields.field_36 === 'Sim',
      'Troca de Dispositivo':                            fields.field_37 === 'Sim',
    },
    pendenciasOutros: fields.field_38 || '',

    engTecnico:     fields.field_39 || '',
    horarioInicio:  fields.field_40 || '',
    horarioTermino: fields.field_41 || '',
    totalHoras:     fields.field_42 || '',
    aceitoPor:      fields.field_43 || '',
  };
}

/**
 * Cache dos IDs resolvidos (evita chamar o Graph em toda requisição)
 */
let _cachedSiteId = null;
let _cachedListId = null;
let _cachedListName = null; // rastreia qual lista está em cache

/**
 * Resolve o Site ID e List ID do SharePoint via Graph API
 * usando hostname, site path e list name do .env.
 * Os resultados são cacheados em memória.
 */
async function resolveSharePointIds(graphClient) {
  const { SHAREPOINT_HOSTNAME, SHAREPOINT_SITE_PATH, SHAREPOINT_LIST_NAME } = process.env;

  if (!SHAREPOINT_HOSTNAME || !SHAREPOINT_SITE_PATH || !SHAREPOINT_LIST_NAME) {
    throw new Error(
      '⚠️  Variáveis SharePoint não configuradas. ' +
      'Preencha SHAREPOINT_HOSTNAME, SHAREPOINT_SITE_PATH e SHAREPOINT_LIST_NAME no .env'
    );
  }

  // Resolver Site ID (se não cacheado)
  if (!_cachedSiteId) {
    console.log(`🔍 Resolvendo Site ID: ${SHAREPOINT_HOSTNAME}:${SHAREPOINT_SITE_PATH}`);
    const site = await graphClient
      .api(`/sites/${SHAREPOINT_HOSTNAME}:${SHAREPOINT_SITE_PATH}`)
      .get();
    _cachedSiteId = site.id;
    console.log(`✅ Site ID resolvido: ${_cachedSiteId}`);
  }

  // Resolver List ID (se não cacheado ou se a lista mudou)
  if (!_cachedListId || _cachedListName !== SHAREPOINT_LIST_NAME) {
    _cachedListId = null; // invalida cache se a lista mudou
    console.log(`🔍 Resolvendo List ID: "${SHAREPOINT_LIST_NAME}"`);

    // Busca TODAS as listas e filtra no lado do Node comparando
    // tanto displayName quanto o name (segmento de URL) — o Graph API filter
    // funciona apenas para displayName e pode falhar com nomes especiais.
    const allLists = await graphClient
      .api(`/sites/${_cachedSiteId}/lists`)
      .get();

    const found = (allLists.value || []).find(
      (l) =>
        l.displayName === SHAREPOINT_LIST_NAME ||
        l.name === SHAREPOINT_LIST_NAME
    );

    if (!found) {
      // Loga as listas disponíveis para facilitar o diagnóstico
      const available = (allLists.value || [])
        .map((l) => `"${l.displayName}" (name: ${l.name})`)
        .join('\n  ');
      throw new Error(
        `Lista "${SHAREPOINT_LIST_NAME}" não encontrada no site.\n` +
        `Listas disponíveis:\n  ${available}`
      );
    }

    _cachedListId = found.id;
    _cachedListName = SHAREPOINT_LIST_NAME;
    console.log(`✅ List ID resolvido: "${found.displayName}" → ${_cachedListId}`);
  }

  return { siteId: _cachedSiteId, listId: _cachedListId };
}

/**
 * POST /api/checklists
 * Recebe o JSON do formulário e cria um item no Microsoft Lists.
 */
const create = async (req, res, next) => {
  try {
    const accessToken = req.session?.accessToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado. Faça login em /api/auth/signin',
      });
    }

    const graphClient = getGraphClient(accessToken);

    // Resolver IDs do SharePoint dinamicamente
    const { siteId, listId } = await resolveSharePointIds(graphClient);

    const formData = req.body;
    const fields = mapFormToListFields(formData);

    console.log('📋 Enviando checklist para Microsoft Lists...');

    const result = await graphClient
      .api(`/sites/${siteId}/lists/${listId}/items`)
      .post({ fields });

    console.log('✅ Item criado no Microsoft Lists:', result.id);

    // ============================================
    // FASE 5: Gerar PDF e Enviar por E-mail (Assíncrono)
    // Continua em background para não travar a resposta imediata da API
    // ============================================
    const fs = require('fs');
    const logFile = require('path').join(__dirname, '..', 'debug-email.log');
    
    (async () => {
      try {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] 📄 Gerando PDF...\n`);
        console.log('📄 Gerando PDF...');
        const pdfBase64 = await generatePDFBase64(formData);
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ✅ PDF gerado. Buffer Base64 Size: ${pdfBase64.length}\n`);
        console.log('✅ PDF gerado. Buffer Base64 Size:', pdfBase64.length);

        if (formData.email) {
          fs.appendFileSync(logFile, `[${new Date().toISOString()}] ✉️ Preparando disparo de email...\n`);
          await sendChecklistEmail(accessToken, formData, pdfBase64);
          fs.appendFileSync(logFile, `[${new Date().toISOString()}] ✅ E-mail enviado com sucesso!\n`);
        } else {
          fs.appendFileSync(logFile, `[${new Date().toISOString()}] ⏭️ Sem endereço de e-mail.\n`);
          console.log('⏭️ Sem endereço de e-mail. Pulando etapa de envio via Outlook.');
        }
      } catch (postError) {
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ❌ Erro Async PDF/Email: ${postError.message}\n${postError.stack}\n`);
        console.error('❌ Erro no processo assíncrono de PDF/Email:', postError.message);
      }
    })();

    res.status(201).json({
      success: true,
      message: 'Checklist salvo no Microsoft Lists e processamento de PDF/E-mail iniciado!',
      data: {
        id: result.id,
        fields: result.fields,
      },
    });
  } catch (error) {
    console.error('❌ Erro ao salvar no Microsoft Lists:', error.message);

    // Erro específico do Graph API
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
 * GET /api/checklists/columns
 * Lista todas as colunas do Microsoft Lists com nome interno e nome de exibição.
 * Útil para debugar/mapear os campos corretamente.
 */
const listColumns = async (req, res, next) => {
  try {
    const accessToken = req.session?.accessToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado. Faça login em /api/auth/signin',
      });
    }

    const graphClient = getGraphClient(accessToken);
    const { siteId, listId } = await resolveSharePointIds(graphClient);

    const columnsResponse = await graphClient
      .api(`/sites/${siteId}/lists/${listId}/columns`)
      .get();

    const columns = columnsResponse.value.map(col => ({
      displayName: col.displayName,
      internalName: col.name,
      type: col.text ? 'text' : col.boolean ? 'boolean' : col.number ? 'number' : col.dateTime ? 'dateTime' : col.choice ? 'choice' : 'other',
    }));

    console.log('📋 Colunas do Microsoft Lists:');
    columns.forEach(col => {
      console.log(`  📌 "${col.displayName}" → internal: "${col.internalName}" (${col.type})`);
    });

    res.json({ success: true, columns });
  } catch (error) {
    console.error('❌ Erro ao listar colunas:', error.message);
    next(error);
  }
};

/**
 * GET /api/checklists
 * Busca os itens da lista no Microsoft Lists para exibir na página inicial.
 */
const list = async (req, res, next) => {
  try {
    const accessToken = req.session?.accessToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado. Faça login em /api/auth/signin',
      });
    }

    const graphClient = getGraphClient(accessToken);
    const { siteId, listId } = await resolveSharePointIds(graphClient);

    const result = await graphClient
      .api(`/sites/${siteId}/lists/${listId}/items`)
      .expand('fields')
      .top(50)
      .get(); // Sorting doesn't always work without index, so we get newest first via sort below if needed

    // Mapear os campos para exibição no painel
    const checklists = result.value.map(item => {
      const f = item.fields || {};
      return {
        id: item.id,
        data:        f.Title || '',
        loja:        f.field_1  || '',
        solicitante: f.field_3  || '',   // Resp. Loja - Solicitante
        engTecnico:  f.field_39 || '',
        statusLoja: {
          'Sistema Funcionando Normalmente':  f.field_27 === 'Sim',
          'Sistema Funcionando Parcialmente': f.field_28 === 'Sim',
          'Sistema com Defeito':              f.field_29 === 'Sim',
          'Não Possui Detecção':              f.field_30 === 'Sim',
        }
      };
    });

    // Sort by ID naturally sorts by creation time if sequential, or just return as is
    res.json({ success: true, data: checklists.reverse() }); // Simplest way to get newest if appending at the bottom
  } catch (error) {
    console.error('❌ Erro ao listar checklists:', error.message);
    next(error);
  }
};

/**
 * GET /api/checklists/:id
 * Busca um único formulário e retorna seus dados mapeados
 */
const getById = async (req, res, next) => {
  try {
    const accessToken = req.session?.accessToken;

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado. Faça login em /api/auth/signin',
      });
    }

    const { id } = req.params;
    const graphClient = getGraphClient(accessToken);
    const { siteId, listId } = await resolveSharePointIds(graphClient);

    const result = await graphClient
      .api(`/sites/${siteId}/lists/${listId}/items/${id}`)
      .expand('fields')
      .get();

    const formData = mapListFieldsToForm(result.fields || {});

    res.json({ success: true, data: formData });
  } catch (error) {
    console.error('❌ Erro ao buscar checklist por ID:', error.message);
    next(error);
  }
};

module.exports = { create, listColumns, list, getById };
