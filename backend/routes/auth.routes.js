const express = require('express');
const router = express.Router();
const { getMsalClient, GRAPH_SCOPES, REDIRECT_URI } = require('../config/authConfig');

/**
 * Rotas de Autenticação — Microsoft Entra ID (OAuth 2.0)
 *
 * Fluxo Authorization Code:
 *   1. /auth/signin    → Redireciona para login.microsoftonline.com
 *   2. /auth/redirect  → Callback: recebe código e troca por access token
 *   3. /auth/signout   → Destrói sessão
 *   4. /auth/profile   → Retorna dados do usuário na sessão
 */

// -----------------------------------------------
// GET /auth/signin
// Gera a URL de autorização e redireciona o usuário
// para a página de login da Microsoft.
// -----------------------------------------------
router.get('/signin', async (req, res, next) => {
  try {
    const authCodeUrlParameters = {
      scopes: GRAPH_SCOPES,
      redirectUri: REDIRECT_URI,
    };

    const authUrl = await getMsalClient().getAuthCodeUrl(authCodeUrlParameters);
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Erro ao gerar URL de login:', error);
    next(error);
  }
});

// -----------------------------------------------
// GET /auth/redirect
// Callback da Microsoft. Recebe o código de autorização
// e o troca por um access token via MSAL.
// -----------------------------------------------
router.get('/redirect', async (req, res, next) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Código de autorização não recebido.',
      });
    }

    const tokenRequest = {
      code,
      scopes: GRAPH_SCOPES,
      redirectUri: REDIRECT_URI,
    };

    const response = await getMsalClient().acquireTokenByCode(tokenRequest);

    // Salvar dados na sessão
    req.session.isAuthenticated = true;
    req.session.accessToken = response.accessToken;
    req.session.user = {
      name: response.account?.name || '',
      username: response.account?.username || '',
      homeAccountId: response.account?.homeAccountId || '',
    };

    console.log(`✅ Usuário autenticado: ${req.session.user.name} (${req.session.user.username})`);

    // Redirecionar para o frontend após login
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(frontendUrl);
  } catch (error) {
    console.error('❌ Erro ao trocar código por token:', error);
    next(error);
  }
});

// -----------------------------------------------
// GET /auth/signout
// Destrói a sessão e redireciona para o frontend.
// -----------------------------------------------
router.get('/signout', (req, res) => {
  const userName = req.session.user?.name || 'Usuário';

  req.session.destroy((err) => {
    if (err) {
      console.error('❌ Erro ao destruir sessão:', err);
    }
    console.log(`👋 Sessão encerrada: ${userName}`);

    // URL de logout da Microsoft (opcional — encerra sessão no Entra ID)
    const logoutUri = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(process.env.FRONTEND_URL || 'http://localhost:5173')}`;
    res.redirect(logoutUri);
  });
});

// -----------------------------------------------
// GET /auth/profile
// Retorna os dados do usuário autenticado na sessão.
// -----------------------------------------------
router.get('/profile', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não autenticado.',
    });
  }

  res.json({
    success: true,
    data: {
      user: req.session.user,
      isAuthenticated: true,
    },
  });
});

module.exports = router;
