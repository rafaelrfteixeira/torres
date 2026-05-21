const express = require('express');
const router = express.Router();
const inspectionRoutes = require('./inspections.routes');
const authRoutes = require('./auth.routes');
const checklistsRoutes = require('./checklists.routes');
const lojasRoutes = require('./lojas.routes');

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

// TODO: Futuras rotas
// router.use('/reports', reportRoutes);    → Geração e envio de relatórios PDF via Outlook

module.exports = router;
