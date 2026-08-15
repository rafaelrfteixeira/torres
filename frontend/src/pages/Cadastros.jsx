import { useParams, useLocation } from 'react-router-dom';

/**
 * Cadastros Page
 *
 * Página que exibe cards com links para planilhas Excel no SharePoint.
 * Cada card é um link externo para uma planilha específica do tenant/sistema.
 * A estrutura permite múltiplos links por disciplina.
 */
export default function Cadastros({ shoppingsMetadata = [] }) {
  const { tenant } = useParams();
  const location = useLocation();

  // Extrai o sistema da URL: /:tenant/:sistema/cadastros
  const pathParts = location.pathname.split('/');
  const tenantIndex = pathParts.indexOf(tenant);
  const sistema = tenantIndex >= 0 ? pathParts[tenantIndex + 1] : '';

  const currentShopping = shoppingsMetadata.find((s) => s.id === tenant) || {
    id: tenant,
    name: tenant,
    excelLojasUrl: '',
  };

  const sistemaLabel = (sistema || '').toUpperCase();

  // Configuração dos links de planilhas por sistema
  // Estrutura extensível: cada sistema pode ter múltiplos links
  const getCadastroLinks = () => {
    const links = [];

    // Link principal de controle de lojas (SDAI e BMS)
    if ((sistema === 'sdai' || sistema === 'bms') && currentShopping.excelLojasUrl) {
      links.push({
        id: 'excel-lojas',
        title: 'Controle de Lojas',
        subtitle: 'Planilha de controle de lojas e códigos LUC',
        url: currentShopping.excelLojasUrl,
        icon: (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125V5.625c0-.621.504-1.125 1.125-1.125h17.25c.621 0 1.125.504 1.125 1.125v12.75c0 .621-.504 1.125-1.125 1.125m-17.25 0V9m17.25 0V9m-18 4.5h18m-10.5-9V19.5m6-15V19.5" />
          </svg>
        ),
        color: 'emerald',
      });
    }

    // Link da Matriz Mestra de Preventivas (Apenas SDAI)
    if (sistema === 'sdai' && currentShopping.excelPreventivasUrl) {
      links.push({
        id: 'excel-preventivas',
        title: 'Matriz Mestra de Preventivas',
        subtitle: 'Planilha de cronograma e matriz de manutenção preventiva',
        url: currentShopping.excelPreventivasUrl,
        icon: (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        color: 'blue',
      });
    }

    // Lista de Corretivas no SharePoint
    if (currentShopping.listaCorretivas) {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      links.push({
        id: 'sharepoint-corretivas',
        title: 'Lista de Corretivas / Ocorrências',
        subtitle: 'Base de chamados e ocorrências no SharePoint',
        url: `${API_URL}/preventivas/go-to-list?list=listaCorretivas&tenant=${tenant}`,
        icon: (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        ),
        color: 'purple',
      });
    }

    // Lista de Histórico de Preventivas no SharePoint
    if (currentShopping.listaHistoricoPreventivas) {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      links.push({
        id: 'sharepoint-preventivas',
        title: 'Histórico de Preventivas Realizadas',
        subtitle: 'Registro e banco de vistorias no SharePoint',
        url: `${API_URL}/preventivas/go-to-list?list=listaHistoricoPreventivas&tenant=${tenant}`,
        icon: (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
        color: 'purple',
      });
    }

    return links;
  };

  const links = getCadastroLinks();

  const colorMap = {
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-200',
      hoverBorder: 'hover:border-emerald-400',
      gradient: 'from-emerald-500 to-green-600',
    },
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-200',
      hoverBorder: 'hover:border-blue-400',
      gradient: 'from-blue-500 to-indigo-600',
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-200',
      hoverBorder: 'hover:border-purple-400',
      gradient: 'from-purple-500 to-indigo-600',
    },
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
          Cadastros
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Planilhas e documentos de referência — {currentShopping.name}
        </p>
      </div>

      {/* Cards grid */}
      {links.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {links.map((link) => {
            const colors = colorMap[link.color] || colorMap.emerald;
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group relative bg-white rounded-2xl border ${colors.border} shadow-sm
                           hover:shadow-lg ${colors.hoverBorder} hover:-translate-y-0.5
                           transition-all duration-300 ease-out
                           p-6 flex items-center gap-4
                           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2`}
              >
                {/* Ícone */}
                <div className={`shrink-0 w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center ${colors.text} transition-transform duration-300 group-hover:scale-110`}>
                  {link.icon}
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-slate-800 group-hover:text-slate-900 transition-colors truncate">
                    {link.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {link.subtitle}
                  </p>
                </div>

                {/* Ícone de link externo */}
                <svg
                  className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-all duration-300 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5m0 0l-2.25 2.25M12 7.5l2.25 2.25" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium">Nenhum cadastro disponível</p>
          <p className="text-slate-400 text-sm mt-1">
            Não há planilhas configuradas para {sistemaLabel} neste cliente.
          </p>
        </div>
      )}
    </div>
  );
}
