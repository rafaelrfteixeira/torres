import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const REGION_ORDER = ['Nordeste', 'Sudeste', 'Sul'];

/**
 * ShoppingSelection Page
 *
 * Primeira tela após o login. Permite ao usuário selecionar
 * o cliente/shopping onde realizará a inspeção, agrupados por região.
 *
 * Os cards são renderizados dinamicamente com base nos shoppings
 * permitidos para o usuário autenticado (RBAC por e-mail).
 */
export default function ShoppingSelection({ allowedShoppings = [], shoppingsMetadata = [] }) {
  const navigate = useNavigate();
  const [selectedRegion, setSelectedRegion] = useState('Todas');

  // Filtrar shoppings com base nas permissões do usuário
  const visibleShoppings = shoppingsMetadata.filter((s) =>
    allowedShoppings.includes(s.id)
  );

  // Agrupar shoppings por região mantendo a ordem definida
  const groupedByRegion = REGION_ORDER.map((region) => ({
    region,
    items: visibleShoppings.filter((s) => (s.region || 'Nordeste') === region),
  })).filter((group) => group.items.length > 0);

  const visibleGroups = selectedRegion === 'Todas'
    ? groupedByRegion
    : groupedByRegion.filter((group) => group.region === selectedRegion);

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
        <div className="mt-8 mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
            Selecione o Cliente
          </h1>
          <p className="text-slate-500 mt-2 text-sm sm:text-base">
            Escolha o cliente para acessar o sistema
          </p>
        </div>

        {/* Filtro por região (exibido quando há mais de uma região disponível) */}
        {groupedByRegion.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {['Todas', ...groupedByRegion.map((g) => g.region)].map((regionOption) => {
              const isActive = selectedRegion === regionOption;
              return (
                <button
                  key={regionOption}
                  type="button"
                  onClick={() => setSelectedRegion(regionOption)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-brand-300 hover:text-brand-700'
                  }`}
                >
                  {regionOption}
                </button>
              );
            })}
          </div>
        )}

        {/* Seções por região */}
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-10">
          {visibleGroups.map(({ region, items }) => (
            <section key={region} className="w-full">
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Região {region}
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {items.length}
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <div className={`grid gap-6 ${
                items.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}>
                {items.map((shopping) => (
                  <button
                    key={shopping.id}
                    onClick={() => navigate(`/${shopping.id}`)}
                    className="group relative bg-white rounded-2xl border border-slate-200 shadow-md
                               hover:shadow-xl hover:border-brand-300 hover:-translate-y-1
                               transition-all duration-300 ease-out
                               p-8 flex flex-col items-center gap-5
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
                    <span className="relative z-10 text-lg sm:text-xl font-semibold text-slate-700 group-hover:text-brand-700 transition-colors duration-300 text-center">
                      {shopping.name}
                    </span>

                    {/* Indicador de ação */}
                    <div className="relative z-10 flex items-center gap-1.5 text-sm text-slate-400 group-hover:text-brand-500 transition-colors duration-300">
                      <span>Acessar sistema</span>
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
            </section>
          ))}
        </div>

        {/* Mensagem caso não tenha nenhum shopping */}
        {visibleShoppings.length === 0 && (
          <div className="mt-12 text-center text-slate-400">
            <p className="text-lg font-medium">Nenhum shopping disponível</p>
            <p className="text-sm mt-2">
              Seu acesso ainda não foi configurado. Entre em contato com o administrador.
            </p>
          </div>
        )}
      </main>

      {/* Footer discreto */}
      <footer className="py-4 text-center text-xs text-slate-400">
        Torres CX Sistemas de Automação © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
