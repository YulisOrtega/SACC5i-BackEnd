import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const MAX_TEMP_PASSWORD_CANDIDATES = 5;

const toIsoDate = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const parseJsonSafe = (value) => {
  if (!value) return null;

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const generarContrasenaTemporal = (length = 10) => {
  const safeLength = Math.max(8, Math.min(24, Number(length) || 10));
  const randomBytes = crypto.randomBytes(safeLength);

  let raw = '';
  for (let i = 0; i < safeLength; i += 1) {
    raw += TEMP_PASSWORD_CHARS[randomBytes[i] % TEMP_PASSWORD_CHARS.length];
  }

  return `TMP-${raw}`;
};

export const registrarBitacoraAccesoTemporal = async (
  connection,
  {
    accesoTemporalId = null,
    usuarioObjetivoId,
    actorId = null,
    actorRol = null,
    accion,
    descripcion,
    metadata = null
  }
) => {
  await connection.query(
    `INSERT INTO usuarios_accesos_temporales_bitacora
     (acceso_temporal_id, usuario_objetivo_id, actor_id, actor_rol, accion, descripcion, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      accesoTemporalId,
      usuarioObjetivoId,
      actorId,
      actorRol,
      accion,
      descripcion,
      metadata ? JSON.stringify(metadata) : null
    ]
  );
};

export const expirarAccesosTemporales = async (connection, usuarioId) => {
  const [expirados] = await connection.query(
    `SELECT id, usuario_id, expires_at
     FROM usuarios_accesos_temporales
     WHERE usuario_id = ?
       AND activo = TRUE
       AND expires_at <= NOW()`,
    [usuarioId]
  );

  if (expirados.length === 0) {
    return 0;
  }

  const ids = expirados.map((item) => item.id);

  await connection.query(
    `UPDATE usuarios_accesos_temporales
     SET activo = FALSE,
         revocado_at = NOW(),
         revocado_motivo = COALESCE(revocado_motivo, 'expirada')
     WHERE id IN (?)`,
    [ids]
  );

  for (const acceso of expirados) {
    await registrarBitacoraAccesoTemporal(connection, {
      accesoTemporalId: acceso.id,
      usuarioObjetivoId: acceso.usuario_id,
      accion: 'expirada',
      descripcion: 'Acceso temporal expirado por vigencia',
      metadata: {
        expires_at: toIsoDate(acceso.expires_at)
      }
    });
  }

  return expirados.length;
};

export const revocarAccesosTemporalesActivos = async (
  connection,
  { usuarioId, actorId, actorRol, motivo }
) => {
  const [activos] = await connection.query(
    `SELECT id, usuario_id, expires_at
     FROM usuarios_accesos_temporales
     WHERE usuario_id = ?
       AND activo = TRUE
       AND expires_at > NOW()`,
    [usuarioId]
  );

  if (activos.length === 0) {
    return 0;
  }

  const ids = activos.map((item) => item.id);
  const motivoFinal = String(motivo || 'revocada_por_admin').trim();

  await connection.query(
    `UPDATE usuarios_accesos_temporales
     SET activo = FALSE,
         revocado_at = NOW(),
         revocado_por_id = ?,
         revocado_motivo = ?
     WHERE id IN (?)`,
    [actorId || null, motivoFinal, ids]
  );

  for (const acceso of activos) {
    await registrarBitacoraAccesoTemporal(connection, {
      accesoTemporalId: acceso.id,
      usuarioObjetivoId: acceso.usuario_id,
      actorId,
      actorRol,
      accion: 'revocada',
      descripcion: 'Acceso temporal revocado por administrador',
      metadata: {
        motivo: motivoFinal,
        expires_at: toIsoDate(acceso.expires_at)
      }
    });
  }

  return activos.length;
};

export const crearAccesoTemporal = async (
  connection,
  {
    usuarioId,
    creadoPorId,
    creadoPorRol,
    duracionDias,
    motivo = null,
    ipAddress = null,
    userAgent = null
  }
) => {
  await expirarAccesosTemporales(connection, usuarioId);

  const [activos] = await connection.query(
    `SELECT id, expires_at
     FROM usuarios_accesos_temporales
     WHERE usuario_id = ?
       AND activo = TRUE
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [usuarioId]
  );

  if (activos.length > 0) {
    const error = new Error('El usuario ya tiene una contraseña temporal activa');
    error.code = 'TEMP_ACTIVE_EXISTS';
    error.expiresAt = activos[0].expires_at;
    throw error;
  }

  const passwordTemporal = generarContrasenaTemporal();
  const passwordHash = await bcrypt.hash(passwordTemporal, 10);

  const [insertResult] = await connection.query(
    `INSERT INTO usuarios_accesos_temporales
     (usuario_id, password_hash, duracion_dias, expires_at, activo, motivo, creado_por_id)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), TRUE, ?, ?)`,
    [usuarioId, passwordHash, duracionDias, duracionDias, motivo || null, creadoPorId]
  );

  const accesoTemporalId = insertResult.insertId;

  const [rows] = await connection.query(
    'SELECT expires_at FROM usuarios_accesos_temporales WHERE id = ? LIMIT 1',
    [accesoTemporalId]
  );

  const expiresAt = rows.length > 0 ? rows[0].expires_at : null;

  await registrarBitacoraAccesoTemporal(connection, {
    accesoTemporalId,
    usuarioObjetivoId: usuarioId,
    actorId: creadoPorId,
    actorRol: creadoPorRol,
    accion: 'generada',
    descripcion: `Acceso temporal generado por ${duracionDias} día(s)`,
    metadata: {
      duracion_dias: duracionDias,
      motivo: motivo || null,
      expires_at: toIsoDate(expiresAt),
      ip_address: ipAddress,
      user_agent: userAgent
    }
  });

  return {
    accesoTemporalId,
    passwordTemporal,
    expiresAt
  };
};

export const obtenerAccesoTemporalActivo = async (connection, usuarioId) => {
  await expirarAccesosTemporales(connection, usuarioId);

  const [rows] = await connection.query(
    `SELECT
       uat.id,
       uat.usuario_id,
       uat.duracion_dias,
       uat.expires_at,
       uat.motivo,
       uat.creado_por_id,
       uat.ultimo_uso_at,
       uat.total_usos,
       uat.created_at,
       creador.nombre_completo AS creado_por_nombre
     FROM usuarios_accesos_temporales uat
     LEFT JOIN usuarios creador ON creador.id = uat.creado_por_id
     WHERE uat.usuario_id = ?
       AND uat.activo = TRUE
       AND uat.expires_at > NOW()
     ORDER BY uat.created_at DESC
     LIMIT 1`,
    [usuarioId]
  );

  if (rows.length === 0) {
    return null;
  }

  const acceso = rows[0];
  return {
    id: acceso.id,
    usuario_id: acceso.usuario_id,
    duracion_dias: acceso.duracion_dias,
    motivo: acceso.motivo,
    creado_por_id: acceso.creado_por_id,
    creado_por_nombre: acceso.creado_por_nombre,
    expires_at: toIsoDate(acceso.expires_at),
    ultimo_uso_at: toIsoDate(acceso.ultimo_uso_at),
    total_usos: Number(acceso.total_usos || 0),
    created_at: toIsoDate(acceso.created_at)
  };
};

export const obtenerBitacoraAccesosTemporales = async (
  connection,
  usuarioId,
  limit = 40
) => {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 40));

  const [rows] = await connection.query(
    `SELECT
       b.id,
       b.acceso_temporal_id,
       b.usuario_objetivo_id,
       b.actor_id,
       b.actor_rol,
       b.accion,
       b.descripcion,
       b.metadata_json,
       b.created_at,
       actor.nombre_completo AS actor_nombre
     FROM usuarios_accesos_temporales_bitacora b
     LEFT JOIN usuarios actor ON actor.id = b.actor_id
     WHERE b.usuario_objetivo_id = ?
     ORDER BY b.created_at DESC
     LIMIT ?`,
    [usuarioId, safeLimit]
  );

  return rows.map((row) => ({
    id: row.id,
    acceso_temporal_id: row.acceso_temporal_id,
    usuario_objetivo_id: row.usuario_objetivo_id,
    actor_id: row.actor_id,
    actor_nombre: row.actor_nombre,
    actor_rol: row.actor_rol,
    accion: row.accion,
    descripcion: row.descripcion,
    metadata: parseJsonSafe(row.metadata_json),
    created_at: toIsoDate(row.created_at)
  }));
};

export const validarContrasenaTemporal = async (
  connection,
  {
    usuarioId,
    password,
    actorId,
    actorRol,
    ipAddress = null,
    userAgent = null
  }
) => {
  if (!password) {
    return { valida: false };
  }

  await expirarAccesosTemporales(connection, usuarioId);

  const [candidatos] = await connection.query(
    `SELECT id, password_hash, expires_at
     FROM usuarios_accesos_temporales
     WHERE usuario_id = ?
       AND activo = TRUE
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT ?`,
    [usuarioId, MAX_TEMP_PASSWORD_CANDIDATES]
  );

  for (const acceso of candidatos) {
    const coincide = await bcrypt.compare(password, acceso.password_hash);

    if (!coincide) {
      continue;
    }

    await connection.query(
      `UPDATE usuarios_accesos_temporales
       SET ultimo_uso_at = NOW(),
           total_usos = total_usos + 1
       WHERE id = ?`,
      [acceso.id]
    );

    await registrarBitacoraAccesoTemporal(connection, {
      accesoTemporalId: acceso.id,
      usuarioObjetivoId: usuarioId,
      actorId,
      actorRol,
      accion: 'usada',
      descripcion: 'Acceso temporal utilizado para iniciar sesión',
      metadata: {
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: toIsoDate(acceso.expires_at)
      }
    });

    return {
      valida: true,
      accesoTemporalId: acceso.id,
      expiresAt: acceso.expires_at
    };
  }

  return { valida: false };
};
