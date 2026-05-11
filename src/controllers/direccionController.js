import pool from '../config/database.js';

const FASES_RECHAZO = ['rechazado', 'rechazado_no_corresponde', 'rechazado_c3'];
const FASE_FINALIZADA = 'finalizado';

const placeholders = (items) => items.map(() => '?').join(',');

const resolverTablaFinalizados = async (connection) => {
  const [[tablaNueva]] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'finalizados'`
  );

  if (Number(tablaNueva?.total || 0) > 0) return 'finalizados';

  const [[tablaLegacy]] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'ciclo_vida_alta_final'`
  );

  if (Number(tablaLegacy?.total || 0) > 0) return 'ciclo_vida_alta_final';
  return null;
};

export const obtenerPanelDireccion = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const rechazoList = FASES_RECHAZO;
    const rechazoPlaceholders = placeholders(rechazoList);

    const [[resumenTramites]] = await connection.query(
      `SELECT
         COUNT(*) AS total_tramites,
         SUM(CASE WHEN t.fase_actual = ? THEN 1 ELSE 0 END) AS tramites_finalizados,
         SUM(CASE WHEN t.fase_actual IN (${rechazoPlaceholders}) THEN 1 ELSE 0 END) AS tramites_rechazados,
         SUM(CASE WHEN t.fase_actual <> ? AND t.fase_actual NOT IN (${rechazoPlaceholders}) THEN 1 ELSE 0 END) AS tramites_en_proceso
       FROM tramites_alta t`,
      [FASE_FINALIZADA, ...rechazoList, FASE_FINALIZADA, ...rechazoList]
    );

    const [[resumenPersonas]] = await connection.query(
      `SELECT
         COUNT(*) AS total_personas,
         SUM(CASE WHEN p.rechazado = TRUE THEN 1 ELSE 0 END) AS personas_rechazadas,
         SUM(CASE WHEN p.validado = TRUE AND p.rechazado = FALSE THEN 1 ELSE 0 END) AS personas_aprobadas,
         SUM(CASE WHEN p.validado = FALSE AND p.rechazado = FALSE THEN 1 ELSE 0 END) AS personas_pendientes
       FROM personas_tramite_alta p`
    );

    const [estatusTramites] = await connection.query(
      `SELECT t.fase_actual, COUNT(*) AS total
       FROM tramites_alta t
       GROUP BY t.fase_actual
       ORDER BY total DESC, t.fase_actual ASC`
    );

    const tablaFinalizados = await resolverTablaFinalizados(connection);
    let totalExpedientesFinalizados = 0;

    if (tablaFinalizados) {
      const [[rowFinalizados]] = await connection.query(
        `SELECT COUNT(*) AS total FROM ${tablaFinalizados}`
      );
      totalExpedientesFinalizados = Number(rowFinalizados?.total || 0);
    }

    const [desempenoAnalistas] = await connection.query(
      `SELECT
         u.id AS analista_id,
         u.nombre_completo AS analista_nombre,
         u.usuario AS analista_usuario,
         COALESCE(r.nombre, 'Sin region') AS region_nombre,
         COUNT(DISTINCT t.id) AS total_tramites,
         COUNT(DISTINCT CASE WHEN t.fase_actual = ? THEN t.id END) AS tramites_finalizados,
         COUNT(DISTINCT CASE WHEN t.fase_actual IN (${rechazoPlaceholders}) THEN t.id END) AS tramites_rechazados,
         COUNT(DISTINCT CASE WHEN t.fase_actual <> ? AND t.fase_actual NOT IN (${rechazoPlaceholders}) THEN t.id END) AS tramites_en_proceso,
         COUNT(DISTINCT CASE WHEN p.rechazado = TRUE THEN p.id END) AS personas_rechazadas
       FROM usuarios u
       LEFT JOIN regiones r ON r.id = u.region_id
       LEFT JOIN tramites_alta t ON t.usuario_analista_c5_id = u.id
       LEFT JOIN personas_tramite_alta p ON p.tramite_alta_id = t.id
       WHERE u.rol = 'analista' AND u.activo = TRUE
       GROUP BY u.id, u.nombre_completo, u.usuario, r.nombre
       ORDER BY tramites_en_proceso DESC, tramites_finalizados DESC, analista_nombre ASC`,
      [FASE_FINALIZADA, ...rechazoList, FASE_FINALIZADA, ...rechazoList]
    );

    const [topMunicipios] = await connection.query(
      `SELECT
         COALESCE(m.nombre, 'Sin municipio') AS municipio_nombre,
         COUNT(*) AS total_tramites,
         SUM(CASE WHEN t.fase_actual = ? THEN 1 ELSE 0 END) AS finalizados,
         SUM(CASE WHEN t.fase_actual IN (${rechazoPlaceholders}) THEN 1 ELSE 0 END) AS rechazados,
         SUM(CASE WHEN t.fase_actual <> ? AND t.fase_actual NOT IN (${rechazoPlaceholders}) THEN 1 ELSE 0 END) AS en_proceso
       FROM tramites_alta t
       LEFT JOIN municipios m ON m.id = t.municipio_id
       GROUP BY m.id, m.nombre
       ORDER BY total_tramites DESC, municipio_nombre ASC
       LIMIT 12`,
      [FASE_FINALIZADA, ...rechazoList, FASE_FINALIZADA, ...rechazoList]
    );

    res.json({
      success: true,
      data: {
        resumen_general: {
          total_tramites: Number(resumenTramites?.total_tramites || 0),
          tramites_en_proceso: Number(resumenTramites?.tramites_en_proceso || 0),
          tramites_finalizados: Number(resumenTramites?.tramites_finalizados || 0),
          tramites_rechazados: Number(resumenTramites?.tramites_rechazados || 0),
          total_personas: Number(resumenPersonas?.total_personas || 0),
          personas_rechazadas: Number(resumenPersonas?.personas_rechazadas || 0),
          personas_aprobadas: Number(resumenPersonas?.personas_aprobadas || 0),
          personas_pendientes: Number(resumenPersonas?.personas_pendientes || 0),
          expedientes_finalizados: totalExpedientesFinalizados,
          analistas_activos: Array.isArray(desempenoAnalistas) ? desempenoAnalistas.length : 0
        },
        estatus_tramites: estatusTramites || [],
        desempeno_analistas: desempenoAnalistas || [],
        top_municipios: topMunicipios || []
      }
    });
  } catch (error) {
    console.error('Error al obtener panel de direccion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener panel de direccion',
      error: error.message
    });
  } finally {
    connection.release();
  }
};
