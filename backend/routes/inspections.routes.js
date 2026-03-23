const express = require('express');
const router = express.Router();
const inspectionsController = require('../controllers/inspections.controller');

// -----------------------------------------------
// Rotas de Inspeções
// -----------------------------------------------

// Listar todas as inspeções
router.get('/', inspectionsController.getAll);

// Buscar inspeção por ID
router.get('/:id', inspectionsController.getById);

// Criar nova inspeção
router.post('/', inspectionsController.create);

// Atualizar inspeção existente
router.put('/:id', inspectionsController.update);

// Excluir inspeção
router.delete('/:id', inspectionsController.delete);

module.exports = router;
