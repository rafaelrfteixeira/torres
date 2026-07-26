/**
 * matrizMestraService.js — Leitura e Parse da Matriz Mestra (Excel) de Preventivas
 */

const XLSX = require('xlsx');

const MESES_MAP = {
  'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3,
  'abril': 4, 'maio': 5, 'junho': 6,
  'julho': 7, 'agosto': 8, 'setembro': 9,
  'outubro': 10, 'novembro': 11, 'dezembro': 12,
  'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
  'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12,
};

/**
 * Converte URL de compartilhamento em Sharing Token (Base64 URL-safe + prefixo u!)
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
 * Faz download de um arquivo via Graph API e retorna o buffer.
 */
async function downloadExcelViaGraph(accessToken, sharingUrl) {
  const sharingToken = encodeSharingUrl(sharingUrl);
  const baseUrl = 'https://graph.microsoft.com/v1.0';

  console.log('📡 [MatrizMestra] Resolvendo driveItem via shares...');
  const driveItemRes = await fetch(`${baseUrl}/shares/${sharingToken}/driveItem`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'redeemSharingLink',
    },
  });

  if (!driveItemRes.ok) {
    const err = await driveItemRes.text();
    throw new Error(`Falha ao resolver driveItem: [${driveItemRes.status}] ${err}`);
  }

  const driveItem = await driveItemRes.json();
  const driveId = driveItem.parentReference?.driveId;
  const itemId = driveItem.id;

  if (!driveId || !itemId) {
    throw new Error('driveId ou itemId não encontrados na Matriz Mestra');
  }

  console.log(`📁 [MatrizMestra] Arquivo: ${driveItem.name} (driveId=${driveId}, itemId=${itemId})`);

  const downloadRes = await fetch(`${baseUrl}/drives/${driveId}/items/${itemId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!downloadRes.ok) {
    const err = await downloadRes.text();
    throw new Error(`Falha no download da Matriz Mestra: [${downloadRes.status}] ${err}`);
  }

  const arrayBuffer = await downloadRes.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    driveId,
    itemId,
    fileName: driveItem.name,
  };
}

function parseMesNumero(mesTexto) {
  if (!mesTexto) return 0;
  const clean = String(mesTexto).trim().toLowerCase();
  if (MESES_MAP[clean]) return MESES_MAP[clean];

  for (const [key, val] of Object.entries(MESES_MAP)) {
    if (clean.includes(key)) return val;
  }

  const num = parseInt(clean, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return num;
  return 0;
}

/**
 * Parseia o buffer Excel da Matriz Mestra.
 * Colunas esperadas: Pavimento, Laço, Tipo, Descrição, Mês Manutenção, Realizado 2026
 */
function parseMatrizMestra(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Nenhuma aba encontrada na Matriz Mestra');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`📊 [MatrizMestra] ${rows.length} linhas lidas da aba "${sheetName}"`);
  if (rows.length <= 1) return { dispositivos: [], headerRowIdx: 0, colMap: {} };

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row || row.length <= 1) continue;
    const cells = row.map((h) => String(h || '').trim().toLowerCase());
    const hasPavimento = cells.some((h) => h.includes('pavimento') || h.includes('piso'));
    const hasDescricao = cells.some((h) => h.includes('descrição') || h.includes('descricao') || h.includes('localizacao'));
    const hasMes = cells.some((h) => h.includes('mês') || h.includes('mes') || h.includes('manutenção') || h.includes('programacao'));
    if ([hasPavimento, hasDescricao, hasMes].filter(Boolean).length >= 2) {
      headerRowIdx = i;
      break;
    }
  }

  const header = rows[headerRowIdx].map((h) => String(h || '').trim().toLowerCase());
  console.log(`📋 [MatrizMestra] Cabeçalho (linha ${headerRowIdx}):`, JSON.stringify(rows[headerRowIdx]));

  // 1. Procurar especificamente pela coluna "Realizado 2026"
  let realizadoIdx = header.findIndex((h) => h === 'realizado 2026' || h === 'realizado_2026' || h === 'realizado-2026');
  if (realizadoIdx === -1) {
    realizadoIdx = header.findIndex((h) => h.includes('realizado') && h.includes('2026'));
  }
  if (realizadoIdx === -1) {
    realizadoIdx = header.findIndex((h) => h.includes('realizado'));
  }

  // 2. Procurar especificamente pela coluna "Mês Manutenção" ou "Mês"
  let mesIdx = header.findIndex((h) => h === 'mês manutenção' || h === 'mes manutencao' || h === 'mês' || h === 'mes');
  if (mesIdx === -1) {
    mesIdx = header.findIndex((h) => (h.includes('mês') || h.includes('mes')) && !h.includes('realizado'));
  }
  if (mesIdx === -1) {
    mesIdx = header.findIndex((h) => h.includes('manutenção') && !h.includes('realizado'));
  }

  const colMap = {
    pavimento: header.findIndex((h) => h.includes('pavimento') || h.includes('piso')),
    laco: header.findIndex((h) => h.includes('laço') || h.includes('laco')),
    tipo: header.findIndex((h) => h.includes('tipo') && !h.includes('dispositivo')),
    descricao: header.findIndex((h) => h.includes('descrição') || h.includes('descricao') || h.includes('localizacao')),
    mesMantencao: mesIdx !== -1 ? mesIdx : 4,
    realizado: realizadoIdx !== -1 ? realizadoIdx : 5,
  };

  if (colMap.pavimento === -1) colMap.pavimento = 0;
  if (colMap.laco === -1) colMap.laco = 1;
  if (colMap.tipo === -1) colMap.tipo = 2;
  if (colMap.descricao === -1) colMap.descricao = 3;

  console.log('🔍 [MatrizMestra] Índices de colunas mapeados:', colMap);

  const mesAtual = new Date().getMonth() + 1;

  const dispositivos = rows.slice(headerRowIdx + 1)
    .filter((row) => row && row.length > 0)
    .map((row, index) => {
      const pavimento = row[colMap.pavimento] != null ? String(row[colMap.pavimento]).trim() : '';
      const laco = row[colMap.laco] != null ? String(row[colMap.laco]).trim() : '';
      const tipo = row[colMap.tipo] != null ? String(row[colMap.tipo]).trim() : '';
      const descricao = row[colMap.descricao] != null ? String(row[colMap.descricao]).trim() : '';
      const mesTexto = row[colMap.mesMantencao] != null ? String(row[colMap.mesMantencao]).trim().toLowerCase() : '';
      const realizadoRaw = row[colMap.realizado] != null ? String(row[colMap.realizado]).trim().toLowerCase() : '';

      const mesNumero = parseMesNumero(mesTexto);
      const realizado = realizadoRaw === 'sim' || realizadoRaw === 's' || realizadoRaw === 'yes' || realizadoRaw === 'ok';

      let status = 'realizado';
      if (!realizado) {
        if (mesNumero > 0 && mesNumero < mesAtual) {
          status = 'atrasado';
        } else if (mesNumero === mesAtual) {
          status = 'pendente';
        } else if (mesNumero > mesAtual) {
          status = 'futuro';
        } else {
          status = 'pendente';
        }
      }

      if (index < 5) {
        console.log(`  [Row ${index + 1}] Pavimento: "${pavimento}", Laço: "${laco}", Descrição: "${descricao}", Mês: "${mesTexto}" (${mesNumero}), RealizadoRaw: "${realizadoRaw}" -> Realizado: ${realizado}`);
      }

      return {
        rowIndex: headerRowIdx + 1 + index,
        realizadoColIndex: colMap.realizado,
        pavimento,
        laco,
        tipo,
        descricao,
        mesMantencao: mesTexto,
        mesNumero,
        realizadoRaw,
        realizado,
        status,
      };
    })
    .filter((d) => d.descricao !== '');

  const mesResumo = {};
  dispositivos.forEach((d) => {
    const k = d.mesMantencao || 'sem_mes';
    if (!mesResumo[k]) mesResumo[k] = { mesNumero: d.mesNumero, total: 0, sim: 0, nao: 0, rawValues: {} };
    mesResumo[k].total++;
    const raw = String(d.realizadoRaw || '').toLowerCase();
    mesResumo[k].rawValues[raw] = (mesResumo[k].rawValues[raw] || 0) + 1;
    if (d.realizado) mesResumo[k].sim++;
    else mesResumo[k].nao++;
  });

  console.log('\n======================================================');
  console.log('📊 [MatrizMestra] RESUMO DA PLANILHA EXCEL POR MÊS:');
  console.log(JSON.stringify(mesResumo, null, 2));
  console.log('======================================================\n');
  console.log('======================================================\n');

  console.log(`✅ [MatrizMestra] ${dispositivos.length} dispositivos parseados. Sim count total: ${dispositivos.filter((d) => d.realizado).length}`);
  return { dispositivos, headerRowIdx, colMap };
}

module.exports = {
  MESES_MAP,
  encodeSharingUrl,
  downloadExcelViaGraph,
  parseMatrizMestra,
};
