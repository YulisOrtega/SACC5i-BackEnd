import BaseModel from './BaseModel.js';

/**
 * TramiteAltaModel - Gestión de trámites de alta
 * Tabla principal: tramites_alta
 */
class TramiteAltaModel extends BaseModel {
  constructor() {
    super('tramites_alta');
  }

  /**
   * Generar número de solicitud por usuario (consecutivo independiente por analista)
   * Formato: consecutivo simple (1, 2, 3...)
   * Compatibilidad: toma en cuenta folios legacy (RPSP/SACC5i)
   */
  async generarNumeroSolicitud(usuarioId, connection = null) {
    const sql = `SELECT MAX(
      CAST(
        CASE
          WHEN numero_solicitud IS NULL OR TRIM(numero_solicitud) = '' THEN '0'
          WHEN numero_solicitud REGEXP '^[0-9]+$' THEN numero_solicitud
          ELSE SUBSTRING_INDEX(numero_solicitud, '-', -1)
        END AS UNSIGNED
      )
    ) AS max_num
    FROM tramites_alta
    WHERE usuario_analista_c5_id = ?`;

    let rows;
    if (connection) {
      const [resultRows] = await connection.query(sql, [usuarioId]);
      rows = resultRows;
    } else {
      rows = await this.query(sql, [usuarioId]);
    }

    const ultimo = Number(rows?.[0]?.max_num || 0);
    const nuevoNumero = Number.isFinite(ultimo) ? ultimo + 1 : 1;

    return String(nuevoNumero);
  }

  /**
   * Obtener trámites del analista con información relacionada
   */
  async findByAnalistaWithDetails(analistaId, filters = {}) {
    let query = `
      SELECT 
        t.*,
        m.nombre as municipio_nombre,
        m.clave as municipio_clave,
        tof.nombre as tipo_oficio_nombre,
        e.nombre as estatus_nombre,
        d.nombre as dependencia_nombre,
        (SELECT COUNT(*) FROM personas_tramite_alta WHERE tramite_alta_id = t.id) as total_personas
      FROM tramites_alta t
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id
      LEFT JOIN estatus_solicitudes e ON t.estatus_id = e.id
      LEFT JOIN dependencias d ON t.dependencia_id = d.id
      WHERE (t.usuario_analista_c5_id = ? OR t.es_tramite_dependencia = TRUE)
    `;
    const params = [analistaId];

    if (filters.fase_actual) {
      query += ' AND t.fase_actual = ?';
      params.push(filters.fase_actual);
    }

    if (filters.municipio_id) {
      query += ' AND t.municipio_id = ?';
      params.push(filters.municipio_id);
    }

    if (filters.estatus_id) {
      query += ' AND t.estatus_id = ?';
      params.push(filters.estatus_id);
    }

    query += ' ORDER BY t.created_at DESC';

    return await this.query(query, params);
  }

  /**
   * Obtener un trámite con toda su información relacionada
   */
  async findByIdWithDetails(tramiteId) {
    const [tramite] = await this.query(
      `SELECT 
        t.*,
        m.nombre as municipio_nombre,
        m.clave as municipio_clave,
        m.region_id,
        r.nombre as region_nombre,
        tof.nombre as tipo_oficio_nombre,
        e.nombre as estatus_nombre,
        d.nombre as dependencia_nombre,
        u.nombre_completo as analista_nombre
      FROM tramites_alta t
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN regiones r ON m.region_id = r.id
      LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id
      LEFT JOIN estatus_solicitudes e ON t.estatus_id = e.id
      LEFT JOIN dependencias d ON t.dependencia_id = d.id
      LEFT JOIN usuarios u ON t.usuario_analista_c5_id = u.id
      WHERE t.id = ?`,
      [tramiteId]
    );

    return tramite || null;
  }

  /**
   * Verificar si existe trámite duplicado
   */
  async existsTramiteDuplicado(municipioId, fechaSolicitud, excludeId = null) {
    let query = `
      SELECT COUNT(*) as count 
      FROM tramites_alta 
      WHERE municipio_id = ? 
      AND fecha_solicitud = ? 
      AND estatus_id IN (1, 2)
    `;
    const params = [municipioId, fechaSolicitud];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    const result = await this.query(query, params);
    return result[0]?.count > 0;
  }

  /**
   * Actualizar fase del trámite
   */
  async actualizarFase(tramiteId, nuevaFase, observaciones = null) {
    const updates = {
      fase_actual: nuevaFase,
      updated_at: new Date()
    };

    if (observaciones) {
      updates.observaciones = observaciones;
    }

    return await this.update(tramiteId, updates);
  }

  /**
   * Obtener trámites pendientes para C3 (validador)
   */
  async findPendientesC3(filters = {}) {
    let query = `
      SELECT 
        t.*,
        m.nombre as municipio_nombre,
        tof.nombre as tipo_oficio_nombre,
        u.nombre_completo as analista_nombre,
        (SELECT COUNT(*) FROM personas_tramite_alta WHERE tramite_alta_id = t.id AND validado = FALSE AND rechazado = FALSE) as personas_pendientes
      FROM tramites_alta t
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id
      LEFT JOIN usuarios u ON t.usuario_analista_c5_id = u.id
      WHERE t.fase_actual IN ('enviado_c3', 'validado_c3')
    `;
    const params = [];

    if (filters.municipio_id) {
      query += ' AND t.municipio_id = ?';
      params.push(filters.municipio_id);
    }

    query += ' ORDER BY t.created_at DESC';

    return await this.query(query, params);
  }

  /**
   * Obtener trámites pendientes para C5
   */
  async findPendientesC5(filters = {}) {
    let query = `
      SELECT 
        t.*,
        m.nombre as municipio_nombre,
        tof.nombre as tipo_oficio_nombre,
        u.nombre_completo as analista_nombre,
        (SELECT COUNT(*) FROM personas_tramite_alta WHERE tramite_alta_id = t.id AND validado = TRUE AND rechazado = FALSE) as personas_activas
      FROM tramites_alta t
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id
      LEFT JOIN usuarios u ON t.usuario_analista_c5_id = u.id
      WHERE t.fase_actual = 'validado_c3'
    `;
    const params = [];

    if (filters.municipio_id) {
      query += ' AND t.municipio_id = ?';
      params.push(filters.municipio_id);
    }

    query += ' ORDER BY t.created_at DESC';

    return await this.query(query, params);
  }

  /**
   * Obtener estadísticas del analista
   */
  async getEstadisticasAnalista(analistaId) {
    const stats = await this.query(
      `SELECT 
        COUNT(*) as total_tramites,
        COUNT(CASE WHEN fase_actual = 'datos_solicitud' THEN 1 END) as en_datos_solicitud,
        COUNT(CASE WHEN fase_actual = 'validacion_personal' THEN 1 END) as en_validacion,
        COUNT(CASE WHEN fase_actual = 'enviado_c3' THEN 1 END) as en_c3,
        COUNT(CASE WHEN fase_actual = 'validado_c3' THEN 1 END) as validados_c3,
        COUNT(CASE WHEN fase_actual = 'validado_c3' THEN 1 END) as en_c5,
        COUNT(CASE WHEN fase_actual = 'completado' THEN 1 END) as completados,
        COUNT(CASE WHEN estatus_id = 3 THEN 1 END) as rechazados
      FROM tramites_alta
      WHERE usuario_analista_c5_id = ?`,
      [analistaId]
    );

    return stats[0] || {};
  }

  /**
   * Verificar que el trámite pertenezca al analista
   */
  async perteneceAAnalista(tramiteId, analistaId) {
    return await this.exists({ 
      id: tramiteId, 
      usuario_analista_c5_id: analistaId 
    });
  }

  /**
   * Obtener trámites por municipio y región
   */
  async findByMunicipioRegion(municipioId, regionId = null) {
    let query = `
      SELECT t.*, m.nombre as municipio_nombre
      FROM tramites_alta t
      LEFT JOIN municipios m ON t.municipio_id = m.id
      WHERE t.municipio_id = ?
    `;
    const params = [municipioId];

    if (regionId) {
      query += ' AND m.region_id = ?';
      params.push(regionId);
    }

    query += ' ORDER BY t.created_at DESC';

    return await this.query(query, params);
  }

  /**
   * Obtener información completa de debug para un trámite
   */
  async getDebugInfo(tramiteId) {
    // Obtener información del trámite
    const tramite = await this.query(
      'SELECT id, numero_solicitud, fase_actual FROM tramites_alta WHERE id = ?',
      [tramiteId]
    );

    if (!tramite || tramite.length === 0) {
      return null;
    }

    // Obtener personas del trámite
    const personas = await this.query(
      `SELECT id, nombre, apellido_paterno, validado, rechazado, 
              motivo_rechazo
       FROM personas_tramite_alta 
       WHERE tramite_alta_id = ?`,
      [tramiteId]
    );

    // Obtener estadísticas
    const stats = await this.query(
      `SELECT 
        COUNT(*) as total_personas,
        SUM(CASE WHEN validado = TRUE OR rechazado = TRUE THEN 1 ELSE 0 END) as dictaminados_c3,
        SUM(CASE WHEN validado = TRUE THEN 1 ELSE 0 END) as aprobados_c3,
        SUM(CASE WHEN rechazado = TRUE THEN 1 ELSE 0 END) as rechazados_c3
      FROM personas_tramite_alta
      WHERE tramite_alta_id = ?`,
      [tramiteId]
    );

    return {
      tramite: tramite[0],
      personas: personas || [],
      estadisticas: stats[0] || {},
      criterio_cambio_fase: {
        todos_dictaminados: (stats[0]?.dictaminados_c3 || 0) === (stats[0]?.total_personas || 0),
        total_personas: stats[0]?.total_personas || 0,
        dictaminados_c3: stats[0]?.dictaminados_c3 || 0
      }
    };
  }
}

export default new TramiteAltaModel();
