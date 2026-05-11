export const errorHandler = (err, req, res, next) => {
  console.error('Error no manejado:', {
    message: err.message,
    name: err.name,
    stack: err.stack,
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl
  });

  const requestId = req.requestId || null;

  // Error de sintaxis JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'JSON invalido en la solicitud',
      requestId
    });
  }

  if (err.message === 'Origen no permitido por CORS') {
    return res.status(403).json({
      success: false,
      message: 'Origen no permitido',
      requestId
    });
  }

  // Error genérico
  const statusCode = Number(err.status || err.statusCode || 500);
  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 && process.env.NODE_ENV !== 'development'
      ? 'Error interno del servidor'
      : (err.message || 'Error interno del servidor'),
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    requestId: req.requestId || null
  });
};
