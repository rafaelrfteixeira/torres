/**
 * authConfig.js — Configuração MSAL para Microsoft Entra ID (Azure AD)
 *
 * Instancia o ConfidentialClientApplication do @azure/msal-node
 * para o fluxo OAuth 2.0 Authorization Code.
 *
 * A inicialização é lazy — o msalClient só é criado quando
 * chamado pela primeira vez, permitindo que o servidor inicie
 * mesmo sem as credenciais configuradas.
 *
 * Variáveis de ambiente necessárias (.env):
 *   - CLIENT_ID      → Application (client) ID do App Registration
 *   - TENANT_ID      → Directory (tenant) ID do Azure AD
 *   - CLIENT_SECRET   → Client secret gerado no App Registration
 *   - REDIRECT_URI    → URI de redirecionamento configurado no Azure
 */

const msal = require('@azure/msal-node');

// -------------------------------------------------
// Escopos obrigatórios para a Microsoft Graph API
// -------------------------------------------------
const GRAPH_SCOPES = [
  'User.Read',
  'Sites.ReadWrite.All',
  'Mail.Send',
];

// -------------------------------------------------
// URI de redirecionamento
// -------------------------------------------------
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3001/api/auth/redirect';

// -------------------------------------------------
// Lazy initialization do ConfidentialClientApplication
// O cliente MSAL só é criado quando realmente necessário,
// evitando erro de inicialização caso as variáveis de
// ambiente ainda não estejam preenchidas.
// -------------------------------------------------
let _msalClient = null;

function getMsalClient() {
  if (_msalClient) {
    return _msalClient;
  }

  const { CLIENT_ID, TENANT_ID, CLIENT_SECRET } = process.env;

  if (!CLIENT_ID || !TENANT_ID || !CLIENT_SECRET) {
    throw new Error(
      '⚠️  Credenciais Microsoft não configuradas. ' +
      'Preencha CLIENT_ID, TENANT_ID e CLIENT_SECRET no arquivo .env'
    );
  }

  const msalConfig = {
    auth: {
      clientId: CLIENT_ID,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
      clientSecret: CLIENT_SECRET,
    },
    system: {
      loggerOptions: {
        loggerCallback: (logLevel, message) => {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[MSAL] ${message}`);
          }
        },
        piiLoggingEnabled: false,
        logLevel: msal.LogLevel.Warning,
      },
    },
  };

  _msalClient = new msal.ConfidentialClientApplication(msalConfig);
  return _msalClient;
}

module.exports = {
  getMsalClient,
  GRAPH_SCOPES,
  REDIRECT_URI,
};
