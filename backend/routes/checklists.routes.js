const express = require('express');
const router = express.Router();
const checklistsController = require('../controllers/checklists.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const { tenantAuthorization } = require('../middlewares/tenant.middleware');

/**
 * Rotas de Checklists — Integração com Microsoft Lists
 *
 * Todas as rotas exigem autenticação + autorização de tenant.
 * O tenant é extraído via query param (?tenant=riomar-recife) ou body.
 *
 * GET  /api/checklists?tenant=<tenant>           → Lista checklists do tenant
 * GET  /api/checklists/columns?tenant=<tenant>   → Lista colunas (debug)
 * GET  /api/checklists/:id?tenant=<tenant>       → Busca checklist por ID
 * POST /api/checklists (body.tenant)             → Cria novo checklist
 */

// Protegida por autenticação + autorização de tenant
router.get('/', isAuthenticated, tenantAuthorization, checklistsController.list);
router.get('/columns', isAuthenticated, tenantAuthorization, checklistsController.listColumns);
router.get('/report', isAuthenticated, tenantAuthorization, checklistsController.listReport);
router.get('/:id/pdf', isAuthenticated, tenantAuthorization, checklistsController.downloadPdf);
router.post('/:id/resend', isAuthenticated, tenantAuthorization, checklistsController.resendPdf);
router.get('/:id', isAuthenticated, tenantAuthorization, checklistsController.getById);
router.post('/', isAuthenticated, tenantAuthorization, checklistsController.create);

module.exports = router;
