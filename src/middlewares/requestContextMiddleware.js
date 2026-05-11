import crypto from 'crypto';

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key'
]);

const safeHeaders = (headers = {}) => {
  const clone = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    clone[key] = SENSITIVE_HEADERS.has(lower) ? '[redacted]' : value;
  }
  return clone;
};

const isDevelopment = process.env.NODE_ENV === 'development';
const verboseLogging = process.env.REQUEST_LOG_VERBOSE === 'true';
const logOptionsRequests = process.env.REQUEST_LOG_OPTIONS === 'true';

export const requestContextMiddleware = (req, res, next) => {
  const requestId = crypto.randomUUID();
  const startedAt = process.hrtime.bigint();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const shouldLog = isDevelopment && (logOptionsRequests || req.method !== 'OPTIONS');

  if (shouldLog && verboseLogging) {
    const payload = {
      type: 'request:start',
      requestId,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent') || null,
      headers: safeHeaders(req.headers)
    };
    console.log(JSON.stringify(payload));
  }

  res.on('finish', () => {
    if (!shouldLog) return;

    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    if (verboseLogging) {
      const payload = {
        type: 'request:finish',
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Number(elapsedMs.toFixed(2))
      };
      console.log(JSON.stringify(payload));
      return;
    }

    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs.toFixed(2)}ms`);
  });

  next();
};
