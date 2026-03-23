require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler.middleware');

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------
// Middlewares Globais
// ---------------------
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------
// Sessão (necessário para OAuth 2.0)
// ---------------------
// Necessário para o Express entender conexões HTTPS que vêm de um Proxy Reverso (Easypanel/Traefik)
app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-trocar-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS em produção
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Permite que o cookie viaje cross-origin no frontend
    httpOnly: true,
    maxAge: 1000 * 60 * 60, // 1 hora
  },
}));

// ---------------------
// Rotas
// ---------------------
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------
// Error Handler Global
// ---------------------
app.use(errorHandler);

// ---------------------
// Iniciar Servidor
// ---------------------
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📋 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
