import BaseModel from './BaseModel.js';

/**
 * MunicipioModel - Gestión de municipios de Puebla
 * Extiende BaseModel con operaciones específicas
 */
class MunicipioModel extends BaseModel {
  constructor() {
    super('municipios');
  }

  /**
   * Obtener municipios con información de región
   * @param {Object} filters - Filtros opcionales
   * @returns {Promise<Array>}
   */
  async findAllWithRegion(filters = {}) {
    let query = `
      SELECT m.*, r.nombre as region_nombre 
      FROM municipios m 
      LEFT JOIN regiones r ON m.region_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.region_id) {
      query += ' AND m.region_id = ?';
      params.push(filters.region_id);
    }

    if (filters.buscar) {
      query += ' AND (m.nombre LIKE ? OR m.clave LIKE ?)';
      const searchTerm = `%${filters.buscar}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY m.nombre ASC';

    return await this.query(query, params);
  }

  /**
   * Buscar municipio por clave oficial
   * @param {number} clave - Clave del municipio
   * @returns {Promise<Object|null>}
   */
  async findByClave(clave) {
    return await this.findOne({ clave });
  }

  /**
   * Obtener municipios de una región específica
   * @param {number} regionId - ID de la región
   * @returns {Promise<Array>}
   */
  async findByRegion(regionId) {
    return await this.findAll({
      where: { region_id: regionId },
      orderBy: 'nombre',
      orderDir: 'ASC'
    });
  }

  /**
   * Verificar si un municipio pertenece a una región
   * @param {number} municipioId - ID del municipio
   * @param {number} regionId - ID de la región
   * @returns {Promise<boolean>}
   */
  async belongsToRegion(municipioId, regionId) {
    return await this.exists({ id: municipioId, region_id: regionId });
  }
}

export default new MunicipioModel();
