import BaseModel from './BaseModel.js';

/**
 * DependenciaModel - Gestión de las 28 dependencias del C5i
 */
class DependenciaModel extends BaseModel {
  constructor() {
    super('dependencias');
  }

  /**
   * Buscar dependencia por nombre
   * @param {string} nombre - Nombre de la dependencia
   * @returns {Promise<Object|null>}
   */
  async findByNombre(nombre) {
    return await this.findOne({ nombre });
  }

  /**
   * Obtener dependencias activas
   * @returns {Promise<Array>}
   */
  async findActivas() {
    return await this.findAll({
      where: { activo: true },
      orderBy: 'nombre',
      orderDir: 'ASC'
    });
  }

  /**
   * Obtener dependencia con estadísticas de trámites
   * @param {number} id - ID de la dependencia
   * @returns {Promise<Object|null>}
   */
  async findWithEstadisticas(id) {
    const [result] = await this.query(
      `SELECT 
        d.*,
        COUNT(DISTINCT t.id) as total_tramites,
        COUNT(DISTINCT CASE WHEN t.fase_actual = 'completado' THEN t.id END) as tramites_completados,
        COUNT(DISTINCT CASE WHEN t.fase_actual != 'completado' THEN t.id END) as tramites_pendientes
      FROM dependencias d
      LEFT JOIN tramites_alta t ON d.id = t.dependencia_id
      WHERE d.id = ?
      GROUP BY d.id`,
      [id]
    );

    return result || null;
  }
}

export default new DependenciaModel();
