import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle, Clock, CheckCircle, Package, Search, RefreshCw,
  Loader2, Filter, FileText, Image as ImageIcon, Edit3, ChevronRight,
  ShieldAlert, Sparkles, SlidersHorizontal, X
} from 'lucide-react';
import CorretivaEditModal from '../components/CorretivaEditModal';
import { syncManager } from '../services/syncManager';

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Extrai o ano e mês de uma ocorrência de forma segura
 */
function getCorretivaYearMonth(c) {
  if (!c) return null;
  
  let dateVal = c.dataRelatada || c.dataAtendimento || '';
  if (typeof dateVal === 'object' && dateVal !== null) {
    dateVal = dateVal.dateTime || '';
  }

  const str = String(dateVal).trim();
  if (str) {
    // Formato DD/MM/YYYY
    const ddmmyyyy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (ddmmyyyy) {
      return { year: parseInt(ddmmyyyy[3], 10), month: parseInt(ddmmyyyy[2], 10) };
    }
    // Formato YYYY-MM-DD
    const yyyymmdd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (yyyymmdd) {
      return { year: parseInt(yyyymmdd[1], 10), month: parseInt(yyyymmdd[2], 10) };
    }
    // Fallback Date parse
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }
  }

  // Fallback: extrair do padrão numérico de OS (ex: 20260825001 -> 2026 / 08)
  if (c.osNumber) {
    const s = String(c.osNumber).trim();
    const match = s.match(/^(\d{4})(\d{2})\d{2}/);
    if (match) {
      const y = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (y >= 2020 && y <= 2035 && m >= 1 && m <= 12) {
        return { year: y, month: m };
      }
    }
  }

  return null;
}

/**
 * Formata qualquer data (ISO, YYYY-MM-DD, DD/MM/YYYY) de forma segura em PT-BR (DD/MM/AAAA)
 */
function formatDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'object' && dateVal !== null) {
    if (dateVal.dateTime) dateVal = dateVal.dateTime;
    else return '';
  }
  const str = String(dateVal).trim();
  if (!str) return '';

  // Se a string não contiver dígitos, não é uma data
  if (!/\d/.test(str)) return '';

  // Se já estiver no formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    return str.substring(0, 10);
  }

  // Se contiver horário (ISO com 'T' ou espaço), parseia no fuso horário do navegador do usuário
  if (str.includes('T') || str.includes(' ')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR');
    }
  }

  // Se estiver no formato simples YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split('-');
    return `${day}/${month}/${year}`;
  }

  // Fallback via Date
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
}

/**
 * Converte qualquer objeto ou string de imagem do SharePoint em uma URL absoluta funcional
 */
function getImageUrl(imgObj) {
  if (!imgObj) return null;
  if (typeof imgObj === 'string') {
    if (imgObj.startsWith('http') || imgObj.startsWith('data:')) return imgObj;
    if (imgObj.startsWith('/')) return `https://torrescx.sharepoint.com${imgObj}`;
    return imgObj;
  }
  if (imgObj.fullUrl) return imgObj.fullUrl;
  const serverUrl = imgObj.serverUrl || 'https://torrescx.sharepoint.com';
  let relUrl = imgObj.serverRelativeUrl || imgObj.url || '';
  if (!relUrl) return null;
  if (relUrl.startsWith('http') || relUrl.startsWith('data:')) return relUrl;
  if (!relUrl.startsWith('/')) relUrl = '/' + relUrl;
  return `${serverUrl}${relUrl}`;
}

/**
 * Normaliza qualquer variação de status para uma chave padrão:
 * 'concluida' | 'em andamento' | 'aguardando peca' | 'pendente'
 */
export function normalizeCorretivaStatus(statusStr) {
  if (!statusStr) return 'pendente';
  const s = String(statusStr)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (
    s.includes('conclu') ||
    s.includes('finaliz') ||
    s.includes('resolv') ||
    s.includes('fechad')
  ) {
    return 'concluida';
  }
  if (
    s.includes('andamento') ||
    s.includes('execuc') ||
    s.includes('atend')
  ) {
    return 'em andamento';
  }
  if (
    s.includes('peca') ||
    s.includes('material') ||
    s.includes('aguard')
  ) {
    return 'aguardando peca';
  }
  return 'pendente';
}

export default function CorretivasOcorrencias({ user, shoppingsMetadata = [] }) {
  const { tenant } = useParams();
  const [corretivas, setCorretivas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('TODOS');
  const [selectedPrioridade, setSelectedPrioridade] = useState('TODOS');
  const [selectedCategoria, setSelectedCategoria] = useState('TODOS');
  const [selectedPeriodo, setSelectedPeriodo] = useState('TODOS');

  // Modal
  const [selectedCorretiva, setSelectedCorretiva] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentShopping = shoppingsMetadata.find((s) => s.id === tenant) || {
    id: tenant,
    name: tenant,
    logo: '',
  };

  const fetchCorretivas = async (refresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const { data, fromCache, error: fetchErr } = await syncManager.fetchWithCache({
        key: `corretivas:${tenant}`,
        url: `${API_URL}/corretivas?tenant=${tenant}`,
        tenant,
        forceRefresh: refresh,
      });

      if (data && data.success) {
        setCorretivas(data.data || []);
      } else if (Array.isArray(data)) {
        setCorretivas(data);
      } else if (fetchErr) {
        throw new Error(fetchErr);
      } else {
        throw new Error('Erro ao carregar lista de corretivas.');
      }
    } catch (err) {
      console.error('❌ Erro ao carregar corretivas:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCorretivas();
  }, [tenant]);

  // Opções para Categoria de Sistema
  const categoryOptions = useMemo(() => {
    const base = [
      { value: 'TODOS', label: 'Todas as Categorias' },
      { value: 'BMS', label: 'BMS - Automação' },
      { value: 'SDAI', label: 'SDAI - Incêndio' },
    ];

    // Incluir outras categorias encontradas na lista de corretivas (ex: SCA, CFTV)
    const extraCategories = new Set();
    corretivas.forEach((c) => {
      if (!c.categoria) return;
      const cat = String(c.categoria).trim();
      const norm = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (
        !norm.includes('bms') &&
        !norm.includes('automa') &&
        !norm.includes('sdai') &&
        !norm.includes('incend') &&
        cat.length > 2
      ) {
        extraCategories.add(cat);
      }
    });

    extraCategories.forEach((extra) => {
      base.push({ value: extra, label: extra });
    });

    return base;
  }, [corretivas]);

  // Opções para Mês / Ano
  const periodosDisponiveis = useMemo(() => {
    const periodosMap = new Map();

    // 1. Extrair períodos reais presentes nas corretivas
    corretivas.forEach((c) => {
      const ym = getCorretivaYearMonth(c);
      if (ym && ym.year && ym.month) {
        const key = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
        if (!periodosMap.has(key)) {
          periodosMap.set(key, {
            value: key,
            year: ym.year,
            month: ym.month,
            label: `${MESES_NOMES[ym.month - 1]} / ${ym.year}`,
          });
        }
      }
    });

    // 2. Garantir meses recentes de 2026 (Maio a Agosto)
    for (let m = 8; m >= 5; m--) {
      const key = `2026-${String(m).padStart(2, '0')}`;
      if (!periodosMap.has(key)) {
        periodosMap.set(key, {
          value: key,
          year: 2026,
          month: m,
          label: `${MESES_NOMES[m - 1]} / 2026`,
        });
      }
    }

    // 3. Ordenar do mais recente para o mais antigo
    return Array.from(periodosMap.values()).sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [corretivas]);

  // Helper para verificar se há filtros ativos
  const hasActiveFilters =
    searchTerm !== '' ||
    selectedStatus !== 'TODOS' ||
    selectedPrioridade !== 'TODOS' ||
    selectedCategoria !== 'TODOS' ||
    selectedPeriodo !== 'TODOS';

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('TODOS');
    setSelectedPrioridade('TODOS');
    setSelectedCategoria('TODOS');
    setSelectedPeriodo('TODOS');
  };

  // Filtragem Geral para a Listagem
  const corretivasFiltradas = useMemo(() => {
    return corretivas.filter((c) => {
      // 1. Filtro de Texto
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        String(c.osNumber || '').toLowerCase().includes(term) ||
        (c.titulo || '').toLowerCase().includes(term) ||
        (c.descricaoDefeito || '').toLowerCase().includes(term) ||
        (c.resolucaoProblema || '').toLowerCase().includes(term) ||
        (c.solicitante || '').toLowerCase().includes(term) ||
        (c.categoria || '').toLowerCase().includes(term);

      // 2. Filtro de Status
      const matchStatus =
        selectedStatus === 'TODOS' ||
        normalizeCorretivaStatus(c.status) === normalizeCorretivaStatus(selectedStatus);

      // 3. Filtro de Prioridade
      const prioStr = (c.prioridade || 'Normal').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const filterPrio = selectedPrioridade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const matchPrioridade =
        selectedPrioridade === 'TODOS' ||
        prioStr.includes(filterPrio) ||
        filterPrio.includes(prioStr);

      // 4. Filtro de Categoria de Sistema
      const matchCategoria = (() => {
        if (selectedCategoria === 'TODOS') return true;
        const cat = (c.categoria || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const title = (c.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (selectedCategoria === 'BMS') {
          return cat.includes('bms') || cat.includes('automa') || cat.includes('predial') || title.includes('bms') || title.includes('bomba');
        }
        if (selectedCategoria === 'SDAI') {
          return cat.includes('sdai') || cat.includes('incend') || cat.includes('alarme') || cat.includes('fogo') || cat.includes('detec');
        }
        const selNorm = selectedCategoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return cat.includes(selNorm) || selNorm.includes(cat);
      })();

      // 5. Filtro de Mês / Ano
      const matchPeriodo = (() => {
        if (selectedPeriodo === 'TODOS') return true;
        const ym = getCorretivaYearMonth(c);
        if (!ym) return false;
        const key = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
        return key === selectedPeriodo;
      })();

      return matchSearch && matchStatus && matchPrioridade && matchCategoria && matchPeriodo;
    });
  }, [corretivas, searchTerm, selectedStatus, selectedPrioridade, selectedCategoria, selectedPeriodo]);

  // Base para cálculo de KPIs (respeita Categoria e Mês/Ano selecionados)
  const corretivasParaKpis = useMemo(() => {
    return corretivas.filter((c) => {
      // Filtro de Categoria
      const matchCategoria = (() => {
        if (selectedCategoria === 'TODOS') return true;
        const cat = (c.categoria || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const title = (c.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (selectedCategoria === 'BMS') {
          return cat.includes('bms') || cat.includes('automa') || cat.includes('predial') || title.includes('bms') || title.includes('bomba');
        }
        if (selectedCategoria === 'SDAI') {
          return cat.includes('sdai') || cat.includes('incend') || cat.includes('alarme') || cat.includes('fogo') || cat.includes('detec');
        }
        const selNorm = selectedCategoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return cat.includes(selNorm) || selNorm.includes(cat);
      })();

      // Filtro de Mês / Ano
      const matchPeriodo = (() => {
        if (selectedPeriodo === 'TODOS') return true;
        const ym = getCorretivaYearMonth(c);
        if (!ym) return false;
        const key = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
        return key === selectedPeriodo;
      })();

      return matchCategoria && matchPeriodo;
    });
  }, [corretivas, selectedCategoria, selectedPeriodo]);

  // Cálculos para os Cards de Estatísticas (KPIs)
  const totalGeral = corretivasParaKpis.length;
  const totalPendentes = corretivasParaKpis.filter((c) => normalizeCorretivaStatus(c.status) === 'pendente').length;
  const totalEmAndamento = corretivasParaKpis.filter((c) => normalizeCorretivaStatus(c.status) === 'em andamento').length;
  const totalAguardandoPeca = corretivasParaKpis.filter((c) => normalizeCorretivaStatus(c.status) === 'aguardando peca').length;
  const totalConcluidas = corretivasParaKpis.filter((c) => normalizeCorretivaStatus(c.status) === 'concluida').length;
  const totalCriticas = corretivasParaKpis.filter(
    (c) => {
      const p = (c.prioridade || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return p.includes('critic') || p.includes('alta');
    }
  ).length;

  const handleOpenEdit = (corretiva) => {
    setSelectedCorretiva({ ...corretiva, tenantSlug: tenant });
    setIsModalOpen(true);
  };

  const handleSaved = () => {
    fetchCorretivas();
  };

  // Helper para cor do badge de status
  const getStatusBadge = (statusStr) => {
    const norm = normalizeCorretivaStatus(statusStr);
    if (norm === 'concluida') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle size={13} /> Concluída
        </span>
      );
    }
    if (norm === 'em andamento') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
          <Clock size={13} /> Em Andamento
        </span>
      );
    }
    if (norm === 'aguardando peca') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <Package size={13} /> Aguardando Peça
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
        <AlertTriangle size={13} /> Pendente
      </span>
    );
  };

  // Helper para cor de prioridade
  const getPrioridadeBadge = (prioStr) => {
    const p = (prioStr || 'normal').toLowerCase();
    if (p.includes('crític') || p.includes('critic')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-600 text-white uppercase tracking-wider">Crítico</span>;
    }
    if (p.includes('alta')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500 text-white uppercase tracking-wider">Alta</span>;
    }
    if (p.includes('baixa')) {
      return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200 text-slate-700 uppercase tracking-wider">Baixa</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">Normal</span>;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* ---------------------------------------------------- */}
      {/* HEADER                                               */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle size={24} className="text-red-600" />
            Corretivas / Ocorrências
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Painel operacional — {currentShopping.name}
          </p>
        </div>
        <button
          onClick={() => fetchCorretivas()}
          disabled={isLoading}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>
        
        {/* ---------------------------------------------------- */}
        {/* SEÇÃO 1: CARDS DE ESTATÍSTICAS (KPIs)                 */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          
          {/* Total */}
          <button
            type="button"
            onClick={() => setSelectedStatus('TODOS')}
            className={`text-left bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between ${
              selectedStatus === 'TODOS' ? 'border-slate-800 ring-2 ring-slate-800/10' : 'border-slate-200'
            }`}
          >
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ocorrências</span>
            <div className="mt-2 flex items-baseline justify-between w-full">
              <span className="text-2xl font-black text-slate-900">{totalGeral}</span>
              <FileText className="text-slate-400" size={20} />
            </div>
          </button>

          {/* Pendentes */}
          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'Pendente' ? 'TODOS' : 'Pendente')}
            className={`text-left bg-gradient-to-br from-red-50 to-red-100/50 p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between ${
              selectedStatus === 'Pendente' ? 'border-red-500 ring-2 ring-red-500/20' : 'border-red-200'
            }`}
          >
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Pendentes</span>
            <div className="mt-2 flex items-baseline justify-between w-full">
              <span className="text-2xl font-black text-red-700">{totalPendentes}</span>
              <AlertTriangle className="text-red-500" size={20} />
            </div>
          </button>

          {/* Em Andamento */}
          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'Em Andamento' ? 'TODOS' : 'Em Andamento')}
            className={`text-left bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between ${
              selectedStatus === 'Em Andamento' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-blue-200'
            }`}
          >
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Em Andamento</span>
            <div className="mt-2 flex items-baseline justify-between w-full">
              <span className="text-2xl font-black text-blue-700">{totalEmAndamento}</span>
              <Clock className="text-blue-500" size={20} />
            </div>
          </button>

          {/* Aguardando Peça */}
          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'Aguardando Peça' ? 'TODOS' : 'Aguardando Peça')}
            className={`text-left bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between ${
              selectedStatus === 'Aguardando Peça' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-amber-200'
            }`}
          >
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Aguard. Peça</span>
            <div className="mt-2 flex items-baseline justify-between w-full">
              <span className="text-2xl font-black text-amber-800">{totalAguardandoPeca}</span>
              <Package className="text-amber-600" size={20} />
            </div>
          </button>

          {/* Concluídas */}
          <button
            type="button"
            onClick={() => setSelectedStatus(selectedStatus === 'Concluída' ? 'TODOS' : 'Concluída')}
            className={`text-left bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between ${
              selectedStatus === 'Concluída' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-emerald-200'
            }`}
          >
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Concluídas</span>
            <div className="mt-2 flex items-baseline justify-between w-full">
              <span className="text-2xl font-black text-emerald-800">{totalConcluidas}</span>
              <CheckCircle className="text-emerald-600" size={20} />
            </div>
          </button>

        </div>

        {/* ---------------------------------------------------- */}
        {/* SEÇÃO 2: FILTROS E BUSCA                             */}
        {/* ---------------------------------------------------- */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <SlidersHorizontal size={18} className="text-blue-600" />
              <span>Filtros Operacionais</span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X size={14} />
                Limpar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Dropdown Categoria de Sistema */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">CATEGORIA DE SISTEMA</label>
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-700 bg-white cursor-pointer transition-all"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Dropdown Mês / Ano */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">MÊS / ANO</label>
              <select
                value={selectedPeriodo}
                onChange={(e) => setSelectedPeriodo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-700 bg-white cursor-pointer transition-all"
              >
                <option value="TODOS">Todos os Períodos</option>
                {periodosDisponiveis.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Dropdown de Status */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">STATUS DO SISTEMA NA LOJA</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-700 bg-white cursor-pointer transition-all"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="Pendente">Pendentes</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Aguardando Peça">Aguardando Peça</option>
                <option value="Concluída">Concluídas</option>
              </select>
            </div>

            {/* 4. Dropdown de Prioridade */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">PRIORIDADE / CRITICIDADE</label>
              <select
                value={selectedPrioridade}
                onChange={(e) => setSelectedPrioridade(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-700 bg-white cursor-pointer transition-all"
              >
                <option value="TODOS">Todas as Prioridades</option>
                <option value="Baixa">Prioridade: Baixa</option>
                <option value="Normal">Prioridade: Normal</option>
                <option value="Alta">Prioridade: Alta</option>
                <option value="Crítico">Prioridade: Crítico</option>
              </select>
            </div>

          </div>

          {/* Campo de Pesquisa */}
          <div className="space-y-1 pt-2 border-t border-slate-100">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">BUSCAR OCORRÊNCIA (TÍTULO, DESCRIÇÃO, OS)</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Ex: detector de fumaça, OS #20260825001, supervisório, bomba..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-800 placeholder:text-slate-400 transition-all"
              />
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* SEÇÃO 3: LISTAGEM DE OCORRÊNCIAS                     */}
        {/* ---------------------------------------------------- */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
            <Loader2 size={40} className="animate-spin text-red-600" />
            <p className="text-slate-500 text-sm font-semibold">Carregando ocorrências e ordens de serviço...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-2xl bg-red-50 border border-red-200 text-center space-y-3">
            <AlertTriangle size={36} className="mx-auto text-red-600" />
            <h3 className="text-lg font-bold text-red-900">Erro ao carregar dados</h3>
            <p className="text-sm text-red-700 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => fetchCorretivas()}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md hover:bg-red-700 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        ) : corretivasFiltradas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <Sparkles size={40} className="mx-auto text-slate-300" />
            <h3 className="text-base font-bold text-slate-700">Nenhuma ocorrência encontrada</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Não há corretivas correspondentes aos filtros selecionados ou nenhuma OS foi aberta ainda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {corretivasFiltradas.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between group"
              >
                
                {/* Lado Esquerdo: Identificação & Detalhes */}
                <div className="flex-1 space-y-3">
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 bg-slate-900 text-white font-extrabold text-xs rounded-lg shadow-sm">
                      OS #{c.osNumber}
                    </span>
                    {getStatusBadge(c.status)}
                    {getPrioridadeBadge(c.prioridade)}
                    <span className="text-xs text-slate-400 ml-auto md:ml-0">
                      Relatada em: {formatDate(c.dataRelatada) || '—'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                      {c.titulo}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {c.descricaoDefeito || 'Falha registrada via preventiva.'}
                    </p>
                  </div>

                  {/* Resolução do Problema se cadastrado */}
                  {c.resolucaoProblema && (
                    <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                      <strong className="block text-emerald-950 font-bold mb-0.5">Resolução do Problema:</strong>
                      <p className="line-clamp-2 text-emerald-800">{c.resolucaoProblema}</p>
                      {c.dataAtendimento && (
                        <span className="text-[10px] text-emerald-600 block mt-1">
                          Atendido em: {formatDate(c.dataAtendimento)}
                        </span>
                      )}
                    </div>
                  )}

                </div>

                  {/* Lado Direito: Ação */}
                  <div className="w-full md:w-auto flex md:flex-col items-center justify-end gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 shrink-0">
                    {normalizeCorretivaStatus(c.status) === 'concluida' ? (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl flex items-center gap-1.5 shrink-0">
                        <CheckCircle size={14} className="text-emerald-600" />
                        Finalizada
                      </span>
                    ) : (
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-red-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                      >
                        <Edit3 size={15} />
                        <span>Atender / Editar</span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </div>

                </div>
              ))}
          </div>
        )}

      {/* Modal de Edição */}
      <CorretivaEditModal
        corretiva={selectedCorretiva}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCorretiva(null);
        }}
        onSaved={handleSaved}
      />

    </div>
  );
}
