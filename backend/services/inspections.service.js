/**
 * Inspections Service
 *
 * Camada de negócio para inspeções.
 * Atualmente usa um array em memória como placeholder.
 *
 * 📌 PRÓXIMAS ETAPAS:
 *   - Substituir o armazenamento em memória pela integração com
 *     Microsoft Lists (SharePoint) via Microsoft Graph API.
 *   - Os dados serão lidos/escritos em uma lista do SharePoint
 *     associada ao site do complexo comercial.
 */

let inspections = [];
let nextId = 1;

const getAll = async () => {
  return inspections;
};

const getById = async (id) => {
  return inspections.find((i) => i.id === Number(id));
};

const create = async (data) => {
  const inspection = {
    id: nextId++,
    storeNumber: data.storeNumber,
    storeName: data.storeName,
    inspectorName: data.inspectorName,
    date: data.date || new Date().toISOString(),
    status: data.status || 'pendente',
    items: data.items || [],
    observations: data.observations || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  inspections.push(inspection);
  return inspection;
};

const update = async (id, data) => {
  const index = inspections.findIndex((i) => i.id === Number(id));
  if (index === -1) return null;

  inspections[index] = {
    ...inspections[index],
    ...data,
    id: inspections[index].id,
    updatedAt: new Date().toISOString(),
  };
  return inspections[index];
};

const remove = async (id) => {
  const index = inspections.findIndex((i) => i.id === Number(id));
  if (index === -1) return null;

  const [removed] = inspections.splice(index, 1);
  return removed;
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove,
};
