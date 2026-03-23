const inspectionsService = require('../services/inspections.service');

/**
 * Controller de Inspeções
 * Responsável por receber as requisições HTTP, delegar ao service
 * e retornar as respostas adequadas.
 */

const getAll = async (req, res, next) => {
  try {
    const inspections = await inspectionsService.getAll();
    res.json({ success: true, data: inspections });
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const inspection = await inspectionsService.getById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ success: false, message: 'Inspeção não encontrada' });
    }
    res.json({ success: true, data: inspection });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const inspection = await inspectionsService.create(req.body);
    res.status(201).json({ success: true, data: inspection });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const inspection = await inspectionsService.update(req.params.id, req.body);
    if (!inspection) {
      return res.status(404).json({ success: false, message: 'Inspeção não encontrada' });
    }
    res.json({ success: true, data: inspection });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await inspectionsService.delete(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Inspeção não encontrada' });
    }
    res.json({ success: true, message: 'Inspeção removida com sucesso' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove,
};
