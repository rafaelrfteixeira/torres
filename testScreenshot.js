const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function captureScreenshot() {
  const htmlPath = path.join(__dirname, 'docs', 'pdf_preview.html');
  const imgPath = path.join(__dirname, 'docs', 'print_formulario.png');

  if (!fs.existsSync(htmlPath)) {
    console.error('❌ O arquivo pdf_preview.html não foi encontrado. Rode testPdf.js primeiro.');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    // Configura um viewport equivalente a uma página A4 a 96 DPI (aprox 794x1123)
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });

    console.log('📸 Capturando screenshot do formulário...');
    await page.screenshot({ path: imgPath, fullPage: true });

    console.log('✅ Print do formulário salvo com sucesso em:', imgPath);
  } catch (err) {
    console.error('❌ Erro ao capturar screenshot:', err);
  } finally {
    await browser.close();
  }
}

captureScreenshot();
