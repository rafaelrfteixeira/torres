/**
 * clientMenuConfig.js — Configuração dos Menus por Cliente
 *
 * Define a estrutura hierárquica de menus/submenus para cada tenant.
 * Cada sistema (SDAI, BMS, SCA) possui seus submenus específicos.
 *
 * Os submenus com `comingSoon: true` renderizam a página placeholder.
 * Os submenus com `isExternal: true` abrem em nova aba.
 * Os submenus com `isCadastros: true` vão para a página de cadastros.
 */

/**
 * Gera os submenus padrão para SDAI
 * @param {string} tenant - ID do tenant
 * @returns {Array} Lista de submenus
 */
function getSDAISubmenus(tenant) {
  const isShoppingRecife = tenant === 'shopping-recife';
  return [
    {
      id: 'dashboard-inspecao',
      label: 'Dashboard Inspeção Lojas',
      route: `/${tenant}/sdai/dashboard`,
      icon: 'bar-chart',
    },
    {
      id: 'dashboard-preventivas',
      label: 'Dashboard Preventivas',
      route: `/${tenant}/sdai/preventivas/dashboard`,
      icon: 'activity',
      comingSoon: !isShoppingRecife,
    },
    {
      id: 'inspecao-lojas',
      label: 'Inspeção Lojas',
      route: `/${tenant}/sdai/inspecao-lojas`,
      icon: 'clipboard-check',
    },
    {
      id: 'preventivas-area-comum',
      label: 'Preventivas Área Comum',
      route: `/${tenant}/sdai/preventivas/area-comum`,
      icon: 'wrench',
      comingSoon: !isShoppingRecife,
    },
    {
      id: 'corretivas',
      label: 'Corretivas/Ocorrências',
      route: `/${tenant}/sdai/corretivas`,
      icon: 'alert-triangle',
      comingSoon: !isShoppingRecife,
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      route: `/${tenant}/sdai/relatorios`,
      icon: 'file-text',
      comingSoon: !isShoppingRecife,
    },
    {
      id: 'cadastros',
      label: 'Cadastros',
      route: `/${tenant}/sdai/cadastros`,
      icon: 'database',
      isCadastros: true,
    },
  ];
}

/**
 * Gera os submenus padrão para BMS
 * @param {string} tenant - ID do tenant
 * @returns {Array} Lista de submenus
 */
function getBMSSubmenus(tenant) {
  return [
    {
      id: 'dashboard-inspecao',
      label: 'Dashboard Inspeção Lojas',
      route: `/${tenant}/bms/dashboard`,
      icon: 'bar-chart',
    },
    {
      id: 'dashboard-preventivas',
      label: 'Dashboard Preventivas',
      route: `/${tenant}/bms/preventivas/dashboard`,
      icon: 'activity',
      comingSoon: true,
    },
    {
      id: 'inspecao-lojas',
      label: 'Inspeção Lojas',
      route: `/${tenant}/bms/inspecao-lojas`,
      icon: 'clipboard-check',
    },
    {
      id: 'preventivas-area-comum',
      label: 'Preventivas Área Comum',
      route: `/${tenant}/bms/preventivas/area-comum`,
      icon: 'wrench',
      comingSoon: true,
    },
    {
      id: 'corretivas',
      label: 'Corretivas/Ocorrências',
      route: `/${tenant}/bms/corretivas`,
      icon: 'alert-triangle',
      comingSoon: true,
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      route: `/${tenant}/bms/relatorios`,
      icon: 'file-text',
    },
    {
      id: 'cadastros',
      label: 'Cadastros',
      route: `/${tenant}/bms/cadastros`,
      icon: 'database',
      isCadastros: true,
    },
  ];
}

/**
 * Gera os submenus padrão para SCA
 * @param {string} tenant - ID do tenant
 * @returns {Array} Lista de submenus
 */
function getSCASubmenus(tenant) {
  return [
    {
      id: 'dashboard-preventivas',
      label: 'Dashboard Preventivas',
      route: `/${tenant}/sca/preventivas/dashboard`,
      icon: 'activity',
      comingSoon: true,
    },
    {
      id: 'preventivas',
      label: 'Preventivas',
      route: `/${tenant}/sca/preventivas`,
      icon: 'wrench',
      comingSoon: true,
    },
    {
      id: 'corretivas',
      label: 'Corretivas/Ocorrências',
      route: `/${tenant}/sca/corretivas`,
      icon: 'alert-triangle',
      comingSoon: true,
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      route: `/${tenant}/sca/relatorios`,
      icon: 'file-text',
    },
    {
      id: 'cadastros',
      label: 'Cadastros',
      route: `/${tenant}/sca/cadastros`,
      icon: 'database',
      isCadastros: true,
    },
  ];
}

/**
 * Retorna a configuração de menus para um tenant específico.
 * @param {string} tenant - ID do tenant (ex: 'riomar-recife')
 * @returns {Array} Array de sistemas com seus submenus
 */
export function getMenuConfig(tenant) {
  const configs = {
    'riomar-recife': [
      { id: 'sdai', label: 'SDAI', icon: 'flame', submenus: getSDAISubmenus(tenant) },
      { id: 'bms', label: 'BMS', icon: 'cpu', submenus: getBMSSubmenus(tenant) },
      { id: 'sca', label: 'SCA', icon: 'shield', submenus: getSCASubmenus(tenant) },
    ],
    'riomar-kennedy': [
      { id: 'sdai', label: 'SDAI', icon: 'flame', submenus: getSDAISubmenus(tenant) },
      { id: 'bms', label: 'BMS', icon: 'cpu', submenus: getBMSSubmenus(tenant) },
    ],
    'shopping-recife': [
      { id: 'sdai', label: 'SDAI', icon: 'flame', submenus: getSDAISubmenus(tenant) },
    ],
    'shopping-guararapes': [
      { id: 'sdai', label: 'SDAI', icon: 'flame', submenus: getSDAISubmenus(tenant) },
      { id: 'bms', label: 'BMS', icon: 'cpu', submenus: getBMSSubmenus(tenant) },
    ],
    'riomar-aracaju': [
      { id: 'bms', label: 'BMS', icon: 'cpu', submenus: getBMSSubmenus(tenant) },
    ],
  };

  return configs[tenant] || [];
}

/**
 * Retorna a primeira rota disponível para um tenant.
 * Usado para redirecionar após seleção de cliente.
 * @param {string} tenant - ID do tenant
 * @returns {string} Rota do primeiro submenu disponível
 */
export function getDefaultRoute(tenant) {
  const menus = getMenuConfig(tenant);
  if (menus.length > 0 && menus[0].submenus.length > 0) {
    return menus[0].submenus[0].route;
  }
  return `/${tenant}`;
}
