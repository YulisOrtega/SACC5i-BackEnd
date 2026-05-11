import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

const SESSION_IDLE_TIMEOUT_MINUTES = Math.max(
  30,
  Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES) || 30
);
const SESSION_IDLE_TIMEOUT_MS = SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || null;
};

const getBrowserSessionContext = async (usuarioId, tokenSessionId) => {
  try {
    const [rows] = await pool.query(
      `SELECT session_id, ultima_actividad_at
       FROM usuarios_sesiones
       WHERE usuario_id = ?
         AND session_id = ?
         AND closed_at IS NULL
       LIMIT 1`,
      [usuarioId, tokenSessionId]
    );

    if (rows.length > 0) {
      return {
        tableAvailable: true,
        matchedSession: rows[0],
        hasAnyActiveSession: true
      };
    }

    const [counts] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM usuarios_sesiones
       WHERE usuario_id = ? AND closed_at IS NULL`,
      [usuarioId]
    );

    return {
      tableAvailable: true,
      matchedSession: null,
      hasAnyActiveSession: Number(counts?.[0]?.total || 0) > 0
    };
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return {
        tableAvailable: false,
        matchedSession: null,
        hasAnyActiveSession: false
      };
    }

    throw error;
  }
};

export const authMiddleware = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

    const token = authHeader.substring(7); // Remover 'Bearer '

    try {
      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const isTemporarySession = Boolean(decoded.is_temp_session);
      const tempSessionExpiresAt = decoded.temp_expires_at || null;

      if (isTemporarySession && tempSessionExpiresAt) {
        const expiresAtDate = new Date(tempSessionExpiresAt);

        if (!Number.isNaN(expiresAtDate.getTime()) && expiresAtDate.getTime() <= Date.now()) {
          return res.status(401).json({
            success: false,
            message: 'La sesión temporal ha expirado'
          });
        }
      }
      
      // Obtener información completa del usuario desde la BD
      const [usuarios] = await pool.query(
        'SELECT id, rol, region_id, dependencia_id, sesion_activa_id, sesion_ultima_actividad_at FROM usuarios WHERE id = ? AND activo = 1',
        [decoded.id]
      );

      if (usuarios.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no encontrado o inactivo'
        });
      }

      const usuario = usuarios[0];
      const tokenSessionId = String(decoded.session_id || '').trim();
      if (!tokenSessionId) {
        return res.status(401).json({
          success: false,
          message: 'Sesion invalida. Vuelve a iniciar sesion.'
        });
      }

      const browserSession = await getBrowserSessionContext(usuario.id, tokenSessionId);
      let sessionMode = 'browser';
      let ultimaActividadRaw = browserSession.matchedSession?.ultima_actividad_at || null;

      if (!browserSession.matchedSession) {
        if (browserSession.tableAvailable && browserSession.hasAnyActiveSession) {
          return res.status(401).json({
            success: false,
            message: 'Tu sesion ya no es valida. Vuelve a iniciar sesion.'
          });
        }

        const sesionActivaId = String(usuario.sesion_activa_id || '').trim();
        if (!sesionActivaId || tokenSessionId !== sesionActivaId) {
          return res.status(401).json({
            success: false,
            message: 'Tu sesión fue cerrada por un nuevo inicio de sesión. Vuelve a iniciar sesión.'
          });
        }

        sessionMode = 'legacy';
        ultimaActividadRaw = usuario.sesion_ultima_actividad_at || null;
      }

      const ultimaActividad = ultimaActividadRaw
        ? new Date(ultimaActividadRaw)
        : null;

      if (ultimaActividad && !Number.isNaN(ultimaActividad.getTime())) {
        const inactividadMs = Date.now() - ultimaActividad.getTime();

        if (inactividadMs > SESSION_IDLE_TIMEOUT_MS) {
          if (sessionMode === 'browser') {
            await pool.query(
              `UPDATE usuarios_sesiones
               SET closed_at = NOW()
               WHERE usuario_id = ?
                 AND session_id = ?
                 AND closed_at IS NULL`,
              [usuario.id, tokenSessionId]
            );

            await pool.query(
              `UPDATE usuarios
               SET sesion_ultima_actividad_at = NULL
               WHERE id = ?`,
              [usuario.id]
            );
          } else {
            await pool.query(
              `UPDATE usuarios
               SET sesion_activa_id = NULL,
                   sesion_ultima_actividad_at = NULL
               WHERE id = ? AND sesion_activa_id = ?`,
              [usuario.id, tokenSessionId]
            );
          }

          return res.status(401).json({
            success: false,
            message: 'Sesion cerrada por inactividad. Vuelve a iniciar sesion.'
          });
        }
      }

      if (sessionMode === 'browser') {
        await pool.query(
          `UPDATE usuarios_sesiones
           SET ultima_actividad_at = NOW(),
               ip_address = COALESCE(?, ip_address),
               user_agent = COALESCE(?, user_agent)
           WHERE usuario_id = ?
             AND session_id = ?
             AND closed_at IS NULL`,
          [getClientIp(req), req.get('user-agent') || null, usuario.id, tokenSessionId]
        );

        await pool.query(
          `UPDATE usuarios
           SET sesion_ultima_actividad_at = NOW(),
               sesion_activa_id = COALESCE(sesion_activa_id, ?)
           WHERE id = ?`,
          [tokenSessionId, usuario.id]
        );
      } else {
        await pool.query(
          `UPDATE usuarios
           SET sesion_ultima_actividad_at = NOW()
           WHERE id = ? AND sesion_activa_id = ?`,
          [usuario.id, tokenSessionId]
        );
      }

      // Agregar información del usuario al request
      req.userId = usuario.id;
      req.userRole = usuario.rol;
      req.regionId = usuario.region_id;
      req.dependenciaId = usuario.dependencia_id;
      req.sessionId = tokenSessionId;
      req.sessionMode = sessionMode;
      req.sessionIdleTimeoutMinutes = SESSION_IDLE_TIMEOUT_MINUTES;
      req.isTemporarySession = isTemporarySession;
      req.tempAccessId = decoded.temp_access_id || null;
      req.tempSessionExpiresAt = tempSessionExpiresAt;
      
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({
      success: false,
      message: 'Error en autenticación',
      error: error.message
    });
  }
};
