/**
 * graphClient.js — Inicializa o cliente Microsoft Graph
 *
 * Utiliza o token de acesso da sessão do usuário (obtido via OAuth 2.0)
 * para autenticar requisições à Microsoft Graph API.
 */

require('isomorphic-fetch');
const { Client } = require('@microsoft/microsoft-graph-client');

/**
 * Cria uma instância do Microsoft Graph Client
 * usando o access token da sessão do usuário.
 *
 * @param {string} accessToken - Token de acesso OAuth 2.0 da sessão
 * @returns {Client} - Instância autenticada do Graph Client
 */
function getGraphClient(accessToken) {
  if (!accessToken) {
    throw new Error('Access token não disponível. O usuário precisa estar autenticado.');
  }

  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });

  return client;
}

module.exports = { getGraphClient };
