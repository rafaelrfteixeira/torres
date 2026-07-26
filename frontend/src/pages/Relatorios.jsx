import { useState, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const ANOS = [2024, 2025, 2026, 2027];

export default function Relatorios({ shoppingsMetadata = [] }) {
  const { tenant } = useParams();
  const location = useLocation();
  const iframeRef = useRef(null);

  const pathParts = location.pathname.split('/');
  const tenantIndex = pathParts.indexOf(tenant);
  const sistema = tenantIndex >= 0 ? pathParts[tenantIndex + 1] : '';

  const currentShopping = shoppingsMetadata.find((s) => s.id === tenant) || {
    id: tenant,
    name: tenant,
  };

  const currentDate = new Date();
  const [mes, setMes] = useState(currentDate.getMonth() + 1);
  const [ano, setAno] = useState(currentDate.getFullYear() > 2026 ? currentDate.getFullYear() : 2026);

  const [isLoading, setIsLoading] = useState(false);
  const [reportHtml, setReportHtml] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  const handleGerarRelatorio = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setReportHtml(null);

    try {
      const response = await fetch(`${API_URL}/reports/monthly-preventive?tenant=${tenant}&sistema=${sistema}&mes=${mes}&ano=${ano}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const text = await response.text();
        let message = 'Falha ao gerar relatório.';
        try {
          const json = JSON.parse(text);
          if (json.message) message = json.message;
        } catch (err) {
          if (text) message = text;
        }
        throw new Error(message);
      }

      const html = await response.text();
      setReportHtml(html);
    } catch (err) {
      console.error('❌ Erro ao buscar relatório:', err);
      setErrorMsg(err.message || 'Erro de conexão ao gerar relatório.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImprimir = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  return (
    <div className="min-h-full flex flex-col space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block px-2.5 py-0.5 bg-brand-50 text-brand-700 rounded-md text-xs font-semibold tracking-wide uppercase">
            {(sistema || 'Preventivas').toUpperCase()}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          Relatórios Técnicos
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Consolidação mensal de preventivas e diagnostico de falhas — {currentShopping.name}
        </p>
      </div>

      {/* Card Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 max-w-3xl">
        <form onSubmit={handleGerarRelatorio} className="flex flex-col sm:flex-row items-end gap-4">
          <div className="w-full sm:w-48 space-y-1.5">
            <label htmlFor="select-mes" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Mês de Referência
            </label>
            <select
              id="select-mes"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              {MESES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-36 space-y-1.5">
            <label htmlFor="select-ano" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Ano
            </label>
            <select
              id="select-ano"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              {ANOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-medium text-sm rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Gerando...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3h7.5M6.75 21h10.5a2.25 2.25 0 002.25-2.25V8.25a2.25 2.25 0 00-.75-1.591l-3.909-3.909A2.25 2.25 0 0013.25 2.25H6.75A2.25 2.25 0 004.5 4.5v14.25A2.25 2.25 0 006.75 21z" />
                </svg>
                <span>Gerar Relatório Mensal</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Erro */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Visualizador de Relatório */}
      {reportHtml && (
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-sm font-semibold text-slate-700">
              Pré-visualização do Relatório Homologado
            </span>
            <button
              onClick={handleImprimir}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231a1.125 1.125 0 01-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.656" />
              </svg>
              <span>Imprimir / Exportar PDF</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden" style={{ height: '800px' }}>
            <iframe
              ref={iframeRef}
              title="Relatório Técnico de Preventivas"
              srcDoc={reportHtml}
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
