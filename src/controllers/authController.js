import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { validarContrasenaTemporal } from '../services/AccesoTemporalService.js';

const toIsoDate = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const SESSION_IDLE_TIMEOUT_MINUTES = Math.max(
  30,
  Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES) || 30
);

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || null;
};

const registerBrowserSession = async (connection, {
  sessionId,
  userId,
  ipAddress,
  userAgent
}) => {
  try {
    await connection.query(
      `UPDATE usuarios_sesiones
       SET closed_at = NOW()
       WHERE usuario_id = ?
         AND closed_at IS NULL
         AND ultima_actividad_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [userId, SESSION_IDLE_TIMEOUT_MINUTES]
    );

    await connection.query(
      `INSERT INTO usuarios_sesiones (session_id, usuario_id, user_agent, ip_address, ultima_actividad_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [sessionId, userId, userAgent, ipAddress]
    );

    return true;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return false;
    }
    throw error;
  }
};

const generateToken = (userId, extraClaims = {}) => {
  return jwt.sign(
    { id: userId, ...extraClaims },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

export const register = async (req, res) => {
  res.status(403).json({
    success: false,
    message: 'El registro público está deshabilitado. Solo los administradores pueden crear usuarios del sistema.',
    contacto: 'Contacte al administrador del sistema para solicitar acceso.'
  });
};

// Login de usuario corregido para sesiones temporales delegadas
export const login = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { username, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.get('user-agent') || null;

    const passwordInput = String(password || '').trim();
    const usernameInput = String(username || '').trim();

    // 1. Buscamos primero en la tabla general de usuarios
    const [users] = await connection.query(
      'SELECT * FROM usuarios WHERE (usuario = ? OR email = ?) AND activo = TRUE',
      [usernameInput, usernameInput]
    );

    let user = users.length > 0 ? users[0] : null;
    let isValidPassword = false;
    let accesoTemporalValido = false;
    let accesoTemporal = null;

    if (user) {
      isValidPassword = await bcrypt.compare(passwordInput, user.password);
    }

    // 2. Si no fue un login normal, validamos en la tabla de contraseñas temporales
    if (!isValidPassword) {
      try {
        const temporal = await validarContrasenaTemporal(connection, {
          username: usernameInput,
          password: passwordInput,
          actorId: user ? user.id : null,
          actorRol: user ? user.rol : null,
          ipAddress,
          userAgent
        });

        accesoTemporalValido = temporal.valida;
        if (temporal.valida) {
          accesoTemporal = temporal;
          // Si iniciaron sesión escribiendo el nombre temporal (ej. yulissa_ortega),
          // cargamos los datos del usuario titular (ej. patricia_flores) para sus permisos
          if (!user) {
            const [ownerUsers] = await connection.query(
              'SELECT * FROM usuarios WHERE id = ? AND activo = TRUE',
              [temporal.usuarioId]
            );
            if (ownerUsers.length > 0) {
              user = ownerUsers[0];
            }
          }
        }
      } catch (error) {
        if (error?.code !== 'ER_NO_SUCH_TABLE') {
          throw error;
        }
      }
    }

    // Si las contraseñas no coincidieron en ningún lado, rechazamos el acceso
    if (!user || (!isValidPassword && !accesoTemporalValido)) {
      return res.status(401).json({
        success: false,
        message: 'Usuario o contraseña incorrectos'
      });
    }

    const sesionActivaId = randomUUID();

    await registerBrowserSession(connection, {
      sessionId: sesionActivaId,
      userId: user.id,
      ipAddress,
      userAgent
    });

    await connection.query(
      'UPDATE usuarios SET sesion_activa_id = ?, sesion_ultima_actividad_at = NOW() WHERE id = ?',
      [sesionActivaId, user.id]
    );

    const token = generateToken(user.id, {
      session_id: sesionActivaId,
      is_temp_session: accesoTemporalValido,
      temp_access_id: accesoTemporal?.accesoTemporalId || null,
      temp_user: accesoTemporal?.usuarioTemporal || null,
      temp_expires_at: toIsoDate(accesoTemporal?.expiresAt)
    });

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      usuario: {
        id: user.id,
        nombre_completo: accesoTemporalValido && accesoTemporal?.usuarioTemporal 
          ? `${accesoTemporal.usuarioTemporal} (Cubre a: ${user.nombre_completo})` 
          : user.nombre_completo,
        usuario: accesoTemporalValido && accesoTemporal?.usuarioTemporal 
          ? accesoTemporal.usuarioTemporal 
          : user.usuario,
        email: user.email,
        extension: user.extension,
        region_id: user.region_id,
        rol: user.rol,
        password_changed: user.password_changed,
        sesion_temporal: accesoTemporalValido,
        sesion_temporal_expira_en: toIsoDate(accesoTemporal?.expiresAt)
      },
      token,
      session_idle_timeout_minutes: SESSION_IDLE_TIMEOUT_MINUTES,
      warning: !user.password_changed ? 'Por seguridad, se recomienda cambiar tu contraseña temporal' : null
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

export const getProfile = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const [users] = await connection.query(
      `SELECT u.id, u.nombre_completo, u.usuario, u.email, u.extension, 
              u.region_id, u.rol, u.password_changed, u.activo,
              u.created_at, r.nombre as region_nombre
       FROM usuarios u
       LEFT JOIN regiones r ON u.region_id = r.id
       WHERE u.id = ?`,
      [req.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const userData = users[0];

    // Si es sesión temporal, sobreescribimos el nombre a mostrar con la variable del token
    if (req.isTemporarySession && req.user?.temp_user) {
      userData.nombre_completo = `${req.user.temp_user} (Cubre a: ${userData.nombre_completo})`;
      userData.usuario = req.user.temp_user;
    }

    res.json({
      success: true,
      data: {
        ...userData,
        sesion_temporal: Boolean(req.isTemporarySession),
        sesion_temporal_expira_en: req.tempSessionExpiresAt || null
      },
      session_idle_timeout_minutes: req.sessionIdleTimeoutMinutes || SESSION_IDLE_TIMEOUT_MINUTES,
      warning: !userData.password_changed ? 'Por seguridad, se recomienda cambiar tu contraseña temporal' : null
    });

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

export const heartbeatSession = async (req, res) => {
  res.json({
    success: true,
    message: 'Sesion activa',
    session_idle_timeout_minutes: SESSION_IDLE_TIMEOUT_MINUTES
  });
};

export const logoutSession = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const sessionId = String(req.sessionId || '').trim();

    if (!sessionId) {
      return res.json({
        success: true,
        message: 'Sesion cerrada'
      });
    }

    let tableAvailable = true;

    try {
      await connection.query(
        `UPDATE usuarios_sesiones
         SET closed_at = NOW()
         WHERE usuario_id = ?
           AND session_id = ?
           AND closed_at IS NULL`,
        [req.userId, sessionId]
      );
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') {
        throw error;
      }
      tableAvailable = false;
    }

    if (tableAvailable) {
      const [activeSessions] = await connection.query(
        `SELECT session_id, ultima_actividad_at
         FROM usuarios_sesiones
         WHERE usuario_id = ?
           AND closed_at IS NULL
         ORDER BY ultima_actividad_at DESC
         LIMIT 1`,
        [req.userId]
      );

      if (activeSessions.length === 0) {
        await connection.query(
          `UPDATE usuarios
           SET sesion_activa_id = NULL,
               sesion_ultima_actividad_at = NULL
           WHERE id = ?`,
          [req.userId]
        );
      } else {
        await connection.query(
          `UPDATE usuarios
           SET sesion_activa_id = ?,
               sesion_ultima_actividad_at = ?
           WHERE id = ?`,
          [activeSessions[0].session_id, activeSessions[0].ultima_actividad_at, req.userId]
        );
      }
    } else {
      await connection.query(
        `UPDATE usuarios
         SET sesion_activa_id = NULL,
             sesion_ultima_actividad_at = NULL
         WHERE id = ? AND sesion_activa_id = ?`,
        [req.userId, sessionId]
      );
    }

    res.json({
      success: true,
      message: 'Sesion cerrada'
    });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesión',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

export const updateProfile = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { nombre_completo, email, extension } = req.body;

    if (req.isTemporarySession) {
      return res.status(403).json({
        success: false,
        message: 'Las sesiones temporales no pueden editar el perfil. Solo el titular con su contraseña normal puede hacerlo.'
      });
    }

    if (typeof extension !== 'undefined') {
      return res.status(403).json({
        success: false,
        message: 'La extensión solo puede ser modificada por un administrador.'
      });
    }

    if (email) {
      const [existingEmail] = await connection.query(
        'SELECT id FROM usuarios WHERE email = ? AND id != ?',
        [email, req.userId]
      );

      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'El correo electrónico ya está en uso por otro usuario'
        });
      }
    }

    await connection.query(
      `UPDATE usuarios 
       SET nombre_completo = COALESCE(?, nombre_completo),
           email = COALESCE(?, email)
       WHERE id = ?`,
      [nombre_completo, email, req.userId]
    );

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

export const changePassword = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { currentPassword, newPassword } = req.body;

    if (req.isTemporarySession) {
      return res.status(403).json({
        success: false,
        message: 'Las sesiones temporales no pueden cambiar la contraseña del titular.'
      });
    }

    const [users] = await connection.query(
      'SELECT password FROM usuarios WHERE id = ?',
      [req.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const isValid = await bcrypt.compare(currentPassword, users[0].password);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connection.query(
      'UPDATE usuarios SET password = ?, password_changed = TRUE WHERE id = ?',
      [hashedPassword, req.userId]
    );

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña',
      error: error.message
    });
  } finally {
    connection.release();
  }
};