/**
 * Error Handler Middleware
 *
 * Middleware global para tratamento de erros.
 * Captura erros lançados em qualquer rota ou middleware
 * e retorna uma resposta padronizada.
 */

const errorHandler = (err, req, res, _next) => {
  console.error('❌ Erro:', err.message);
  console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
