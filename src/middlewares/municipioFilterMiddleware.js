// Middleware para detectar y exponer el municipio seleccionado en la request
// Solo los roles permitidos pueden usar el filtro por municipio.

const ALLOWED_MUNICIPIO_FILTER_ROLES = new Set([
  'direccion',
  'admin',
  'coordinador',
  'super_admin'
]);

const parseMunicipioId = (value) => {
  if (value === undefined || value === null) return null;
  const parsed = Number(String(value).trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const municipioFilterMiddleware = (req, res, next) => {
  const rawMunicipioId = req.query?.municipio_id
    ?? req.body?.municipio_id
    ?? req.params?.municipio_id
    ?? req.params?.municipioId
    ?? req.headers['x-municipio-id']
    ?? req.headers['x-municipioid'];

  if (rawMunicipioId === undefined || rawMunicipioId === null || String(rawMunicipioId).trim() === '') {
    return next();
  }

  const municipioId = parseMunicipioId(rawMunicipioId);
  if (!municipioId) {
    return res.status(400).json({
      success: false,
      message: 'Municipio inválido'
    });
  }

  const userRole = String(req.userRole || '').trim();
  if (!ALLOWED_MUNICIPIO_FILTER_ROLES.has(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos para filtrar por municipio'
    });
  }

  req.municipio_id = municipioId;
  next();
};
