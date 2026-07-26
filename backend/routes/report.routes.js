const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const { tenantAuthorization } = require('../middlewares/tenant.middleware');

/**
 * Rotas de Relatórios
 *
 * GET /api/reports/monthly-preventive?tenant=<tenant>&mes=<mes>&ano=<ano>
 *   → Gera dinamicamente o HTML do Relatório Técnico de Preventivas
 */

router.get('/monthly-preventive', isAuthenticated, tenantAuthorization, reportController.getMonthlyPreventive);

module.exports = router;
