import BaseModel from './BaseModel.js';

/**
 * EstatusModel - Gestión de estatus de solicitudes
 */
class EstatusModel extends BaseModel {
  constructor() {
    super('estatus_solicitudes');
  }

  /**
   * Buscar estatus por nombre
   * @param {string} nombre - Nombre del estatus
   * @returns {Promise<Object|null>}
   */
  async findByNombre(nombre) {
    return await this.findOne({ nombre });
  }

  /**
   * Obtener estatus con conteo de trámites
   * @returns {Promise<Array>}
   */
  async findAllWithTramites() {
    return await this.query(
      `SELECT 
        e.*,
        COUNT(t.id) as total_tramites
      FROM estatus_solicitudes e
      LEFT JOIN tramites_alta t ON e.id = t.estatus_id
      GROUP BY e.id
      ORDER BY e.id ASC`
    );
  }
}

export default new EstatusModel();
