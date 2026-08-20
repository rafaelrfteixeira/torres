import { useState, useEffect } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Send,
  X
} from 'lucide-react';

/**
 * OfflineBanner — Banner Dinâmico de Conectividade e Fila de Sincronização
 *
 * Exibe alertas elegantes quando:
 * 1. O dispositivo está offline.
 * 2. Há dados pendentes na fila aguardando conexão.
 * 3. A sincronização automática ou manual está ocorrendo.
 * 4. A sincronização acaba de ser concluída com sucesso.
 */
export default function OfflineBanner() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    pendingItems,
    triggerSync,
    lastSyncTime
  } = useNetworkStatus();

  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isQueueExpanded, setIsQueueExpanded] = useState(false);

  // Exibe toast de sucesso por 4 segundos quando lastSyncTime é atualizado
  useEffect(() => {
    if (lastSyncTime && isOnline && pendingCount === 0) {
      setShowSuccessToast(true);
      const timer = setTimeout(() => setShowSuccessToast(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [lastSyncTime, isOnline, pendingCount]);

  // Se estiver online, sem itens pendentes, não sincronizando e sem toast, não ocupa espaço
  if (isOnline && pendingCount === 0 && !isSyncing && !showSuccessToast) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 transition-all duration-300 shadow-md">
      {/* 1. MODO OFFLINE */}
      {!isOnline && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white px-4 py-2.5 text-xs sm:text-sm font-medium">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-100"></span>
              </span>
              <WifiOff className="w-4 h-4 text-amber-200 shrink-0" />
              <span>
                <strong>Modo Offline Ativo</strong> — Os dados serão salvos no dispositivo e sincronizados automaticamente ao reconectar.
              </span>
            </div>

            {pendingCount > 0 && (
              <button
                onClick={() => setIsQueueExpanded(!isQueueExpanded)}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-900/60 hover:bg-amber-900/90 text-amber-100 rounded-lg text-xs font-semibold transition-colors border border-amber-400/30 cursor-pointer"
              >
                <span>{pendingCount} {pendingCount === 1 ? 'item pendente' : 'itens pendentes'}</span>
                {isQueueExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. MODO SINCRONIZANDO (Online ou em processo) */}
      {isOnline && isSyncing && (
        <div className="bg-gradient-to-r from-brand-600 via-brand-700 to-blue-800 text-white px-4 py-2.5 text-xs sm:text-sm font-medium">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-blue-200 animate-spin shrink-0" />
              <span>
                Sincronizando <strong>{pendingCount} {pendingCount === 1 ? 'dado pendente' : 'dados pendentes'}</strong> com o servidor...
              </span>
            </div>
            <div className="text-xs text-blue-100 bg-blue-900/50 px-2.5 py-1 rounded-md">
              Aguarde a conclusão
            </div>
          </div>
        </div>
      )}

      {/* 3. MODO ONLINE COM ITENS PENDENTES (Aguardando disparo) */}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-brand-900 to-slate-900 text-white px-4 py-2.5 text-xs sm:text-sm font-medium border-b border-brand-500/40">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Conexão restabelecida! Há <strong>{pendingCount} {pendingCount === 1 ? 'item pendente' : 'itens pendentes'}</strong> na fila.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsQueueExpanded(!isQueueExpanded)}
                className="text-xs text-slate-300 hover:text-white px-2 py-1 flex items-center gap-1 cursor-pointer"
              >
                <span>Ver fila</span>
                {isQueueExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              <button
                onClick={triggerSync}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Sincronizar Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. TOAST DE SUCESSO APÓS SINCRONIZAÇÃO */}
      {showSuccessToast && !isSyncing && (
        <div className="bg-emerald-700 text-white px-4 py-2 text-xs sm:text-sm font-medium animate-fade-in flex items-center justify-between">
          <div className="max-w-7xl mx-auto flex items-center gap-2 w-full">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>Todos os dados locais foram sincronizados com o SharePoint / Lists com sucesso!</span>
          </div>
          <button
            onClick={() => setShowSuccessToast(false)}
            className="text-emerald-200 hover:text-white p-1 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5. PAINEL EXPANSÍVEL COM DETALHES DA FILA */}
      {isQueueExpanded && pendingItems.length > 0 && (
        <div className="bg-slate-900 text-slate-100 border-b border-slate-700 px-4 py-3 text-xs max-h-60 overflow-y-auto animate-fade-in">
          <div className="max-w-7xl mx-auto space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                Itens na Fila de Envio (Outbox)
              </span>
              <span className="text-slate-400 text-[11px]">
                {pendingItems.length} pendente(s)
              </span>
            </div>
            <div className="divide-y divide-slate-800">
              {pendingItems.map((item) => (
                <div key={item.id} className="py-2 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-medium text-slate-200">{item.description || item.url}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.tenant ? `Cliente: ${item.tenant} • ` : ''}
                        {new Date(item.timestamp).toLocaleTimeString('pt-BR')} • Método: {item.method}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {item.status === 'failed' ? (
                      <span className="px-2 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-700 text-[10px] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Falha ({item.retryCount}x)
                      </span>
                    ) : item.status === 'processing' ? (
                      <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700 text-[10px] flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Enviando...
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700 text-[10px]">
                        Aguardando rede
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
