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
  // Helper: converte checkbox Sim/Não do formulário para string
  const boolToSimNao = (sim, nao) => {
    if (sim) return 'Sim';
    if (nao) return 'Não';
    return '';
  };

  // Helper: converte boolean para "Sim"/"Não" (colunas são do tipo texto no Lists)
  const boolToText = (val) => val ? 'Sim' : 'Não';

  const sistemas = formData.sistemas || {};

  // ⚠️ Os nomes internos no SharePoint Lists são field_1, field_2, etc.
  //    Os nomes de exibição são diferentes dos nomes internos.
  //    Mapeamento completo: displayName → internalName
  return {
    // Title (interno: Title) — O usuário renomeou no SharePoint para "DataInspecao"
    // Formatar 'YYYY-MM-DD' para 'DD/MM/YYYY'
    Title: formData.data ? formData.data.split('-').reverse().join('/') : '',

    // --- Cabeçalho ---
    field_1: formData.loja || '',                  // Loja
    field_2: formData.solicitante || '',            // Solicitante
    field_3: formData.telefone || '',               // Telefone
    Email: formData.email || '',                    // Email (Usuário alterou para Texto simples)
    field_5: boolToText(formData.manutencaoCorretiva),   // ManutencaoCorretiva (texto)
    field_6: boolToText(formData.manutencaoPreventiva),  // ManutencaoPreventiva (texto)
    field_7: formData.tipoLoja || '',               // TipoLoja

    // --- Sistemas — Existente ---
    field_8: boolToSimNao(sistemas.alarme_do_shopping?.existenteSim, sistemas.alarme_do_shopping?.existenteNao),       // AlarmeShopping_Existente
    field_9: boolToSimNao(sistemas.alarme_do_shopping?.funcionandoSim, sistemas.alarme_do_shopping?.funcionandoNao),    // AlarmeShopping_Funcionando
    field_10: boolToSimNao(sistemas.alarme_da_loja?.existenteSim, sistemas.alarme_da_loja?.existenteNao),              // AlarmeLoja_Existente
    field_11: boolToSimNao(sistemas.alarme_da_loja?.funcionandoSim, sistemas.alarme_da_loja?.funcionandoNao),           // AlarmeLoja_Funcionando
    field_12: boolToSimNao(sistemas.extração_de_fumaça?.existenteSim, sistemas.extração_de_fumaça?.existenteNao),       // ExtracaoFumaca_Existente
    field_13: boolToSimNao(sistemas.extração_de_fumaça?.funcionandoSim, sistemas.extração_de_fumaça?.funcionandoNao),    // ExtracaoFumaca_Funcionando
    field_14: boolToSimNao(sistemas.insuflamento_de_ar?.existenteSim, sistemas.insuflamento_de_ar?.existenteNao),       // InsuflamentoAr_Existente
    field_15: boolToSimNao(sistemas.insuflamento_de_ar?.funcionandoSim, sistemas.insuflamento_de_ar?.funcionandoNao),    // InsuflamentoAr_Funcionando
    field_16: boolToSimNao(sistemas.ar_condicionado?.existenteSim, sistemas.ar_condicionado?.existenteNao),             // ArCondicionado_Existente
    field_17: boolToSimNao(sistemas.ar_condicionado?.funcionandoSim, sistemas.ar_condicionado?.funcionandoNao),          // ArCondicionado_Funcionando
    field_18: boolToSimNao(sistemas.comando_de_gás?.existenteSim, sistemas.comando_de_gás?.existenteNao),               // ComandoGas_Existente
    field_19: boolToSimNao(sistemas.comando_de_gás?.funcionandoSim, sistemas.comando_de_gás?.funcionandoNao),            // ComandoGas_Funcionando
    field_20: boolToSimNao(sistemas.damper_extração?.existenteSim, sistemas.damper_extração?.existenteNao),              // DamperExtracao_Existente
    field_21: boolToSimNao(sistemas.damper_extração?.funcionandoSim, sistemas.damper_extração?.funcionandoNao),           // DamperExtracao_Funcionando
    field_22: boolToSimNao(sistemas.damper_insuflamento?.existenteSim, sistemas.damper_insuflamento?.existenteNao),      // DamperInsuflamento_Existente
    field_23: boolToSimNao(sistemas.damper_insuflamento?.funcionandoSim, sistemas.damper_insuflamento?.funcionandoNao),   // DamperInsuflamento_Funcionando

    // --- Especificações ---
    field_24: formData.centralPropria === 'sim' ? 'Sim' : formData.centralPropria === 'nao' ? 'Não' : '',  // CentralPropria
    field_25: Number(formData.especificacoes?.nDF) || 0,           // NumDF
    field_26: Number(formData.especificacoes?.nDT) || 0,           // NumDT
    field_27: Number(formData.especificacoes?.nAM) || 0,           // NumAM
    field_28: Number(formData.especificacoes?.nSirenes) || 0,      // NumSirenes
    field_29: Number(formData.especificacoes?.nDG) || 0,           // NumDG
    field_30: Number(formData.especificacoes?.nModulos) || 0,      // NumModulos
    field_31: Number(formData.especificacoes?.outrosDispositivos) || 0, // OutrosDispositivos

    // --- Observações ---
    field_32: formData.observacoes || '',                          // Observacoes

    // --- Status da Loja (tipo texto no Lists) ---
    field_33: boolToText(formData.statusLoja?.['Sistema Funcionando Normalmente']),    // StatusFuncionandoNormalmente
    field_34: boolToText(formData.statusLoja?.['Sistema Funcionando Parcialmente']),   // StatusFuncionandoParcialmente
    field_35: boolToText(formData.statusLoja?.['Sistema com Defeito']),                // StatusComDefeito
    field_36: boolToText(formData.statusLoja?.['Não Possui Detecção']),                // StatusNaoPossuiDeteccao
    field_37: formData.statusOutros || '',                         // StatusOutros

    // --- Pendências (tipo texto no Lists) ---
    field_38: boolToText(formData.pendencias?.['Necessário Abertura do Forro']),                          // PendAberturaForro
    field_39: boolToText(formData.pendencias?.['Verificar Integridade do Cabo de Alimentação']),          // PendCaboAlimentacao
    field_40: boolToText(formData.pendencias?.['Verificar Integridade do Cabo de Sinal']),                // PendCaboSinal
    field_41: boolToText(formData.pendencias?.['Interligar o Sistema da Loja com do Shopping']),          // PendInterligarSistema
    field_42: boolToText(formData.pendencias?.['Necessário Verificar o Sistema da Loja']),                // PendVerificarSistemaLoja
    field_43: boolToText(formData.pendencias?.['Troca de Dispositivo']),                                  // PendTrocaDispositivo
    field_44: formData.pendenciasOutros || '',                     // PendOutros

    // --- Rodapé ---
    field_45: formData.engTecnico || '',                           // EngTecnico
    field_46: formData.horarioInicio || '',                        // HorarioInicio
    field_47: formData.horarioTermino || '',                       // HorarioTermino
    field_48: formData.totalHoras || '',                           // TotalHoras
    field_49: formData.aceitoPor || '',                            // AceitoPor
  };
}

/**
 * Cache dos IDs resolvidos (evita chamar o Graph em toda requisição)
 */
let _cachedSiteId = null;
let _cachedListId = null;

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

  // Resolver List ID (se não cacheado)
  if (!_cachedListId) {
    console.log(`🔍 Resolvendo List ID: "${SHAREPOINT_LIST_NAME}"`);
    const lists = await graphClient
      .api(`/sites/${_cachedSiteId}/lists`)
      .filter(`displayName eq '${SHAREPOINT_LIST_NAME}'`)
      .get();

    if (!lists.value || lists.value.length === 0) {
      throw new Error(`Lista "${SHAREPOINT_LIST_NAME}" não encontrada no site.`);
    }

    _cachedListId = lists.value[0].id;
    console.log(`✅ List ID resolvido: ${_cachedListId}`);
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

    // Mapear os campos confidenciais baseando-se no mapeamento interno da controler
    const checklists = result.value.map(item => {
      const f = item.fields || {};
      return {
        id: item.id,
        data: f.Title || f.DataInspecao || '',
        loja: f.field_1 || '',
        solicitante: f.field_2 || '',
        engTecnico: f.field_45 || '',
        statusLoja: {
          'Sistema Funcionando Normalmente': f.field_33 === 'Sim',
          'Sistema Funcionando Parcialmente': f.field_34 === 'Sim',
          'Sistema com Defeito': f.field_35 === 'Sim',
          'Não Possui Detecção': f.field_36 === 'Sim'
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

module.exports = { create, listColumns, list };
