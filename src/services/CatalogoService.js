import MunicipioModel from '../models/MunicipioModel.js';
import RegionModel from '../models/RegionModel.js';
import DependenciaModel from '../models/DependenciaModel.js';
import TipoOficioModel from '../models/TipoOficioModel.js';
import EstatusModel from '../models/EstatusModel.js';
import PuestoModel from '../models/PuestoModel.js';

/**
 * CatalogoService - Capa de lógica de negocio para catálogos
 * Centraliza operaciones complejas y validaciones de negocio
 */
class CatalogoService {
  /**
   * Obtener todos los tipos de oficio
   * @returns {Promise<Array>}
   */
  async getTiposOficio() {
    return await TipoOficioModel.findAll({
      orderBy: 'nombre',
      orderDir: 'ASC'
    });
  }

  /**
   * Obtener tipos de oficio con estadísticas de uso
   * @returns {Promise<Array>}
   */
  async getTiposOficioConEstadisticas() {
    return await TipoOficioModel.findAllWithTramites();
  }

  /**
   * Obtener municipios con filtros opcionales
   * @param {Object} filtros - Filtros de búsqueda
   * @returns {Promise<Array>}
   */
  async getMunicipios(filtros = {}) {
    const { region_id, buscar } = filtros;

    if (region_id || buscar) {
      return await MunicipioModel.findAllWithRegion({ region_id, buscar });
    }

    return await MunicipioModel.findAllWithRegion();
  }

  /**
   * Obtener un municipio por ID con su región
   * @param {number} id - ID del municipio
   * @returns {Promise<Object|null>}
   */
  async getMunicipioPorId(id) {
    const [municipio] = await MunicipioModel.query(
      `SELECT m.*, r.nombre as region_nombre 
       FROM municipios m 
       LEFT JOIN regiones r ON m.region_id = r.id 
       WHERE m.id = ?`,
      [id]
    );
    return municipio || null;
  }

  /**
   * Obtener todas las regiones
   * @returns {Promise<Array>}
   */
  async getRegiones() {
    return await RegionModel.findAll({
      orderBy: 'nombre',
      orderDir: 'ASC'
    });
  }

  /**
   * Obtener región con sus municipios
   * @param {number} id - ID de la región
   * @returns {Promise<Object|null>}
   */
  async getRegionConMunicipios(id) {
    return await RegionModel.findWithMunicipios(id);
  }

  /**
   * Obtener estadísticas de una región
   * @param {number} id - ID de la región
   * @returns {Promise<Object|null>}
   */
  async getEstadisticasRegion(id) {
    return await RegionModel.getEstadisticas(id);
  }

  /**
   * Obtener todos los estatus de solicitudes
   * @returns {Promise<Array>}
   */
  async getEstatus() {
    return await EstatusModel.findAll({
      orderBy: 'id',
      orderDir: 'ASC'
    });
  }

  /**
   * Obtener estatus con estadísticas de uso
   * @returns {Promise<Array>}
   */
  async getEstatusConEstadisticas() {
    return await EstatusModel.findAllWithTramites();
  }

  /**
   * Obtener todas las dependencias del C5i
   * @returns {Promise<Array>}
   */
  async getDependencias() {
    return await DependenciaModel.findAll({
      orderBy: 'nombre',
      orderDir: 'ASC'
    });
  }

  /**
   * Obtener dependencias activas solamente
   * @returns {Promise<Array>}
   */
  async getDependenciasActivas() {
    return await DependenciaModel.findActivas();
  }

  /**
   * Obtener dependencia con estadísticas
   * @param {number} id - ID de la dependencia
   * @returns {Promise<Object|null>}
   */
  async getDependenciaConEstadisticas(id) {
    return await DependenciaModel.findWithEstadisticas(id);
  }

  /**
   * Obtener puestos con filtros opcionales
   * @param {Object} filtros - Filtros de búsqueda
   * @returns {Promise<Array>}
   */
  async getPuestos(filtros = {}) {
    const { competencia } = filtros;

    if (competencia) {
      return await PuestoModel.findByCompetencia(competencia);
    }

    return await PuestoModel.findAll({
      orderBy: 'nombre',
      orderDir: 'ASC'
    });
  }

  /**
   * Obtener puestos con estadísticas de asignación
   * @returns {Promise<Array>}
   */
  async getPuestosConEstadisticas() {
    return await PuestoModel.findAllWithEstadisticas();
  }

  /**
   * Validar que un municipio pertenezca a una región
   * Útil para validaciones de permisos de analistas
   * @param {number} municipioId - ID del municipio
   * @param {number} regionId - ID de la región
   * @returns {Promise<boolean>}
   */
  async validarMunicipioEnRegion(municipioId, regionId) {
    return await MunicipioModel.belongsToRegion(municipioId, regionId);
  }

  /**
   * Obtener resumen de todos los catálogos
   * @returns {Promise<Object>}
   */
  async getResumenCatalogos() {
    const [totales, regiones, dependencias, puestos] = await Promise.all([
      MunicipioModel.query(`
        SELECT 
          (SELECT COUNT(*) FROM municipios) as total_municipios,
          (SELECT COUNT(*) FROM regiones) as total_regiones,
          (SELECT COUNT(*) FROM dependencias) as total_dependencias,
          (SELECT COUNT(*) FROM tipos_oficio) as total_tipos_oficio,
          (SELECT COUNT(*) FROM puestos) as total_puestos
      `),
      RegionModel.findAll({ orderBy: 'nombre' }),
      DependenciaModel.findActivas(),
      PuestoModel.query(`
        SELECT competencia, COUNT(*) as total 
        FROM puestos 
        GROUP BY competencia
      `)
    ]);

    return {
      totales: totales[0],
      regiones,
      dependencias_activas: dependencias.length,
      puestos_por_competencia: puestos
    };
  }
}

export default new CatalogoService();
