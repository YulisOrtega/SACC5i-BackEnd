import PersonaTramiteModel from '../models/PersonaTramiteModel.js';
import TramiteAltaModel from '../models/TramiteAltaModel.js';

/**
 * RevisionService - Lógica de negocio para Revisión de Requisitos
 * Capa de servicio separada siguiendo la arquitectura en capas del proyecto.
 */
class RevisionService {
  /**
   * Lista de documentos requeridos para la revisión
   */
  static DOCUMENTOS_REQUERIDOS = [
    { clave: 'acta_nacimiento', nombre: 'Acta de Nacimiento', orden: 1 },
    { clave: 'credencial_elector', nombre: 'Credencial de elector', orden: 2 },
    { clave: 'cartilla_militar', nombre: 'Cartilla del Servicio Militar Nacional', orden: 3 },
    { clave: 'curp', nombre: 'CURP', orden: 4 },
    { clave: 'rfc', nombre: 'Registro Federal de Contribuyentes (RFC)', orden: 5 },
    { clave: 'certificado_estudios', nombre: 'Comprobante del último certificado de estudios', orden: 6 },
    { clave: 'comprobante_domicilio', nombre: 'Comprobante de domicilio actual', orden: 7 },
    { clave: 'grupo_sanguineo', nombre: 'Grupo Sanguíneo y factor Rh', orden: 8 },
    { clave: 'formato_escritura', nombre: 'Formato de escritura', orden: 9 },
    { clave: 'cedula_inscripcion', nombre: 'Cédula de Inscripción', orden: 10 }
  ];

  /**
   * Obtener personas pendientes de revisión (para tabla RecibidosC3 → botón "Revisión")
   */
  async obtenerPendientesRevision(filtros = {}) {
    return await PersonaTramiteModel.findPendientesRevision(filtros);
  }

  /**
   * Obtener personas en proceso de revisión (vista "En Proceso")
   */
  async obtenerEnProcesoRevision(filtros = {}) {
    return await PersonaTramiteModel.findEnProcesoRevision(filtros);
  }

  /**
   * Iniciar revisión de requisitos para una persona
   * Mueve la persona de "pendiente" a "en_proceso"
   */
  async iniciarRevision(personaId, usuarioId) {
    const persona = await PersonaTramiteModel.findForRevision(personaId);
    if (!persona) {
      throw new Error('Persona no encontrada');
    }

    // Idempotente: si ya está en proceso de revisión, retornar datos actuales sin error
    if (['en_proceso', 'antecedentes', 'documentos', 'completado'].includes(persona.fase_revision)) {
      return await PersonaTramiteModel.findForRevision(personaId);
    }

    if (persona.fase_revision !== 'pendiente') {
      throw new Error(`Esta persona no se puede iniciar en revisión (estado: ${persona.fase_revision})`);
    }

    if (!persona.observaciones_c3) {
      throw new Error('Esta persona no ha sido aprobada por C3');
    }

    // Inicializar documentos
    const documentosInicial = RevisionService.DOCUMENTOS_REQUERIDOS.map(doc => ({
      ...doc,
      validado: false,
      rechazado: false,
      observacion: null
    }));

    await TramiteAltaModel.transaction(async (connection) => {
      await connection.query(
        `UPDATE personas_tramite_alta SET 
          fase_revision = 'en_proceso',
          fecha_inicio_revision = NOW(),
          revisado_por_usuario_id = ?,
          documentos_validados = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [usuarioId, JSON.stringify(documentosInicial), personaId]
      );

      // Si el trámite no está en fase revision_requisitos, actualizarlo
      if (!['revision_requisitos', 'finalizado'].includes(persona.tramite_fase)) {
        await connection.query(
          `UPDATE tramites_alta SET fase_actual = 'revision_requisitos', updated_at = NOW() WHERE id = ?`,
          [persona.tramite_alta_id]
        );

        await connection.query(
          `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
           VALUES (?, ?, ?, 'revision_requisitos', 'Inicio de revisión de requisitos')`,
          [persona.tramite_alta_id, usuarioId, persona.tramite_fase]
        );
      }
    });
    // Leer DESPUÉS del commit para obtener datos frescos
    return await PersonaTramiteModel.findForRevision(personaId);
  }

  /**
   * Obtener detalle de persona para revisión
   */
  async obtenerDetalleRevision(personaId, usuarioId, usuarioRol) {
    const persona = await PersonaTramiteModel.findForRevision(personaId);
    if (!persona) {
      throw new Error('Persona no encontrada');
    }

    // Parsear documentos
    if (persona.documentos_validados && typeof persona.documentos_validados === 'string') {
      persona.documentos_validados = JSON.parse(persona.documentos_validados);
    }

    // Si no tiene documentos inicializados, crear estructura base
    if (!persona.documentos_validados) {
      persona.documentos_validados = RevisionService.DOCUMENTOS_REQUERIDOS.map(doc => ({
        ...doc,
        validado: false,
        rechazado: false,
        observacion: null
      }));
    }

    return persona;
  }

  /**
   * Guardar resultado de antecedentes (RNPSP y SUIC)
   */
  async guardarAntecedentes(personaId, usuarioId, datos) {
    const persona = await PersonaTramiteModel.findForRevision(personaId);
    if (!persona) throw new Error('Persona no encontrada');

    if (!['en_proceso', 'antecedentes'].includes(persona.fase_revision)) {
      throw new Error('La persona no está en fase válida para registrar antecedentes');
    }

    const { resultado_rnpsp, resultado_suic, justificacion_rnpsp, justificacion_antecedentes } = datos;

    // Validar valores
    const validos = ['sin_antecedentes', 'con_antecedentes'];
    if (!validos.includes(resultado_rnpsp) || !validos.includes(resultado_suic)) {
      throw new Error('Resultado de antecedentes inválido');
    }

    const rnpspConAntecedentes = resultado_rnpsp === 'con_antecedentes';
    const suicConAntecedentes  = resultado_suic  === 'con_antecedentes';
    const tieneAntecedentes    = rnpspConAntecedentes || suicConAntecedentes;

    // Justificación obligatoria por cada sistema con antecedentes
    if (rnpspConAntecedentes && !justificacion_rnpsp?.trim()) {
      throw new Error('La justificación RNPSP es obligatoria cuando hay antecedentes');
    }
    if (suicConAntecedentes && !justificacion_antecedentes?.trim()) {
      throw new Error('La justificación SUIC es obligatoria cuando hay antecedentes');
    }

    await TramiteAltaModel.transaction(async (connection) => {
      await connection.query(
        `UPDATE personas_tramite_alta SET 
          resultado_rnpsp = ?,
          resultado_suic = ?,
          tiene_antecedentes = ?,
          justificacion_rnpsp = ?,
          justificacion_antecedentes = ?,
          fase_revision = 'documentos',
          updated_at = NOW()
        WHERE id = ?`,
        [
          resultado_rnpsp,
          resultado_suic,
          tieneAntecedentes,
          rnpspConAntecedentes ? justificacion_rnpsp.trim() : null,
          suicConAntecedentes  ? justificacion_antecedentes.trim() : null,
          personaId
        ]
      );

      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
         VALUES (?, ?, 'revision_requisitos', 'revision_requisitos', ?)`,
        [persona.tramite_alta_id, usuarioId,
         `Antecedentes registrados - RNPSP: ${resultado_rnpsp}${rnpspConAntecedentes ? ' (con justificación)' : ''}, SUIC: ${resultado_suic}${suicConAntecedentes ? ' (con justificación)' : ''}`]
      );
    });
    // Leer DESPUÉS del commit para obtener datos frescos
    return await PersonaTramiteModel.findForRevision(personaId);
  }

  /**
   * Validar/rechazar un documento individual
   */
  async validarDocumento(personaId, usuarioId, clave, validado, observacion = null) {
    const persona = await PersonaTramiteModel.findForRevision(personaId);
    if (!persona) throw new Error('Persona no encontrada');

    if (!['documentos', 'en_proceso', 'antecedentes'].includes(persona.fase_revision)) {
      throw new Error('La persona no está en fase de validación de documentos');
    }

    let documentos = persona.documentos_validados;
    if (typeof documentos === 'string') documentos = JSON.parse(documentos);
    if (!documentos) throw new Error('No se encontraron documentos para validar');

    const idx = documentos.findIndex(d => d.clave === clave);
    if (idx === -1) throw new Error(`Documento '${clave}' no encontrado`);

    documentos[idx].validado = validado;
    // rechazado solo es true cuando explícitamente no validado Y se provee observacion
    documentos[idx].rechazado = !validado && !!observacion?.trim();
    documentos[idx].observacion = observacion || null;

    await PersonaTramiteModel.update(personaId, {
      documentos_validados: JSON.stringify(documentos),
      updated_at: new Date()
    });

    return documentos;
  }

  /**
   * Validar todos los documentos de una vez
   */
  async validarTodosDocumentos(personaId, usuarioId) {
    const persona = await PersonaTramiteModel.findForRevision(personaId);
    if (!persona) throw new Error('Persona no encontrada');

    let documentos = persona.documentos_validados;
    if (typeof documentos === 'string') documentos = JSON.parse(documentos);
    if (!documentos) throw new Error('No se encontraron documentos');

    documentos = documentos.map(d => ({ ...d, validado: true, rechazado: false }));

    await PersonaTramiteModel.update(personaId, {
      documentos_validados: JSON.stringify(documentos),
      updated_at: new Date()
    });

    return documentos;
  }

  /**
   * Completar revisión de requisitos
   * Valida que antecedentes y documentos estén completos
   */
  async completarRevision(personaId, usuarioId) {
    const persona = await PersonaTramiteModel.findForRevision(personaId);
    if (!persona) throw new Error('Persona no encontrada');

    // Idempotente: si ya está completada, retornar directamente
    if (persona.fase_revision === 'completado') {
      return persona;
    }

    if (!['documentos', 'en_proceso', 'antecedentes'].includes(persona.fase_revision)) {
      throw new Error('La persona no está en fase válida para completar revisión');
    }

    // Verificar antecedentes
    if (persona.resultado_rnpsp === 'pendiente' || persona.resultado_suic === 'pendiente') {
      throw new Error('Debe completar la verificación de antecedentes antes de continuar');
    }

    // Verificar documentos
    let documentos = persona.documentos_validados;
    if (typeof documentos === 'string') documentos = JSON.parse(documentos);

    // Normalizar: documentos con rechazado:true pero sin observacion real
    // o con la observacion hardcodeada legacy — se tratan como validados
    const LEGACY_OBSERVACION = 'Documento no cumple requisitos';
    if (documentos) {
      documentos = documentos.map(d => {
        const obsVacia = !d.observacion?.trim();
        const obsLegacy = d.observacion?.trim() === LEGACY_OBSERVACION;
        if (d.rechazado && (obsVacia || obsLegacy)) {
          return { ...d, validado: true, rechazado: false, observacion: null };
        }
        return d;
      });
    }

    const sinValidar = documentos?.filter(d => !d.validado && !d.rechazado) || [];
    if (sinValidar.length > 0) {
      throw new Error(`Quedan ${sinValidar.length} documento(s) sin revisar`);
    }

    // Solo son rechazos explícitos los que tienen observacion escrita
    const rechazados = documentos?.filter(d => d.rechazado === true && d.observacion?.trim()) || [];

    await TramiteAltaModel.transaction(async (connection) => {
      // Guardar documentos normalizados antes de continuar
      await connection.query(
        `UPDATE personas_tramite_alta SET documentos_validados = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(documentos), personaId]
      );

      const faseNueva = rechazados.length > 0 ? 'rechazado_revision' : 'completado';

      await connection.query(
        `UPDATE personas_tramite_alta SET
          fase_revision = ?,
          fecha_fin_revision = NOW(),
          updated_at = NOW()
        WHERE id = ?`,
        [faseNueva, personaId]
      );

      const comentario = rechazados.length > 0
        ? `Revisión completada con ${rechazados.length} documento(s) rechazado(s): ${rechazados.map(d => d.nombre).join(', ')}`
        : 'Revisión de requisitos completada exitosamente';

      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
         VALUES (?, ?, 'revision_requisitos', 'revision_requisitos', ?)`,
        [persona.tramite_alta_id, usuarioId, comentario]
      );
    });
    // Leer DESPUÉS del commit para obtener datos frescos
    return await PersonaTramiteModel.findForRevision(personaId);
  }

  /**
   * Rechazar persona en revisión de requisitos
   */
  async rechazarEnRevision(personaId, usuarioId, motivo) {
    const persona = await PersonaTramiteModel.findForRevision(personaId);
    if (!persona) throw new Error('Persona no encontrada');

    if (!motivo?.trim()) throw new Error('El motivo de rechazo es obligatorio');

    return await TramiteAltaModel.transaction(async (connection) => {
      await connection.query(
        `UPDATE personas_tramite_alta SET
          fase_revision = 'rechazado_revision',
          rechazado = TRUE,
          motivo_rechazo = ?,
          fecha_fin_revision = NOW(),
          updated_at = NOW()
        WHERE id = ?`,
        [motivo.trim(), personaId]
      );

      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
         VALUES (?, ?, 'revision_requisitos', 'revision_requisitos', ?)`,
        [persona.tramite_alta_id, usuarioId, `Rechazado en revisión de requisitos: ${motivo.trim()}`]
      );

      return await PersonaTramiteModel.findForRevision(personaId);
    });
  }
}

export default new RevisionService();
