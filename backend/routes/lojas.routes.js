const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/auth.middleware');
const { tenantAuthorization } = require('../middlewares/tenant.middleware');
const { getLojas, clearLojasCache } = require('../services/excelService');

/**
 * Rotas de Lojas — Leitura de dados do Excel via MS Graph
 *
 * GET /api/lojas?tenant=riomar-recife → Retorna a lista de lojas com piso e código LUC
 * POST /api/lojas/refresh?tenant=riomar-recife → Limpa o cache e recarrega a lista
 */

// -----------------------------------------------
// GET /lojas?tenant=<tenant>
// Retorna a lista de lojas da planilha Excel do tenant
// -----------------------------------------------
router.get('/', isAuthenticated, tenantAuthorization, async (req, res, next) => {
  try {
    const isRefresh = req.query.refresh === 'true' || req.query.force === 'true';
    if (isRefresh) {
      clearLojasCache(req.tenantConfig.excelLojasUrl);
    }

    const lojas = await getLojas(req.session.accessToken, req.tenantConfig.excelLojasUrl, isRefresh);

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      count: lojas.length,
      data: lojas,
      refreshed: isRefresh,
    });
  } catch (error) {
    console.error('❌ Erro ao buscar lojas do Excel:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar lista de lojas da planilha Excel.',
      detail: error.message,
    });
  }
});

// -----------------------------------------------
// POST /lojas/refresh?tenant=<tenant>
// Limpa o cache e recarrega a lista de lojas
// -----------------------------------------------
router.post('/refresh', isAuthenticated, tenantAuthorization, async (req, res, next) => {
  try {
    clearLojasCache(req.tenantConfig.excelLojasUrl);
    const lojas = await getLojas(req.session.accessToken, req.tenantConfig.excelLojasUrl);

    res.json({
      success: true,
      count: lojas.length,
      data: lojas,
      message: 'Cache atualizado com sucesso.',
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar cache de lojas:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar lista de lojas.',
      detail: error.message,
    });
  }
});

module.exports = router;
