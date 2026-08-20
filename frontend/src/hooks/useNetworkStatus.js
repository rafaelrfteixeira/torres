import { useState, useEffect, useCallback } from 'react';
import { db } from '../services/db';
import { syncManager, syncEvents } from '../services/syncManager';

/**
 * useNetworkStatus — Hook para status de conexão e sincronização
 *
 * Retorna:
 * - isOnline: boolean
 * - isSyncing: boolean
 * - pendingCount: number
 * - pendingItems: Array
 * - triggerSync: Function
 * - lastSyncTime: number | null
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(syncManager.isSyncing);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingItems, setPendingItems] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Atualiza a contagem e lista de pendências
  const refreshQueueStatus = useCallback(async () => {
    try {
      const count = await db.getPendingCount();
      setPendingCount(count);

      const items = await db.getPendingSyncItems();
      setPendingItems(items);
    } catch (err) {
      console.error('Erro ao ler status da fila de sincronização:', err);
    }
  }, []);

  useEffect(() => {
    // 1. Status inicial
    refreshQueueStatus();

    // 2. Ouvintes de eventos da rede
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. Inscrição nos eventos do SyncManager
    const unsubStatus = syncEvents.subscribe('sync_status', (data) => {
      setIsSyncing(data.isSyncing);
    });

    const unsubQueue = syncEvents.subscribe('queue_change', (data) => {
      setPendingCount(data.pendingCount);
      refreshQueueStatus();
    });

    const unsubFinished = syncEvents.subscribe('sync_finished', (data) => {
      setLastSyncTime(data.timestamp);
      refreshQueueStatus();
    });

    const unsubItemSynced = syncEvents.subscribe('item_synced', () => {
      refreshQueueStatus();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubStatus();
      unsubQueue();
      unsubFinished();
      unsubItemSynced();
    };
  }, [refreshQueueStatus]);

  // Função para disparar sincronização manual
  const triggerSync = useCallback(async () => {
    if (navigator.onLine && !isSyncing) {
      await syncManager.processSyncQueue();
      await refreshQueueStatus();
    }
  }, [isSyncing, refreshQueueStatus]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    pendingItems,
    triggerSync,
    lastSyncTime,
    refreshQueueStatus,
  };
}

export default useNetworkStatus;
