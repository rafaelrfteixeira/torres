const express = require('express');
const router = express.Router();
const checklistsController = require('../controllers/checklists.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');

/**
 * Rotas de Checklists — Integração com Microsoft Lists
 *
 * POST /api/checklists → Cria um novo item na lista do SharePoint
 */

// Protegida por autenticação
router.get('/', isAuthenticated, checklistsController.list);
router.get('/columns', isAuthenticated, checklistsController.listColumns);
router.post('/', isAuthenticated, checklistsController.create);

module.exports = router;
