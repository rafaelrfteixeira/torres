import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, AlertTriangle, Clock, ChevronDown, ChevronUp,
  Loader2, Wrench, MapPin, Hash, Flame, RefreshCw
} from 'lucide-react';
import InspecaoFormModal from '../components/InspecaoFormModal';

/**
 * PreventivasAreaComum — Painel Operacional do Mês
 *
 * Renderiza os dispositivos pendentes de manutenção preventiva,
 * separados em duas categorias:
 *   1. Pendentes Atrasados (meses anteriores com Realizado = "não")
 *   2. Preventivas do Mês Atual
 *
 * Dispositivos já realizados NÃO aparecem na lista.
 *
 * @param {Object} props.user             - Dados do usuário logado
 * @param {Array}  props.shoppingsMetadata - Metadata de todos os shoppings
 */

const MESES_NOMES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function PreventivasAreaComum({ user, shoppingsMetadata = [] }) {
  const { tenant } = useParams();
  const [dispositivos, setDispositivos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispositivo, setSelectedDispositivo] = useState(null);
  const [expandAtrasados, setExpandAtrasados] = useState(true);
  const [expandMesAtual, setExpandMesAtual] = useState(true);

  const currentShopping = shoppingsMetadata.find((s) => s.id === tenant) || {
    id: tenant, name: tenant, logo: '',
  };

  const mesAtual = new Date().getMonth() + 1;
  const mesAtualNome = MESES_NOMES[mesAtual] || '';

  // Buscar dispositivos do backend
  const fetchDispositivos = async (refresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const refreshQuery = refresh ? '&refresh=true' : '';
      const response = await fetch(`${API_URL}/preventivas/dispositivos?tenant=${tenant}${refreshQuery}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Erro ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setDispositivos(result.data || []);
      } else {
        throw new Error(result.message || 'Erro ao carregar dispositivos.');
      }
    } catch (err) {
      console.error('❌ Erro ao buscar dispositivos:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDispositivos(false);
  }, [tenant]);

  // Filtrar por busca de texto
  const dispositivosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return dispositivos;
    const term = searchTerm.toLowerCase();
    return dispositivos.filter(
      (d) =>
        (d.descricao || '').toLowerCase().includes(term) ||
        (d.pavimento || '').toLowerCase().includes(term) ||
        (d.tipo || '').toLowerCase().includes(term) ||
        (d.laco || '').toLowerCase().includes(term)
    );
  }, [dispositivos, searchTerm]);

  // Separar em categorias
  const atrasados = useMemo(
    () => dispositivosFiltrados.filter((d) => d.status === 'atrasado'),
    [dispositivosFiltrados]
  );

  const pendentes = useMemo(
    () => dispositivosFiltrados.filter((d) => d.status === 'pendente'),
    [dispositivosFiltrados]
  );

  // KPIs
  const totalAtrasados = dispositivos.filter((d) => d.status === 'atrasado').length;
  const totalPendentes = dispositivos.filter((d) => d.status === 'pendente').length;
  const totalGeral = totalAtrasados + totalPendentes;

  // Callback pós-salvamento
  const handleSaved = () => {
    fetchDispositivos(); // Recarrega a lista
  };

  // ============================================
  // TELA DE LOADING
  // ============================================
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={40} className="animate-spin text-red-600" />
        <p className="text-slate-500 text-sm font-medium">Carregando Matriz Mestra...</p>
      </div>
    );
  }

  // ============================================
  // TELA DE ERRO
  // ============================================
  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-4">
          <AlertTriangle size={40} className="text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-red-800">Erro ao Carregar Preventivas</h2>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => fetchDispositivos(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors cursor-pointer"
          >
            <RefreshCw size={16} />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ============================================ */}
      {/* HEADER                                       */}
      {/* ============================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wrench size={24} className="text-red-600" />
            Preventivas Área Comum
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Painel operacional — {mesAtualNome} 2026
          </p>
        </div>
        <button
          onClick={() => fetchDispositivos(true)}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-sm"
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      {/* ============================================ */}
      {/* KPIs                                         */}
      {/* ============================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          label="Total Pendentes"
          value={totalGeral}
          icon={Clock}
          color="from-slate-600 to-slate-800"
        />
        <KpiCard
          label="Atrasados"
          value={totalAtrasados}
          icon={AlertTriangle}
          color="from-red-600 to-red-800"
          pulse={totalAtrasados > 0}
        />
        <KpiCard
          label={`Mês Atual (${mesAtualNome.substring(0, 3)})`}
          value={totalPendentes}
          icon={Wrench}
          color="from-emerald-600 to-emerald-800"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* ============================================ */}
      {/* FILTRO DE BUSCA                              */}
      {/* ============================================ */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por descrição, pavimento, tipo ou laço..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none placeholder:text-slate-400 shadow-sm transition-all"
        />
        {searchTerm && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {dispositivosFiltrados.length} resultados
          </span>
        )}
      </div>

      {/* ============================================ */}
      {/* LISTA VAZIA                                  */}
      {/* ============================================ */}
      {totalGeral === 0 && !isLoading && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-3">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <Wrench size={28} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-emerald-800">Tudo em Dia!</h3>
          <p className="text-sm text-emerald-600 max-w-md mx-auto">
            Não há dispositivos pendentes de manutenção preventiva para este mês.
          </p>
        </div>
      )}

      {/* ============================================ */}
      {/* SEÇÃO: PENDENTES ATRASADOS                  */}
      {/* ============================================ */}
      {atrasados.length > 0 && (
        <section>
          <button
            onClick={() => setExpandAtrasados(!expandAtrasados)}
            className="w-full flex items-center justify-between px-4 py-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center pulse-alert">
                <AlertTriangle size={16} className="text-red-600" />
              </div>
              <div className="text-left">
                <h2 className="text-sm sm:text-base font-bold text-red-800">
                  Pendentes Atrasados
                </h2>
                <p className="text-xs text-red-500">
                  {atrasados.length} dispositivo{atrasados.length !== 1 ? 's' : ''} de meses anteriores
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-600 text-white pulse-alert">
                {atrasados.length}
              </span>
              {expandAtrasados ? (
                <ChevronUp size={18} className="text-red-400 group-hover:text-red-600 transition-colors" />
              ) : (
                <ChevronDown size={18} className="text-red-400 group-hover:text-red-600 transition-colors" />
              )}
            </div>
          </button>

          {expandAtrasados && (
            <div className="mt-2 space-y-2 animate-fade-in">
              {atrasados.map((d, index) => (
                <DispositivoCard
                  key={`atr-${index}`}
                  dispositivo={d}
                  variant="atrasado"
                  onClick={() => setSelectedDispositivo(d)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============================================ */}
      {/* SEÇÃO: PREVENTIVAS DO MÊS ATUAL             */}
      {/* ============================================ */}
      {pendentes.length > 0 && (
        <section>
          <button
            onClick={() => setExpandMesAtual(!expandMesAtual)}
            className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Wrench size={16} className="text-emerald-600" />
              </div>
              <div className="text-left">
                <h2 className="text-sm sm:text-base font-bold text-emerald-800">
                  Preventivas — {mesAtualNome}
                </h2>
                <p className="text-xs text-emerald-500">
                  {pendentes.length} dispositivo{pendentes.length !== 1 ? 's' : ''} pendente{pendentes.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
                {pendentes.length}
              </span>
              {expandMesAtual ? (
                <ChevronUp size={18} className="text-emerald-400 group-hover:text-emerald-600 transition-colors" />
              ) : (
                <ChevronDown size={18} className="text-emerald-400 group-hover:text-emerald-600 transition-colors" />
              )}
            </div>
          </button>

          {expandMesAtual && (
            <div className="mt-2 space-y-2 animate-fade-in">
              {pendentes.map((d, index) => (
                <DispositivoCard
                  key={`pend-${index}`}
                  dispositivo={d}
                  variant="pendente"
                  onClick={() => setSelectedDispositivo(d)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============================================ */}
      {/* BUSCA SEM RESULTADOS                         */}
      {/* ============================================ */}
      {searchTerm && dispositivosFiltrados.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
          <Search size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            Nenhum dispositivo encontrado para "<span className="font-semibold">{searchTerm}</span>"
          </p>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL DE INSPEÇÃO                            */}
      {/* ============================================ */}
      {selectedDispositivo && (
        <InspecaoFormModal
          dispositivo={selectedDispositivo}
          user={user}
          currentShopping={currentShopping}
          tenant={tenant}
          onClose={() => setSelectedDispositivo(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

/* ============================================ */
/* COMPONENTES AUXILIARES                       */
/* ============================================ */

/**
 * KPI Card — Mini card de indicador
 */
function KpiCard({ label, value, icon: Icon, color, pulse = false, className = '' }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-4 text-white shadow-lg ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon size={20} className={`opacity-80 ${pulse ? 'animate-pulse' : ''}`} />
        {pulse && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-100" />
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-bold">{value}</p>
      <p className="text-xs opacity-80 mt-0.5">{label}</p>
    </div>
  );
}

/**
 * DispositivoCard — Card individual de dispositivo na lista
 */
function DispositivoCard({ dispositivo, variant, onClick }) {
  const isAtrasado = variant === 'atrasado';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 sm:p-4 transition-all duration-200 cursor-pointer group ${
        isAtrasado
          ? 'bg-white border-red-200 hover:border-red-400 hover:shadow-md hover:shadow-red-100'
          : 'bg-white border-slate-200 hover:border-emerald-400 hover:shadow-md hover:shadow-emerald-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Info principal */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* TAG + Descrição */}
          <div className="flex items-center gap-2 flex-wrap">
            {isAtrasado && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 pulse-alert shrink-0">
                <AlertTriangle size={10} />
                ATRASADO
              </span>
            )}
            <h3 className={`text-sm font-semibold truncate ${isAtrasado ? 'text-red-800' : 'text-slate-800'}`}>
              {dispositivo.descricao || 'Sem descrição'}
            </h3>
          </div>

          {/* Metadados */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {dispositivo.pavimento && (
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-slate-400" />
                {dispositivo.pavimento}
              </span>
            )}
            {dispositivo.laco && (
              <span className="flex items-center gap-1">
                <Hash size={12} className="text-slate-400" />
                {dispositivo.laco}
              </span>
            )}
            {dispositivo.tipo && (
              <span className="flex items-center gap-1">
                <Flame size={12} className="text-slate-400" />
                {dispositivo.tipo}
              </span>
            )}
            {dispositivo.mesMantencao && (
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-slate-400" />
                {dispositivo.mesMantencao}
              </span>
            )}
          </div>
        </div>

        {/* Ícone de ação */}
        <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
          isAtrasado
            ? 'bg-red-100 text-red-600 group-hover:bg-red-200'
            : 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200'
        }`}>
          <Wrench size={16} />
        </div>
      </div>
    </button>
  );
}
