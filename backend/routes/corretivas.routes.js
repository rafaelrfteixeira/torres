const express = require('express');
const router = express.Router();
const corretivasController = require('../controllers/corretivas.controller');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const { tenantAuthorization } = require('../middlewares/tenant.middleware');

/**
 * Rotas de Corretivas / Ocorrências
 *
 * GET /api/corretivas?tenant=<tenant>        → Lista ocorrências
 * PUT /api/corretivas/:id?tenant=<tenant>    → Atualiza ocorrência (solução, status, imagem 3, data de atendimento)
 */

router.get('/', isAuthenticated, tenantAuthorization, corretivasController.getCorretivas);
router.put('/:id', isAuthenticated, tenantAuthorization, corretivasController.updateCorretiva);

module.exports = router;
