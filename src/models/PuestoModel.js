import BaseModel from './BaseModel.js';

/**
 * PuestoModel - Gestión de puestos policiales
 */
class PuestoModel extends BaseModel {
  constructor() {
    super('puestos');
  }

  /**
   * Obtener puestos filtrados por competencia
   * @param {string} competencia - Tipo de competencia (municipal, estatal, federal)
   * @returns {Promise<Array>}
   */
  async findByCompetencia(competencia) {
    let query = 'SELECT * FROM puestos WHERE 1=1';
    const params = [];

    if (competencia) {
      query += ' AND competencia = ?';
      params.push(competencia);
    }

    query += ' ORDER BY nombre ASC';

    return await this.query(query, params);
  }

  /**
   * Buscar puesto por nombre
   * @param {string} nombre - Nombre del puesto
   * @returns {Promise<Object|null>}
   */
  async findByNombre(nombre) {
    return await this.findOne({ nombre });
  }

  /**
   * Obtener puestos con estadísticas de asignación
   * @returns {Promise<Array>}
   */
  async findAllWithEstadisticas() {
    return await this.query(
      `SELECT 
        p.*,
        COUNT(DISTINCT pt.id) as total_asignaciones,
        COUNT(DISTINCT CASE WHEN pt.estatus = 'activo' THEN pt.id END) as asignaciones_activas
      FROM puestos p
      LEFT JOIN personas_tramite_alta pt ON p.id = pt.puesto_id
      GROUP BY p.id
      ORDER BY p.nombre ASC`
    );
  }
}

export default new PuestoModel();
