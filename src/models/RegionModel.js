import BaseModel from './BaseModel.js';

/**
 * RegionModel - Gestión de regiones (Cajas Territoriales)
 */
class RegionModel extends BaseModel {
  constructor() {
    super('regiones');
  }

  /**
   * Obtener región con sus municipios
   * @param {number} id - ID de la región
   * @returns {Promise<Object|null>}
   */
  async findWithMunicipios(id) {
    const region = await this.findById(id);
    if (!region) return null;

    const municipios = await this.query(
      'SELECT * FROM municipios WHERE region_id = ? ORDER BY nombre ASC',
      [id]
    );

    return {
      ...region,
      municipios
    };
  }

  /**
   * Obtener estadísticas de una región
   * @param {number} id - ID de la región
   * @returns {Promise<Object>}
   */
  async getEstadisticas(id) {
    const [stats] = await this.query(
      `SELECT 
        r.id,
        r.nombre,
        COUNT(DISTINCT m.id) as total_municipios,
        COUNT(DISTINCT t.id) as total_tramites
      FROM regiones r
      LEFT JOIN municipios m ON r.id = m.region_id
      LEFT JOIN tramites_alta t ON m.id = t.municipio_id
      WHERE r.id = ?
      GROUP BY r.id, r.nombre`,
      [id]
    );

    return stats || null;
  }
}

export default new RegionModel();
