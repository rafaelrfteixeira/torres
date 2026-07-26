const express = require('express');
const router = express.Router();
const inspectionRoutes = require('./inspections.routes');
const authRoutes = require('./auth.routes');
const checklistsRoutes = require('./checklists.routes');
const lojasRoutes = require('./lojas.routes');
const preventivasRoutes = require('./preventivas.routes');
const corretivasRoutes = require('./corretivas.routes');
const reportRoutes = require('./report.routes');

// -----------------------------------------------
// Registro de Rotas
// -----------------------------------------------

// Autenticação (Microsoft Entra ID / OAuth 2.0)
router.use('/auth', authRoutes);

// Inspeções (CRUD)
router.use('/inspections', inspectionRoutes);

// Checklists (Microsoft Lists)
router.use('/checklists', checklistsRoutes);

// Lojas (Excel via MS Graph — Autocomplete)
router.use('/lojas', lojasRoutes);

// Preventivas — Manutenção Preventiva Área Comum (Excel + Microsoft Lists)
router.use('/preventivas', preventivasRoutes);

// Corretivas / Ocorrências (Microsoft Lists)
router.use('/corretivas', corretivasRoutes);

// Relatórios (Preventivas, etc.)
router.use('/reports', reportRoutes);

module.exports = router;
