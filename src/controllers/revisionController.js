import RevisionService from '../services/RevisionService.js';

// ============================================
// REVISIÓN DE REQUISITOS
// ============================================

/**
 * Obtener personas pendientes de revisión (aprobadas por C3, sin iniciar)
 */
export const obtenerPendientesRevision = async (req, res) => {
  try {
    const filtros = {
      usuario_id: req.userId,
      usuario_rol: req.userRole,
      busqueda: req.query.busqueda
    };

    const personas = await RevisionService.obtenerPendientesRevision(filtros);

    res.json({
      success: true,
      data: personas,
      total: personas.length
    });
  } catch (error) {
    console.error('Error al obtener pendientes revisión:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener personas en proceso de revisión (vista "En Proceso")
 */
export const obtenerEnProcesoRevision = async (req, res) => {
  try {
    const filtros = {
      usuario_id: req.userId,
      usuario_rol: req.userRole,
      busqueda: req.query.busqueda,
      analista_id: req.query.analista_id
    };

    const personas = await RevisionService.obtenerEnProcesoRevision(filtros);

    res.json({
      success: true,
      data: personas,
      total: personas.length
    });
  } catch (error) {
    console.error('Error al obtener en proceso revisión:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Iniciar revisión de requisitos para una persona
 */
export const iniciarRevision = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const persona = await RevisionService.iniciarRevision(persona_id, req.userId);

    res.json({
      success: true,
      message: 'Revisión de requisitos iniciada',
      data: persona
    });
  } catch (error) {
    console.error('Error al iniciar revisión:', error);
    const status = error.message.includes('no encontrada') ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Obtener detalle de persona para revisión
 */
export const obtenerDetalleRevision = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const persona = await RevisionService.obtenerDetalleRevision(
      persona_id, req.userId, req.userRole
    );

    res.json({
      success: true,
      data: persona
    });
  } catch (error) {
    console.error('Error al obtener detalle revisión:', error);
    const status = error.message.includes('no encontrada') ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Guardar resultados de antecedentes (RNPSP + SUIC)
 */
export const guardarAntecedentes = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const persona = await RevisionService.guardarAntecedentes(
      persona_id, req.userId, req.body
    );

    res.json({
      success: true,
      message: 'Antecedentes registrados correctamente',
      data: persona
    });
  } catch (error) {
    console.error('Error al guardar antecedentes:', error);
    const status = error.message.includes('no encontrada') ? 404 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Validar/rechazar un documento individual
 */
export const validarDocumentoRevision = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const { clave, validado, observacion } = req.body;

    if (!clave) {
      return res.status(400).json({ success: false, message: 'La clave del documento es requerida' });
    }

    const documentos = await RevisionService.validarDocumento(
      persona_id, req.userId, clave, validado !== false, observacion
    );

    res.json({
      success: true,
      message: `Documento '${clave}' ${validado !== false ? 'validado' : 'rechazado'}`,
      data: documentos
    });
  } catch (error) {
    console.error('Error al validar documento:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Validar todos los documentos de una persona
 */
export const validarTodosDocumentos = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const documentos = await RevisionService.validarTodosDocumentos(persona_id, req.userId);

    res.json({
      success: true,
      message: 'Todos los documentos validados',
      data: documentos
    });
  } catch (error) {
    console.error('Error al validar todos documentos:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Completar revisión de requisitos (validar que todo esté OK)
 */
export const completarRevision = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const persona = await RevisionService.completarRevision(persona_id, req.userId);

    res.json({
      success: true,
      message: persona.fase_revision === 'completado'
        ? 'Revisión completada exitosamente'
        : 'Revisión completada con documentos rechazados',
      data: persona
    });
  } catch (error) {
    console.error('Error al completar revisión:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Rechazar persona durante revisión de requisitos
 */
export const rechazarEnRevision = async (req, res) => {
  try {
    const { persona_id } = req.params;
    const { motivo } = req.body;

    const persona = await RevisionService.rechazarEnRevision(persona_id, req.userId, motivo);

    res.json({
      success: true,
      message: 'Persona rechazada en revisión de requisitos',
      data: persona
    });
  } catch (error) {
    console.error('Error al rechazar en revisión:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};
