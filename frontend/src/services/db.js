import Dexie from 'dexie';

/**
 * TorresCX_DB — Banco de Dados Local (IndexedDB com Dexie)
 *
 * Gerencia a persistência de:
 * 1. syncQueue: Fila de envio (Outbox Pattern) para requisições feitas offline.
 * 2. cachedData: Cache local para consultas (lojas, preventivas, corretivas, sessão).
 * 3. drafts: Rascunhos de formulários em edição para evitar perda de dados.
 * 4. localSubmissions: Histórico de formulários salvos localmente.
 */
class TorresDB extends Dexie {
  constructor() {
    super('TorresCX_DB');

    this.version(1).stores({
      syncQueue: '++id, url, method, status, timestamp, retryCount, tenant, type',
      cachedData: 'key, tenant, updatedAt',
      drafts: 'id, formType, tenant, updatedAt',
      localSubmissions: 'id, type, tenant, createdAt, synced',
    });

    this.syncQueue = this.table('syncQueue');
    this.cachedData = this.table('cachedData');
    this.drafts = this.table('drafts');
    this.localSubmissions = this.table('localSubmissions');
  }

  // ============================================
  // Fila de Sincronização (syncQueue)
  // ============================================

  /**
   * Adiciona uma requisição à fila de sincronização
   */
  async addToSyncQueue({
    url,
    method = 'POST',
    payload = null,
    headers = {},
    description = '',
    tenant = '',
    type = 'general',
  }) {
    const item = {
      url,
      method,
      payload,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
      lastError: null,
      description: description || `${method} ${url}`,
      tenant,
      type,
    };

    const id = await this.syncQueue.add(item);
    return { ...item, id };
  }

  /**
   * Retorna todos os itens pendentes ordenados por timestamp (FIFO)
   */
  async getPendingSyncItems() {
    return await this.syncQueue
      .where('status')
      .equals('pending')
      .sortBy('timestamp');
  }

  /**
   * Retorna a quantidade total de itens pendentes ou em falha
   */
  async getPendingCount() {
    return await this.syncQueue
      .where('status')
      .anyOf(['pending', 'failed'])
      .count();
  }

  /**
   * Atualiza o status ou dados de um item na fila
   */
  async updateSyncItem(id, updates) {
    return await this.syncQueue.update(id, updates);
  }

  /**
   * Remove um item da fila após envio com sucesso
   */
  async removeSyncItem(id) {
    return await this.syncQueue.delete(id);
  }

  /**
   * Limpa todos os itens da fila
   */
  async clearSyncQueue() {
    return await this.syncQueue.clear();
  }

  // ============================================
  // Cache de Consultas (cachedData)
  // ============================================

  /**
   * Salva dados em cache local
   */
  async setCachedData(key, data, tenant = '') {
    return await this.cachedData.put({
      key,
      data,
      tenant,
      updatedAt: Date.now(),
    });
  }

  /**
   * Obtém dados do cache local
   */
  async getCachedData(key) {
    const record = await this.cachedData.get(key);
    return record ? record.data : null;
  }

  /**
   * Obtém registro completo com timestamp
   */
  async getCachedDataRecord(key) {
    return await this.cachedData.get(key);
  }

  /**
   * Remove dados do cache
   */
  async removeCachedData(key) {
    return await this.cachedData.delete(key);
  }

  // ============================================
  // Rascunhos de Formulários (drafts)
  // ============================================

  /**
   * Salva um rascunho de formulário
   */
  async saveDraft(id, formType, tenant, data) {
    return await this.drafts.put({
      id,
      formType,
      tenant,
      data,
      updatedAt: Date.now(),
    });
  }

  /**
   * Recupera um rascunho
   */
  async getDraft(id) {
    const record = await this.drafts.get(id);
    return record ? record.data : null;
  }

  /**
   * Remove um rascunho após submissão
   */
  async deleteDraft(id) {
    return await this.drafts.delete(id);
  }

  // ============================================
  // Submissões Locais (localSubmissions)
  // ============================================

  /**
   * Registra uma submissão local para visualização instantânea
   */
  async saveLocalSubmission(id, type, tenant, data, synced = false) {
    return await this.localSubmissions.put({
      id,
      type,
      tenant,
      data,
      createdAt: new Date().toISOString(),
      synced: synced ? 1 : 0,
    });
  }

  /**
   * Lista submissões locais por tipo e tenant
   */
  async getLocalSubmissions(type, tenant) {
    return await this.localSubmissions
      .where({ type, tenant })
      .toArray();
  }
}

export const db = new TorresDB();
export default db;
