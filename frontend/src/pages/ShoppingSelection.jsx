import { useNavigate } from 'react-router-dom';

/**
 * ShoppingSelection Page
 *
 * Primeira tela após o login. Permite ao usuário selecionar
 * o cliente/shopping onde realizará a inspeção.
 */
export default function ShoppingSelection() {
  const navigate = useNavigate();

  const shoppings = [
    {
      id: 'riomar',
      name: 'Shopping RioMar Recife',
      logo: '/logo_riomar_recife.png',
      route: '/riomar_recife/selecionar-form',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50 flex flex-col">
      {/* Header com logo Torres CX */}
      <header className="w-full flex justify-center pt-10 pb-2">
        <img
          src="/logo.png"
          alt="Torres CX Sistemas de Automação"
          className="h-16 sm:h-20 object-contain drop-shadow-sm"
        />
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 pb-12">
        {/* Título */}
        <div className="mt-8 mb-10 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            Selecione o Cliente
          </h1>
          <p className="text-slate-500 mt-2 text-sm sm:text-base">
            Escolha o cliente onde será realizada a inspeção
          </p>
        </div>

        {/* Grid de cards */}
        <div className="w-full max-w-md mx-auto grid grid-cols-1 gap-6">
          {shoppings.map((shopping) => (
            <button
              key={shopping.id}
              onClick={() => navigate(shopping.route)}
              className="group relative bg-white rounded-2xl border border-slate-200 shadow-md
                         hover:shadow-xl hover:border-brand-300 hover:-translate-y-1
                         transition-all duration-300 ease-out
                         p-8 sm:p-10 flex flex-col items-center gap-5
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                         cursor-pointer active:scale-[0.98]"
            >
              {/* Glow sutil no hover */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              {/* Logo do shopping */}
              <div className="relative z-10 w-full flex justify-center">
                <img
                  src={shopping.logo}
                  alt={shopping.name}
                  className="h-20 sm:h-24 object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              {/* Nome do shopping */}
              <span className="relative z-10 text-lg sm:text-xl font-semibold text-slate-700 group-hover:text-brand-700 transition-colors duration-300">
                {shopping.name}
              </span>

              {/* Indicador de ação */}
              <div className="relative z-10 flex items-center gap-1.5 text-sm text-slate-400 group-hover:text-brand-500 transition-colors duration-300">
                <span>Iniciar inspeção</span>
                <svg
                  className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* Footer discreto */}
      <footer className="py-4 text-center text-xs text-slate-400">
        Torres CX Sistemas de Automação © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
