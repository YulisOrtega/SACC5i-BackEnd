import BaseModel from './BaseModel.js';

/**
 * HistorialModel - Gestión del historial de cambios en trámites
 * Tabla: historial_tramites_alta
 * Campos: tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario
 */
class HistorialModel extends BaseModel {
  constructor() {
    super('historial_tramites_alta');
  }

  /**
   * Obtener historial de un trámite
   */
  async findByTramite(tramiteId) {
    return await this.query(
      `SELECT 
        h.*,
        u.nombre_completo as usuario_nombre,
        u.rol as usuario_rol
      FROM historial_tramites_alta h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      WHERE h.tramite_alta_id = ?
      ORDER BY h.created_at DESC`,
      [tramiteId]
    );
  }

  /**
   * Registrar acción en el historial
   */
  async registrar(tramiteId, usuarioId, faseAnterior, faseNueva, comentario = null) {
    return await this.create({
      tramite_alta_id: tramiteId,
      usuario_id: usuarioId,
      fase_anterior: faseAnterior,
      fase_nueva: faseNueva,
      comentario
    });
  }

  /**
   * Obtener última acción de un trámite
   */
  async getUltimaAccion(tramiteId) {
    const accion = await this.query(
      `SELECT h.*, u.nombre_completo as usuario_nombre
       FROM historial_tramites_alta h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       WHERE h.tramite_alta_id = ?
       ORDER BY h.created_at DESC
       LIMIT 1`,
      [tramiteId]
    );

    return accion[0] || null;
  }

  /**
   * Obtener historial filtrado por fase
   */
  async findByFaseNueva(tramiteId, faseNueva) {
    return await this.query(
      `SELECT h.*, u.nombre_completo as usuario_nombre
       FROM historial_tramites_alta h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       WHERE h.tramite_alta_id = ? AND h.fase_nueva = ?
       ORDER BY h.created_at DESC`,
      [tramiteId, faseNueva]
    );
  }
}

export default new HistorialModel();
