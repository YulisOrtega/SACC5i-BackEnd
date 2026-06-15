import BaseModel from './BaseModel.js';

/**
 * PersonaTramiteModel - Gestión de personas en trámites de alta
 * Tabla: personas_tramite_alta
 */
class PersonaTramiteModel extends BaseModel {
  constructor() {
    super('personas_tramite_alta');
  }

  /**
   * Obtener todas las personas de un trámite
   */
  async findByTramite(tramiteId, filters = {}) {
    let query = `
      SELECT 
        p.*,
        pu.nombre as puesto_nombre,
        pu.es_competencia_municipal,
        pu.motivo_no_competencia
      FROM personas_tramite_alta p
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      WHERE p.tramite_alta_id = ?
      AND NOT EXISTS (
        SELECT 1
        FROM finalizados f
        WHERE f.persona_tramite_id = p.id
          AND IFNULL(f.is_baja, 0) = 1
      )
    `;
    const params = [tramiteId];

    if (filters.validado !== undefined) {
      query += ' AND p.validado = ?';
      params.push(filters.validado);
    }

    if (filters.rechazado !== undefined) {
      query += ' AND p.rechazado = ?';
      params.push(filters.rechazado);
    }

    query += ' ORDER BY p.created_at ASC';

    return await this.query(query, params);
  }

  /**
   * Verificar si existe una persona con el mismo CURP en el trámite
   */
  async existeCurpEnTramite(tramiteId, curp, excludeId = null) {
    let query = 'SELECT COUNT(*) as count FROM personas_tramite_alta WHERE tramite_alta_id = ? AND curp = ?';
    const params = [tramiteId, curp];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    const [result] = await this.query(query, params);
    return result[0].count > 0;
  }

  /**
   * Obtener personas pendientes de dictamen C3
   */
  async findPendientesC3(filters = {}) {
    let query = `
      SELECT 
        p.*,
        t.numero_solicitud,
        t.fecha_solicitud,
        t.municipio_id,
        t.dependencia_id,
        t.es_tramite_dependencia,
        t.proceso_movimiento,
        m.nombre as municipio_nombre,
        r.nombre as region_nombre,
        d.nombre as dependencia_nombre,
        pu.nombre as puesto_nombre,
        pu.es_competencia_municipal,
        u.nombre_completo as analista_nombre,
        CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN regiones r ON m.region_id = r.id
      LEFT JOIN dependencias d ON t.dependencia_id = d.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN usuarios u ON t.usuario_analista_c5_id = u.id
      WHERE p.validado = TRUE AND p.rechazado = FALSE
      AND t.fase_actual = 'enviado_c3'
      AND p.motivo_rechazo IS NULL
      AND p.observaciones_c3 IS NULL
    `;
    const params = [];

    if (filters.busqueda) {
      query += ` AND (
        p.nombre LIKE ? OR 
        p.apellido_paterno LIKE ? OR 
        p.apellido_materno LIKE ? OR
        t.numero_solicitud LIKE ?
      )`;
      const searchTerm = `%${filters.busqueda}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.municipio_id) {
      query += ' AND t.municipio_id = ?';
      params.push(filters.municipio_id);
    }

    if (filters.tramite_id) {
      query += ' AND p.tramite_alta_id = ?';
      params.push(filters.tramite_id);
    }

    query += ' ORDER BY p.created_at DESC';

    return await this.query(query, params);
  }

  /**
   * Obtener personas aprobadas por C3 pendientes de C5
   */
  async findAprobadosC3PendientesC5(filters = {}) {
    let query = `
      SELECT 
        p.*,
        t.numero_solicitud,
        t.municipio_id,
        m.nombre as municipio_nombre,
        pu.nombre as puesto_nombre,
        u.nombre_completo as analista_nombre
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN usuarios u ON t.usuario_analista_c5_id = u.id
      WHERE p.validado = TRUE AND p.rechazado = FALSE
      AND t.fase_actual = 'validado_c3'
    `;
    const params = [];

    if (filters.municipio_id) {
      query += ' AND t.municipio_id = ?';
      params.push(filters.municipio_id);
    }

    query += ' ORDER BY p.created_at DESC';

    return await this.query(query, params);
  }

  /**
   * Actualizar dictamen C3 de una persona
   */
  async actualizarDictamenC3(personaId, aprobado, observaciones = null) {
    const updates = {
      validado: aprobado ? true : false,
      rechazado: aprobado ? false : true,
      updated_at: new Date()
    };

    if (observaciones) {
      updates.motivo_rechazo = observaciones;
    }

    return await this.update(personaId, updates);
  }

  /**
   * Obtener estadísticas de personas en un trámite
   */
  async getEstadisticasTramite(tramiteId) {
    const rows = await this.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN validado = TRUE AND rechazado = FALSE THEN 1 END) as aprobados_c3,
        COUNT(CASE WHEN rechazado = TRUE THEN 1 END) as rechazados_c3,
        COUNT(CASE WHEN validado = TRUE AND rechazado = FALSE AND observaciones_c3 IS NULL THEN 1 END) as pendientes_c3
      FROM personas_tramite_alta
      WHERE tramite_alta_id = ?`,
      [tramiteId]
    );

    return rows[0] || {};
  }

  /**
   * Verificar si todas las personas del trámite tienen dictamen C3
   * Una persona sin dictamen es: validado=TRUE, rechazado=FALSE, observaciones_c3 IS NULL
   */
  async todasTienenDictamenC3(tramiteId) {
    const rows = await this.query(
      `SELECT COUNT(*) as count 
       FROM personas_tramite_alta 
       WHERE tramite_alta_id = ? AND validado = TRUE AND rechazado = FALSE AND observaciones_c3 IS NULL`,
      [tramiteId]
    );

    return rows[0].count === 0;
  }

  // DEPRECADO: rechazarNoMunicipales ya no se usa.
  // La validación de competencia ahora se hace al momento de agregar persona (agregarPersona en TramiteAltaService).
  // C5 no puede agregar puestos no municipales, así que nunca llegarán personas no municipales al trámite.

  /**
   * Obtener persona por ID con información del trámite
   */
  async findByIdWithTramite(personaId) {
    const [persona] = await this.query(
      `SELECT 
        p.*,
        t.numero_solicitud,
        t.municipio_id,
        t.usuario_analista_c5_id,
        t.fase_actual as tramite_fase,
        m.nombre as municipio_nombre,
        pu.nombre as puesto_nombre,
        pu.es_competencia_municipal,
        pu.motivo_no_competencia
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      WHERE p.id = ?`,
      [personaId]
    );

    return persona || null;
  }

  // ============================================
  // REVISIÓN DE REQUISITOS
  // ============================================

  /**
   * Obtener personas en proceso de revisión de requisitos
   * (aprobadas por C3, fase_revision = 'en_proceso' o posterior)
   */
  async findEnProcesoRevision(filtros = {}) {
    const where = [
      "p.validado = TRUE",
      "p.rechazado = FALSE",
      "p.observaciones_c3 IS NOT NULL",
      "p.fase_revision IN ('en_proceso', 'antecedentes', 'documentos')"
    ];
    const params = [];

    if (filtros.usuario_id && filtros.usuario_rol === 'analista') {
      where.push('(t.usuario_analista_c5_id = ? OR t.es_tramite_dependencia = TRUE)');
      params.push(filtros.usuario_id);
    }

    if (filtros.analista_id && ['admin', 'super_admin', 'direccion'].includes(filtros.usuario_rol)) {
      where.push('t.usuario_analista_c5_id = ?');
      params.push(Number(filtros.analista_id));
    }

    if (filtros.busqueda) {
      where.push('(p.nombre LIKE ? OR p.apellido_paterno LIKE ? OR t.numero_solicitud LIKE ?)');
      const s = `%${filtros.busqueda}%`;
      params.push(s, s, s);
    }

    const sql = `
      SELECT 
        p.id, p.tramite_alta_id, p.nombre, p.apellido_paterno, p.apellido_materno,
        p.fecha_nacimiento, p.numero_oficio_c3, p.puesto_id, p.fase_revision,
        p.resultado_rnpsp, p.resultado_suic, p.tiene_antecedentes,
        p.documentos_validados, p.fecha_inicio_revision,
        CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo,
        t.numero_solicitud, t.fase_actual as tramite_fase,
        t.fecha_solicitud, t.proceso_movimiento, t.es_tramite_dependencia,
        t.usuario_analista_c5_id,
        pu.nombre as puesto_nombre,
        m.nombre as municipio_nombre,
        dep.nombre as dependencia_nombre,
        ua.nombre_completo as analista_nombre,
        TIMESTAMPDIFF(SECOND, p.fecha_inicio_revision, NOW()) as segundos_en_revision
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id
      WHERE ${where.join(' AND ')}
      ORDER BY p.fecha_inicio_revision ASC
    `;

    return await this.query(sql, params);
  }

  /**
   * Obtener personas aprobadas por C3 pendientes de iniciar revisión
   */
  async findPendientesRevision(filtros = {}) {
    const where = [
      "p.validado = TRUE",
      "p.rechazado = FALSE",
      "p.observaciones_c3 IS NOT NULL",
      "p.fase_revision = 'pendiente'",
      "t.fase_actual IN ('dictaminado_c3', 'validado_c3', 'revision_requisitos')"
    ];
    const params = [];

    if (filtros.usuario_id && filtros.usuario_rol === 'analista') {
      where.push('(t.usuario_analista_c5_id = ? OR t.es_tramite_dependencia = TRUE)');
      params.push(filtros.usuario_id);
    }

    if (filtros.busqueda) {
      where.push('(p.nombre LIKE ? OR p.apellido_paterno LIKE ? OR t.numero_solicitud LIKE ?)');
      const s = `%${filtros.busqueda}%`;
      params.push(s, s, s);
    }

    const sql = `
      SELECT 
        p.id, p.tramite_alta_id, p.nombre, p.apellido_paterno, p.apellido_materno,
        p.fecha_nacimiento, p.numero_oficio_c3, p.puesto_id, p.fase_revision,
        p.observaciones_c3,
        CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo,
        t.numero_solicitud, t.fase_actual as tramite_fase, t.fecha_solicitud,
        t.proceso_movimiento, t.es_tramite_dependencia,
        pu.nombre as puesto_nombre,
        m.nombre as municipio_nombre,
        dep.nombre as dependencia_nombre,
        ua.nombre_completo as analista_nombre
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id
      WHERE ${where.join(' AND ')}
      ORDER BY p.created_at DESC
    `;

    return await this.query(sql, params);
  }

  /**
   * Obtener detalle completo de persona para revisión
   */
  async findForRevision(personaId) {
    const [persona] = await this.query(
      `SELECT 
        p.*,
        CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo,
        t.numero_solicitud, t.municipio_id, t.usuario_analista_c5_id,
        t.fase_actual as tramite_fase, t.fecha_solicitud, t.proceso_movimiento,
        m.nombre as municipio_nombre,
        pu.nombre as puesto_nombre, pu.es_competencia_municipal,
        dep.nombre as dependencia_nombre,
        ur.nombre_completo as revisado_por_nombre
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ur ON p.revisado_por_usuario_id = ur.id
      WHERE p.id = ?`,
      [personaId]
    );

    return persona || null;
  }

  // ── CUIP ──

  /**
   * Personas con revisión completada pendientes de validación CUIP
   */
  async findPendientesCuip(filtros = {}) {
    const where = [
      "p.fase_revision = 'completado'",
      "p.fase_cuip = 'pendiente'",
      "p.rechazado = FALSE"
    ];
    const params = [];

    if (filtros.usuario_id && filtros.usuario_rol === 'analista') {
      where.push('(t.usuario_analista_c5_id = ? OR t.es_tramite_dependencia = TRUE)');
      params.push(filtros.usuario_id);
    }

    if (filtros.busqueda) {
      where.push('(p.nombre LIKE ? OR p.apellido_paterno LIKE ? OR t.numero_solicitud LIKE ?)');
      const s = `%${filtros.busqueda}%`;
      params.push(s, s, s);
    }

    const sql = `
      SELECT 
        p.id, p.tramite_alta_id, p.nombre, p.apellido_paterno, p.apellido_materno,
        p.fecha_nacimiento, p.numero_oficio_c3, p.puesto_id, p.fase_revision, p.fase_cuip,
        CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo,
        t.numero_solicitud, t.fase_actual as tramite_fase, t.fecha_solicitud,
        t.proceso_movimiento, t.es_tramite_dependencia,
        pu.nombre as puesto_nombre,
        m.nombre as municipio_nombre,
        dep.nombre as dependencia_nombre
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      WHERE ${where.join(' AND ')}
      ORDER BY p.fecha_fin_revision ASC
    `;

    return await this.query(sql, params);
  }

  /**
   * Personas en proceso de validación CUIP
   */
  async findEnProcesoCuip(filtros = {}) {
    const where = [
      "p.fase_cuip = 'en_proceso'",
      "p.rechazado = FALSE"
    ];
    const params = [];

    if (filtros.usuario_id && filtros.usuario_rol === 'analista') {
      where.push('(t.usuario_analista_c5_id = ? OR t.es_tramite_dependencia = TRUE)');
      params.push(filtros.usuario_id);
    }

    if (filtros.analista_id && ['admin', 'super_admin', 'direccion'].includes(filtros.usuario_rol)) {
      where.push('t.usuario_analista_c5_id = ?');
      params.push(Number(filtros.analista_id));
    }

    const sql = `
      SELECT 
        p.id, p.tramite_alta_id, p.nombre, p.apellido_paterno, p.apellido_materno,
        p.fecha_nacimiento, p.numero_oficio_c3, p.puesto_id, p.fase_revision, p.fase_cuip,
        p.fecha_inicio_cuip,
        CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo,
        t.numero_solicitud, t.fase_actual as tramite_fase, t.fecha_solicitud, t.es_tramite_dependencia,
        t.usuario_analista_c5_id,
        pu.nombre as puesto_nombre,
        m.nombre as municipio_nombre,
        dep.nombre as dependencia_nombre,
        ua.nombre_completo as analista_nombre,
        uc.nombre_completo as cuip_revisado_por_nombre
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id
      LEFT JOIN usuarios uc ON p.cuip_revisado_por_id = uc.id
      WHERE ${where.join(' AND ')}
      ORDER BY p.fecha_inicio_cuip ASC
    `;

    return await this.query(sql, params);
  }

  /**
   * Detalle completo de persona para validación CUIP
   */
  async findForCuip(personaId) {
    const [persona] = await this.query(
      `SELECT 
        p.*,
        CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo,
        t.numero_solicitud, t.municipio_id, t.usuario_analista_c5_id,
        t.fase_actual as tramite_fase, t.fecha_solicitud, t.proceso_movimiento,
        m.nombre as municipio_nombre,
        pu.nombre as puesto_nombre,
        dep.nombre as dependencia_nombre,
        uc.nombre_completo as cuip_revisado_por_nombre,
        ur.nombre_completo as revisado_por_nombre
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios uc ON p.cuip_revisado_por_id = uc.id
      LEFT JOIN usuarios ur ON p.revisado_por_usuario_id = ur.id
      WHERE p.id = ?`,
      [personaId]
    );

    return persona || null;
  }
}

export default new PersonaTramiteModel();
