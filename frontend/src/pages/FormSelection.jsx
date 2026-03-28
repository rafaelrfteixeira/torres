import { useNavigate } from 'react-router-dom';

/**
 * FormSelection Page
 *
 * Permite ao técnico escolher o tipo de inspeção a ser realizada
 * no shopping selecionado (SDAI ou BMS).
 */
export default function FormSelection() {
  const navigate = useNavigate();

  const inspections = [
    {
      id: 'sdai',
      title: 'Inspeção SDAI',
      subtitle: 'Sistema de Detecção e Alarme de Incêndio',
      route: '/riomar_recife/sdai/novo',
      icon: (
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.468 5.99 5.99 0 00-1.925 3.547 5.975 5.975 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
        </svg>
      ),
      color: 'from-orange-500 to-red-600',
      bgLight: 'bg-orange-50',
      borderHover: 'hover:border-orange-300',
      textColor: 'text-orange-600',
    },
    {
      id: 'bms',
      title: 'Inspeção BMS',
      subtitle: 'Sistema de Automação',
      route: '/riomar_recife/bms/novo',
      icon: (
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
      ),
      color: 'from-brand-500 to-brand-700',
      bgLight: 'bg-brand-50',
      borderHover: 'hover:border-brand-300',
      textColor: 'text-brand-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50 flex flex-col">
      {/* Header com logo Torres CX */}
      <header className="w-full flex justify-center pt-8 pb-2">
        <img
          src="/logo.png"
          alt="Torres CX Sistemas de Automação"
          className="h-14 sm:h-16 object-contain drop-shadow-sm"
        />
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 pb-12">
        {/* Título */}
        <div className="mt-6 mb-4 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            Selecione o Tipo de Inspeção
          </h1>
        </div>

        {/* Contexto do shopping selecionado */}
        <div className="flex items-center gap-3 mb-10 px-5 py-3 bg-white/70 backdrop-blur-sm rounded-xl border border-slate-100 shadow-sm">
          <img
            src="/logo_riomar_recife.png"
            alt="RioMar Recife"
            className="h-8 object-contain"
          />
          <span className="text-sm font-medium text-slate-500">
            Shopping RioMar Recife
          </span>
        </div>

        {/* Grid de cards de inspeção */}
        <div className="w-full max-w-md mx-auto grid grid-cols-1 gap-5">
          {inspections.map((inspection) => (
            <button
              key={inspection.id}
              onClick={() => navigate(inspection.route)}
              className={`group relative bg-white rounded-2xl border border-slate-200 shadow-md
                         hover:shadow-xl ${inspection.borderHover} hover:-translate-y-1
                         transition-all duration-300 ease-out
                         p-6 sm:p-8 flex items-center gap-5
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                         cursor-pointer active:scale-[0.98]`}
            >
              {/* Ícone com gradiente */}
              <div className={`shrink-0 w-16 h-16 rounded-xl ${inspection.bgLight} flex items-center justify-center ${inspection.textColor} transition-transform duration-300 group-hover:scale-110`}>
                {inspection.icon}
              </div>

              {/* Texto */}
              <div className="flex-1 text-left">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 group-hover:text-slate-900 transition-colors">
                  {inspection.title}
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {inspection.subtitle}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        {/* Botão Voltar */}
        <button
          onClick={() => navigate('/')}
          className="mt-8 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar à seleção de clientes
        </button>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400">
        Torres CX Sistemas de Automação © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
