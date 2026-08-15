import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';

/**
 * Sidebar — Componente de navegação lateral
 *
 * Renderiza menus hierárquicos (SDAI, BMS, SCA) com submenus
 * colapsáveis para cada sistema do tenant selecionado.
 *
 * Responsiva:
 *   - Desktop (≥768px): sempre visível, fixa à esquerda
 *   - Mobile (<768px): off-canvas com overlay, ativada por hamburger
 *
 * @param {Object} props
 * @param {Array} props.menuConfig - Configuração dos menus do tenant
 * @param {Object} props.currentShopping - Metadata do shopping atual
 * @param {boolean} props.isOpen - Estado de abertura (mobile)
 * @param {function} props.onClose - Callback para fechar sidebar (mobile)
 */

// ============================================
// Ícones SVG inline (evita dependência extra)
// ============================================

const icons = {
  flame: (
    <svg className="sidebar-group__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    </svg>
  ),
  cpu: (
    <svg className="sidebar-group__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  shield: (
    <svg className="sidebar-group__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  video: (
    <svg className="sidebar-group__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  camera: (
    <svg className="sidebar-group__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 13.5 5.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  'clipboard-check': (
    <svg className="sidebar-submenu__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 011.65 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
    </svg>
  ),
  'bar-chart': (
    <svg className="sidebar-submenu__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  activity: (
    <svg className="sidebar-submenu__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  wrench: (
    <svg className="sidebar-submenu__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1a7.065 7.065 0 010-9.998l.007-.007a7.065 7.065 0 019.998 0l5.1 5.1a7.065 7.065 0 010 9.998l-.007.007a7.065 7.065 0 01-9.998 0z" />
    </svg>
  ),
  'alert-triangle': (
    <svg className="sidebar-submenu__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  'file-text': (
    <svg className="sidebar-submenu__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3h7.5M6.75 21h10.5a2.25 2.25 0 002.25-2.25V8.25a2.25 2.25 0 00-.75-1.591l-3.909-3.909A2.25 2.25 0 0013.25 2.25H6.75A2.25 2.25 0 004.5 4.5v14.25A2.25 2.25 0 006.75 21z" />
    </svg>
  ),
  database: (
    <svg className="sidebar-submenu__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  ),
};

function getIcon(iconName, className) {
  return icons[iconName] || null;
}

export default function Sidebar({ menuConfig = [], currentShopping = {}, isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Estado dos menus colapsáveis — abre o primeiro por padrão
  const [openGroups, setOpenGroups] = useState(() => {
    return menuConfig.length > 0 ? { [menuConfig[0].id]: true } : {};
  });

  // Atualiza os grupos abertos quando menuConfig muda (troca de tenant)
  useEffect(() => {
    if (menuConfig.length > 0) {
      setOpenGroups({ [menuConfig[0].id]: true });
    }
  }, [currentShopping.id]);

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleSubmenuClick = (submenu) => {
    navigate(submenu.route);
    // Fechar sidebar no mobile após navegação
    if (onClose) onClose();
  };

  const isActiveRoute = (route) => {
    return location.pathname === route;
  };

  const isGroupActive = (group) => {
    return group.submenus.some((sub) => location.pathname === sub.route);
  };

  return (
    <>
      {/* Overlay (mobile) */}
      <div
        className={`sidebar-overlay ${isOpen ? 'sidebar-overlay--visible' : ''}`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        {/* Header — Logo do cliente */}
        <div className="sidebar-header">
          {currentShopping.logo && (
            <img
              src={currentShopping.logo}
              alt={currentShopping.name}
              className="sidebar-header__logo"
            />
          )}
          <div className="sidebar-header__info">
            <div className="sidebar-header__name">{currentShopping.name}</div>
            <div className="sidebar-header__label">Painel de Gestão</div>
          </div>
          {/* Close button (mobile only) */}
          <button className="sidebar-close" onClick={onClose} aria-label="Fechar menu">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {menuConfig.map((group) => (
            <div key={group.id} className="sidebar-group">
              {/* Group Toggle */}
              <button
                className={`sidebar-group__toggle ${isGroupActive(group) ? 'sidebar-group__toggle--active' : ''}`}
                onClick={() => toggleGroup(group.id)}
              >
                {getIcon(group.icon)}
                <span>{group.label}</span>
                <svg
                  className={`sidebar-group__chevron ${openGroups[group.id] ? 'sidebar-group__chevron--open' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Submenu Items */}
              <div className={`sidebar-submenu ${openGroups[group.id] ? 'sidebar-submenu--open' : ''}`}>
                {group.submenus.map((sub) => (
                  <button
                    key={sub.id}
                    className={`sidebar-submenu__item ${isActiveRoute(sub.route) ? 'sidebar-submenu__item--active' : ''}`}
                    onClick={() => handleSubmenuClick(sub)}
                  >
                    {getIcon(sub.icon)}
                    <span>{sub.label}</span>
                    {sub.comingSoon && (
                      <span className="sidebar-submenu__badge">Em breve</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer — Trocar Cliente */}
        <div className="sidebar-footer">
          <button
            className="sidebar-footer__btn"
            onClick={() => {
              navigate('/');
              if (onClose) onClose();
            }}
          >
            <svg className="sidebar-footer__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Trocar Cliente
          </button>
        </div>
      </aside>
    </>
  );
}
