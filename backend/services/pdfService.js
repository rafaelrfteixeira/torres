const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Pré-carrega o logo em Base64 para embedar diretamente no HTML do PDF
// Isso evita problemas de caminhos locais quando o Puppeteer rodar no Docker
let logoBase64 = '';
try {
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  const bitmap = fs.readFileSync(logoPath);
  logoBase64 = `data:image/png;base64,${Buffer.from(bitmap).toString('base64')}`;
} catch (error) {
  console.error('⚠️ Aviso: logo.png não encontrado na pasta assets. O PDF será gerado sem logo.', error.message);
}

/**
 * pdfService.js — Geração de PDF a partir de HTML
 * 
 * Renderiza um template HTML meticulosamente desenhado para
 * ser idêntico ao formulário físico "Check List Lojas".
 */

/**
 * Helper para renderizar checkboxes (marcado ou vazio)
 * No papel físico, é preenchido um X. Em Linux/Docker, evitamos caracteres Unicode
 * exóticos (como ballot boxes) pois muitas vezes a fonte não os têm. Usamos CSS border e um X.
 */
function checkbox(isChecked) {
  return `<span class="box">${isChecked ? 'X' : '&nbsp;'}</span>`;
}

function field(value) {
  return value ? value : '';
}

/**
 * Constrói o HTML dinâmico interpolando os dados numéricos, strings e checkboxes.
 */
function generateHTML(data) {
  const s = data.sistemas || {};
  const esp = data.especificacoes || {};
  const st = data.statusLoja || {};
  const pen = data.pendencias || {};

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório Operacional</title>
      <style>
        /* Reset e configuração de página A4 */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: A4 portrait; margin: 8mm 10mm; }
        body {
          font-family: 'Arial', sans-serif;
          font-size: 10pt;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Estrutura Principal */
        .page-container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        /* Header Logo e Título */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2mm;
        }
        .logo-area {
          display: flex;
          align-items: center;
        }
        .logo-box {
          width: 50px;
          height: 50px;
          background-color: #004b93;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 8px;
        }
        .logo-box span { color: white; display:block; font-size:18px; font-weight:bold; letter-spacing:-1px;}
        .brand-text h1 { font-size: 20pt; font-weight: normal; color: #004b93; margin: 0; letter-spacing: -1px; }
        .brand-text p { font-size: 8pt; color: #555; margin-top: -2px; }
        
        .header-right { text-align: right; }
        .header-date { font-size: 9pt; margin-bottom: 5px; }
        .header-date span { border-bottom: 1px solid #000; padding: 0 15px; display: inline-block; width: 150px;}
        .header-right h2 { font-size: 14pt; margin: 0; }

        /* Blocos com Bordas Fortes (duplas ou espessas) */
        .section-box {
          border: 2px solid #000;
          margin-bottom: 3mm;
        }
        
        .section-title-fill {
          background-color: #e6e6e6;
          text-align: center;
          font-weight: bold;
          font-size: 11pt;
          padding: 3px 0;
          border-bottom: 2px solid #000;
        }

        /* Manutenção */
        .maintenance-row {
          display: flex;
          justify-content: space-around;
          padding: 8px 0;
          font-weight: bold;
        }

        /* Tabela de Dados (Loja, Solicitante, etc) */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-top: 2px solid #000;
        }
        .info-cell {
          border-right: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 4px 6px;
          font-size: 9pt;
        }
        .info-cell:nth-child(even) { border-right: none; }
        .info-label { font-weight: bold; margin-right: 5px; }

        /* Tipo da Loja */
        .store-type-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 10px;
          border: 2px solid #000;
          margin-bottom: 3mm;
          font-weight: bold;
          font-size: 9pt;
          align-items: center;
        }
        .store-type-label { font-style: italic; font-weight: bold; margin-right: 15px;}

        /* Main Grid: Sistemas (Esquerda) + Especificações (Direita) */
        .main-columns {
          display: flex;
          gap: 3mm;
          margin-bottom: 3mm;
        }
        .systems-col { flex: 2; border: 2px solid #000; }
        .specs-col { flex: 1; border: 2px solid #000; padding: 5px; }

        /* Tabela de Sistemas */
        .systems-table {
          width: 100%;
          border-collapse: collapse;
          text-align: center;
          font-size: 8pt;
        }
        .systems-table th {
          background-color: #e6e6e6;
          border-bottom: 2px solid #000;
          border-right: 1px solid #000;
          padding: 4px;
        }
        .systems-table th:last-child { border-right: none; }
        .systems-table td {
          border-bottom: 1px solid #000;
          border-right: 1px solid #000;
          padding: 5px 2px;
        }
        .systems-table tr:last-child td { border-bottom: none; }
        .systems-table td:last-child { border-right: none; }
        .sys-name { text-align: left; padding-left: 5px !important; font-style: italic; font-weight: bold;}
        .chk-group { display: flex; justify-content: space-evenly; align-items: center;}

        /* Especificações */
        .specs-title { text-align: center; font-weight: bold; background-color: #e6e6e6; border-bottom: 1px solid #000; padding: 2px 0; margin: -5px -5px 5px -5px;}
        .specs-row { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 6px; font-size: 9pt; font-weight: bold;}
        .specs-row label { margin-right: 10px; }
        .specs-input { width: 50px; height: 16px; border: 1px solid #000; display: inline-block; text-align: center; }
        .central-propria { margin-bottom: 10px; text-align: center; font-weight: bold; font-size: 9pt;}

        /* Observações */
        .obs-box { border: 2px solid #000; min-height: 80px; margin-bottom: 3mm; padding: 5px;}
        .obs-title { font-weight: bold; font-size: 10pt; margin-bottom: 5px;}
        .obs-content { font-size: 9pt; white-space: pre-wrap; word-wrap: break-word; line-height: 1.4; border-bottom: 1px solid #ccc; min-height: 60px;}

        /* Status + Pendências */
        .status-columns { display: flex; gap: 3mm; margin-bottom: 3mm; }
        .status-col { flex: 1; border: 2px solid #000; padding: 5px; }
        .status-title { text-align: center; font-weight: bold; background-color: #e6e6e6; border-bottom: 1px solid #000; padding: 3px 0; margin: -5px -5px 8px -5px;}
        .status-item { font-size: 8pt; font-weight: bold; margin-bottom: 6px; display: flex; align-items: center;}
        .status-item span.box { margin-right: 5px; }
        .status-item-text { flex: 1; border-bottom: 1px solid #000; margin-left: 5px; min-height: 12px;}

        /* Rodapé Assinaturas */
        .footer-sig { border: 2px solid #000; display: grid; grid-template-columns: 2fr 1fr 1fr 2fr; margin-bottom: 2mm;}
        .sig-cell { border-right: 1px solid #000;text-align: center;}
        .sig-cell:last-child { border-right: none; }
        .sig-header { background-color: #e6e6e6; border-bottom: 1px solid #000; font-weight: bold; padding: 2px 0; font-size: 9pt;}
        .sig-body { height: 25px; display: flex; align-items: end; justify-content: center; padding-bottom: 3px; font-size: 9pt;}
        
        .legal-text { font-size: 6pt; text-align: justify; color: #333; margin-bottom: 5mm;}
        .page-num { text-align: right; font-weight: bold; font-size: 9pt;}
        .page-num span { display: inline-block; width: 30px; border-bottom: 1px solid #000;text-align:center;}

        /* Checkbox Box Element (CSS puro para evitar erros de fonte no Linux) */
        .box {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
          font-size: 10pt;
          font-weight: bold;
          vertical-align: middle;
          margin-right: 3px;
          line-height: 1;
          width: 14px;
          height: 14px;
          border: 1px solid #000;
          color: #000;
        }
        
        .chk-label { font-size: 8pt; }
      </style>
    </head>
    <body>
      <div class="page-container">
        
        <!-- Header -->
        <div class="header">
          <div class="logo-area">
            ${logoBase64 ? `<img src="${logoBase64}" alt="TORRES | Cx" style="height: 50px; object-fit: contain;" />` : '<h1>TORRES | Cx</h1>'}
          </div>
          <div class="header-right">
            <div class="header-date">
              DATA: <span>${data.data ? data.data.split('-').reverse().join('/') : ''}</span>
            </div>
            <h2>RELATÓRIO OPERACIONAL</h2>
          </div>
        </div>

        <!-- Box 1 -->
        <div class="section-box">
          <div class="section-title-fill">CHECK LIST - LOJAS</div>
          <div class="maintenance-row">
            <div>MANUTENÇÃO CORRETIVA ${checkbox(data.manutencaoCorretiva)}</div>
            <div>MANUTENÇÃO PREVENTIVA ${checkbox(data.manutencaoPreventiva)}</div>
          </div>
          <div class="info-grid">
            <div class="info-cell"><span class="info-label">LOJA:</span> ${field(data.loja)}</div>
            <div class="info-cell"><span class="info-label">SOLICITANTE:</span> ${field(data.solicitante)}</div>
            <div class="info-cell" style="border-bottom:none;"><span class="info-label">TELEFONE:</span> ${field(data.telefone)}</div>
            <div class="info-cell" style="border-bottom:none;"><span class="info-label">E-MAIL:</span> ${field(data.email)}</div>
          </div>
        </div>

        <!-- Tipo Loja -->
        <div class="store-type-row">
          <span class="store-type-label">TIPO DA LOJA</span>
          <div>${checkbox(data.tipoLoja === 'Âncora')} ÂNCORA</div>
          <div>${checkbox(data.tipoLoja === 'Megaloja')} MEGALOJA</div>
          <div>${checkbox(data.tipoLoja === 'Satélite')} SATÉLITE</div>
          <div>${checkbox(data.tipoLoja === 'Fast Food')} FAST FOOD</div>
          <div>${checkbox(data.tipoLoja === 'Quiosque')} QUIOSQUE</div>
        </div>

        <!-- Main Areas -->
        <div class="main-columns">
          
          <!-- Tabela de Sistemas -->
          <div class="systems-col">
            <table class="systems-table">
              <tr>
                <th>SISTEMA</th>
                <th>EXISTENTE</th>
                <th>FUNCIONANDO</th>
              </tr>
              ${[
                { id: 'alarme_do_shopping', name: 'ALARME DO SHOPPING' },
                { id: 'alarme_da_loja', name: 'ALARME DA LOJA' },
                { id: 'extração_de_fumaça', name: 'EXTRAÇÃO DE FUMAÇA' },
                { id: 'insuflamento_de_ar', name: 'INSUFLAMENTO DE AR' },
                { id: 'ar_condicionado', name: 'AR CONDICIONADO' },
                { id: 'comando_de_gás', name: 'COMANDO DE GÁS' },
                { id: 'damper_extração', name: 'DAMPER EXTRAÇÃO' },
                { id: 'damper_insuflamento', name: 'DAMPER INSUFLAMENTO' }
              ].map(sys => `
              <tr>
                <td class="sys-name">${sys.name}</td>
                <td>
                  <div class="chk-group">
                    <span>${checkbox(s[sys.id]?.existenteSim)} <span class="chk-label">SIM</span></span>
                    <span>${checkbox(s[sys.id]?.existenteNao)} <span class="chk-label">NÃO</span></span>
                  </div>
                </td>
                <td>
                  <div class="chk-group">
                    <span>${checkbox(s[sys.id]?.funcionandoSim)} <span class="chk-label">SIM</span></span>
                    <span>${checkbox(s[sys.id]?.funcionandoNao)} <span class="chk-label">NÃO</span></span>
                  </div>
                </td>
              </tr>
              `).join('')}
            </table>
          </div>

          <!-- Especificações -->
          <div class="specs-col">
            <div class="specs-title">ESPECIFICAÇÕES</div>
            <div class="central-propria">
              CENTRAL PRÓPRIA &nbsp; S ${checkbox(data.centralPropria==='sim')} &nbsp; N ${checkbox(data.centralPropria==='nao')}
            </div>
            
            <div class="specs-row"><label>N° DF</label><div class="specs-input">${field(esp.nDF)}</div></div>
            <div class="specs-row"><label>N° DT</label><div class="specs-input">${field(esp.nDT)}</div></div>
            <div class="specs-row"><label>N° AM</label><div class="specs-input">${field(esp.nAM)}</div></div>
            <div class="specs-row"><label>N° SIRENES</label><div class="specs-input">${field(esp.nSirenes)}</div></div>
            <div class="specs-row"><label>N° DG</label><div class="specs-input">${field(esp.nDG)}</div></div>
            <div class="specs-row"><label>N° MODULOS</label><div class="specs-input">${field(esp.nModulos)}</div></div>
            <div class="specs-row"><label>OUTROS DISPOSITIVOS</label><div class="specs-input">${field(esp.outrosDispositivos)}</div></div>
          </div>
        </div>

        <!-- Observações -->
        <div class="obs-box">
          <div class="obs-title">OBSERVAÇÕES:</div>
          <div class="obs-content">${field(data.observacoes)}</div>
        </div>

        <!-- Status & Pendencias -->
        <div class="status-columns">
          <div class="status-col">
            <div class="status-title">STATUS DA LOJA</div>
            <div class="status-item">${checkbox(st['Sistema Funcionando Normalmente'])} SISTEMA FUNCIONANDO NORMALMENTE</div>
            <div class="status-item">${checkbox(st['Sistema Funcionando Parcialmente'])} SISTEMA FUNCIONANDO PARCIALMENTE</div>
            <div class="status-item">${checkbox(st['Sistema com Defeito'])} SISTEMA COM DEFEITO</div>
            <div class="status-item">${checkbox(st['Não Possui Detecção'])} NÃO POSSUI DETECÇÃO</div>
            <div class="status-item">${checkbox(!!data.statusOutros)} OUTROS <div class="status-item-text">${field(data.statusOutros)}</div></div>
          </div>
          <div class="status-col">
            <div class="status-title">PENDÊNCIAS</div>
            <div class="status-item">${checkbox(pen['Necessário Abertura do Forro'])} NECESSÁRIO ABERTURA DO FORRO</div>
            <div class="status-item">${checkbox(pen['Verificar Integridade do Cabo de Alimentação'])} VERIFICAR INTEGRIDADE DO CABO DE ALIMENTAÇÃO</div>
            <div class="status-item">${checkbox(pen['Verificar Integridade do Cabo de Sinal'])} VERIFICAR INTEGRIDADE DO CABO DE SINAL</div>
            <div class="status-item">${checkbox(pen['Interligar o Sistema da Loja com do Shopping'])} INTERLIGAR O SISTEMA DA LOJA COM DO SHOPPING</div>
            <div class="status-item">${checkbox(pen['Necessário Verificar o Sistema da Loja'])} NECESSÁRIO VERIFICAR O SISTEMA DA LOJA</div>
            <div class="status-item">${checkbox(pen['Troca de Dispositivo'])} TROCA DE DISPOSITIVO <div class="status-item-text"></div></div>
            <div class="status-item">${checkbox(!!data.pendenciasOutros)} OUTROS <div class="status-item-text">${field(data.pendenciasOutros)}</div></div>
          </div>
        </div>

        <div style="font-size: 5pt; text-align: justify; margin-bottom: 2mm; text-transform: uppercase;">
          * ESSE CHECK LIST É REALIZADO COM APROVAÇÃO DA ADMINISTRAÇÃO DO SHOPPING, SE O SISTEMA DE DETECÇÃO DE INCÊNDIO
          DA LOJA NÃO ESTIVER FUNCIONANDO CORRETAMENTE OU DE ACORDO COM AS NORMAS IMPOSTAS PELO SHOPPING, É DE RESPONSABILIDADE
          DO LOJISTA ADEQUAR SEU SISTEMA DE DETECÇÃO E ALARME DE INCÊNDIO NOS PADRÕES DO SHOPPING.
        </div>

        <!-- Rodapé / Assinaturas -->
        <div class="footer-sig">
          <div class="sig-cell">
            <div class="sig-header">ENG. / TÉC.</div>
            <div class="sig-body">${field(data.engTecnico)}</div>
          </div>
          <div class="sig-cell">
            <div class="sig-header">INÍCIO / TÉRMINO</div>
            <div class="sig-body">${field(data.horarioInicio)} às ${field(data.horarioTermino)}</div>
          </div>
          <div class="sig-cell">
            <div class="sig-header">TOTAL DE HORAS</div>
            <div class="sig-body">${field(data.totalHoras)}</div>
          </div>
          <div class="sig-cell">
            <div class="sig-header">ACEITO POR:</div>
            <div class="sig-body">${field(data.aceitoPor)}</div>
          </div>
        </div>

        <div class="legal-text">
          CONFORME NBR 17240 - 10.3 - A MANUTENÇÃO PREVENTIVA DEVE GARANTIR QUE O SISTEMA DE DETECÇÃO E ALARME DE INCÊNDIO ESTEJA EM PLENO
          FUNCIONAMENTO, OU REGISTRAR NO RELATÓRIO AS SUAS RESTRIÇÕES OU FALHAS. NESTE ÚLTIMO CASO RECOMENDA-SE QUE AS CORREÇÕES NECESSÁRIAS
          SEJAM EXECUTADAS DE IMEDIATO. (ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS, 2010, P.47).
        </div>

        <div class="page-num">
          PÁGINA <span>1</span> DE <span>1</span>
        </div>

      </div>
    </body>
    </html>
  `;
}

/**
 * Invoca o Puppeteer para gerar um buffer PDF a partir do HTML.
 */
async function generatePDFBuffer(formData) {
  const html = generateHTML(formData);
  
  // Puppeteer usa argumentos específicos para contornar bloqueios comuns de SO/Docker
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // Previne crash de memória no Docker (/dev/shm)
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    // setContent aguarda até o domenuto carregar via networkidle0
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // formatação de impressão exata A4
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true, // Garante que as cores de fundo (cinza das section titles) apareçam
      margin: { top: 0, bottom: 0, left: 0, right: 0 } // as margens já estão na div .page-container / @page
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

/**
 * Converte o PDF em Buffer para Base64.
 */
async function generatePDFBase64(formData) {
  const buffer = await generatePDFBuffer(formData);
  // Puppeteer > v20 retorna Uint8Array. Precisamos converter para Buffer do Node antes do base64.
  return Buffer.from(buffer).toString('base64');
}

module.exports = {
  generateHTML,
  generatePDFBuffer,
  generatePDFBase64
};
