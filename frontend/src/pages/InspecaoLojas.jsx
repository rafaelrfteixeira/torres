import { useNavigate, useParams, useLocation } from 'react-router-dom';

/**
 * InspecaoLojas Page
 *
 * Página com card para iniciar nova inspeção de lojas (SDAI ou BMS).
 * Serve como "hub" de acesso ao formulário de inspeção para cada sistema.
 */
export default function InspecaoLojas({ shoppingsMetadata = [] }) {
  const navigate = useNavigate();
  const { tenant } = useParams();
  const location = useLocation();

  // Extrai o sistema da URL: /:tenant/:sistema/inspecao-lojas
  const pathParts = location.pathname.split('/');
  const tenantIndex = pathParts.indexOf(tenant);
  const sistema = tenantIndex >= 0 ? pathParts[tenantIndex + 1] : '';

  const currentShopping = shoppingsMetadata.find((s) => s.id === tenant) || {
    id: tenant,
    name: tenant,
    logo: '',
  };

  const sistemaLabel = (sistema || '').toUpperCase();
  const isSDAI = sistema === 'sdai';

  const formRoute = isSDAI
    ? `/${tenant}/sdai/novo`
    : `/${tenant}/bms/novo`;

  const sistemaConfig = isSDAI
    ? {
        title: 'Inspeção SDAI',
        subtitle: 'Sistema de Detecção e Alarme de Incêndio',
        color: 'from-orange-500 to-red-600',
        bgLight: 'bg-orange-50',
        textColor: 'text-orange-600',
        borderHover: 'hover:border-orange-300',
        icon: (
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.468 5.99 5.99 0 00-1.925 3.547 5.975 5.975 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
          </svg>
        ),
      }
    : {
        title: 'Inspeção BMS',
        subtitle: 'Sistema de Automação Predial',
        color: 'from-brand-500 to-brand-700',
        bgLight: 'bg-brand-50',
        textColor: 'text-brand-600',
        borderHover: 'hover:border-brand-300',
        icon: (
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
          </svg>
        ),
      };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block px-2.5 py-0.5 bg-brand-50 text-brand-700 rounded-md text-xs font-semibold tracking-wide uppercase">
            {sistemaLabel}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          Inspeção de Lojas
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {currentShopping.name}
        </p>
      </div>

      {/* Card de nova inspeção */}
      <div className="max-w-lg">
        <button
          onClick={() => navigate(formRoute)}
          className={`group relative w-full bg-white rounded-2xl border border-slate-200 shadow-md
                     hover:shadow-xl ${sistemaConfig.borderHover} hover:-translate-y-1
                     transition-all duration-300 ease-out
                     p-6 sm:p-8 flex items-center gap-5
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                     cursor-pointer active:scale-[0.98] text-left`}
        >
          {/* Ícone */}
          <div className={`shrink-0 w-16 h-16 rounded-xl ${sistemaConfig.bgLight} flex items-center justify-center ${sistemaConfig.textColor} transition-transform duration-300 group-hover:scale-110`}>
            {sistemaConfig.icon}
          </div>

          {/* Texto */}
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 group-hover:text-slate-900 transition-colors">
              Nova {sistemaConfig.title}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {sistemaConfig.subtitle}
            </p>
          </div>

          {/* Seta */}
          <svg
            className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-all duration-300 group-hover:translate-x-1 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
