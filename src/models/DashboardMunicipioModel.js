import BaseModel from './BaseModel.js';

/**
 * DashboardMunicipioModel - Gestión del dashboard personalizado de municipios
 * Tabla: analista_municipios_dashboard
 */
class DashboardMunicipioModel extends BaseModel {
  constructor() {
    super('analista_municipios_dashboard');
  }

  async ensureDashboardTable() {
    await this.query(`
      CREATE TABLE IF NOT EXISTS analista_municipios_dashboard (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_analista_id INT NOT NULL,
        municipio_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_dashboard_analista_municipio (usuario_analista_id, municipio_id),
        INDEX idx_dashboard_usuario_analista (usuario_analista_id),
        INDEX idx_dashboard_municipio (municipio_id),
        CONSTRAINT fk_dashboard_usuario_analista
          FOREIGN KEY (usuario_analista_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        CONSTRAINT fk_dashboard_municipio
          FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE CASCADE
      )
    `);
  }

  /**
   * Obtener municipios del dashboard del analista
   */
  async findByAnalista(analistaId) {
    await this.ensureDashboardTable();

    return await this.query(
      `SELECT 
        d.*,
        m.nombre as municipio_nombre,
        m.clave as municipio_clave,
        m.region_id,
        r.nombre as region_nombre,
        (SELECT COUNT(*) FROM tramites_alta WHERE municipio_id = d.municipio_id AND usuario_analista_c5_id = ?) as total_tramites,
        (SELECT COUNT(*) FROM tramites_alta WHERE municipio_id = d.municipio_id AND usuario_analista_c5_id = ? AND fase_actual != 'finalizado') as tramites_activos
      FROM analista_municipios_dashboard d
      LEFT JOIN municipios m ON d.municipio_id = m.id
      LEFT JOIN regiones r ON m.region_id = r.id
      WHERE d.usuario_analista_id = ?
      ORDER BY m.nombre ASC`,
      [analistaId, analistaId, analistaId]
    );
  }

  /**
   * Verificar si el municipio ya está en el dashboard
   */
  async existeEnDashboard(analistaId, municipioId) {
    await this.ensureDashboardTable();

    return await this.exists({
      usuario_analista_id: analistaId,
      municipio_id: municipioId
    });
  }

  /**
   * Agregar municipio al dashboard
   */
  async agregar(analistaId, municipioId) {
    // Verificar si ya existe
    const existe = await this.existeEnDashboard(analistaId, municipioId);
    if (existe) {
      throw new Error('Este municipio ya está en tu dashboard');
    }

    return await this.create({
      usuario_analista_id: analistaId,
      municipio_id: municipioId
    });
  }

  /**
   * Eliminar municipio del dashboard
   */
  async eliminarByAnalistaMunicipio(analistaId, municipioId) {
    await this.ensureDashboardTable();

    return await this.query(
      'DELETE FROM analista_municipios_dashboard WHERE usuario_analista_id = ? AND municipio_id = ?',
      [analistaId, municipioId]
    );
  }

  /**
   * Verificar si el municipio tiene trámites iniciados
   */
  async tieneTramitesIniciados(analistaId, municipioId) {
    const result = await this.query(
      'SELECT COUNT(*) as count FROM tramites_alta WHERE usuario_analista_c5_id = ? AND municipio_id = ?',
      [analistaId, municipioId]
    );

    return result[0].count > 0;
  }

  /**
   * Obtener municipios disponibles para agregar (de la región del analista)
   */
  async getMunicipiosDisponibles(analistaId, regionId) {
    await this.ensureDashboardTable();

    return await this.query(
      `SELECT 
        m.*,
        r.nombre as region_nombre,
        (SELECT COUNT(*) FROM tramites_alta WHERE municipio_id = m.id AND usuario_analista_c5_id = ?) as total_tramites_historico
      FROM municipios m
      LEFT JOIN regiones r ON m.region_id = r.id
      WHERE m.region_id = ?
      AND m.id NOT IN (
        SELECT municipio_id 
        FROM analista_municipios_dashboard 
        WHERE usuario_analista_id = ?
      )
      ORDER BY m.nombre ASC`,
      [analistaId, regionId, analistaId]
    );
  }
}

export default new DashboardMunicipioModel();
