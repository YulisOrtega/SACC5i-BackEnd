import CatalogoService from '../services/CatalogoService.js';

/**
 * ARQUITECTURA REFACTORIZADA:
 * Controllers -> Services -> Models -> Database
 * 
 * El controller maneja HTTP (req/res)
 * El service maneja lógica de negocio
 * El model maneja acceso a datos
 */

// Obtener tipos de oficio
export const getTiposOficio = async (req, res) => {
  try {
    const tipos = await CatalogoService.getTiposOficio();

    res.json({
      success: true,
      data: tipos
    });

  } catch (error) {
    console.error('Error al obtener tipos de oficio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipos de oficio',
      error: error.message
    });
  }
};

// Obtener municipios
export const getMunicipios = async (req, res) => {
  try {
    const { region_id, buscar } = req.query;
    
    const municipios = await CatalogoService.getMunicipios({ 
      region_id, 
      buscar 
    });

    res.json({
      success: true,
      data: municipios
    });

  } catch (error) {
    console.error('Error al obtener municipios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener municipios',
      error: error.message
    });
  }
};

// Obtener regiones
export const getRegiones = async (req, res) => {
  try {
    const regiones = await CatalogoService.getRegiones();

    res.json({
      success: true,
      data: regiones
    });

  } catch (error) {
    console.error('Error al obtener regiones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener regiones',
      error: error.message
    });
  }
};

// Obtener estatus de solicitudes
export const getEstatus = async (req, res) => {
  try {
    const estatus = await CatalogoService.getEstatus();

    res.json({
      success: true,
      data: estatus
    });

  } catch (error) {
    console.error('Error al obtener estatus:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estatus',
      error: error.message
    });
  }
};

// Obtener dependencias (28 del C5i)
export const getDependencias = async (req, res) => {
  try {
    const dependencias = await CatalogoService.getDependencias();

    res.json({
      success: true,
      data: dependencias,
      total: dependencias.length
    });

  } catch (error) {
    console.error('Error al obtener dependencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener dependencias',
      error: error.message
    });
  }
};

// Obtener puestos con filtro de competencia
export const getPuestos = async (req, res) => {
  try {
    const { competencia } = req.query;
    const puestos = await CatalogoService.getPuestos({ competencia });

    res.json({
      success: true,
      data: puestos,
      total: puestos.length,
      message: 'Puestos con es_competencia_municipal=FALSE serán rechazados automáticamente'
    });

  } catch (error) {
    console.error('Error al obtener puestos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener puestos',
      error: error.message
    });
  }
};
