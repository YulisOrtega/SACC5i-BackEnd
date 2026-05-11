import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import {
  crearAccesoTemporal,
  revocarAccesosTemporalesActivos,
  obtenerAccesoTemporalActivo,
  obtenerBitacoraAccesosTemporales
} from '../services/AccesoTemporalService.js';

const toIsoDate = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const safeCountQuery = async (connection, query, params = []) => {
  try {
    const [[row]] = await connection.query(query, params);
    return Number(row?.total || 0);
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return 0;
    }
    throw error;
  }
};

const safeDeleteQuery = async (connection, query, params = []) => {
  try {
    const [result] = await connection.query(query, params);
    return Number(result?.affectedRows || 0);
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return 0;
    }
    throw error;
  }
};

const SESSION_IDLE_TIMEOUT_MINUTES = Math.max(
  30,
  Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES) || 30
);

const obtenerResumenRegistrosAnalista = async (connection, usuarioId) => {
  const [tramites, personas, historial, citas, finalizados, dashboard] = await Promise.all([
    safeCountQuery(connection, `SELECT COUNT(*) AS total FROM tramites_alta WHERE usuario_analista_c5_id = ?`, [usuarioId]),
    safeCountQuery(connection, `
      SELECT COUNT(*) AS total
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON t.id = p.tramite_alta_id
      WHERE t.usuario_analista_c5_id = ?
    `, [usuarioId]),
    safeCountQuery(connection, `
      SELECT COUNT(*) AS total
      FROM historial_tramites_alta h
      INNER JOIN tramites_alta t ON t.id = h.tramite_alta_id
      WHERE t.usuario_analista_c5_id = ?
    `, [usuarioId]),
    safeCountQuery(connection, `
      SELECT COUNT(*) AS total
      FROM citas_biometricas c
      INNER JOIN tramites_alta t ON t.id = c.tramite_alta_id
      WHERE t.usuario_analista_c5_id = ?
    `, [usuarioId]),
    safeCountQuery(connection, `
      SELECT COUNT(*) AS total
      FROM finalizados f
      INNER JOIN tramites_alta t ON t.id = f.tramite_alta_id
      WHERE t.usuario_analista_c5_id = ?
    `, [usuarioId]),
    safeCountQuery(connection, `
      SELECT COUNT(*) AS total
      FROM analista_municipios_dashboard
      WHERE usuario_analista_id = ?
    `, [usuarioId])
  ]);

  return {
    tramites_alta: tramites,
    personas_tramite_alta: personas,
    historial_tramites_alta: historial,
    citas_biometricas: citas,
    finalizados,
    analista_municipios_dashboard: dashboard
  };
};

// ============================================
// GESTIÓN DE USUARIOS (Solo para ADMIN)
// ============================================

// Listar todos los usuarios
export const getUsuarios = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { rol, activo, region_id, buscar } = req.query;
    const orderClause = `
      ORDER BY
        CASE u.rol
          WHEN 'super_admin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'direccion' THEN 3
          WHEN 'analista' THEN 4
          WHEN 'validador_c3' THEN 5
          WHEN 'dependencia' THEN 6
          WHEN 'operador_ccp' THEN 7
          ELSE 99
        END,
        CASE WHEN u.region_id IS NULL THEN 1 ELSE 0 END,
        u.region_id ASC,
        CASE
          WHEN u.extension REGEXP '^[0-9]+$' THEN CAST(u.extension AS UNSIGNED)
          ELSE 999999
        END,
        u.nombre_completo ASC,
        u.id ASC
    `;
    
    let query = `
      SELECT u.id, u.nombre_completo, u.usuario, u.email, u.extension, u.region_id, u.rol, 
             u.activo, u.password_changed, u.created_at, r.nombre as region_nombre,
             COALESCE(sesiones.sesiones_activas, 0) as sesiones_activas,
             CASE WHEN COALESCE(sesiones.sesiones_activas, 0) > 0 THEN TRUE ELSE FALSE END as en_linea,
             sesiones.ultima_actividad_sesion_at
      FROM usuarios u
      LEFT JOIN regiones r ON u.region_id = r.id
      LEFT JOIN (
        SELECT
          usuario_id,
          COUNT(*) as sesiones_activas,
          MAX(ultima_actividad_at) as ultima_actividad_sesion_at
        FROM usuarios_sesiones
        WHERE closed_at IS NULL
          AND ultima_actividad_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
        GROUP BY usuario_id
      ) sesiones ON sesiones.usuario_id = u.id
      WHERE 1=1
    `;
    
    const params = [SESSION_IDLE_TIMEOUT_MINUTES];

    if (rol) {
      query += ' AND u.rol = ?';
      params.push(rol);
    }

    if (activo !== undefined) {
      query += ' AND u.activo = ?';
      params.push(activo === 'true' || activo === true);
    }

    if (region_id) {
      query += ' AND u.region_id = ?';
      params.push(region_id);
    }

    if (buscar) {
      query += ' AND (u.nombre_completo LIKE ? OR u.usuario LIKE ? OR u.email LIKE ? OR u.extension LIKE ?)';
      const searchTerm = `%${buscar}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += orderClause;

    let usuarios = [];
    try {
      const [rows] = await connection.query(query, params);
      usuarios = rows;
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') {
        throw error;
      }

      // Compatibilidad mientras se ejecuta la migracion de sesiones por navegador.
      let legacyQuery = `
        SELECT u.id, u.nombre_completo, u.usuario, u.email, u.extension, u.region_id, u.rol,
               u.activo, u.password_changed, u.created_at, r.nombre as region_nombre,
               0 as sesiones_activas,
               FALSE as en_linea,
               NULL as ultima_actividad_sesion_at
        FROM usuarios u
        LEFT JOIN regiones r ON u.region_id = r.id
        WHERE 1=1
      `;

      const legacyParams = [];

      if (rol) {
        legacyQuery += ' AND u.rol = ?';
        legacyParams.push(rol);
      }

      if (activo !== undefined) {
        legacyQuery += ' AND u.activo = ?';
        legacyParams.push(activo === 'true' || activo === true);
      }

      if (region_id) {
        legacyQuery += ' AND u.region_id = ?';
        legacyParams.push(region_id);
      }

      if (buscar) {
        legacyQuery += ' AND (u.nombre_completo LIKE ? OR u.usuario LIKE ? OR u.email LIKE ? OR u.extension LIKE ?)';
        const searchTerm = `%${buscar}%`;
        legacyParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      legacyQuery += orderClause;
      const [legacyRows] = await connection.query(legacyQuery, legacyParams);
      usuarios = legacyRows;
    }

    res.json({
      success: true,
      data: usuarios,
      total: usuarios.length
    });

  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Crear nuevo usuario (Analista)
export const createUsuario = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const {
      nombre,
      apellido,
      usuario,
      email,
      extension,
      region_id,
      rol
    } = req.body;

    // Verificar que el usuario, email o extensión no existan
    const [existing] = await connection.query(
      'SELECT id FROM usuarios WHERE usuario = ? OR email = ? OR extension = ?',
      [usuario, email, extension]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El usuario, email o extensión ya existe'
      });
    }

    // Verificar que la región exista (si se proporciona)
    if (region_id) {
      const [region] = await connection.query(
        'SELECT id FROM regiones WHERE id = ?',
        [region_id]
      );

      if (region.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'La región especificada no existe'
        });
      }
    }

    // Password inicial = nombre de usuario
    const hashedPassword = await bcrypt.hash(usuario, 10);
    
    // Concatenar nombre completo
    const nombre_completo = `${nombre} ${apellido}`;

    // Insertar usuario
    const [result] = await connection.query(
      `INSERT INTO usuarios (nombre_completo, usuario, email, password, extension, region_id, rol, password_changed)
       VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [nombre_completo, usuario, email, hashedPassword, extension, region_id, rol || 'analista']
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: {
        id: result.insertId,
        nombre_completo,
        usuario,
        email,
        extension,
        region_id,
        rol: rol || 'analista',
        password_inicial: usuario
      }
    });

  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Actualizar usuario
export const updateUsuario = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { usuario, email, nombre, apellido, extension, region_id, rol } = req.body;

    // Verificar que el usuario existe
    const [existing] = await connection.query(
      'SELECT id, rol FROM usuarios WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const targetUser = existing[0];

    // Un admin normal no puede editar cuentas super_admin.
    if (req.userRole === 'admin' && targetUser.rol === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Un administrador no puede editar al Super Administrador'
      });
    }

    // Un admin normal no puede cambiar el rol de otro usuario.
    if (req.userRole === 'admin' && typeof rol !== 'undefined' && rol !== targetUser.rol) {
      return res.status(403).json({
        success: false,
        message: 'Solo Super Admin puede cambiar roles'
      });
    }

    // Si se quiere cambiar el usuario, verificar que no exista otro con ese username
    if (usuario) {
      const [duplicate] = await connection.query(
        'SELECT id FROM usuarios WHERE usuario = ? AND id != ?',
        [usuario, id]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro usuario con ese nombre de usuario'
        });
      }
    }

    // Si se quiere cambiar el email, verificar que no exista otro con ese email
    if (email) {
      const [duplicateEmail] = await connection.query(
        'SELECT id FROM usuarios WHERE email = ? AND id != ?',
        [email, id]
      );

      if (duplicateEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro usuario con ese correo electrónico'
        });
      }
    }

    // Verificar región si se proporciona
    if (region_id) {
      const [region] = await connection.query(
        'SELECT id FROM regiones WHERE id = ?',
        [region_id]
      );

      if (region.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'La región especificada no existe'
        });
      }
    }

    // Concatenar nombre completo si se proporcionan nombre y/o apellido
    let nombre_completo = null;
    if (nombre && apellido) {
      nombre_completo = `${nombre} ${apellido}`;
    } else if (nombre || apellido) {
      // Si solo se proporciona uno, obtener el otro de la base de datos
      const [currentUser] = await connection.query(
        'SELECT nombre_completo FROM usuarios WHERE id = ?',
        [id]
      );
      const currentParts = currentUser[0].nombre_completo.split(' ');
      const currentNombre = currentParts.slice(0, -1).join(' ');
      const currentApellido = currentParts[currentParts.length - 1];
      
      nombre_completo = `${nombre || currentNombre} ${apellido || currentApellido}`;
    }

    await connection.query(
      `UPDATE usuarios 
       SET usuario = COALESCE(?, usuario),
           email = COALESCE(?, email),
           nombre_completo = COALESCE(?, nombre_completo),
           extension = COALESCE(?, extension),
           region_id = ?,
           rol = COALESCE(?, rol)
       WHERE id = ?`,
      [usuario, email, nombre_completo, extension, region_id, rol, id]
    );

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Eliminar usuario (Hard Delete) - solo Super Admin
export const deleteUsuario = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const targetId = Number(req.params.id);
    const actorId = Number(req.userId);

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario invalido'
      });
    }

    if (targetId === actorId) {
      return res.status(403).json({
        success: false,
        message: 'No puedes eliminar el usuario con el que iniciaste sesion'
      });
    }

    const [users] = await connection.query(
      'SELECT id, usuario, nombre_completo, rol FROM usuarios WHERE id = ?',
      [targetId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    await connection.beginTransaction();

    // Reasignar autor de accesos temporales al super admin actual para evitar bloqueo por FK RESTRICT.
    try {
      await connection.query(
        `UPDATE usuarios_accesos_temporales
         SET creado_por_id = ?
         WHERE creado_por_id = ?`,
        [actorId, targetId]
      );
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') {
        throw error;
      }
    }

    const [result] = await connection.query(
      'DELETE FROM usuarios WHERE id = ?',
      [targetId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
      data: {
        id: users[0].id,
        usuario: users[0].usuario,
        nombre_completo: users[0].nombre_completo,
        rol: users[0].rol
      }
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Ignorar errores de rollback cuando no hay transaccion activa
    }

    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Borrar todos los registros operativos asociados a un analista (solo Super Admin)
export const purgeAnalistaRegistros = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const targetId = Number(req.params.id);

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario invalido'
      });
    }

    const [users] = await connection.query(
      'SELECT id, usuario, nombre_completo, rol, activo FROM usuarios WHERE id = ?',
      [targetId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const targetUser = users[0];

    if (targetUser.rol !== 'analista') {
      return res.status(400).json({
        success: false,
        message: 'La limpieza de registros solo aplica a usuarios con rol analista'
      });
    }

    const resumenAntes = await obtenerResumenRegistrosAnalista(connection, targetId);
    const totalEliminados = Object.values(resumenAntes)
      .reduce((acc, value) => acc + Number(value || 0), 0);

    if (totalEliminados === 0) {
      return res.json({
        success: true,
        message: 'El analista no tiene registros asociados para eliminar',
        data: {
          usuario: {
            id: targetUser.id,
            usuario: targetUser.usuario,
            nombre_completo: targetUser.nombre_completo,
            rol: targetUser.rol,
            activo: Boolean(targetUser.activo)
          },
          eliminados: resumenAntes,
          total_eliminados: 0
        }
      });
    }

    await connection.beginTransaction();

    await safeDeleteQuery(connection, `
      DELETE f
      FROM finalizados f
      INNER JOIN tramites_alta t ON t.id = f.tramite_alta_id
      WHERE t.usuario_analista_c5_id = ?
    `, [targetId]);

    await safeDeleteQuery(connection, `
      DELETE c
      FROM citas_biometricas c
      INNER JOIN tramites_alta t ON t.id = c.tramite_alta_id
      WHERE t.usuario_analista_c5_id = ?
    `, [targetId]);

    await safeDeleteQuery(connection, `
      DELETE h
      FROM historial_tramites_alta h
      INNER JOIN tramites_alta t ON t.id = h.tramite_alta_id
      WHERE t.usuario_analista_c5_id = ?
    `, [targetId]);

    await safeDeleteQuery(connection, `
      DELETE p
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON t.id = p.tramite_alta_id
      WHERE t.usuario_analista_c5_id = ?
    `, [targetId]);

    await safeDeleteQuery(connection, `
      DELETE FROM tramites_alta
      WHERE usuario_analista_c5_id = ?
    `, [targetId]);

    await safeDeleteQuery(connection, `
      DELETE FROM analista_municipios_dashboard
      WHERE usuario_analista_id = ?
    `, [targetId]);

    await connection.commit();

    return res.json({
      success: true,
      message: 'Registros del analista eliminados exitosamente',
      data: {
        usuario: {
          id: targetUser.id,
          usuario: targetUser.usuario,
          nombre_completo: targetUser.nombre_completo,
          rol: targetUser.rol,
          activo: Boolean(targetUser.activo)
        },
        eliminados: resumenAntes,
        total_eliminados: totalEliminados
      }
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Ignorar errores de rollback cuando no hay transaccion activa
    }

    console.error('Error al limpiar registros de analista:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al limpiar registros del analista',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Dar de baja usuario (Soft Delete)
export const deactivateUsuario = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    // No permitir desactivar super admins
    const [user] = await connection.query(
      'SELECT rol FROM usuarios WHERE id = ?',
      [id]
    );

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (user[0].rol === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'No se puede desactivar un Super Admin'
      });
    }

    // Desactivar usuario (Soft Delete)
    await connection.query(
      'UPDATE usuarios SET activo = FALSE WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente'
    });

  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desactivar usuario',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Reactivar usuario
export const activateUsuario = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    await connection.query(
      'UPDATE usuarios SET activo = TRUE WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Usuario reactivado exitosamente'
    });

  } catch (error) {
    console.error('Error al reactivar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reactivar usuario',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Resetear contraseña de usuario (vuelve al nombre de usuario)
export const resetPassword = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    // Obtener usuario objetivo
    const [users] = await connection.query(
      'SELECT id, usuario, rol FROM usuarios WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const userTarget = users[0];

    // Un admin normal no puede resetear la contraseña de un super_admin.
    if (req.userRole === 'admin' && userTarget.rol === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Un administrador no puede resetear la contraseña del Super Administrador'
      });
    }

    const { usuario } = userTarget;
    const hashedPassword = await bcrypt.hash(String(usuario), 10);

    await connection.beginTransaction();

    await connection.query(
      'UPDATE usuarios SET password = ?, password_changed = FALSE WHERE id = ?',
      [hashedPassword, id]
    );

    let accesosTemporalesRevocados = 0;
    try {
      accesosTemporalesRevocados = await revocarAccesosTemporalesActivos(connection, {
        usuarioId: Number(id),
        actorId: req.userId,
        actorRol: req.userRole,
        motivo: 'reset_password_admin'
      });
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') {
        throw error;
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Contraseña reseteada exitosamente',
      data: {
        password_temporal: usuario,
        accesos_temporales_revocados: accesosTemporalesRevocados
      }
    });

  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Ignorar errores de rollback cuando no hay transacción activa
    }

    console.error('Error al resetear contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al resetear contraseña',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Generar contraseña temporal para delegación de trabajo
export const generarPasswordTemporal = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const duracionDias = Number(req.body.duracion_dias);
    const motivo = req.body.motivo ? String(req.body.motivo).trim() : null;

    const [users] = await connection.query(
      'SELECT id, usuario, rol, activo FROM usuarios WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const userTarget = users[0];

    if (!userTarget.activo) {
      return res.status(400).json({
        success: false,
        message: 'No se puede generar contraseña temporal para un usuario inactivo'
      });
    }

    if (userTarget.rol === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'No se puede generar contraseña temporal para un Super Admin'
      });
    }

    await connection.beginTransaction();

    const resultado = await crearAccesoTemporal(connection, {
      usuarioId: userTarget.id,
      creadoPorId: req.userId,
      creadoPorRol: req.userRole,
      duracionDias,
      motivo,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null
    });

    await connection.commit();

    res.json({
      success: true,
      message: 'Contraseña temporal generada exitosamente',
      data: {
        usuario: userTarget.usuario,
        password_temporal: resultado.passwordTemporal,
        duracion_dias: duracionDias,
        expira_en: toIsoDate(resultado.expiresAt)
      }
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Ignorar errores de rollback cuando no hay transacción activa
    }

    console.error('Error al generar contraseña temporal:', error);

    if (error?.code === 'TEMP_ACTIVE_EXISTS') {
      return res.status(409).json({
        success: false,
        message: 'El usuario ya tiene una contraseña temporal activa. Revócala antes de generar otra.',
        data: {
          expira_en: toIsoDate(error.expiresAt)
        }
      });
    }

    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Falta ejecutar migraciones para contraseñas temporales. Ejecuta npm run db:migrate'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al generar contraseña temporal',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Obtener estado y bitácora de contraseñas temporales por usuario
export const obtenerPasswordTemporal = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const limit = Number(req.query.limit) || 40;

    const [users] = await connection.query(
      'SELECT id, usuario, nombre_completo, rol, activo FROM usuarios WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const userTarget = users[0];
    const accesoActivo = await obtenerAccesoTemporalActivo(connection, userTarget.id);
    const bitacora = await obtenerBitacoraAccesosTemporales(connection, userTarget.id, limit);

    res.json({
      success: true,
      data: {
        usuario: {
          id: userTarget.id,
          usuario: userTarget.usuario,
          nombre_completo: userTarget.nombre_completo,
          rol: userTarget.rol,
          activo: Boolean(userTarget.activo)
        },
        acceso_activo: accesoActivo,
        bitacora
      }
    });
  } catch (error) {
    console.error('Error al obtener contraseña temporal:', error);

    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Falta ejecutar migraciones para contraseñas temporales. Ejecuta npm run db:migrate'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de contraseña temporal',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Revocar contraseña temporal activa por usuario
export const revocarPasswordTemporal = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const motivo = req.body?.motivo ? String(req.body.motivo).trim() : 'revocada_manual';

    const [users] = await connection.query(
      'SELECT id, usuario FROM usuarios WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    await connection.beginTransaction();

    const revocados = await revocarAccesosTemporalesActivos(connection, {
      usuarioId: Number(id),
      actorId: req.userId,
      actorRol: req.userRole,
      motivo
    });

    if (revocados === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'El usuario no tiene contraseña temporal activa'
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Contraseña temporal revocada exitosamente',
      data: {
        usuario: users[0].usuario,
        revocados
      }
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Ignorar errores de rollback cuando no hay transacción activa
    }

    console.error('Error al revocar contraseña temporal:', error);

    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Falta ejecutar migraciones para contraseñas temporales. Ejecuta npm run db:migrate'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al revocar contraseña temporal',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ============================================
// ESTADÍSTICAS DE ADMINISTRACIÓN
// ============================================
export const getEstadisticasAdmin = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    // Total de usuarios por rol
    const [porRol] = await connection.query(`
      SELECT rol, COUNT(*) as cantidad, 
             SUM(CASE WHEN activo = TRUE THEN 1 ELSE 0 END) as activos
      FROM usuarios
      GROUP BY rol
    `);

    // Usuarios que no han cambiado contraseña
    const [sinCambiar] = await connection.query(`
      SELECT COUNT(*) as cantidad
      FROM usuarios
      WHERE password_changed = FALSE AND activo = TRUE
    `);

    // Trámites por región
    const [porRegion] = await connection.query(`
      SELECT r.nombre, COUNT(t.id) as total_tramites
      FROM regiones r
      LEFT JOIN usuarios u ON r.id = u.region_id
      LEFT JOIN tramites_alta t ON u.id = t.usuario_analista_c5_id
      GROUP BY r.id, r.nombre
      ORDER BY total_tramites DESC
    `);

    res.json({
      success: true,
      data: {
        usuarios_por_rol: porRol,
        usuarios_sin_cambiar_password: sinCambiar[0].cantidad,
        tramites_por_region: porRegion
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  } finally {
    connection.release();
  }
};
