import BaseModel from './BaseModel.js';

/**
 * TipoOficioModel - Gestión de tipos de oficio (Alta, Baja, Consulta, etc.)
 */
class TipoOficioModel extends BaseModel {
  constructor() {
    super('tipos_oficio');
  }

  /**
   * Buscar tipo de oficio por nombre
   * @param {string} nombre - Nombre del tipo de oficio
   * @returns {Promise<Object|null>}
   */
  async findByNombre(nombre) {
    return await this.findOne({ nombre });
  }

  /**
   * Obtener tipos de oficio con conteo de trámites
   * @returns {Promise<Array>}
   */
  async findAllWithTramites() {
    return await this.query(
      `SELECT 
        t.*,
        COUNT(ta.id) as total_tramites
      FROM tipos_oficio t
      LEFT JOIN tramites_alta ta ON t.id = ta.tipo_oficio_id
      GROUP BY t.id
      ORDER BY t.nombre ASC`
    );
  }
}

export default new TipoOficioModel();
