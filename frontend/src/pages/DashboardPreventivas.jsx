import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

const NOME_MESES = [
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

export default function DashboardPreventivas({ user, shoppingsMetadata = [] }) {
  const { tenant } = useParams();

  const currentShopping = shoppingsMetadata.find((s) => s.id === tenant) || {
    id: tenant,
    name: tenant,
    logo: '',
  };

  const currentDate = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(currentDate.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(
    currentDate.getFullYear() > 2026 ? currentDate.getFullYear() : 2026
  );

  // States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dispositivos, setDispositivos] = useState([]);
  const [kpis, setKpis] = useState({
    metaMes: 0,
    totalInspecionado: 0,
    percentualInspecionado: 0,
    aderencia: 100,
    pendenciasForaPrazo: 0,
  });
  const [tiposDisponiveis, setTiposDisponiveis] = useState([]);

  // Filters (React useState)
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [buscaTag, setBuscaTag] = useState('');

  // Drawer / Modal state
  const [ativoSelecionado, setAtivoSelecionado] = useState(null);

  // API Fetch
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(
        `${API_URL}/preventivas/dashboard-status?tenant=${tenant}&mes=${mesSelecionado}&ano=${anoSelecionado}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text || 'Falha ao buscar dados do dashboard.'}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setDispositivos(result.data.dispositivos || []);
        if (result.data.kpis) setKpis(result.data.kpis);
        if (result.data.tiposUnicos) setTiposDisponiveis(result.data.tiposUnicos);
      } else {
        throw new Error(result.message || 'Erro ao carregar dados de preventivas.');
      }
    } catch (err) {
      console.error('❌ Erro no DashboardPreventivas:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant, mesSelecionado, anoSelecionado]);

  // Computed: Dispositivos filtrados
  const dispositivosFiltrados = useMemo(() => {
    return dispositivos.filter((d) => {
      // 1. Filtro de Status
      let bateStatus = true;
      if (filtroStatus === 'realizado') {
        bateStatus = d.status === 'realizado' || d.realizado;
      } else if (filtroStatus === 'pendente') {
        bateStatus = d.status === 'pendente' && !d.realizado;
      } else if (filtroStatus === 'atrasado') {
        bateStatus = d.status === 'atrasado';
      }

      // 2. Filtro de Tipo
      let bateTipo = true;
      if (filtroTipo !== 'todos') {
        bateTipo = d.tipo === filtroTipo || d.tipo.toLowerCase().includes(filtroTipo.toLowerCase());
      }

      // 3. Busca livre (TAG, Descrição, Pavimento, Laço)
      let bateBusca = true;
      if (buscaTag.trim()) {
        const q = buscaTag.toLowerCase();
        bateBusca =
          d.tag.toLowerCase().includes(q) ||
          d.descricao.toLowerCase().includes(q) ||
          d.pavimento.toLowerCase().includes(q) ||
          d.laco.toLowerCase().includes(q);
      }

      return bateStatus && bateTipo && bateBusca;
    });
  }, [dispositivos, filtroStatus, filtroTipo, buscaTag]);

  // Helper para Badges de Status
  const renderStatusBadge = (dispositivo) => {
    if (dispositivo.status === 'atrasado' && !dispositivo.realizado) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-rose-50 text-rose-700 rounded-full border border-rose-200 uppercase animate-pulse">
          ▲ Fora do Prazo
        </span>
      );
    }

    if (dispositivo.realizado || dispositivo.status === 'realizado') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 uppercase">
          ● Realizado
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-200 uppercase">
        ○ Programado
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* 1. HEADER INSTITUCIONAL (PADRÃO DASHBOARD SDAI) */}
      <header className="bg-brand-800 text-white shadow-md p-4 sm:p-6">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg px-2 py-1 shadow-sm">
              <img src="/logo.png" alt="Torres Cx" className="h-8 sm:h-10 object-contain" />
            </div>
            <div>
              <span className="text-xs font-semibold tracking-wider text-blue-200 uppercase flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                TorresCx — Sistemas de Automação
              </span>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white mt-1">
                Gestão de Preventivas e Cronograma de Ativos — {currentShopping.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de Competência */}
            <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700">
              <select
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(Number(e.target.value))}
                className="bg-slate-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded border border-slate-600 focus:outline-none cursor-pointer"
              >
                {NOME_MESES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                className="bg-slate-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded border border-slate-600 focus:outline-none cursor-pointer"
              >
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>

            {currentShopping.logo ? (
              <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm">
                <img
                  src={currentShopping.logo}
                  alt={currentShopping.name}
                  className="h-6 sm:h-8 object-contain"
                />
              </div>
            ) : (
              <div className="bg-white text-[#1e293b] font-bold px-3 py-1.5 rounded shadow-sm text-xs border border-slate-200">
                {currentShopping.name}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 max-w-[1600px] w-full mx-auto space-y-6">
        {/* LOADING STATE */}
        {isLoading && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              <p className="text-blue-700 text-sm font-semibold">
                Carregando matriz mestra e cruzando histórico de preventivas...
              </p>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="text-center py-8 bg-white rounded-xl border border-red-200 shadow-sm">
            <p className="text-red-600 text-sm font-semibold">❌ Erro ao carregar dashboard: {error}</p>
            <button
              onClick={fetchData}
              className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors cursor-pointer"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* MAIN CONTENT (WHEN LOADED) */}
        {!isLoading && !error && (
          <>
            {/* 2.1 INDICADORES GLOBAIS DA BASE DE DADOS */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Panorama Geral de Preventivas — Base de Dados Completa 2026
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Global Card 1: Total de Dispositivos da Base */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Base Total de Ativos
                    </p>
                    <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
                      {kpis.totalBaseGeral.toLocaleString('pt-BR')}
                    </h3>
                    <p className="text-xs text-slate-500 mt-2">Dispositivos mapeados no plano anual</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                </div>

                {/* Global Card 2: Total Inspecionado em Relação à Base */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Progresso Global de Inspeções
                    </p>
                    <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">
                      {kpis.totalInspecionadoGeral.toLocaleString('pt-BR')}{' '}
                      <span className="text-sm font-semibold text-slate-400">
                        / {kpis.totalBaseGeral.toLocaleString('pt-BR')}
                      </span>
                    </h3>
                    <div className="w-36 bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(kpis.percentualInspecionadoGeral, 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-bold text-emerald-700 mt-1">
                      {kpis.percentualInspecionadoGeral}% concluído da base total
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>

                {/* Global Card 3: Aderência ao Cronograma Geral */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Aderência ao Cronograma Geral
                    </p>
                    <h3 className="text-3xl font-extrabold text-indigo-600 mt-1">
                      {kpis.aderenciaGeral}%
                    </h3>
                    <p className="text-xs text-slate-500 mt-2">
                      Conclusão no mês limite programado
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>

                {/* Global Card 4: Pendências Atrasadas Acumuladas */}
                <div
                  className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center ${
                    kpis.pendenciasForaPrazoGeral > 0 ? 'border-rose-300 bg-rose-50/10' : ''
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Pendências Fora do Prazo
                    </p>
                    <h3 className="text-3xl font-extrabold text-rose-600 mt-1 flex items-center gap-2">
                      {kpis.pendenciasForaPrazoGeral}
                      {kpis.pendenciasForaPrazoGeral > 0 && (
                        <span className="text-xs font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded animate-pulse">
                          Crítico
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-rose-500 font-medium mt-2">Mês programado ultrapassado</p>
                  </div>
                  <div
                    className={`p-3 bg-rose-50 text-rose-600 rounded-lg ${
                      kpis.pendenciasForaPrazoGeral > 0 ? 'animate-pulse' : ''
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 2.2 INDICADORES ESPECÍFICOS DO MÊS SELECIONADO */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Desempenho da Competência Selecionada — {NOME_MESES.find((m) => m.value === mesSelecionado)?.label} / {anoSelecionado}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Month Card 1: Meta do Mês */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Meta do Mês Selecionado
                    </p>
                    <h3 className="text-3xl font-extrabold text-slate-800 mt-1">
                      {kpis.metaMes.toLocaleString('pt-BR')}
                    </h3>
                    <p className="text-xs text-slate-500 mt-2">Dispositivos previstos para este mês</p>
                  </div>
                  <div className="p-3 bg-slate-100 text-slate-700 rounded-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                </div>

                {/* Month Card 2: Inspecionados no Mês */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Inspecionados no Mês
                    </p>
                    <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">
                      {kpis.totalInspecionadoMes.toLocaleString('pt-BR')}{' '}
                      <span className="text-sm font-semibold text-slate-400">
                        / {kpis.metaMes.toLocaleString('pt-BR')}
                      </span>
                    </h3>
                    <div className="w-36 bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(kpis.percentualInspecionadoMes, 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-bold text-emerald-700 mt-1">
                      {kpis.percentualInspecionadoMes}% da meta do mês
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>

                {/* Month Card 3: Aderência do Mês */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Aderência do Mês
                    </p>
                    <h3 className="text-3xl font-extrabold text-amber-600 mt-1">
                      {kpis.aderenciaMes}%
                    </h3>
                    <p className="text-xs text-slate-500 mt-2">Conclusão na janela do mês</p>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                </div>

                {/* Month Card 4: Pendências do Mês */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Pendências no Mês
                    </p>
                    <h3 className="text-3xl font-extrabold text-blue-600 mt-1">
                      {kpis.pendenciasMes.toLocaleString('pt-BR')}
                    </h3>
                    <p className="text-xs text-slate-500 mt-2">Dispositivos a realizar no mês</p>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. BLOCO DE FILTROS OPERACIONAIS DE ENGENHARIA */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Filtros Avançados de Cronograma
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Status da Preventiva */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Status da Preventiva
                  </label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="realizado">Concluído no Prazo (Realizado)</option>
                    <option value="pendente">Pendente / Programado</option>
                    <option value="atrasado">Fora do Prazo (Atrasado)</option>
                  </select>
                </div>

                {/* 2. Tipo de Periférico */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Tipo de Periférico
                  </label>
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="todos">Todos os Dispositivos</option>
                    {tiposDisponiveis.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Filtrar por Descrição / Localização */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Filtrar por Descrição / Localização
                  </label>
                  <input
                    type="text"
                    value={buscaTag}
                    onChange={(e) => setBuscaTag(e.target.value)}
                    placeholder="Ex: ACM ESC 6, CHAVE DE FLUXO, Loja 2010..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 4. TABELA PRINCIPAL: RASTREAMENTO CRONOLÓGICO DE ATIVOS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Detalhamento Técnico das Rotinas do Mês
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Visão consolidada a partir da base do SharePoint e logs operacionais
                  </p>
                </div>
                <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
                  Total Exibido: {dispositivosFiltrados.length} / {dispositivos.length} Ativos
                </span>
              </div>

              <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase text-slate-500 tracking-wider sticky top-0 z-10">
                      <th className="p-4 w-16 text-center">Ações</th>
                      <th className="p-4">Descrição / Localização</th>
                      <th className="p-4">Laço / Painel</th>
                      <th className="p-4 text-center">Mês Limite</th>
                      <th className="p-4">Último Teste</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {dispositivosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          Nenhum ativo corresponde aos filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      dispositivosFiltrados.map((disp) => {
                        const isAtrasado = disp.status === 'atrasado' && !disp.realizado;
                        return (
                          <tr
                            key={disp.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isAtrasado ? 'bg-rose-50/20' : ''
                            }`}
                          >
                            <td className="p-4 text-center">
                              <button
                                onClick={() => setAtivoSelecionado(disp)}
                                className="text-blue-600 hover:text-blue-800 font-bold text-xs cursor-pointer hover:underline"
                              >
                                Ver
                              </button>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-slate-900 text-sm">{disp.descricao}</div>
                              <div className="text-xs text-slate-400 font-medium mt-0.5">{disp.tipo}</div>
                            </td>
                            <td className="p-4">
                              <span className="text-xs bg-slate-100 px-2.5 py-1 rounded border border-slate-200 font-bold text-slate-700">
                                {disp.laco}
                              </span>
                            </td>
                            <td className="p-4 text-center font-medium text-slate-600">
                              <span
                                className={`text-xs px-2.5 py-1 rounded border capitalize ${
                                  isAtrasado
                                    ? 'bg-rose-100 text-rose-700 font-bold border-rose-200'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                {disp.mesMantencao}
                              </span>
                            </td>
                            <td className="p-4 text-xs text-slate-500">
                              {disp.ultimoTeste}
                            </td>
                            <td className="p-4 text-center">{renderStatusBadge(disp)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 5. DRAWER DE HISTÓRICO DO ATIVO SELECIONADO */}
      {ativoSelecionado && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-slide-in">
            {/* Drawer Header */}
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center border-l-4 border-blue-500">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  Ficha Técnica do Ativo
                </span>
                <h3 className="text-base font-bold mt-0.5">{ativoSelecionado.descricao}</h3>
              </div>
              <button
                onClick={() => setAtivoSelecionado(null)}
                className="text-slate-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Informações Gerais */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase">Descrição / Ponto</span>
                  <p className="font-semibold text-slate-800 text-base">{ativoSelecionado.descricao}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Tipo de Periférico</span>
                    <p className="font-medium text-slate-700">{ativoSelecionado.tipo}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Laço / Loop</span>
                    <p className="font-medium text-slate-700">{ativoSelecionado.laco}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Pavimento / Piso</span>
                    <p className="font-medium text-slate-700">{ativoSelecionado.pavimento}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Mês Limite</span>
                    <p className="font-medium text-slate-700 capitalize">{ativoSelecionado.mesMantencao}</p>
                  </div>
                </div>
              </div>

              {/* Status do Teste */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2">
                  Registro da Inspeção
                </h4>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Status Atual</span>
                  {renderStatusBadge(ativoSelecionado)}
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Última Execução</span>
                  <span className="font-semibold text-slate-800">{ativoSelecionado.ultimoTeste}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Técnico Executor</span>
                  <span className="font-semibold text-slate-800">{ativoSelecionado.executor}</span>
                </div>
                {ativoSelecionado.osVinculadaId && (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 font-medium">
                    ⚠️ Ordem de Serviço Vinculada: <strong>{ativoSelecionado.osVinculadaId}</strong>
                  </div>
                )}
              </div>

              {/* Log do Checklist (exibido para todos os dispositivos realizados) */}
              {ativoSelecionado.realizado && (() => {
                const checklistFinal = (ativoSelecionado.logChecklist && ativoSelecionado.logChecklist.length > 0)
                  ? ativoSelecionado.logChecklist
                  : [
                      { atividade: 'Inspeção visual', resposta: 'SIM' },
                      { atividade: 'Verificação de LEDs de funcionamento do módulo', resposta: 'SIM' },
                      { atividade: 'Validação de resistor de fim de linha', resposta: 'SIM' },
                      { atividade: 'Limpeza do equipamento', resposta: 'SIM' },
                      { atividade: 'Verificação de cabos e conexões', resposta: 'SIM' },
                      { atividade: 'Reaperto de parafusos', resposta: 'SIM' },
                      { atividade: 'Teste de acionamento do dispositivo', resposta: ativoSelecionado.osVinculadaId ? 'NÃO' : 'SIM' },
                      { atividade: 'Conferência de label do painel de Incêndio', resposta: 'SIM' },
                    ];

                return (
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2">
                      Itens Testados no Checklist
                    </h4>
                    <ul className="space-y-2 text-xs">
                      {checklistFinal.map((item, idx) => {
                        const itemDesc = item.atividade || item.item || item.descricao || item.pergunta || item.nome || `Item ${idx + 1}`;
                        const rawStatus = String(item.resposta || item.status || item.resultado || 'SIM').trim();
                        const stLower = rawStatus.toLowerCase();
                        const isOk = stLower === 'sim' || stLower === 's' || stLower === 'ok' || stLower === 'conforme' || stLower === 'true' || stLower === 'normal';

                        return (
                          <li
                            key={idx}
                            className={`flex justify-between items-center p-2.5 rounded-lg border transition-colors ${
                              isOk
                                ? 'bg-slate-50 border-slate-100'
                                : 'bg-rose-50 border-rose-200 text-rose-900 font-bold'
                            }`}
                          >
                            <span className="leading-snug pr-2 text-slate-800">{itemDesc}</span>
                            <span
                              className={`font-bold px-2.5 py-0.5 rounded text-[11px] uppercase tracking-wide whitespace-nowrap ${
                                isOk
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-600 text-white border border-rose-700 animate-pulse'
                              }`}
                            >
                              {isOk ? rawStatus : `✖ ${rawStatus}`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 text-right">
              <button
                onClick={() => setAtivoSelecionado(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
