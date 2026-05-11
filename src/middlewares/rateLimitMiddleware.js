import rateLimit from 'express-rate-limit';

const apiWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const apiMax = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300);
const authWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const authMax = Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS || 8);
const isDevelopment = process.env.NODE_ENV !== 'production';

export const apiRateLimiter = rateLimit({
  windowMs: apiWindowMs,
  max: apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return (
      req.method === 'OPTIONS' ||
      (isDevelopment && req.method === 'GET') ||
      req.path === '/health' ||
      req.path === '/api/auth/login' ||
      req.path === '/api/auth/profile'
    );
  },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Demasiadas solicitudes en poco tiempo. Intenta de nuevo en unos minutos.',
      requestId: req.requestId || null
    });
  }
});

export const authLoginRateLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    return `${req.ip}:${username || 'unknown'}`;
  },
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Se excedio el numero de intentos de inicio de sesion. Espera un momento e intenta nuevamente.',
      requestId: req.requestId || null
    });
  }
});
