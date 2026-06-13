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
    excelLojasUrl: 'https://torrescx-my.sharepoint.com/:x:/g/personal/carlos_gueiros_torrescx_com_br/IQAtbHrJTvbyR5opMe1Rmy97AZwNIkQfD_uMib1B9STU51Y',
    ccEmails: ['carlos.gueiros@torrescx.com.br'],
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
};

// -----------------------------------------------
// Permissões RBAC por E-mail
// ['*'] = acesso total (master)
// ['riomar-recife'] = acesso apenas ao RioMar Recife
// -----------------------------------------------
const permissions = {
  'rafael.teixeira@torrescx.com.br': ['*'],
  'msantos@torrescx.com.br': ['*'],
  'antonio.cezar@torrescx.com.br': ['riomar-recife'],
  'carlos.gueiros@torrescx.com.br': ['riomar-kennedy'],
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
