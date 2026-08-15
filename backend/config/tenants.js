/**
 * tenants.js — Configuração Multi-Tenant
 *
 * Centraliza todas as configurações específicas de cada shopping (tenant)
 * e o mapeamento de permissões por e-mail (RBAC hardcoded).
 *
 * Para adicionar um novo shopping:
 *   1. Adicione uma entrada em `shoppings` com os dados do SharePoint/Excel
 *   2. Adicione os e-mails dos técnicos autorizados em `permissions`
 */

// -----------------------------------------------
// Dicionário de Shoppings (Tenants)
// -----------------------------------------------
const shoppings = {
  'riomar-recife': {
    name: 'Shopping RioMar Recife',
    logo: '/logo_riomar_recife.png',
    listaSDAI: '2024-6-1361-SDAI-Shopping Riomar Recife',
    listaBMS: '2024-6-1361-BMS-Shopping Riomar Recife',
    excelLojasUrl: 'https://torrescx-my.sharepoint.com/:x:/g/personal/msantos_torrescx_com_br/IQBfN8g4jixWQZEVBdGxBqpOAdzKmnnqf37pdxWv8UftGLM',
    ccEmails: ['msantos@torrescx.com.br'],
    // Preventivas Área Comum
    excelPreventivasUrl: null, // TODO: Configurar URL da Matriz Mestra para RioMar Recife
    listaHistoricoPreventivas: null,
    listaCorretivas: null,
    // Responsável Shopping padrão (usado como default nos formulários)
    responsavelShopping: {
      sdai: {
        solicitante: 'Flávia Barbosa',
        telefone: '81992643095',
        email: 'flavia.barbosa@riomarrecife.com.br',
      },
      bms: {
        solicitante: 'José Gabriel',
        telefone: '81992643095',
        email: 'jose.gabriel@riomarrecife.com.br',
      },
    },
  },
  'riomar-kennedy': {
    name: 'Shopping RioMar Kennedy',
    logo: '/logo_riomar_kennedy.png',
    listaSDAI: '2021-5-491-SDAI-Shopping Riomar Kennedy',
    listaBMS: '2021-5-491-BMS-Shopping Riomar Kennedy',
    excelLojasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQCd4pgWXkNERZTurFywc0WfAWsywZVNZDcVOdXxszKxUQA',
    ccEmails: ['carlos.gueiros@torrescx.com.br'],
    // Preventivas Área Comum
    excelPreventivasUrl: null, // TODO: Configurar
    listaHistoricoPreventivas: null,
    listaCorretivas: null,
    responsavelShopping: {
      sdai: {
        solicitante: 'Maria Eugenia',
        telefone: '8592267150',
        email: 'eugenia.lyra@riomarkennedy.com.br',
      },
      bms: {
        solicitante: 'Maria Eugenia',
        telefone: '8592267150',
        email: 'eugenia.lyra@riomarkennedy.com.br',
      },
    },
  },
  'shopping-recife': {
    name: 'Shopping Recife',
    logo: '/logo_shopping_recife.png',
    listaSDAI: '2026-3-180-SDAI-Shopping Recife SDAI',
    listaBMS: '2026-3-180-BMS-Shopping Recife BMS',
    excelLojasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQA1oFdc24rWTKKUi_82HSrIAYCtEH7wdEc21YIgpj02lMc',
    ccEmails: ['carlos.gueiros@torrescx.com.br'],
    // Preventivas Área Comum
    excelPreventivasUrl: null,
    listaHistoricoPreventivas: null,
    listaCorretivas: null,
    responsavelShopping: {
      sdai: {
        solicitante: 'Roberto Santana',
        telefone: '81989340130',
        email: 'roberto.santana@shoppingrecife.com.br',
      },
      bms: {
        solicitante: 'Roberto Santana',
        telefone: '81989340130',
        email: 'roberto.santana@shoppingrecife.com.br',
      },
    },
  },
  'shopping-guararapes': {
    name: 'Shopping Guararapes',
    logo: '/logo_shopping_guararapes.png',
    listaSDAI: '2026-1-1765-SDAI-GUARARAPES SHOPPING',
    listaBMS: '2026-1-1765-BMS-GUARARAPES SHOPPING',
    excelLojasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQBHpqCvw4i8RJHroFbfTUOGAdLR3yvlO-9xv0cb_Sk8_sw',
    ccEmails: ['carlos.gueiros@torrescx.com.br'],
    // Preventivas Área Comum
    excelPreventivasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQA5YLv6hEgeSpDMuoDO2Fb9ARwv4Jg64Mu9jCbrwBTPRoM',
    listaHistoricoPreventivas: 'SHOPPING_GUARARAPES_PREVENTIVAS_2026',
    listaCorretivas: 'CC-2026-1-1765-MAN-SH-GUARARAPES',
    responsavelShopping: {
      sdai: {
        solicitante: 'Edielison Santos',
        telefone: '8194538848',
        email: 'edielison.santos@shopping-guararapes.com.br',
      },
      bms: {
        solicitante: 'Edielison Santos',
        telefone: '8194538848',
        email: 'edielison.santos@shopping-guararapes.com.br',
      },
    },
  },
  'riomar-aracaju': {
    name: 'Shopping RioMar Aracaju',
    logo: '/logo_shopping_riomar_aracaju.png',
    listaSDAI: null,
    listaBMS: '2018-6-26-BMS-Shopping Aracaju BMS',
    excelLojasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQDq52YdifuhT4uSJjYlkAVhAe9BOkesEAGjPzZjsaqFxBI',
    ccEmails: ['carlos.gueiros@torrescx.com.br'],
    // Preventivas Área Comum
    excelPreventivasUrl: null, // TODO: Configurar
    listaHistoricoPreventivas: null,
    listaCorretivas: null,
    responsavelShopping: {
      sdai: null,
      bms: {
        solicitante: 'Elenilson Santos',
        telefone: '79981115949',
        email: 'elenilson.santos@riomararacaju.com.br',
      },
    },
  },
  'salvador-norte': {
    name: 'Salvador Norte Shopping',
    logo: '/logo_salvador_norte_shooping.png',
    listaSDAI: null,
    listaBMS: null,
    excelLojasUrl: null,
    ccEmails: [],
    // Preventivas Área Comum
    excelPreventivasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQCvuYCgnjCqQpbKdU7tBghuATINDi027SO_KsOy97i-qg4',
    listaHistoricoPreventivas: 'SALVADOR_NORTE_SHOPPING_PREVENTIVAS_2026',
    listaCorretivas: 'CC-2024-4-1323-MAN-S_NORTE_SALVAD-MANUTENCAO',
    responsavelShopping: {
      sdai: null, // TODO: Configurar responsável SDAI
      bms: null,  // TODO: Configurar responsável BMS
    },
  },
  'empresarial-rui-barbosa': {
    name: 'Empresarial Rui Barbosa',
    logo: '/logo_empresarial_rui_barbosa.png',
    listaSDAI: '2024-3-1308-MAN-EMPESARIAL RUI BARBOSA_SDAI',
    listaBMS: null,
    excelLojasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQAgZxlwUfGqS46TJZ4Ku1fbAa55hBxDMhATaIskhS3m0KY',
    ccEmails: ['carlos.gueiros@torrescx.com.br'],
    // Preventivas Área Comum
    excelPreventivasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQBpZfxChC-GQb5b1NAJ5oTXAQO8f3MiqDm4K4DPlVnFgNQ',
    listaHistoricoPreventivas: 'EMPRESARIAL_RUI_BARBOSA_PREVENTIVAS_2026',
    listaCorretivas: 'CC-2024-3-1308-MAN-EMPESARIAL RUI BARBOSA',
    responsavelShopping: {
      sdai: {
        solicitante: 'Karen Nascimento',
        telefone: null, // TODO: Configurar telefone
        email: 'ruibarbosa.supervisor@innova.net.br',
      },
      bms: null,
    },
  },
  'empresarial-cicero-dias': {
    name: 'Empresarial Cicero Dias',
    logo: '/logo_empresarial_cicero_dias.png',
    listaSDAI: '2021-11-656-SDAI-MAN-CD-SISTEMAS',
    listaBMS: null,
    excelLojasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQCLpesnBCgqRr9YPpgSksNxAR6NLfo6l-p6fNq0TFL2ccE',
    ccEmails: ['carlos.gueiros@torrescx.com.br'],
    // Preventivas Área Comum
    excelPreventivasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQBE0wOaCrU0Q7YqeNP7WDbcAfTA7qILZ6QWmHFKC_nZ5hM',
    listaHistoricoPreventivas: 'EMPRESARIAL_CICERO_DIAS_PREVENTIVAS_2026',
    listaCorretivas: 'CC-2021-11-656-MAN-CD-SISTEMAS',
    responsavelShopping: {
      sdai: {
        solicitante: 'Maria Raquel',
        telefone: null,
        email: 'acaciogil.gerente@innova.net.br',
      },
      bms: {
        solicitante: 'Maria Raquel',
        telefone: null,
        email: 'acaciogil.gerente@innova.net.br',
      },
    },
  },
  'empresarial-kronos': {
    name: 'Empresarial Kronos',
    logo: '/logo_empresarial_kronos.png',
    listaSDAI: '2024-11-1485-SDAI-MAN-EMPRESARIA KRONOS',
    listaBMS: null,
    excelLojasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQCspYLiTUs8QYChJjpHh-nJAfK8sMnMLa5INs5MUntGGkg',
    ccEmails: ['carlos.gueiros@torrescx.com.br'],
    // Preventivas Área Comum
    excelPreventivasUrl: 'https://torrescx.sharepoint.com/:x:/s/Manutencao/IQDQuNIpkmd3ToZpxeiF65MLAUDt-y65eyAXffLDCY26l4U',
    listaHistoricoPreventivas: 'EMPRESARIA_KRONOS_PREVENTIVAS_2026',
    listaCorretivas: 'CC-2024-11-1485-MAN-EMPRESARIA KRONOS',
    responsavelShopping: {
      sdai: {
        solicitante: 'Eunice',
        telefone: null,
        email: 'kronosemp@gmail.com',
      },
      bms: null,
    },
  },
};

// -----------------------------------------------
// Permissões RBAC por E-mail
// ['*'] = acesso total (master)
// ['riomar-recife'] = acesso apenas ao RioMar Recife
// -----------------------------------------------
const permissions = {
  'rafael.teixeira@torrescx.com.br': ['*'],
  'pedro.ricardolima@torrescx.com.br': ['shopping-recife'],
  'msantos@torrescx.com.br': ['*'],
  'antonio.cezar@torrescx.com.br': ['riomar-recife'],
  'carlos.gueiros@torrescx.com.br': ['riomar-kennedy', 'shopping-recife', 'shopping-guararapes', 'riomar-aracaju', 'empresarial-rui-barbosa', 'empresarial-cicero-dias', 'empresarial-kronos'],
  'david.teixeira@torrescx.com.br': ['riomar-kennedy'],
  'ruan.lima@torrescx.com.br': ['shopping-recife'],
  'leandro.araujo@torrescx.com.br': ['riomar-kennedy'],
  'ananias.santana@torrescx.com.br': ['shopping-guararapes'],
  'arnaldo.justino@torrescx.com.br': ['riomar-aracaju', 'empresarial-rui-barbosa', 'empresarial-cicero-dias', 'empresarial-kronos'],
  'carlos.vinicius@torrescx.com.br': ['riomar-aracaju', 'empresarial-rui-barbosa', 'empresarial-cicero-dias', 'empresarial-kronos'],
  'marcos.torres@torrescx.com.br': ['*'],
  'adm.manut@torrescx.com.br': ['*'],
  'rafael.costal@torrescx.com.br': ['salvador-norte'],
  'joao.henrique@torrescx.com.br': ['salvador-norte'],
};

/**
 * Retorna os shoppings permitidos para um e-mail.
 * Se o e-mail tem ['*'], retorna todas as chaves de shoppings.
 * Se não está cadastrado, retorna array vazio.
 */
function getAllowedShoppings(email) {
  const normalizedEmail = (email || '').toLowerCase();
  const userPerms = permissions[normalizedEmail] || [];

  if (userPerms.includes('*')) {
    return Object.keys(shoppings);
  }

  // Filtra para retornar apenas tenants que realmente existem
  return userPerms.filter((tenant) => shoppings[tenant]);
}

/**
 * Verifica se um e-mail tem acesso a um tenant específico.
 */
function hasAccess(email, tenant) {
  const normalizedEmail = (email || '').toLowerCase();
  const userPerms = permissions[normalizedEmail] || [];
  return userPerms.includes('*') || userPerms.includes(tenant);
}

module.exports = { shoppings, permissions, getAllowedShoppings, hasAccess };
