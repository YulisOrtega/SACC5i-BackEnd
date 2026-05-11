import pool from '../config/database.js';

// ============================================
// DEPENDENCIAS - Crear Solicitud de Alta
// ============================================

/**
 * Crear nueva solicitud de alta desde una dependencia
 * Solo incluye: tipo_movimiento, dependencia (auto), corporacion/municipio, fecha_solicitud (auto)
 */
export const crearSolicitudDependencia = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    // SOLO CAMPOS DE DEPENDENCIA: tipo_movimiento y corporación/municipio
    const {
      tipo_oficio_id,
      municipio_id
    } = req.body;

    // Obtener el usuario actual (dependencia)
    const [usuario] = await connection.query(
      'SELECT id, dependencia_id, rol FROM usuarios WHERE id = ?',
      [req.userId]
    );

    if (usuario.length === 0 || usuario[0].rol !== 'dependencia') {
      return res.status(403).json({
        success: false,
        message: 'Solo usuarios con rol de dependencia pueden crear solicitudes'
      });
    }

    if (!usuario[0].dependencia_id) {
      return res.status(400).json({
        success: false,
        message: 'El usuario no tiene una dependencia asignada'
      });
    }

    // Generar número de solicitud único con consecutivo simple global
    const [maxRows] = await connection.query(
      `SELECT MAX(
         CAST(
           CASE
             WHEN numero_solicitud IS NULL OR TRIM(numero_solicitud) = '' THEN '0'
             WHEN numero_solicitud REGEXP '^[0-9]+$' THEN numero_solicitud
             ELSE SUBSTRING_INDEX(numero_solicitud, '-', -1)
           END AS UNSIGNED
         )
       ) AS max_num
       FROM tramites_alta`
    );

    const ultimo = Number(maxRows?.[0]?.max_num || 0);
    const numero_solicitud = String(Number.isFinite(ultimo) ? ultimo + 1 : 1);
    const fecha_solicitud = new Date().toISOString().split('T')[0];

    // Insertar solicitud SOLO con campos de dependencia
    const [result] = await connection.query(
      `INSERT INTO tramites_alta (
        numero_solicitud,
        usuario_analista_c5_id,
        es_tramite_dependencia,
        tipo_oficio_id,
        municipio_id,
        dependencia_id,
        fecha_solicitud,
        proceso_movimiento,
        fase_actual,
        estatus_id
      ) VALUES (?, ?, TRUE, ?, ?, ?, ?, 'ALTA', 'datos_solicitud', 1)`,
      [
        numero_solicitud,
        req.userId, // El usuario de dependencia crea el trámite
        tipo_oficio_id,
        municipio_id,
        usuario[0].dependencia_id,
        fecha_solicitud
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Solicitud de dependencia creada exitosamente',
      data: {
        id: result.insertId,
        numero_solicitud,
        tipo_oficio_id,
        municipio_id,
        dependencia_id: usuario[0].dependencia_id, // Automático
        fecha_solicitud, // Automático
        fase_actual: 'datos_solicitud',
        es_tramite_dependencia: true
      }
    });

  } catch (error) {
    console.error('Error al crear solicitud de dependencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear solicitud',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Obtener mis solicitudes (para usuario de dependencia)
 */
export const obtenerMisSolicitudesDependencia = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { fase_actual, estatus_id } = req.query;

    // Obtener el usuario actual
    const [usuario] = await connection.query(
      'SELECT id, dependencia_id, rol FROM usuarios WHERE id = ?',
      [req.userId]
    );

    if (usuario.length === 0 || usuario[0].rol !== 'dependencia') {
      return res.status(403).json({
        success: false,
        message: 'Solo usuarios con rol de dependencia pueden acceder'
      });
    }

    let query = `
      SELECT 
        t.id,
        t.numero_solicitud,
        t.tipo_oficio_id,
        t.municipio_id,
        t.dependencia_id,
        t.fase_actual,
        t.estatus_id,
        t.fecha_solicitud,
        t.created_at,
        t.updated_at,
        tipo_o.nombre as tipo_oficio_nombre,
        m.nombre as municipio_nombre,
        d.nombre as dependencia_nombre,
        e.nombre as estatus_nombre,
        (SELECT COUNT(*) FROM personas_tramite_alta WHERE tramite_alta_id = t.id) as total_personas
      FROM tramites_alta t
      LEFT JOIN tipos_oficio tipo_o ON t.tipo_oficio_id = tipo_o.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN dependencias d ON t.dependencia_id = d.id
      LEFT JOIN estatus_solicitudes e ON t.estatus_id = e.id
      WHERE t.usuario_analista_c5_id = ? 
        AND t.es_tramite_dependencia = TRUE
    `;

    const params = [req.userId];

    if (fase_actual) {
      query += ' AND t.fase_actual = ?';
      params.push(fase_actual);
    }

    if (estatus_id) {
      query += ' AND t.estatus_id = ?';
      params.push(estatus_id);
    }

    query += ' ORDER BY t.created_at DESC';

    const [solicitudes] = await connection.query(query, params);

    res.json({
      success: true,
      data: solicitudes,
      total: solicitudes.length
    });

  } catch (error) {
    console.error('Error al obtener solicitudes de dependencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitudes',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * Obtener solicitud específica por ID (para dependencia)
 */
export const obtenerSolicitudDependenciaPorId = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    // Verificar que el usuario sea de dependencia
    const [usuario] = await connection.query(
      'SELECT id, dependencia_id, rol FROM usuarios WHERE id = ?',
      [req.userId]
    );

    if (usuario.length === 0 || usuario[0].rol !== 'dependencia') {
      return res.status(403).json({
        success: false,
        message: 'Solo usuarios con rol de dependencia pueden acceder'
      });
    }

    // Obtener la solicitud
    const [solicitud] = await connection.query(
      `SELECT 
        t.*,
        tipo_o.nombre as tipo_oficio_nombre,
        m.nombre as municipio_nombre,
        d.nombre as dependencia_nombre,
        e.nombre as estatus_nombre
      FROM tramites_alta t
      LEFT JOIN tipos_oficio tipo_o ON t.tipo_oficio_id = tipo_o.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN dependencias d ON t.dependencia_id = d.id
      LEFT JOIN estatus_solicitudes e ON t.estatus_id = e.id
      WHERE t.id = ? AND t.usuario_analista_c5_id = ? AND t.es_tramite_dependencia = TRUE`,
      [id, req.userId]
    );

    if (solicitud.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada o no tienes permiso para verla'
      });
    }

    // Obtener personas del trámite
    const [personas] = await connection.query(
      `SELECT 
        p.*,
        pu.nombre as puesto_nombre
      FROM personas_tramite_alta p
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      WHERE p.tramite_alta_id = ?
      ORDER BY p.created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...solicitud[0],
        personas
      }
    });

  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitud',
      error: error.message
    });
  } finally {
    connection.release();
  }
};
