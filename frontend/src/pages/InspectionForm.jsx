import { useState } from 'react';

/**
 * InspectionForm Page
 *
 * Formulário de inspeção digital.
 * Permite ao inspetor preencher o checklist para uma loja específica.
 *
 * Categorias do checklist:
 *   - Detecção de Incêndio
 *   - Alarmes
 *   - Dampers
 *   - Extração de Fumaça
 */
function InspectionForm() {
  const [formData, setFormData] = useState({
    storeNumber: '',
    storeName: '',
    inspectorName: '',
    items: [],
    observations: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Enviar dados para a API
    console.log('Dados da inspeção:', formData);
  };

  return (
    <div className="inspection-form-page">
      <h1>📝 Nova Inspeção</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="storeNumber">Número da Loja</label>
          <input
            type="text"
            id="storeNumber"
            placeholder="Ex: L-001"
            value={formData.storeNumber}
            onChange={(e) => setFormData({ ...formData, storeNumber: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="storeName">Nome da Loja</label>
          <input
            type="text"
            id="storeName"
            placeholder="Ex: Loja Centro"
            value={formData.storeName}
            onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="inspectorName">Nome do Inspetor</label>
          <input
            type="text"
            id="inspectorName"
            placeholder="Seu nome"
            value={formData.inspectorName}
            onChange={(e) => setFormData({ ...formData, inspectorName: e.target.value })}
          />
        </div>

        {/* TODO: Adicionar itens do checklist por categoria */}
        <p style={{ color: '#888', fontStyle: 'italic' }}>
          Itens do checklist serão implementados na próxima etapa.
        </p>

        <div className="form-group">
          <label htmlFor="observations">Observações</label>
          <textarea
            id="observations"
            rows="4"
            placeholder="Observações gerais..."
            value={formData.observations}
            onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
          />
        </div>

        <button type="submit">Salvar Inspeção</button>
      </form>
    </div>
  );
}

export default InspectionForm;
