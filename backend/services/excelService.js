/**
 * excelService.js — Serviço para leitura de dados do Excel via Microsoft Graph API
 *
 * Estratégia robusta com múltiplos fallbacks para acessar planilhas
 * do OneDrive for Business / SharePoint:
 *
 *   1. /shares/{token}/driveItem → download → parse local com xlsx
 *   2. /shares/{token}/driveItem → Excel API (usedRange)
 *   3. /me/drive/sharedWithMe → encontrar arquivo → download → parse
 *
 * O parse local com a biblioteca 'xlsx' evita problemas com sessões
 * do Excel API e funciona de forma mais confiável.
 */

require('isomorphic-fetch');
const XLSX = require('xlsx');

// -------------------------------------------------
// Cache em memória para evitar chamadas repetidas
// Formato: { data: [...], timestamp: Date }
// -------------------------------------------------
const _lojasCache = new Map(); // chave = excelLojasUrl
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Converte uma URL de compartilhamento em Sharing Token (Base64 URL-safe + prefixo u!)
 * Remove query params (?e=...) antes de codificar.
 */
function encodeSharingUrl(url) {
  const cleanUrl = url.split('?')[0];
  const base64 = Buffer.from(cleanUrl, 'utf-8').toString('base64');
  const base64UrlSafe = base64
    .replace(/=+$/, '')
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
  return `u!${base64UrlSafe}`;
}

/**
 * Faz GET na Graph API com headers customizáveis e log de erro detalhado.
 * Retorna { ok, status, data?, error? }
 */
async function graphFetch(endpoint, accessToken, extraHeaders = {}) {
  const url = `https://graph.microsoft.com/v1.0${endpoint}`;
  console.log(`📡 Graph API: GET ${endpoint}`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`❌ Graph API [${response.status}] ${endpoint}:`, errorBody);
    return { ok: false, status: response.status, error: errorBody };
  }

  return { ok: true, status: response.status, data: await response.json() };
}

/**
 * Faz GET na Graph API e retorna o buffer binário (para download de arquivos).
 */
async function graphDownload(endpoint, accessToken) {
  const url = `https://graph.microsoft.com/v1.0${endpoint}`;
  console.log(`⬇️  Graph Download: GET ${endpoint}`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`❌ Graph Download [${response.status}]:`, errorBody);
    return { ok: false, status: response.status, error: errorBody };
  }

  const arrayBuffer = await response.arrayBuffer();
  return { ok: true, buffer: Buffer.from(arrayBuffer) };
}

/**
 * Parseia um buffer Excel (.xlsx/.xls) e retorna array de objetos { piso, luc, loja }.
 * Colunas esperadas: [0]=?, [1]=Piso, [2]=LUC, [3]=Loja
 */
function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Usar a primeira aba
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Nenhuma aba encontrada na planilha');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Array de arrays

  console.log(`📊 ${rows.length} linhas lidas (incluindo cabeçalho) da aba "${sheetName}"`);

  if (rows.length <= 1) return [];

  // Encontrar a linha de cabeçalho real (pode haver linhas de título antes)
  // Uma linha é considerada cabeçalho quando tem pelo menos 2 colunas com
  // nomes individuais que combinam com piso/luc/loja/nome/código
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    if (!row || row.length <= 1) continue; // Pular linhas com 1 célula (título mesclado)

    const cells = row.map((h) => String(h || '').trim().toLowerCase());
    const hasPiso = cells.some((h) => h === 'piso' || h === 'pavimento');
    const hasLuc = cells.some((h) => h === 'luc' || h === 'código' || h === 'codigo' || h === 'luc\'s');
    const hasLoja = cells.some((h) => h === 'loja' || h === 'nome' || h === 'nome fantasia' || h === 'lojas');

    // Pelo menos 2 dos 3 campos esperados devem estar presentes
    const matches = [hasPiso, hasLuc, hasLoja].filter(Boolean).length;
    if (matches >= 2) {
      headerRowIdx = i;
      break;
    }
  }

  // Log do cabeçalho para debug
  console.log(`📋 Cabeçalho (linha ${headerRowIdx}):`, JSON.stringify(rows[headerRowIdx]));

  // Detectar colunas automaticamente pelo cabeçalho
  const header = rows[headerRowIdx].map((h) => String(h || '').trim().toLowerCase());
  let pisoIdx = header.findIndex((h) => h.includes('piso'));
  let lucIdx = header.findIndex((h) => h.includes('luc') || h.includes('código') || h.includes('codigo'));
  let lojaIdx = header.findIndex((h) => h.includes('loja') || h.includes('nome'));

  // Fallback para posições fixas se não encontrar pelo nome
  if (pisoIdx === -1) pisoIdx = 1;
  if (lucIdx === -1) lucIdx = 2;
  if (lojaIdx === -1) lojaIdx = 3;

  console.log(`🔍 Índices detectados: piso=${pisoIdx}, luc=${lucIdx}, loja=${lojaIdx}`);

  const lojas = rows.slice(headerRowIdx + 1)
    .filter((row) => row && row.length > 0) // Ignorar linhas vazias
    .map((row) => ({
      piso: row[pisoIdx] != null ? String(row[pisoIdx]).trim() : '',
      luc: row[lucIdx] != null ? String(row[lucIdx]).trim() : '',
      loja: row[lojaIdx] != null ? String(row[lojaIdx]).trim() : '',
    }))
    .filter((item) => item.loja !== ''); // Ignorar linhas sem nome de loja

  console.log(`✅ ${lojas.length} lojas parseadas`);
  return lojas;
}

// =====================================================
// Estratégia 1: /shares/{token}/driveItem → download
// =====================================================
async function trySharesDownload(sharingToken, accessToken) {
  console.log('\n🔄 Estratégia 1: Shares + Download local...');

  // Resolver driveItem via Sharing Link
  const result = await graphFetch(
    `/shares/${sharingToken}/driveItem`,
    accessToken,
    { 'Prefer': 'redeemSharingLink' }
  );

  if (!result.ok) {
    console.warn('⚠️  Estratégia 1 falhou no /shares/driveItem');
    return null;
  }

  const driveItem = result.data;
  const driveId = driveItem.parentReference?.driveId;
  const itemId = driveItem.id;

  if (!driveId || !itemId) {
    console.warn('⚠️  driveId ou itemId não encontrados');
    return null;
  }

  console.log(`📁 Arquivo: ${driveItem.name} (driveId=${driveId}, itemId=${itemId})`);

  // Download do conteúdo
  const download = await graphDownload(
    `/drives/${driveId}/items/${itemId}/content`,
    accessToken
  );

  if (!download.ok) {
    console.warn('⚠️  Falha no download do arquivo');
    return null;
  }

  return parseExcelBuffer(download.buffer);
}

// =====================================================
// Estratégia 2: /shares/{token}/driveItem → Excel API
// =====================================================
async function trySharesExcelApi(sharingToken, accessToken) {
  console.log('\n🔄 Estratégia 2: Shares + Excel API...');

  const result = await graphFetch(
    `/shares/${sharingToken}/driveItem`,
    accessToken,
    { 'Prefer': 'redeemSharingLink' }
  );

  if (!result.ok) {
    console.warn('⚠️  Estratégia 2 falhou no /shares/driveItem');
    return null;
  }

  const driveItem = result.data;
  const driveId = driveItem.parentReference?.driveId;
  const itemId = driveItem.id;

  if (!driveId || !itemId) {
    console.warn('⚠️  driveId ou itemId não encontrados');
    return null;
  }

  // Tentar usedRange via Excel API
  const range = await graphFetch(
    `/drives/${driveId}/items/${itemId}/workbook/worksheets/microsoft.graph.itemAt(index=0)/usedRange`,
    accessToken
  );

  if (!range.ok) {
    console.warn('⚠️  Falha na Excel API usedRange');
    return null;
  }

  const rows = range.data.values || [];
  console.log(`📊 ${rows.length} linhas lidas via Excel API`);

  if (rows.length <= 1) return [];

  return rows.slice(1).map((row) => ({
    piso: row[1] != null ? String(row[1]).trim() : '',
    luc: row[2] != null ? String(row[2]).trim() : '',
    loja: row[3] != null ? String(row[3]).trim() : '',
  }));
}

// =====================================================
// Estratégia 3: /me/drive/sharedWithMe → download
// =====================================================
async function trySharedWithMe(accessToken) {
  console.log('\n🔄 Estratégia 3: sharedWithMe + Download...');

  const result = await graphFetch('/me/drive/sharedWithMe', accessToken);

  if (!result.ok) {
    console.warn('⚠️  Estratégia 3 falhou no sharedWithMe');
    return null;
  }

  const items = result.data.value || [];
  console.log(`📂 ${items.length} itens compartilhados encontrados`);

  // Procurar arquivo Excel
  const excelItem = items.find(
    (item) =>
      item.name?.endsWith('.xlsx') ||
      item.name?.endsWith('.xls') ||
      item.name?.toLowerCase().includes('loja')
  );

  if (!excelItem) {
    console.warn('⚠️  Nenhum arquivo Excel encontrado em sharedWithMe');
    // Log dos nomes para debug
    items.forEach((item) => console.log(`   📄 ${item.name}`));
    return null;
  }

  console.log(`📁 Encontrado: ${excelItem.name}`);

  const driveId = excelItem.remoteItem?.parentReference?.driveId || excelItem.parentReference?.driveId;
  const itemId = excelItem.remoteItem?.id || excelItem.id;

  if (!driveId || !itemId) {
    console.warn('⚠️  driveId ou itemId não encontrados no sharedWithMe');
    return null;
  }

  // Download do conteúdo
  const download = await graphDownload(
    `/drives/${driveId}/items/${itemId}/content`,
    accessToken
  );

  if (!download.ok) {
    console.warn('⚠️  Falha no download via sharedWithMe');
    return null;
  }

  return parseExcelBuffer(download.buffer);
}

// =====================================================
// Estratégia 4: Download direto via @microsoft.graph.downloadUrl
// Usa o /shares endpoint para obter o downloadUrl diretamente
// =====================================================
async function tryDirectDownloadUrl(sharingToken, accessToken) {
  console.log('\n🔄 Estratégia 4: Download direto via shares/driveItem select downloadUrl...');

  const result = await graphFetch(
    `/shares/${sharingToken}/driveItem?select=id,name,@microsoft.graph.downloadUrl`,
    accessToken,
    { 'Prefer': 'redeemSharingLink' }
  );

  if (!result.ok) {
    console.warn('⚠️  Estratégia 4 falhou');
    return null;
  }

  const downloadUrl = result.data['@microsoft.graph.downloadUrl'];
  if (!downloadUrl) {
    console.warn('⚠️  downloadUrl não disponível na resposta');
    return null;
  }

  console.log(`⬇️  Download direto do arquivo...`);

  // Download sem autenticação (downloadUrl é pré-autenticado)
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    console.warn(`⚠️  Falha no download direto [${response.status}]`);
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  return parseExcelBuffer(Buffer.from(arrayBuffer));
}

/**
 * Busca os dados das lojas a partir de uma planilha Excel compartilhada.
 * Tenta múltiplas estratégias de acesso.
 */
async function getLojas(accessToken, excelLojasUrl) {
  if (!excelLojasUrl) {
    throw new Error('URL do Excel de lojas não configurada para este tenant.');
  }

  // Verificar cache por URL do tenant
  const cached = _lojasCache.get(excelLojasUrl);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.log(`⚡ Retornando ${cached.data.length} lojas do cache`);
    return cached.data;
  }

  const sharingUrl = excelLojasUrl;
  const sharingToken = encodeSharingUrl(sharingUrl);
  console.log('🔗 Sharing token:', sharingToken.substring(0, 50) + '...');
  console.log('🔗 URL original:', sharingUrl);

  // Lista de estratégias a tentar (em ordem de preferência)
  const strategies = [
    () => trySharesDownload(sharingToken, accessToken),
    () => tryDirectDownloadUrl(sharingToken, accessToken),
    () => trySharesExcelApi(sharingToken, accessToken),
    () => trySharedWithMe(accessToken),
  ];

  let lojas = null;
  let lastError = null;

  for (let i = 0; i < strategies.length; i++) {
    try {
      lojas = await strategies[i]();
      if (lojas && lojas.length > 0) {
        console.log(`\n🎉 Estratégia ${i + 1} funcionou! ${lojas.length} lojas carregadas.`);
        break;
      }
    } catch (err) {
      console.error(`❌ Estratégia ${i + 1} lançou erro:`, err.message);
      lastError = err;
    }
  }

  if (!lojas || lojas.length === 0) {
    const errorMsg =
      'Não foi possível acessar a planilha de lojas por nenhuma das estratégias. ' +
      'Verifique se:\n' +
      '  1. A URL do Excel do tenant está correta\n' +
      '  2. O arquivo foi compartilhado com "Pessoas na Torres CX com o link"\n' +
      '  3. O usuário logado tem permissão para acessar o arquivo\n' +
      '  4. O App Registration tem a permissão Files.Read.All';
    throw new Error(lastError ? `${errorMsg}\n\nÚltimo erro: ${lastError.message}` : errorMsg);
  }

  // Atualizar cache por tenant
  _lojasCache.set(excelLojasUrl, { data: lojas, timestamp: Date.now() });

  return lojas;
}

/**
 * Limpa o cache de lojas (útil para forçar recarga).
 */
function clearLojasCache(excelLojasUrl) {
  if (excelLojasUrl) {
    _lojasCache.delete(excelLojasUrl);
    console.log(`🗑️  Cache de lojas limpo para: ${excelLojasUrl}`);
  } else {
    _lojasCache.clear();
    console.log('🗑️  Cache de lojas limpo (todos os tenants)');
  }
}

module.exports = { encodeSharingUrl, getLojas, clearLojasCache };
