import TramiteAltaService from '../services/TramiteAltaService.js';
import TramiteAltaModel from '../models/TramiteAltaModel.js';
import PersonaTramiteModel from '../models/PersonaTramiteModel.js';
import HistorialModel from '../models/HistorialModel.js';

// ============================================
// ARQUITECTURA REFACTORIZADA
// ============================================
// Controllers -> Services -> Models -> Database
// El controller solo maneja HTTP (req/res)
// La lógica de negocio está en TramiteAltaService

// ============================================
// PASO 1: NUEVA SOLICITUD DE ALTA
// ============================================

/**
 * PASO 1: Crear nueva solicitud de ALTA
 * Imagen 5 del mockup - Formulario "Nueva Solicitud de Alta"
 */
export const crearNuevaSolicitud = async (req, res) => {
  try {
    const usuarioId = req.userId;
    const datos = req.body || {};
    const userRole = req.userRole;
    const esAdminMultiRegion = userRole === 'admin' || userRole === 'super_admin';

    let regionId = req.regionId;
    if (esAdminMultiRegion) {
      regionId = datos?.region_id ? Number(datos.region_id) : null;
      if (!regionId) {
        return res.status(400).json({
          success: false,
          message: 'Debe seleccionar una región para crear la solicitud de ALTA'
        });
      }
    }

    if (!regionId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario no tiene región asignada'
      });
    }

    // Crear solicitud usando el servicio
    const solicitud = await TramiteAltaService.crearSolicitud(usuarioId, regionId, datos);

    res.status(201).json({
      success: true,
      message: 'Solicitud de ALTA creada exitosamente',
      data: {
        id: solicitud.id,
        numero_solicitud: solicitud.numero_solicitud,
        fase_actual: solicitud.fase_actual
      }
    });

  } catch (error) {
    console.error('Error al crear solicitud de ALTA:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear solicitud de ALTA',
      error: error.message
    });
  }
};

// ============================================
// DASHBOARD PERSONALIZADO DE MUNICIPIOS
// ============================================

/**
 * DASHBOARD: Obtener municipios que el analista agregó a su dashboard
 */
export const obtenerDashboardMunicipios = async (req, res) => {
  try {
    const analistaId = req.userId;
    const municipios = await TramiteAltaService.obtenerDashboardMunicipios(analistaId);

    res.json({
      success: true,
      data: municipios,
      total: municipios.length,
      message: municipios.length === 0 
        ? 'Dashboard vacío. Agrega municipios con el botón +' 
        : `Dashboard cargado: ${municipios.length} municipio(s)`
    });

  } catch (error) {
    console.error('Error al obtener dashboard de municipios:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener dashboard de municipios',
      error: error.message
    });
  }
};

/**
 * Obtener catálogo de municipios disponibles para agregar al dashboard
 */
export const obtenerMunicipiosDisponibles = async (req, res) => {
  try {
    const analistaId = req.userId;
    const regionId = req.regionId;

    if (!regionId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario no tiene región asignada'
      });
    }

    const municipios = await TramiteAltaService.obtenerMunicipiosDisponibles(analistaId, regionId);

    res.json({
      success: true,
      data: municipios,
      total: municipios.length,
      message: `${municipios.length} municipio(s) disponible(s) para agregar`
    });

  } catch (error) {
    console.error('Error al obtener municipios disponibles:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener municipios disponibles',
      error: error.message
    });
  }
};

/**
 * Agregar un municipio al dashboard del analista
 */
export const agregarMunicipioDashboard = async (req, res) => {
  try {
    const analistaId = req.userId;
    const regionId = req.regionId;
    const { municipio_id } = req.body;

    if (!municipio_id) {
      return res.status(400).json({
        success: false,
        message: 'El ID del municipio es requerido'
      });
    }

    const dashboardEntry = await TramiteAltaService.agregarMunicipioDashboard(
      analistaId,
      regionId,
      municipio_id
    );

    res.status(201).json({
      success: true,
      message: 'Municipio agregado al dashboard exitosamente',
      data: dashboardEntry
    });

  } catch (error) {
    console.error('Error al agregar municipio:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al agregar municipio',
      error: error.message
    });
  }
};

/**
 * Eliminar un municipio del dashboard
 */
export const eliminarMunicipioDashboard = async (req, res) => {
  try {
    const analistaId = req.userId;
    const { municipio_id } = req.params;

    await TramiteAltaService.eliminarMunicipioDashboard(analistaId, municipio_id);

    res.json({
      success: true,
      message: 'Municipio eliminado del dashboard exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar municipio:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al eliminar municipio',
      error: error.message
    });
  }
};

/**
 * Obtener todas las solicitudes de ALTA del analista
 */
export const obtenerMisSolicitudes = async (req, res) => {
  try {
    const analistaId = req.userId;
    const filtros = {
      fase_actual: req.query.fase,
      municipio_id: req.query.municipio_id,
      estatus_id: req.query.estatus_id
    };

    const solicitudes = await TramiteAltaService.obtenerSolicitudesAnalista(analistaId, filtros);

    res.json({
      success: true,
      data: solicitudes,
      total: solicitudes.length
    });

  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener solicitudes',
      error: error.message
    });
  }
};

/**
 * Obtener una solicitud específica con historial
 */
export const obtenerSolicitudPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.userId;
    const usuarioRol = req.userRole;

    const solicitud = await TramiteAltaService.obtenerSolicitudPorId(id, usuarioId, usuarioRol);

    res.json({
      success: true,
      data: solicitud
    });

  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    const statusCode = error.message.includes('No tienes permiso') ? 403 : 
                       error.message.includes('no encontrado') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al obtener solicitud',
      error: error.message
    });
  }
};

/**
 * Eliminar borrador no enviado a C3
 */
export const eliminarBorradorNoEnviado = async (req, res) => {
  try {
    const { tramite_id } = req.params;
    const usuarioId = req.userId;

    await TramiteAltaService.eliminarBorradorNoEnviado(tramite_id, usuarioId);

    res.json({
      success: true,
      message: 'Borrador eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar borrador no enviado:', error);
    const statusCode = error.message.includes('No tienes permiso') ? 403
      : error.message.includes('no encontrado') ? 404
      : error.message.includes('Solo se pueden eliminar borradores') ? 400
      : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al eliminar borrador',
      error: error.message
    });
  }
};

// ============================================
// PASO 2: VALIDACIÓN DE PERSONAL (Próximamente)
// ============================================

/**
 * PASO 2: Agregar personas a validar
 * Imagen 6 del mockup - "Validación de Personal"
 */
/**
 * Agregar múltiples personas para validar (PASO 2)
 */
export const agregarPersonasParaValidar = async (req, res) => {
  try {
    const { tramite_id } = req.params;
    const { personas } = req.body;
    const usuarioId = req.userId;

    if (!personas || personas.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debes proporcionar al menos una persona'
      });
    }

    const personasCreadas = await TramiteAltaService.agregarPersonas(tramite_id, usuarioId, personas);

    res.status(201).json({
      success: true,
      message: `${personasCreadas.length} persona(s) agregada(s) exitosamente`,
      data: personasCreadas
    });

  } catch (error) {
    console.error('Error al agregar personas:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al agregar personas',
      error: error.message
    });
  }
};

/**
 * Enviar solicitud a C3 (después de validar personal)
 */
export const enviarSolicitudAC3 = async (req, res) => {
  try {
    const tramite_id = req.params.tramite_id || req.body.tramite_id;
    const usuarioId = req.userId;

    const tramite = await TramiteAltaService.enviarSolicitudAC3(tramite_id, usuarioId);

    res.json({
      success: true,
      message: 'Solicitud enviada a C3 exitosamente',
      data: tramite
    });

  } catch (error) {
    console.error('Error al enviar solicitud a C3:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al enviar solicitud a C3',
      error: error.message
    });
  }
};

// ============================================
// PASO 3: DICTAMEN C3
// ============================================

/**
 * PASO 3: Ver PERSONAS pendientes para C3 (Vista por persona individual)
 */
export const obtenerPersonasPendientesC3 = async (req, res) => {
  try {
    const filtros = {
      busqueda: req.query.busqueda,
      municipio_id: req.query.municipio_id
    };

    const personas = await TramiteAltaService.obtenerPersonasPendientesC3(filtros);

    res.json({
      success: true,
      data: personas,
      total: personas.length,
      message: `${personas.length} personas pendientes de dictamen C3`
    });

  } catch (error) {
    console.error('Error al obtener personas pendientes C3:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener personas pendientes',
      error: error.message
    });
  }
};

/**
 * Obtener detalle de una solicitud para C3
 */
export const obtenerSolicitudParaC3 = async (req, res) => {
  try {
    const { id } = req.params;

    const tramites = await TramiteAltaService.obtenerTramitesPendientesC3({ tramite_id: id });

    if (tramites.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada o no disponible para C3'
      });
    }

    const tramite = tramites[0];
    const [personas, historial] = await Promise.all([
      PersonaTramiteModel.findByTramite(id),
      HistorialModel.findByTramite(id)
    ]);

    res.json({
      success: true,
      data: {
        ...tramite,
        personas,
        historial
      }
    });

  } catch (error) {
    console.error('Error al obtener solicitud para C3:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener solicitud',
      error: error.message
    });
  }
};

/**
 * DEBUG: Ver estado de dictámenes de un trámite
 */
/**
 * Debug: Obtener estado detallado de un trámite
 * Útil para verificar el flujo de trabajo y estadísticas
 */
export const debugTramiteEstado = async (req, res) => {
  try {
    const { tramite_id } = req.params;

    const debugInfo = await TramiteAltaModel.getDebugInfo(tramite_id);

    if (!debugInfo) {
      return res.status(404).json({ 
        success: false, 
        message: 'Trámite no encontrado' 
      });
    }

    res.json({
      success: true,
      data: debugInfo
    });

  } catch (error) {
    console.error('Error debug tramite:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en debug',
      error: error.message
    });
  }
};

/**
 * C3 emite dictamen para UNA PERSONA individual
 */
export const emitirDictamenPersonaC3 = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const { estatus, observaciones_c3 } = req.body;
    const usuarioId = req.userId;

    // Validar estatus
    const estatusPermitidos = ['ALTA OK', 'NO PUEDE SER DADO DE ALTA', 'PENDIENTE'];
    if (!estatusPermitidos.includes(estatus)) {
      return res.status(400).json({
        success: false,
        message: 'Estatus inválido. Use: ALTA OK, NO PUEDE SER DADO DE ALTA, o PENDIENTE'
      });
    }

    const persona = await TramiteAltaService.emitirDictamenPersonaC3(
      persona_id,
      usuarioId,
      estatus,
      observaciones_c3
    );

    res.json({
      success: true,
      message: `Dictamen "${estatus}" registrado para persona ${persona_id}`,
      data: persona
    });

  } catch (error) {
    console.error('Error al emitir dictamen persona C3:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al emitir dictamen',
      error: error.message
    });
  }
};

/**
 * Obtener historial de trámites procesados por C3
 */
export const obtenerHistorialC3 = async (req, res) => {
  try {
    const filtros = {
      validador_id: req.userId,
      fecha_inicio: req.query.fecha_inicio,
      fecha_fin: req.query.fecha_fin,
      busqueda: req.query.busqueda,
      dictamen: req.query.dictamen
    };

    const tramites = await TramiteAltaService.obtenerHistorialC3(filtros);

    res.json({
      success: true,
      data: tramites,
      total: tramites.length,
      message: `${tramites.length} trámites procesados en historial`
    });

  } catch (error) {
    console.error('Error al obtener historial C3:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener historial',
      error: error.message
    });
  }
};

// ============================================
// PASO 2: VALIDACIÓN DE PERSONAL
// ============================================

/**
 * C5 obtiene TODAS las personas de TODOS los trámite
 * Vista unificada para ver el estatus de cada persona
 */
export const obtenerTodasLasPersonasC5 = async (req, res) => {
  try {
    const filtros = {
      usuario_id: req.userId,
      usuario_rol: req.userRole,
      busqueda: req.query.busqueda,
      fase_tramite: req.query.fase_tramite,
      estatus_persona: req.query.estatus_persona,
      municipio_nombre: req.query.municipio_nombre
    };

    const personas = await TramiteAltaService.obtenerTodasLasPersonasC5(filtros);

    res.json({
      success: true,
      data: personas,
      total: personas.length,
      message: personas.length === 0
        ? 'No hay registros para el municipio seleccionado'
        : `${personas.length} personas encontradas`
    });

  } catch (error) {
    console.error('Error al obtener personas C5:', error);

    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener personas',
      error: error.message
    });
  }
};

/**
 * Agregar persona individual al trámite (PASO 2)
 */
export const agregarPersona = async (req, res) => {
  try {
    const { tramite_id } = req.params;
    const usuarioId = req.userId;
    const datosPersona = req.body;

    const persona = await TramiteAltaService.agregarPersona(tramite_id, usuarioId, datosPersona);

    res.status(201).json({
      success: true,
      message: persona.rechazado 
        ? 'Persona agregada y rechazada automáticamente (puesto no municipal)'
        : 'Persona agregada exitosamente',
      data: persona
    });

  } catch (error) {
    console.error('Error al agregar persona:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error al agregar persona',
      error: error.message
    });
  }
};

/**
 * Obtener personas del trámite
 */
export const obtenerPersonasPorTramite = async (req, res) => {
  try {
    const { tramite_id } = req.params;

    const personas = await PersonaTramiteModel.findByTramite(tramite_id);

    res.json({
      success: true,
      data: personas,
      total: personas.length
    });

  } catch (error) {
    console.error('Error al obtener personas:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener personas',
      error: error.message
    });
  }
};

/**
 * Editar persona (datos básicos en PASO 2)
 */
export const editarPersona = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const usuarioId = req.userId;

    await TramiteAltaService.editarPersona(persona_id, usuarioId, req.body || {});

    res.json({
      success: true,
      message: 'Persona actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error al editar persona:', error);
    const statusCode = error.message.includes('permiso') ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al editar persona',
      error: error.message
    });
  }
};

/**
 * Validar persona (marcar como aprobada)
 */
export const validarPersona = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const usuarioId = req.userId;

    const resultado = await TramiteAltaService.validarPersona(persona_id, usuarioId);

    res.json({
      success: true,
      message: resultado?.validado ? 'Persona validada exitosamente' : 'Persona desvalidada exitosamente'
    });

  } catch (error) {
    console.error('Error al validar persona:', error);
    const statusCode = error.message.includes('permiso') ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al validar persona',
      error: error.message
    });
  }
};

/**
 * Rechazar persona manualmente
 */
export const rechazarPersona = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const { motivo_rechazo } = req.body;
    const usuarioId = req.userId;

    await TramiteAltaService.rechazarPersona(persona_id, usuarioId, motivo_rechazo);

    res.json({
      success: true,
      message: 'Persona rechazada exitosamente'
    });

  } catch (error) {
    console.error('Error al rechazar persona:', error);
    const statusCode = error.message.includes('permiso') ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al rechazar persona',
      error: error.message
    });
  }
};

// ============================================
// TABLA DE PERSONAS RECHAZADAS (C5 y C3)
// ============================================

/**
 * Obtener TODAS las PERSONAS rechazadas (no trámites)
 * Vista por persona individual - Historial completo de rechazos
 */
export const obtenerPersonasRechazadas = async (req, res) => {
  try {
    const {
      busqueda = '',
      fecha_inicio = '',
      fecha_fin = '',
      etapa_rechazo = '',
      page = 1,
      limit = 15,
      analista_id = null
    } = req.query;

    const data = await TramiteAltaService.obtenerPersonasRechazadas({
      busqueda,
      fecha_inicio,
      fecha_fin,
      etapa_rechazo,
      page,
      limit,
      analista_id,

      usuario_id: req.userId,
      usuario_rol: req.user?.rol || req.rol || req.userRole || req.usuario?.rol
    });

    res.json({
      success: true,
      data: data.personas || [],
      paginacion: data.paginacion || {}
    });
  } catch (error) {
    console.error('Error al obtener personas rechazadas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener personas rechazadas'
    });
  }
};

/**
 * Actualizar motivo de rechazo de una persona
 */
export const actualizarMotivoRechazo = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const { motivo_rechazo } = req.body;

    if (!motivo_rechazo) {
      return res.status(400).json({
        success: false,
        message: 'El motivo de rechazo es requerido'
      });
    }

    const resultado = await TramiteAltaService.actualizarMotivoRechazo(
      persona_id, motivo_rechazo, req.userId
    );

    res.json({
      success: true,
      message: resultado.message
    });

  } catch (error) {
    console.error('Error al actualizar motivo:', error);
    const statusCode = error.message.includes('no encontrad') ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al actualizar motivo de rechazo'
    });
  }
};

/**
 * Generar oficio de rechazo para una persona
 */
export const generarOficioRechazo = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const oficio = await TramiteAltaService.generarOficioRechazo(persona_id);

    res.json({
      success: true,
      data: oficio,
      message: 'Oficio de rechazo generado correctamente'
    });

  } catch (error) {
    console.error('Error al generar oficio:', error);
    const statusCode = error.message.includes('no encontrad') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al generar oficio de rechazo'
    });
  }
};

// ============================================
// REVISIÓN DE PROPUESTAS C3 (Solo C5)
// ============================================

/**
 * Obtener trámites con rechazos de C3 pendientes de generar oficio
 */
export const obtenerPropuestasC3 = async (req, res) => {
  try {
    const filtros = {
      usuario_id: req.userId,
      usuario_rol: req.userRole,
      busqueda: req.query.busqueda
    };

    const tramites = await TramiteAltaService.obtenerTramitesConRechazosC3(filtros);

    res.json({
      success: true,
      data: tramites,
      total: tramites.length,
      message: `${tramites.length} trámite(s) con rechazos de C3 pendientes`
    });

  } catch (error) {
    console.error('Error al obtener rechazos C3:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener rechazos C3',
      error: error.message
    });
  }
};

/**
 * C5: Emitir decisión final sobre propuestas de C3 (Segundo filtro de competencia)
 */
export const emitirDecisionFinalC5 = async (req, res) => {
  try {
    const { tramite_id, decisiones } = req.body;
    const usuarioId = req.userId;

    // Validaciones básicas
    if (!tramite_id) {
      return res.status(400).json({
        success: false,
        message: 'El tramite_id es requerido'
      });
    }

    if (!decisiones || !Array.isArray(decisiones) || decisiones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar al menos una decisión'
      });
    }

    // Validar formato de decisiones
    for (const decision of decisiones) {
      if (!decision.persona_id || !decision.decision) {
        return res.status(400).json({
          success: false,
          message: 'Cada decisión debe tener persona_id y decision'
        });
      }

      if (!['original', 'propuesta'].includes(decision.decision)) {
        return res.status(400).json({
          success: false,
          message: 'La decisión debe ser "original" o "propuesta"'
        });
      }
    }

    const resultado = await TramiteAltaService.emitirDecisionFinalC5(
      tramite_id,
      usuarioId,
      decisiones
    );

    // Si hay error de validación de competencia
    if (resultado.error) {
      return res.status(resultado.statusCode).json({
        success: false,
        message: resultado.message,
        detalles: resultado.detalles
      });
    }

    res.json({
      success: true,
      message: resultado.todas_decisiones_tomadas 
        ? 'Todas las decisiones registradas. Trámite aprobado con decisión final de C5.'
        : 'Decisiones registradas correctamente',
      data: resultado
    });

  } catch (error) {
    console.error('Error al emitir decisión final C5:', error);
    const statusCode = error.message.includes('permisos') ? 403 : 
                       error.message.includes('no encontrado') ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al emitir decisión final',
      error: error.message
    });
  }
};

// ============================================
// NUEVO: TRÁMITES DE DEPENDENCIAS PARA C5
// ============================================

/**
 * Obtener todos los trámites creados por dependencias (para C5)
 */
export const obtenerTramitesDependenciasParaC5 = async (req, res) => {
  try {
    const filtros = {
      usuario_rol: req.userRole,
      fase_actual: req.query.fase_actual,
      dependencia_id: req.query.dependencia_id
    };

    const tramites = await TramiteAltaService.obtenerTramitesDependencias(filtros);

    res.json({
      success: true,
      message: 'Trámites de dependencias obtenidos exitosamente',
      data: tramites,
      total: tramites.length,
      info: 'Estos son los trámites creados por las dependencias (FGE, CERESO, AUXILIAR, PRIVADA, SSP)'
    });

  } catch (error) {
    console.error('Error al obtener trámites de dependencias:', error);
    const statusCode = error.message.includes('Solo usuarios') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al obtener trámites de dependencias',
      error: error.message
    });
  }
};

