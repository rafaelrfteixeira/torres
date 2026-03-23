/**
 * Auth Middleware — isAuthenticated
 *
 * Verifica se o usuário tem uma sessão autenticada válida
 * (token de acesso presente na sessão) antes de permitir
 * acesso a rotas protegidas.
 *
 * Uso:
 *   const { isAuthenticated } = require('../middlewares/auth.middleware');
 *   router.get('/rota-protegida', isAuthenticated, controller.handler);
 */

const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.isAuthenticated && req.session.accessToken) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Acesso negado. Faça login em /api/auth/signin',
  });
};

module.exports = { isAuthenticated };
