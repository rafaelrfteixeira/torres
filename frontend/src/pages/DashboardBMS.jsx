import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * DashboardBMS — Dashboard de Acompanhamento das Inspeções de BMS
 *
 * Baseado no DashboardSDAI, mas adaptado para a realidade do BMS:
 * - KPIs (Total de Lojas, Inspecionadas, Parciais, Com Defeito, Cobertura)
 * - Filtros Operacionais (Status, Segmento, Busca)
 * - Tabela agrupada por loja com histórico expansível de BMS
 * - Identificação dos sensores existentes (Ambiente, Duto, Pânico, Presença, Porta, Barreira, Falta Fase)
 */

// ============================================
// Helpers
// ============================================

function converterStringParaData(stringData) {
  if (!stringData || stringData === '-') return new Date(0);
  const partes = stringData.split('/');
  if (partes.length !== 3) return new Date(0);
  return new Date(partes[2], partes[1] - 1, partes[0]);
}

function getStatusBadge(status) {
  const config = {
    Normal: {
      label: 'Funcionando',
      dot: 'bg-emerald-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
    },
    'Com Defeito': {
      label: 'Com Defeito',
      dot: 'bg-red-600',
      bg: 'bg-red-50',
      text: 'text-red-800',
      border: 'border-red-300',
    },
    Parcial: {
      label: 'Parcial',
      dot: 'bg-amber-600',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-300',
    },
    'Sem BMS': {
      label: 'Sem BMS',
      dot: 'bg-slate-400',
      bg: 'bg-slate-50',
      text: 'text-slate-600',
      border: 'border-slate-200',
    },
  };

  const c = config[status] || config['Sem BMS'];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text} border ${c.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ============================================
// Main Component
// ============================================

export default function DashboardBMS({ user, shoppingsMetadata = [] }) {
  const navigate = useNavigate();
  const { tenant } = useParams();

  const currentShopping = shoppingsMetadata.find((s) => s.id === tenant) || {
    id: tenant,
    name: tenant,
    logo: '',
  };

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dadosLojasAgrupadas, setDadosLojasAgrupadas] = useState([]);
  const [totalLojasPredio, setTotalLojasPredio] = useState(0);

  // Filters
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [buscaLoja, setBuscaLoja] = useState('');

  // Expandable rows
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Toast notification for resend
  const [toast, setToast] = useState(null);

  // ============================================
  // Fetch data
  // ============================================
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const API_URL =
          import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const response = await fetch(
          `${API_URL}/checklists/report?tenant=${tenant}&checklist_type=bms`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          throw new Error(`HTTP erro! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          processarDados(result.data.inspecoes || [], result.data.totalLojasPredio || 0);
        } else {
          throw new Error(result.message || 'Erro ao buscar dados.');
        }
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tenant]);

  // ============================================
  // Process raw BMS inspection data
  // ============================================
  function processarDados(registrosBrutos, totalLojas) {
    setTotalLojasPredio(totalLojas);

    const mapaAgrupado = {};

    registrosBrutos.forEach((item) => {
      const nomeLoja = item.Loja || 'N/A';
      const numeroLoja = item.Codigo_loja || 'N/A';
      const chaveUnica = `${nomeLoja}#${numeroLoja}`.toUpperCase();

      // Status da inspeção
      let statusItem = 'Normal';
      if (item.status_com_defeito === 'Sim') statusItem = 'Com Defeito';
      else if (item.status_funcionando_parcialmente === 'Sim')
        statusItem = 'Parcial';
      else if (item.status_nao_possui_deteccao === 'Sim')
        statusItem = 'Sem BMS';
      else if (item.status_funcionando_normalmente === 'Sim')
        statusItem = 'Normal';

      // Inventário BMS (Quais sensores existem instalados)
      const disps = [];
      if (item.temp_amb_exist === 'Sim') disps.push('Temp. Amb.');
      if (item.temp_duto_exist === 'Sim') disps.push('Temp. Duto');
      if (item.panico_exist === 'Sim') disps.push('Pânico');
      if (item.movimento_exist === 'Sim') disps.push('Presença');
      if (item.porta_exist === 'Sim') disps.push('Porta');
      if (item.barreira_exist === 'Sim') disps.push('Barreira');
      if (item.falta_fase_exist === 'Sim') disps.push('Falta Fase');
      const resumoInventario =
        disps.length > 0 ? disps.join(' | ') : 'Sem disp. alocados';

      const objetoInspecao = {
        id: item.id,
        data: item.Data || '-',
        inventario: resumoInventario,
        status: statusItem,
        tecnico: item.engenheiro_tecnico || 'Não Informado',
        responsavelShopping: item.responsavel_shopping || '-',
        preventiva: item.manutencao_preventiva || 'Não',
        corretiva: item.manutencao_corretiva || 'Não',
        observacoes: item.observacoes || 'Nenhuma',
      };

      if (!mapaAgrupado[chaveUnica]) {
        mapaAgrupado[chaveUnica] = {
          nomeLoja,
          numeroLoja,
          segmento: item.tipo_loja || 'Não Definido',
          inspecoes: [],
        };
      }
      mapaAgrupado[chaveUnica].inspecoes.push(objetoInspecao);
    });

    // Convert to array, sort inspections, compute current status
    const agrupadas = Object.values(mapaAgrupado).map((loja) => {
      loja.inspecoes.sort(
        (a, b) => converterStringParaData(b.data) - converterStringParaData(a.data)
      );
      const ultimaVisita = loja.inspecoes[0];
      loja.statusAtual = ultimaVisita.status;
      loja.inventarioAtual = ultimaVisita.inventario;
      loja.ultimaData = ultimaVisita.data;
      return loja;
    });

    // Sort global: most recently inspected first
    agrupadas.sort(
      (a, b) =>
        converterStringParaData(b.ultimaData) -
        converterStringParaData(a.ultimaData)
    );

    setDadosLojasAgrupadas(agrupadas);
  }

  // ============================================
  // Computed: segments for filter dropdown
  // ============================================
  const segmentosUnicos = useMemo(() => {
    const segs = [
      ...new Set(
        dadosLojasAgrupadas
          .map((item) => item.segmento)
          .filter(Boolean)
      ),
    ];
    return segs.sort();
  }, [dadosLojasAgrupadas]);

  // ============================================
  // Computed: filtered data
  // ============================================
  const dadosFiltrados = useMemo(() => {
    return dadosLojasAgrupadas.filter((item) => {
      const bateStatus =
        filtroStatus === 'todos' || item.statusAtual === filtroStatus;
      const bateTipo =
        filtroTipo === 'todos' || item.segmento === filtroTipo;
      const busca = buscaLoja.toLowerCase();
      const bateBusca =
        item.nomeLoja.toLowerCase().includes(busca) ||
        item.numeroLoja.toLowerCase().includes(busca);

      return bateStatus && bateTipo && bateBusca;
    });
  }, [dadosLojasAgrupadas, filtroStatus, filtroTipo, buscaLoja]);

  // ============================================
  // Computed: KPIs
  // ============================================
  const kpis = useMemo(() => {
    const totalInspecionadasUnicas = dadosLojasAgrupadas.length;
    const defeitosAtuais = dadosLojasAgrupadas.filter(
      (d) => d.statusAtual === 'Com Defeito'
    ).length;
    const parciaisAtuais = dadosLojasAgrupadas.filter(
      (d) => d.statusAtual === 'Parcial'
    ).length;
    const cobertura =
      totalLojasPredio > 0
        ? ((totalInspecionadasUnicas / totalLojasPredio) * 100).toFixed(1)
        : 0;

    return {
      totalLojasPredio,
      totalInspecionadasUnicas,
      defeitosAtuais,
      parciaisAtuais,
      cobertura,
    };
  }, [dadosLojasAgrupadas, totalLojasPredio]);

  // ============================================
  // Toggle row expansion
  // ============================================
  const toggleHistorico = (index) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER */}
      <header className="bg-brand-800 text-white shadow-md p-4 sm:p-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/${tenant}/selecionar-form`)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
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
                Inspeção de BMS — {currentShopping.name}
              </h1>
            </div>
          </div>
          {currentShopping.logo && (
            <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm">
              <img
                src={currentShopping.logo}
                alt={currentShopping.name}
                className="h-6 sm:h-8 object-contain"
              />
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* LOADING STATE */}
        {isLoading && (
          <div className="text-center py-8 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
              <p className="text-brand-600 text-sm font-semibold">
                Agrupando registros e ordenando por data mais recente...
              </p>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {error && (
          <div className="text-center py-8 bg-white rounded-xl border border-red-200 shadow-sm">
            <p className="text-red-600 text-sm font-semibold">
              ❌ Erro ao carregar dados: {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* CONTENT */}
        {!isLoading && !error && (
          <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Total de Lojas */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total de Lojas
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                    {kpis.totalLojasPredio}
                  </h3>
                </div>
                <div className="p-2.5 sm:p-3 bg-brand-50 rounded-lg text-brand-600">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.15c0 .415.336.75.75.75z" />
                  </svg>
                </div>
              </div>

              {/* Inspecionadas (Únicas) */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Inspecionadas
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1">
                    {kpis.totalInspecionadasUnicas}
                  </h3>
                </div>
                <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-lg text-emerald-600">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              {/* Lojas Parciais */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Lojas Parciais
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">
                    {kpis.parciaisAtuais}
                  </h3>
                </div>
                <div className="p-2.5 sm:p-3 bg-amber-50 rounded-lg text-amber-600">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
              </div>

              {/* Com Defeito Atual */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Com Defeito
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-red-600 mt-1">
                    {kpis.defeitosAtuais}
                  </h3>
                </div>
                <div className="p-2.5 sm:p-3 bg-red-50 rounded-lg text-red-600">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
              </div>

              {/* Cobertura Real */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between col-span-2 sm:col-span-1">
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Cobertura Real
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-brand-600 mt-1">
                    {kpis.cobertura}%
                  </h3>
                </div>
                <div className="p-2.5 sm:p-3 bg-indigo-50 rounded-lg text-brand-600">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                </div>
              </div>
            </div>

            {/* FILTERS */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-800">
                <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                Filtros Operacionais
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Status */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-semibold">
                    Status do Sistema na Loja
                  </label>
                  <select
                     id="filtro-status"
                     value={filtroStatus}
                     onChange={(e) => setFiltroStatus(e.target.value)}
                     className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white cursor-pointer transition-colors"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="Normal">Funcionando</option>
                    <option value="Parcial">Parcial</option>
                    <option value="Com Defeito">Com Defeito</option>
                    <option value="Sem BMS">Sem BMS</option>
                  </select>
                </div>

                {/* Segmento */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-semibold">
                    Segmento / Tipo de Loja
                  </label>
                  <select
                     id="filtro-tipo"
                     value={filtroTipo}
                     onChange={(e) => setFiltroTipo(e.target.value)}
                     className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-brand-500 focus:bg-white cursor-pointer transition-colors"
                  >
                    <option value="todos">Todos os Segmentos</option>
                    {segmentosUnicos.map((seg) => (
                      <option key={seg} value={seg}>
                        {seg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Busca */}
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-semibold">
                    Buscar Loja (Nome ou Código)
                  </label>
                  <input
                    id="busca-loja"
                    type="text"
                    value={buscaLoja}
                    onChange={(e) => setBuscaLoja(e.target.value)}
                    placeholder="Ex: Madero, 3009..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">
                    Portfólio de Lojas e Histórico de Visitas (BMS)
                  </h2>
                  <span className="text-xs text-slate-500 font-normal italic hidden sm:inline">
                    (Clique na linha para abrir o histórico)
                  </span>
                </div>
                <span className="text-xs bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-full text-brand-600 font-semibold whitespace-nowrap">
                  Lojas: {dadosFiltrados.length}
                </span>
              </div>

              <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-100/90 backdrop-blur-md border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider sticky top-0 z-10">
                      <th className="px-4 sm:px-6 py-3.5 w-10" />
                      <th className="px-4 sm:px-6 py-3.5">Nome da Loja</th>
                      <th className="px-4 sm:px-6 py-3.5">Nº / Código</th>
                      <th className="px-4 sm:px-6 py-3.5">Segmento</th>
                      <th className="px-4 sm:px-6 py-3.5">Últimos Sensores Mapeados</th>
                      <th className="px-4 sm:px-6 py-3.5">Status Atual</th>
                      <th className="px-4 sm:px-6 py-3.5">Última Inspeção</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {dadosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-400">
                          Nenhuma loja correspondente encontrada.
                        </td>
                      </tr>
                    ) : (
                      dadosFiltrados.map((loja, index) => (
                        <LojaRow
                          key={`${loja.nomeLoja}-${loja.numeroLoja}`}
                          loja={loja}
                          index={index}
                          isExpanded={expandedRows.has(index)}
                          onToggle={() => toggleHistorico(index)}
                          tenant={tenant}
                          onToast={setToast}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 text-center py-4 text-xs text-slate-500 mt-auto">
        © {new Date().getFullYear()} {currentShopping.name} — Gestão Integrada
        de Sistemas Prediais executada por TorresCx.
      </footer>

      {/* TOAST */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 max-w-md px-6 py-4 rounded-xl shadow-2xl animate-slide-in ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">{toast.type === 'success' ? '✅' : '❌'}</span>
            <div>
              <p className="font-semibold text-sm">
                {toast.type === 'success' ? 'Sucesso!' : 'Erro'}
              </p>
              <p className="text-sm opacity-90 mt-0.5">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="ml-auto text-white/70 hover:text-white text-lg leading-none cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function LojaRow({ loja, index, isExpanded, onToggle, tenant, onToast }) {
  const [loadingPdf, setLoadingPdf] = useState(null);
  const [loadingResend, setLoadingResend] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  const handleViewPdf = async (e, itemId) => {
    e.stopPropagation();
    setLoadingPdf(itemId);
    try {
      const url = `${API_URL}/checklists/${itemId}/pdf?tenant=${tenant}&checklist_type=bms`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      onToast({ type: 'error', message: `Erro ao gerar PDF: ${err.message}` });
      setTimeout(() => onToast(null), 5000);
    } finally {
      setLoadingPdf(null);
    }
  };

  const handleResendPdf = async (e, itemId) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja reenviar o relatório por e-mail ao cliente?')) return;
    setLoadingResend(itemId);
    try {
      const url = `${API_URL}/checklists/${itemId}/resend?tenant=${tenant}&checklist_type=bms`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json();
      if (response.ok && result.success) {
        onToast({ type: 'success', message: result.message });
      } else {
        throw new Error(result.message || 'Erro ao reenviar.');
      }
    } catch (err) {
      console.error('Erro ao reenviar PDF:', err);
      onToast({ type: 'error', message: err.message });
    } finally {
      setLoadingResend(null);
      setTimeout(() => onToast(null), 6000);
    }
  };

  return (
    <>
      <tr
        onClick={onToggle}
        className="hover:bg-blue-50/30 transition-colors border-b border-slate-200 cursor-pointer select-none"
      >
        <td className="px-3 sm:px-4 py-4 text-center text-slate-400">
          <svg
            className={`w-4 h-4 text-brand-600 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </td>
        <td className="px-4 sm:px-6 py-4 font-bold text-slate-900 tracking-wide">
          {loja.nomeLoja}
        </td>
        <td className="px-4 sm:px-6 py-4 font-mono text-slate-500 text-xs">
          {loja.numeroLoja}
        </td>
        <td className="px-4 sm:px-6 py-4 text-xs">
          <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 text-slate-700 font-semibold">
            {loja.segmento}
          </span>
        </td>
        <td className="px-4 sm:px-6 py-4 text-xs font-semibold text-brand-600">
          {loja.inventarioAtual}
        </td>
        <td className="px-4 sm:px-6 py-4">
          {getStatusBadge(loja.statusAtual)}
        </td>
        <td className="px-4 sm:px-6 py-4 text-xs text-slate-500 font-mono">
          <span className="flex items-center gap-2">
            {loja.ultimaData}
            <span className="text-[10px] bg-blue-50 border border-blue-200 text-brand-600 px-1.5 py-0.5 rounded-full font-bold">
              {loja.inspecoes.length}x
            </span>
          </span>
        </td>
      </tr>

      {/* Expanded history row */}
      {isExpanded && (
        <tr className="bg-slate-50/50 border-b border-slate-200">
          <td colSpan={7} className="p-4">
            <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white shadow-md">
              <div className="text-xs font-extrabold text-brand-600 bg-slate-100/80 px-4 py-3 border-b-2 border-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Histórico de Inspeções desta Loja
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-300 text-[11px] text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-3.5 px-4 border-r border-slate-200">Data</th>
                    <th className="py-3.5 px-4 border-r border-slate-200">Sensores Configurados</th>
                    <th className="py-3.5 px-4 border-r border-slate-200">Diagnóstico</th>
                    <th className="py-3.5 px-4 border-r border-slate-200">Técnico Resp.</th>
                    <th className="py-3.5 px-4 border-r border-slate-200">Observações</th>
                    <th className="py-3.5 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loja.inspecoes.map((visit, vIdx) => (
                    <tr
                      key={vIdx}
                      className={`border-b border-slate-200 text-xs text-slate-800 hover:bg-slate-100/80 transition-colors ${
                        vIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono text-slate-950 font-bold border-r border-slate-200">
                        {visit.data}
                      </td>
                      <td className="py-3.5 px-4 text-brand-600 font-extrabold border-r border-slate-200">
                        {visit.inventario}
                      </td>
                      <td className="py-3.5 px-4 border-r border-slate-200">
                        {getStatusBadge(visit.status)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-950 font-bold border-r border-slate-200">
                        {visit.tecnico}
                      </td>
                      <td className="py-3.5 px-4 text-slate-900 font-medium max-w-xs break-words border-r border-slate-200" title={visit.observacoes}>
                        {visit.observacoes}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => handleViewPdf(e, visit.id)}
                            disabled={loadingPdf === visit.id}
                            title="Visualizar PDF"
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 hover:border-brand-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                          >
                            {loadingPdf === visit.id ? (
                              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            )}
                            PDF
                          </button>

                          <button
                            onClick={(e) => handleResendPdf(e, visit.id)}
                            disabled={loadingResend === visit.id}
                            title="Reenviar relatório por e-mail"
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 hover:border-emerald-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                          >
                            {loadingResend === visit.id ? (
                              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                              </svg>
                            )}
                            Reenviar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
