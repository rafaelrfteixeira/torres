import { useParams, useLocation } from 'react-router-dom';

/**
 * ComingSoon Page
 *
 * Página placeholder para funcionalidades futuras (preventivas, corretivas, etc.).
 * Exibe mensagem "Em breve" com design premium alinhado ao sistema.
 */
export default function ComingSoon() {
  const { tenant } = useParams();
  const location = useLocation();

  // Extrai o sistema da URL: /:tenant/:sistema/...
  const pathParts = location.pathname.split('/');
  const tenantIndex = pathParts.indexOf(tenant);
  const sistema = tenantIndex >= 0 ? pathParts[tenantIndex + 1] : '';

  const sistemaLabel = (sistema || '').toUpperCase();

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Ícone animado */}
        <div className="relative mx-auto w-24 h-24 mb-8">
          <div className="absolute inset-0 bg-brand-100 rounded-full animate-pulse opacity-60" />
          <div className="relative z-10 w-24 h-24 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L11.42 5m-5.1 5.07h11.76M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">
          Em Breve
        </h1>
        <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-2">
          Esta funcionalidade está sendo desenvolvida e estará disponível em breve.
        </p>
        {sistemaLabel && (
          <span className="inline-block mt-2 px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold tracking-wide">
            {sistemaLabel}
          </span>
        )}

        {/* Indicador de progresso visual */}
        <div className="mt-10 mx-auto max-w-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Em desenvolvimento</span>
            <span>70%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-1000"
              style={{ width: '70%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
