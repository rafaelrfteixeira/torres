/**
 * report.controller.js — Controller de Relatórios Técnicos
 *
 * Handlers:
 *   GET /api/reports/monthly-preventive?tenant=<tenant>&mes=<mes>&ano=<ano>
 *     → Retorna o HTML consolidado do Relatório Técnico de Preventivas Mensal
 */

const { getGraphClient } = require('../services/graphClient');
const { generateMonthlyPreventiveReport } = require('../services/reportService');

const getMonthlyPreventive = async (req, res, next) => {
  try {
    const accessToken = req.session?.accessToken;
    if (!accessToken) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    const tenantConfig = req.tenantConfig;
    const now = new Date();

    const mes = parseInt(req.query.mes, 10) || now.getMonth() + 1;
    const ano = parseInt(req.query.ano, 10) || now.getFullYear();
    const sistema = req.query.sistema || 'sdai';

    if (mes < 1 || mes > 12) {
      return res.status(400).json({ success: false, message: 'Mês inválido. Deve ser entre 1 e 12.' });
    }

    if (ano < 2020 || ano > 2100) {
      return res.status(400).json({ success: false, message: 'Ano inválido.' });
    }

    const graphClient = getGraphClient(accessToken);

    const html = await generateMonthlyPreventiveReport(
      graphClient,
      accessToken,
      tenantConfig,
      mes,
      ano,
      sistema
    );

    // Se a query param ?json=true for passada, podemos enviar em envelope JSON
    if (req.query.json === 'true') {
      return res.json({ success: true, html, mes, ano, tenant: req.tenantSlug });
    }

    // Por padrão retorna a string HTML pronta para visualização / renderização / PDF
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('❌ [ReportController] Erro ao gerar relatório mensal:', error.message);
    next(error);
  }
};

module.exports = {
  getMonthlyPreventive,
};
