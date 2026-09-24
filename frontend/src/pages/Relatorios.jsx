import { useState, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  ClipboardCheck,
  Printer,
  Calendar,
  Layers,
  Sparkles,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Activity
} from 'lucide-react';

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

  // Tipo de relatório selecionado: 'preventivas' | 'corretivas'
  const [activeReportType, setActiveReportType] = useState('corretivas');

  const currentDate = new Date();
  const [mes, setMes] = useState(currentDate.getMonth() + 1);
  const [ano, setAno] = useState(currentDate.getFullYear() > 2026 ? currentDate.getFullYear() : 2026);

  const [isLoading, setIsLoading] = useState(false);
  const [reportHtml, setReportHtml] = useState(null);
  const [currentLoadedType, setCurrentLoadedType] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  const handleGerarRelatorio = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setReportHtml(null);
    setCurrentLoadedType(activeReportType);

    try {
      let endpoint = '';
      if (activeReportType === 'preventivas') {
        endpoint = `${API_URL}/reports/monthly-preventive?tenant=${tenant}&sistema=${sistema || 'sdai'}&mes=${mes}&ano=${ano}`;
      } else {
        endpoint = `${API_URL}/reports/monthly-corretivas?tenant=${tenant}&mes=${mes}&ano=${ano}&sistema=todos`;
      }

      const response = await fetch(endpoint, {
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
    <div className="min-h-full flex flex-col space-y-6 pb-12">
      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-md text-xs font-semibold tracking-wide uppercase">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Central de Relatórios Técnicos
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Emissão de Relatórios Homologados
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gere relatórios executivos em formato A4 para conferência gerencial e exportação em PDF — <span className="font-semibold text-slate-700">{currentShopping.name}</span>
          </p>
        </div>
      </div>

      {/* Seletores de Tipo de Relatório (Separados e Identificados) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Relatório de Corretivas & Ocorrências */}
        <button
          type="button"
          onClick={() => setActiveReportType('corretivas')}
          className={`flex items-start gap-4 p-5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            activeReportType === 'corretivas'
              ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
              activeReportType === 'corretivas'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                Novo • Executivo
              </span>
              {activeReportType === 'corretivas' && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 mt-1">
              Corretivas & Ocorrências
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Consolidação mensal de ordens de serviço, gráficos de categorias, distribuição de status e evidências fotográficas anexadas.
            </p>
          </div>
        </button>

        {/* Card 2: Relatório Técnico de Preventivas */}
        <button
          type="button"
          onClick={() => setActiveReportType('preventivas')}
          className={`flex items-start gap-4 p-5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            activeReportType === 'preventivas'
              ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
          }`}
        >
          <div
            className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
              activeReportType === 'preventivas'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            <ClipboardCheck className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                Área Comum • NBR
              </span>
              {activeReportType === 'preventivas' && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 mt-1">
              Preventivas Técnicas & Dispositivos
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Relatório técnico mensal de rotinas preventivas, checklists normativos de dispositivos testados e rastreabilidade de campo.
            </p>
          </div>
        </button>
      </div>

      {/* Formulário de Parâmetros e Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <Calendar className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            {activeReportType === 'corretivas'
              ? 'Parâmetros do Relatório de Corretivas & Ocorrências'
              : 'Parâmetros do Relatório Técnico de Preventivas'}
          </h2>
        </div>

        <form
          onSubmit={handleGerarRelatorio}
          className={`grid grid-cols-1 sm:grid-cols-2 ${
            activeReportType === 'corretivas' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
          } gap-4 items-end`}
        >
          {/* Mês de Referência */}
          <div className="space-y-1.5">
            <label htmlFor="select-mes" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Mês de Referência
            </label>
            <select
              id="select-mes"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {MESES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Ano */}
          <div className="space-y-1.5">
            <label htmlFor="select-ano" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Ano
            </label>
            <select
              id="select-ano"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {ANOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro específico apenas para Preventivas */}
          {activeReportType === 'preventivas' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Sistema Operacional
              </label>
              <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium">
                {(sistema || 'Preventivas Área Comum').toUpperCase()}
              </div>
            </div>
          )}

          {/* Botão de Ação */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold text-sm rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 h-[42px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>
                  {activeReportType === 'corretivas'
                    ? 'Gerar Relatório Executivo'
                    : 'Gerar Relatório de Preventivas'}
                </span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Erro */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Visualizador de Relatório & Ações de Exportação */}
      {reportHtml && (
        <div className="flex flex-col space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white px-5 py-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-sm font-bold text-slate-800">
                {currentLoadedType === 'corretivas'
                  ? 'Pré-visualização: Relatório Executivo de Ocorrências & Chamados'
                  : 'Pré-visualização: Relatório Técnico de Preventivas'}
              </span>
              <span className="text-xs text-slate-500 hidden md:inline">
                • Orientação A4 Paisagem homologada
              </span>
            </div>

            <button
              onClick={handleImprimir}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Exportar PDF</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden" style={{ height: '820px' }}>
            <iframe
              ref={iframeRef}
              title={
                currentLoadedType === 'corretivas'
                  ? 'Relatório Executivo de Ocorrências'
                  : 'Relatório Técnico de Preventivas'
              }
              srcDoc={reportHtml}
              className="w-full h-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
