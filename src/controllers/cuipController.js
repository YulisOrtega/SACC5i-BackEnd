import CuipService from '../services/CuipService.js';
import CitaService from '../services/CitaService.js';

// ══════════════════════════════════════════════════════════════
// VALIDACIÓN CUIP (Cédula Única de Identificación Personal)
// ══════════════════════════════════════════════════════════════

/**
 * Obtener personas pendientes de validación CUIP
 */
export const obtenerPendientesCuip = async (req, res) => {
  try {
    const filtros = { ...req.query, usuario_id: req.userId, usuario_rol: req.userRole };
    const pendientes = await CuipService.obtenerPendientesCuip(filtros);
    res.json({ success: true, data: pendientes });
  } catch (error) {
    console.error('Error al obtener pendientes CUIP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener personas en proceso de validación CUIP
 */
export const obtenerEnProcesoCuip = async (req, res) => {
  try {
    const filtros = { ...req.query, usuario_id: req.userId, usuario_rol: req.userRole };
    const enProceso = await CuipService.obtenerEnProcesoCuip(filtros);
    res.json({ success: true, data: enProceso });
  } catch (error) {
    console.error('Error al obtener en proceso CUIP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Iniciar validación CUIP
 */
export const iniciarCuip = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const persona = await CuipService.iniciarCuip(persona_id, req.userId);
    res.json({ success: true, message: 'Validación CUIP iniciada', data: persona });
  } catch (error) {
    console.error('Error al iniciar CUIP:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Obtener detalle de persona para validación CUIP
 */
export const obtenerDetalleCuip = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const persona = await CuipService.obtenerDetalleCuip(persona_id);
    res.json({ success: true, data: persona });
  } catch (error) {
    console.error('Error al obtener detalle CUIP:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Validar/rechazar campo individual del CUIP
 */
export const validarCampoCuip = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const { seccion_clave, campo_num, validado } = req.body;
    const cuip = await CuipService.validarCampoCuip(persona_id, req.userId, seccion_clave, campo_num, validado);
    res.json({ success: true, data: cuip });
  } catch (error) {
    console.error('Error al validar campo CUIP:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Validar todos los campos de una sección
 */
export const validarSeccionCuip = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const { seccion_clave } = req.body;
    const cuip = await CuipService.validarSeccionCuip(persona_id, req.userId, seccion_clave);
    res.json({ success: true, data: cuip });
  } catch (error) {
    console.error('Error al validar sección CUIP:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Marcar/desmarcar excepción NINGUNO de una sección
 */
export const marcarExcepcionCuip = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const { seccion_clave, activa } = req.body;
    const result = await CuipService.marcarExcepcionCuip(persona_id, req.userId, seccion_clave, activa);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error al marcar excepción CUIP:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Validar todo el CUIP completo
 */
export const validarTodoCuip = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const result = await CuipService.validarTodoCuip(persona_id, req.userId);
    res.json({ success: true, message: 'Todo el CUIP validado', data: result });
  } catch (error) {
    console.error('Error al validar todo CUIP:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Completar validación CUIP
 */
export const completarCuip = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const persona = await CuipService.completarCuip(persona_id, req.userId);
    res.json({
      success: true,
      message: 'Validación CUIP completada exitosamente',
      data: persona
    });
  } catch (error) {
    console.error('Error al completar CUIP:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Aprobar CUIP y generar cita biométrica (operación combinada)
 */
export const aprobarYGenerarCita = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const { fecha_cita, lugar, notas, email_override, enviar_notificacion } = req.body;
    if (!fecha_cita) {
      return res.status(400).json({ success: false, message: 'La fecha y hora de la cita son obligatorias' });
    }
    const resultado = await CitaService.aprobarYGenerarCita(
      persona_id,
      req.userId,
      {
        fecha_cita,
        lugar,
        notas,
        email_override,
        enviar_notificacion
      }
    );

    const notificacionSolicitada = enviar_notificacion === true;

    res.json({
      success: true,
      message: !notificacionSolicitada
        ? `Cita ${resultado.cita.folio_cita} programada para envío manual`
        : (resultado.correoEnviado
          ? `Cita ${resultado.cita.folio_cita} programada y notificación enviada por correo`
          : `Cita ${resultado.cita.folio_cita} programada (correo no pudo enviarse, revise la configuración)`),
      data: resultado.cita,
      correo_enviado: resultado.correoEnviado,
      notificacion_solicitada: notificacionSolicitada
    });
  } catch (error) {
    console.error('Error al aprobar CUIP y generar cita:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Rechazar persona durante validación CUIP
 */
export const rechazarEnCuip = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const { motivo } = req.body;
    const persona = await CuipService.rechazarEnCuip(persona_id, req.userId, motivo);
    res.json({
      success: true,
      message: 'Persona rechazada en validación CUIP',
      data: persona
    });
  } catch (error) {
    console.error('Error al rechazar en CUIP:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};
