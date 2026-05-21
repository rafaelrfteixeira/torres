const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/auth.middleware');
const { getLojas, clearLojasCache } = require('../services/excelService');

/**
 * Rotas de Lojas — Leitura de dados do Excel via MS Graph
 *
 * GET /api/lojas → Retorna a lista de lojas com piso e código LUC
 * POST /api/lojas/refresh → Limpa o cache e recarrega a lista
 */

// -----------------------------------------------
// GET /lojas
// Retorna a lista de lojas da planilha Excel
// -----------------------------------------------
router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const lojas = await getLojas(req.session.accessToken);

    res.json({
      success: true,
      count: lojas.length,
      data: lojas,
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
// POST /lojas/refresh
// Limpa o cache e recarrega a lista de lojas
// -----------------------------------------------
router.post('/refresh', isAuthenticated, async (req, res, next) => {
  try {
    clearLojasCache();
    const lojas = await getLojas(req.session.accessToken);

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
