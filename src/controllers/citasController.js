import CitaService from '../services/CitaService.js';


/**
 * Listar citas con filtros y paginación
 * GET /api/tramites/alta/citas
 */
export const listarCitas = async (req, res) => {
  try {
    const {
      busqueda,
      estado,
      fecha_vista = 'todas',
      fecha_objetivo,
      analista_id,
      pagina = 1,
      limit = 10
    } = req.query;

    const data = await CitaService.listarCitas({
      busqueda,
      estado,
      fecha_vista,
      fecha_objetivo,
      analista_id,
      pagina,
      limit
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error en listarCitas:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

//reagendar cita
export const reenviarNotificacionCita = async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevo_correo } = req.body;
    const data = await CitaService.reenviarNotificacionCita(Number(id), req.userId, { nuevo_correo });
    
    const msg = data.correoEnviado 
      ? 'Correo actualizado y notificación enviada con éxito'
      : 'Correo actualizado, pero el servidor de correo tardó en responder o falló el envío';
      
    res.json({ success: true, message: msg, data });
  } catch (err) {
    const code = err.message.includes('válido') ? 400 : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

/**
 * Estadísticas de citas
 * GET /api/tramites/alta/citas/stats
 */
export const getEstadisticasCitas = async (req, res) => {
  try {
    const { analista_id } = req.query;
    const data = await CitaService.getEstadisticasCitas({ analista_id });
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error en getEstadisticasCitas:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Actualizar estado de una cita
 * PATCH /api/tramites/alta/citas/:id/estado
 */
export const actualizarEstadoCita = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!estado) {
      return res.status(400).json({ success: false, message: 'El estado es obligatorio' });
    }
    await CitaService.actualizarEstadoCita(Number(id), estado);
    res.json({ success: true, message: 'Estado de cita actualizado' });
  } catch (err) {
    const code = err.message.includes('inválido') || err.message.includes('no encontrada') ? 400 : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

export const obtenerBitacoraCita = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await CitaService.obtenerBitacoraCita(Number(id));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const reprogramarCita = async (req, res) => {
  try {
    const { id } = req.params;
    // AGREGAMOS 'nuevo_correo' a la desestructuración del req.body:
    const { fecha_cita, justificacion, lugar, notas, nuevo_correo } = req.body; 
    
    const data = await CitaService.reprogramarCita(Number(id), req.userId, {
      fecha_cita,
      justificacion,
      lugar,
      notas,
      nuevo_correo
    });
    
    res.json({ success: true, message: 'Cita reprogramada y acuse enviado correctamente', data });
  } catch (err) {
    const code = err.message.includes('obligatoria') || err.message.includes('justificación') ? 400 : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

export const cancelarCita = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const data = await CitaService.cancelarCita(Number(id), req.userId, motivo || 'Cancelación manual');
    res.json({ success: true, message: 'Cita cancelada y enviada a rechazados', data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const finalizarFlujoCita = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      asistio,
      sim_sin_antecedentes,
      suim_resultado,
      justificacion,
      cuip_capturado
    } = req.body;

    const data = await CitaService.finalizarFlujoCita(Number(id), req.userId, {
      asistio,
      sim_sin_antecedentes,
      suim_resultado,
      justificacion,
      cuip_capturado
    });
    res.json({ success: true, message: 'Flujo de cita actualizado', data });
  } catch (err) {
    const code =
      err.message.includes('SUIM') ||
      err.message.includes('justificación') ||
      err.message.includes('CUIP')
        ? 400
        : 500;

    res.status(code).json({ success: false, message: err.message });
  }
};

export const listarFinalizados = async (req, res) => {
  try {
    const { busqueda = '', analista_id, pagina = 1, limit = 10 } = req.query;
    const data = await CitaService.listarFinalizados({ busqueda, analista_id, pagina, limit });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const actualizarFase1Finalizado = async (req, res) => {
  try {
    const { id } = req.params;
    const { fase1_estado } = req.body;
    if (!fase1_estado) {
      return res.status(400).json({ success: false, message: 'El estado de Fase 1 es obligatorio' });
    }

    await CitaService.actualizarFase1Finalizado(Number(id), fase1_estado);
    res.json({ success: true, message: 'Fase 1 actualizada' });
  } catch (err) {
    const code = err.message.includes('invalido') || err.message.includes('no encontrado') ? 400 : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

export const subirAcuseFinalizado = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Debes enviar un archivo PDF' });
    }

    await CitaService.subirAcuseFinalizado(Number(id), req.file, req.userId);
    res.json({ success: true, message: 'Constancia subida correctamente' });
  } catch (err) {
    const code = err.message.includes('Firmado') || err.message.includes('no encontrado') ? 400 : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

export const subirAcusePersonaFinalizado = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Debes enviar un archivo PDF' });
    }

    await CitaService.subirAcusePersonaFinalizado(Number(id), req.file, req.userId);
    res.json({ success: true, message: 'Acuse de persona subido correctamente' });
  } catch (err) {
    const code =
      err.message.includes('Firmado')
      || err.message.includes('no encontrado')
      || err.message.includes('migraciones')
        ? 400
        : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

export const eliminarAcuseFinalizado = async (req, res) => {
  try {
    const { id } = req.params;
    await CitaService.eliminarAcuseFinalizado(Number(id));
    res.json({ success: true, message: 'Constancia eliminada correctamente' });
  } catch (err) {
    const code = err.message.includes('no encontrado') ? 400 : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

export const eliminarAcusePersonaFinalizado = async (req, res) => {
  try {
    const { id } = req.params;
    await CitaService.eliminarAcusePersonaFinalizado(Number(id));
    res.json({ success: true, message: 'Acuse de persona eliminado correctamente' });
  } catch (err) {
    const code = err.message.includes('no encontrado') || err.message.includes('migraciones') ? 400 : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

export const verConstanciaFinalizado = async (req, res) => {
  try {
    const { id } = req.params;
    const fileData = await CitaService.obtenerConstanciaFinalizado(Number(id));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileData.originalName)}"`);
    res.sendFile(fileData.absolutePath);
  } catch (err) {
    const code = err.message.includes('no encontrado') || err.message.includes('no tiene constancia') ? 404 : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

export const verAcusePersonaFinalizado = async (req, res) => {
  try {
    const { id } = req.params;
    const fileData = await CitaService.obtenerAcusePersonaFinalizado(Number(id));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileData.originalName)}"`);
    res.sendFile(fileData.absolutePath);
  } catch (err) {
    const code =
      err.message.includes('no encontrado')
      || err.message.includes('no tiene acuse')
      || err.message.includes('migraciones')
        ? 404
        : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

