/**
 * API Service
 *
 * Camada de comunicação centralizada com o backend com suporte a Offline-First.
 */

import { syncManager } from './syncManager';
import { db } from './db';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = {
  /**
   * Listar todas as inspeções
   */
  getInspections: async () => {
    const { data } = await syncManager.fetchWithCache({
      key: 'inspections:all',
      url: `${API_BASE_URL}/inspections`,
    });
    return data;
  },

  /**
   * Buscar inspeção por ID
   */
  getInspectionById: async (id) => {
    const { data } = await syncManager.fetchWithCache({
      key: `inspections:${id}`,
      url: `${API_BASE_URL}/inspections/${id}`,
    });
    return data;
  },

  /**
   * Criar nova inspeção (Offline-First)
   */
  createInspection: async (data, tenant = '') => {
    return await syncManager.submitWithOfflineSupport({
      url: `${API_BASE_URL}/inspections`,
      method: 'POST',
      payload: data,
      description: `Nova Inspeção: ${data.loja || data.tagId || 'Geral'}`,
      tenant,
      type: 'inspection',
    });
  },

  /**
   * Atualizar inspeção (Offline-First)
   */
  updateInspection: async (id, data, tenant = '') => {
    return await syncManager.submitWithOfflineSupport({
      url: `${API_BASE_URL}/inspections/${id}`,
      method: 'PUT',
      payload: data,
      description: `Atualizar Inspeção #${id}`,
      tenant,
      type: 'inspection',
    });
  },

  /**
   * Excluir inspeção
   */
  deleteInspection: async (id, tenant = '') => {
    return await syncManager.submitWithOfflineSupport({
      url: `${API_BASE_URL}/inspections/${id}`,
      method: 'DELETE',
      description: `Excluir Inspeção #${id}`,
      tenant,
      type: 'inspection',
    });
  },
};

export { db, syncManager };
export default api;
