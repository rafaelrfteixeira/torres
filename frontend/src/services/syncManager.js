import { db } from './db';

/**
 * SyncManager — Gerenciador de Sincronização e Fila de Envio (Outbox Pattern)
 *
 * Responsável por:
 * 1. Processar a fila de requisições pendentes (syncQueue) ao reconectar à internet.
 * 2. Interceptar submissões quando offline e gravá-las no IndexedDB (Dexie).
 * 3. Notificar a interface em tempo real através de eventos reativos.
 * 4. Implementar retry exponencial com limite de tentativas.
 */

// Event Bus simples para o React se inscrever em tempo real
class SyncEventBus {
  constructor() {
    this.listeners = new Map();
  }

  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Retorna função de unsubscribe
    return () => {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(callback);
      }
    };
  }

  emit(event, data) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Erro no listener do evento ${event}:`, e);
        }
      });
    }
  }
}

export const syncEvents = new SyncEventBus();

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.maxRetries = 5;
    this.syncIntervalId = null;

    if (typeof window !== 'undefined') {
      this.initListeners();
    }
  }

  /**
   * Inicializa os listeners de conectividade da janela
   */
  initListeners() {
    // Quando a rede voltar, processa a fila imediatamente
    window.addEventListener('online', () => {
      console.log('🌐 Rede reconectada. Disparando sincronização da fila...');
      syncEvents.emit('network_change', { isOnline: true });
      this.processSyncQueue();
    });

    // Quando a rede cair
    window.addEventListener('offline', () => {
      console.log('📡 Dispositivo desconectado da rede. Modo Offline ativo.');
      syncEvents.emit('network_change', { isOnline: false });
    });

    // Intervalo de segurança periódico (a cada 60s se estiver online e houver itens)
    this.syncIntervalId = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.checkAndSync();
      }
    }, 60000);
  }

  /**
   * Verifica se há itens pendentes e processa
   */
  async checkAndSync() {
    try {
      const count = await db.getPendingCount();
      if (count > 0 && navigator.onLine && !this.isSyncing) {
        await this.processSyncQueue();
      }
    } catch (err) {
      console.error('Erro na checagem periódica de sincronização:', err);
    }
  }

  /**
   * Processa a fila de sincronização sequencialmente (FIFO)
   */
  async processSyncQueue() {
    if (this.isSyncing) {
      console.log('⏳ Sincronização já em andamento...');
      return;
    }

    if (!navigator.onLine) {
      console.log('⚠️ Não é possível sincronizar: dispositivo está offline.');
      return;
    }

    this.isSyncing = true;
    syncEvents.emit('sync_status', { isSyncing: true });

    try {
      const pendingItems = await db.getPendingSyncItems();
      const total = pendingItems.length;

      if (total === 0) {
        this.isSyncing = false;
        syncEvents.emit('sync_status', { isSyncing: false, total: 0, processed: 0 });
        syncEvents.emit('queue_change', { pendingCount: 0 });
        return;
      }

      console.log(`🚀 Iniciando sincronização de ${total} item(ns) pendente(s)...`);

      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const item of pendingItems) {
        // Se a internet caiu no meio do processo, interrompe
        if (!navigator.onLine) {
          console.warn('⚠️ Conexão perdida durante a sincronização. Interrompendo.');
          break;
        }

        try {
          // Atualiza status para processing
          await db.updateSyncItem(item.id, { status: 'processing' });
          syncEvents.emit('item_syncing', { item, current: processedCount + 1, total });

          // Despacha a requisição HTTP para o backend
          const response = await fetch(item.url, {
            method: item.method,
            headers: item.headers || { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: item.payload ? JSON.stringify(item.payload) : undefined,
          });

          if (response.ok) {
            // Sucesso na sincronização
            await db.removeSyncItem(item.id);
            processedCount++;
            successCount++;
            console.log(`✅ Item #${item.id} (${item.description}) sincronizado com sucesso!`);

            syncEvents.emit('item_synced', { item, success: true });
          } else {
            // Erro HTTP (4xx ou 5xx)
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            const retryCount = (item.retryCount || 0) + 1;
            const isFatal = response.status >= 400 && response.status < 500 && response.status !== 408;

            console.error(`❌ Falha ao sincronizar item #${item.id} (HTTP ${response.status}):`, errorData);

            if (retryCount >= this.maxRetries || isFatal) {
              await db.updateSyncItem(item.id, {
                status: 'failed',
                retryCount,
                lastError: errorData.message || `Erro HTTP ${response.status}`,
              });
            } else {
              await db.updateSyncItem(item.id, {
                status: 'pending',
                retryCount,
                lastError: errorData.message || `Erro HTTP ${response.status}`,
              });
            }

            processedCount++;
            errorCount++;
            syncEvents.emit('item_synced', { item, success: false, error: errorData.message });
          }
        } catch (netErr) {
          // Erro de rede durante envio
          console.error(`❌ Erro de rede ao sincronizar item #${item.id}:`, netErr);
          const retryCount = (item.retryCount || 0) + 1;
          await db.updateSyncItem(item.id, {
            status: 'pending',
            retryCount,
            lastError: netErr.message || 'Falha de conexão com o servidor',
          });
          // Se houve queda de conexão, para o loop
          break;
        }
      }

      const remaining = await db.getPendingCount();
      syncEvents.emit('queue_change', { pendingCount: remaining });
      syncEvents.emit('sync_finished', {
        successCount,
        errorCount,
        remaining,
        timestamp: Date.now(),
      });

    } catch (err) {
      console.error('Erro global no processamento da fila de sincronização:', err);
    } finally {
      this.isSyncing = false;
      syncEvents.emit('sync_status', { isSyncing: false });
    }
  }

  /**
   * Submete uma requisição com suporte completo a Offline-First
   *
   * 1. Se online: tenta enviar para a API. Se falhar por conexão, chaveia para a fila.
   * 2. Se offline: grava na syncQueue e em localSubmissions diretamente.
   */
  async submitWithOfflineSupport({
    url,
    method = 'POST',
    payload = null,
    headers = {},
    description = '',
    tenant = '',
    type = 'general',
  }) {
    // Caso 1: Dispositivo explicitamente offline
    if (!navigator.onLine) {
      console.log(`📴 Offline: enfileirando requisição "${description}" na syncQueue...`);
      const queueItem = await db.addToSyncQueue({
        url,
        method,
        payload,
        headers,
        description,
        tenant,
        type,
      });

      // Salva registro local para visualização
      const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await db.saveLocalSubmission(localId, type, tenant, payload, false);

      const pendingCount = await db.getPendingCount();
      syncEvents.emit('queue_change', { pendingCount });

      return {
        success: true,
        offline: true,
        queued: true,
        queueId: queueItem.id,
        message: '💾 Salvo no dispositivo! O envio será realizado automaticamente quando a conexão retornar.',
        data: payload,
      };
    }

    // Caso 2: Dispositivo online — tenta enviar
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        credentials: 'include',
        body: payload ? JSON.stringify(payload) : undefined,
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success !== false) {
        // Salva cópia local como sincronizada
        const localId = result.data?.id || `synced_${Date.now()}`;
        await db.saveLocalSubmission(localId, type, tenant, payload, true);

        return {
          success: true,
          offline: false,
          data: result.data || result,
          message: result.message || 'Operação realizada com sucesso!',
        };
      } else {
        // Erro do backend (validação, etc.)
        return {
          success: false,
          offline: false,
          message: result.message || `Erro ${response.status} ao processar a requisição.`,
          data: result,
        };
      }
    } catch (netErr) {
      // Falha de rede (ex: servidor inacessível, timeout, drop de sinal)
      console.warn(`⚠️ Falha de rede ao enviar (${netErr.message}). Chaveando para modo offline...`);

      const queueItem = await db.addToSyncQueue({
        url,
        method,
        payload,
        headers,
        description,
        tenant,
        type,
      });

      const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await db.saveLocalSubmission(localId, type, tenant, payload, false);

      const pendingCount = await db.getPendingCount();
      syncEvents.emit('queue_change', { pendingCount });

      return {
        success: true,
        offline: true,
        queued: true,
        queueId: queueItem.id,
        message: '💾 Falha de conexão: os dados foram salvos com segurança no dispositivo e serão sincronizados ao reconectar.',
        data: payload,
      };
    }
  }

  /**
   * Helper para consultas GET com cache automático no Dexie
   */
  async fetchWithCache({
    key,
    url,
    options = {},
    tenant = '',
    forceRefresh = false,
  }) {
    // 1. Se online e não estamos forçando apenas cache, tenta a rede
    if (navigator.onLine && !forceRefresh) {
      try {
        const response = await fetch(url, {
          credentials: 'include',
          ...options,
        });

        if (response.ok) {
          const result = await response.json();
          // Salva no cache do Dexie
          await db.setCachedData(key, result, tenant);
          return { data: result, fromCache: false };
        }
      } catch (error) {
        console.warn(`Falha na consulta online de "${key}". Tentando cache local...`, error);
      }
    }

    // 2. Se offline ou falhou a rede, busca no cache do Dexie
    const cached = await db.getCachedData(key);
    if (cached) {
      console.log(`📦 Dados recuperados do cache local para chave: ${key}`);
      return { data: cached, fromCache: true };
    }

    return { data: null, fromCache: false, error: 'Dados indisponíveis offline.' };
  }
}

export const syncManager = new SyncManager();
export default syncManager;
