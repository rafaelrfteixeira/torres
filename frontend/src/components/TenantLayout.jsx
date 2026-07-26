import { useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import { getMenuConfig } from '../config/clientMenuConfig';

/**
 * TenantLayout — Layout principal pós-seleção de cliente
 *
 * Renderiza a sidebar + topbar + área de conteúdo (<Outlet />).
 * Extrai o tenant da URL e carrega os menus correspondentes.
 *
 * @param {Object} props
 * @param {Object} props.user - Dados do usuário autenticado
 * @param {Array} props.shoppingsMetadata - Metadata de todos os shoppings
 */
export default function TenantLayout({ user, shoppingsMetadata = [] }) {
  const { tenant } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentShopping = shoppingsMetadata.find((s) => s.id === tenant) || {
    id: tenant,
    name: tenant,
    logo: '',
  };

  const menuConfig = getMenuConfig(tenant);

  const logoutUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/signout`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar
        menuConfig={menuConfig}
        currentShopping={currentShopping}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area (offset on desktop) */}
      <div className="tenant-main min-h-screen flex flex-col">
        {/* Topbar */}
        <header className="bg-slate-900 border-b border-slate-700/50 px-4 sm:px-6 py-3 text-white flex justify-between items-center sticky top-0 z-40 shadow-md">
          <div className="flex items-center gap-3">
            {/* Hamburger (mobile only) */}
            <button
              className="sidebar-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center font-bold text-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="text-sm font-medium hidden sm:inline-block">
              Olá, <span className="text-brand-300">{user?.name}</span>
            </span>
          </div>

          <a
            href={logoutUrl}
            className="text-sm text-slate-300 hover:text-white flex items-center gap-2 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
          >
            Sair
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </a>
        </header>

        {/* Content area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
