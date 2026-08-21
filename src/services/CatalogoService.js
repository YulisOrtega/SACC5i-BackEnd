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
  /**
   * Obtener municipios con filtros opcionales (incluye excepción para Región 6)
   * @param {Object} filtros - Filtros de búsqueda
   * @returns {Promise<Array>}
   */
  async getMunicipios(filtros = {}) {
    const { region_id, buscar } = filtros;
    let municipios = [];

    if (region_id || buscar) {
      municipios = await MunicipioModel.findAllWithRegion({ region_id, buscar });
    } else {
      municipios = await MunicipioModel.findAllWithRegion();
    }

    // 👇 LA MAGIA: Excepción para la analista de Tehuacán (Región 6)
    // Si están pidiendo los municipios de la región 6, le inyectamos los "extras"
    if (Number(region_id) === 6 && !buscar) {
      // Lista de los municipios "históricos" que le quitaron pero sigue trabajando
      const municipiosExtrasNombres = [
        'Nicolas Bravo', 'San Antonio Cañada', 'San Gabriel Chilac', 
        'San Jose Miahuatlán', 'San Sebastián Tlacotepec', 'Santiago Miahuatlán', 
        'Tehuacán', 'Tepanco de Lopez', 'Tepexi de Rodríguez', 
        'Tlacotepec De Benito Juarez', 'Vicente Guerrero', 'Zapotitlán', 
        'Zinacatepec', 'Zoquitlán'
      ];

      // Hacemos una consulta rápida para traer los IDs y datos de esos municipios extra
      if (municipiosExtrasNombres.length > 0) {
        const placeholders = municipiosExtrasNombres.map(() => '?').join(',');
        const municipiosExtras = await MunicipioModel.query(
          `SELECT m.*, r.nombre as region_nombre 
           FROM municipios m 
           LEFT JOIN regiones r ON m.region_id = r.id 
           WHERE m.nombre IN (${placeholders})`,
          municipiosExtrasNombres
        );

        // Juntamos los 13 oficiales con los extras, y filtramos duplicados por si acaso
        const todosLosMunicipios = [...municipios, ...municipiosExtras];
        
        // Filtramos duplicados (por si alguno de la lista extra ya estaba en los 13)
        const municipiosUnicos = Array.from(new Map(todosLosMunicipios.map(m => [m.id, m])).values());

        // Ordenamos la lista combinada alfabéticamente para que se vea bonita en el select
        municipiosUnicos.sort((a, b) => a.nombre.localeCompare(b.nombre));

        return municipiosUnicos;
      }
    }

    return municipios;
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
   * Validar que un municipio pertenezca a una región (con excepción para Región 6)
   * @param {number} municipioId - ID del municipio
   * @param {number} regionId - ID de la región
   * @returns {Promise<boolean>}
   */
  async validarMunicipioEnRegion(municipioId, regionId) {
    // 1. Revisión normal de seguridad
    const esValido = await MunicipioModel.belongsToRegion(municipioId, regionId);
    if (esValido) return true;

    // 2. 👇 LA MAGIA PARTE 2: Permitir el guardado si es Tehuacán (Región 6) y usa sus "extras"
    if (Number(regionId) === 6) {
      // Obtenemos los datos del municipio que está intentando guardar
      const municipio = await this.getMunicipioPorId(municipioId);
      
      if (municipio) {
        const municipiosExtras = [
          'Nicolas Bravo', 'San Antonio Cañada', 'San Gabriel Chilac', 
          'San Jose Miahuatlán', 'San Sebastián Tlacotepec', 'Santiago Miahuatlán', 
          'Tehuacán', 'Tepanco de Lopez', 'Tepexi de Rodríguez', 
          'Tlacotepec De Benito Juarez', 'Vicente Guerrero', 'Zapotitlán', 
          'Zinacatepec', 'Zoquitlán'
        ];
        
        // Si el municipio que intentan guardar está en esta lista rebelde, lo dejamos pasar
        if (municipiosExtras.includes(municipio.nombre)) {
          return true;
        }
      }
    }

    // Si no pasó la validación normal ni es de los extras de Tehuacán, bloqueamos
    return false;
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
