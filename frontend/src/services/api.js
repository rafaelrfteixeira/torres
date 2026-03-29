/**
 * API Service
 *
 * Camada de comunicação com o backend.
 * Centraliza todas as chamadas HTTP para a API.
 */

const API_BASE_URL = 'https://torrescx-backend-checklist-lojas.zj3i1b.easypanel.host/api';

const api = {
  /**
   * Listar todas as inspeções
   */
  getInspections: async () => {
    const response = await fetch(`${API_BASE_URL}/inspections`);
    return response.json();
  },

  /**
   * Buscar inspeção por ID
   */
  getInspectionById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/inspections/${id}`);
    return response.json();
  },

  /**
   * Criar nova inspeção
   */
  createInspection: async (data) => {
    const response = await fetch(`${API_BASE_URL}/inspections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  /**
   * Atualizar inspeção
   */
  updateInspection: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/inspections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  /**
   * Excluir inspeção
   */
  deleteInspection: async (id) => {
    const response = await fetch(`${API_BASE_URL}/inspections/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },
};

export default api;
