/**
 * Tenant Middleware — tenantAuthorization
 *
 * Verifica se o usuário logado tem permissão para acessar
 * o tenant (shopping) solicitado na requisição.
 *
 * O tenant é extraído de: query string, body ou route params.
 *
 * Se autorizado, injeta no request:
 *   - req.tenantSlug  → chave do tenant (ex: 'riomar-recife')
 *   - req.tenantConfig → objeto com dados do shopping (listas, URLs, etc.)
 *
 * Uso:
 *   const { tenantAuthorization } = require('../middlewares/tenant.middleware');
 *   router.get('/rota', isAuthenticated, tenantAuthorization, controller.handler);
 */

const { shoppings, hasAccess } = require('../config/tenants');

const tenantAuthorization = (req, res, next) => {
  // Extrair tenant de query, body ou params (nessa ordem de prioridade)
  const tenant = req.query.tenant || req.body?.tenant || req.params?.tenant;

  if (!tenant) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetro "tenant" é obrigatório.',
    });
  }

  // Verificar se o tenant existe no dicionário
  if (!shoppings[tenant]) {
    return res.status(400).json({
      success: false,
      message: `Tenant "${tenant}" não reconhecido.`,
    });
  }

  // Verificar permissão do usuário
  const email = req.session?.user?.username;

  if (!hasAccess(email, tenant)) {
    console.warn(`🚫 Acesso negado: ${email} tentou acessar tenant "${tenant}"`);
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Você não tem permissão para acessar este shopping.',
    });
  }

  // Injetar config do tenant no request para uso nos controllers
  req.tenantSlug = tenant;
  req.tenantConfig = shoppings[tenant];

  next();
};

module.exports = { tenantAuthorization };
