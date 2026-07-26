const express = require('express');
const router = express.Router();
const preventivasController = require('../controllers/preventivas.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const { tenantAuthorization } = require('../middlewares/tenant.middleware');

/**
 * Rotas de Preventivas — Manutenção Preventiva Área Comum
 *
 * Todas as rotas exigem autenticação + autorização de tenant.
 * O tenant é extraído via query param (?tenant=<tenant>) ou body.
 *
 * GET  /api/preventivas/dispositivos?tenant=<tenant>  → Lista dispositivos pendentes/atrasados
 * POST /api/preventivas/salvar (body.tenant)          → Salva preventiva + abre OS se necessário
 */

router.get('/dispositivos', isAuthenticated, tenantAuthorization, preventivasController.getDispositivos);
router.get('/dashboard-status', isAuthenticated, tenantAuthorization, preventivasController.getDashboardStatus);
router.get('/inspect-excel', isAuthenticated, tenantAuthorization, preventivasController.inspectExcel);
router.get('/debug-columns', isAuthenticated, tenantAuthorization, preventivasController.debugColumns);
router.post('/salvar', isAuthenticated, tenantAuthorization, preventivasController.salvar);

module.exports = router;
