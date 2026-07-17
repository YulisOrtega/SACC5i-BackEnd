import TramiteAltaModel from '../models/TramiteAltaModel.js';
import PersonaTramiteModel from '../models/PersonaTramiteModel.js';
import HistorialModel from '../models/HistorialModel.js';
import DashboardMunicipioModel from '../models/DashboardMunicipioModel.js';
import MunicipioModel from '../models/MunicipioModel.js';
import BaseModel from '../models/BaseModel.js';

const normalizarNumeroOficio = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return '';
  return String(value).trim().toUpperCase();
};

const normalizarNumeroOficioOpcional = (value) => {
  if (value === undefined) return undefined;

  const normalizedValue = String(value ?? '').trim().toUpperCase();

  return normalizedValue || null;
};

const normalizarNombrePersona = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return '';
  return String(value).trim().toUpperCase();
};

const normalizarNumeroOficioC3 = normalizarNumeroOficioOpcional;
const normalizarNumeroOficioC5 = normalizarNumeroOficio;

class TramiteAltaService {
  
  async crearSolicitud(usuarioId, regionId, datos) {
    if (!datos.es_tramite_dependencia) {
      const municipioValido = await MunicipioModel.belongsToRegion(
        datos.municipio_id,
        regionId
      );

      if (!municipioValido) {
        throw new Error('El municipio no pertenece a tu región asignada');
      }
    }

    if (datos.fecha_solicitud) {
      const existeDuplicado = await TramiteAltaModel.existsTramiteDuplicado(
        datos.municipio_id,
        datos.fecha_solicitud
      );

      if (existeDuplicado) {
        console.warn('Advertencia: Ya existe una solicitud similar para este municipio');
      }
    }

    return await TramiteAltaModel.transaction(async (connection) => {
      await connection.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuarioId]);
      const numero_solicitud = await TramiteAltaModel.generarNumeroSolicitud(usuarioId, connection);

      const datosSolicitud = {
        numero_solicitud,
        usuario_analista_c5_id: usuarioId,
        tipo_oficio_id: datos.tipo_oficio_id,
        municipio_id: datos.municipio_id,
        fecha_solicitud: datos.fecha_solicitud || new Date().toISOString().split('T')[0],
        proceso_movimiento: 'ALTA',
        fase_actual: 'datos_solicitud',
        estatus_id: 1, 
        es_tramite_dependencia: datos.es_tramite_dependencia || false
      };

      if (datos.dependencia_id) datosSolicitud.dependencia_id = datos.dependencia_id;
      if (datos.tipo_documento) datosSolicitud.tipo_documento = datos.tipo_documento;
      const numeroOficioC5 = normalizarNumeroOficioC5(datos?.numero_oficio_c5 ?? datos?.numero_oficio);
      if (numeroOficioC5 !== undefined) {
        datosSolicitud.numero_oficio_c5 = numeroOficioC5 || null;
      }
      if (datos.termino) datosSolicitud.termino = datos.termino;
      if (datos.dias_horas) datosSolicitud.dias_horas = datos.dias_horas;
      if (datos.fecha_sello_c5) datosSolicitud.fecha_sello_c5 = datos.fecha_sello_c5;
      if (datos.fecha_recibido_dt) datosSolicitud.fecha_recibido_dt = datos.fecha_recibido_dt;
      if (datos.observaciones) datosSolicitud.observaciones = datos.observaciones;

      const [result] = await connection.query(
        `INSERT INTO tramites_alta SET ?`,
        [datosSolicitud]
      );

      const solicitudId = result.insertId;

      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
         VALUES (?, ?, NULL, 'datos_solicitud', 'Solicitud creada - Solicitud inicializada - Paso 1')`,
        [solicitudId, usuarioId]
      );

      const [solicitud] = await connection.query(
        'SELECT * FROM tramites_alta WHERE id = ?',
        [solicitudId]
      );

      return solicitud[0];
    });
  }

  async obtenerSolicitudesAnalista(analistaId, filtros = {}) {
    return await TramiteAltaModel.findByAnalistaWithDetails(analistaId, filtros);
  }

  async obtenerSolicitudPorId(tramiteId, usuarioId, usuarioRol) {
    const tramite = await TramiteAltaModel.findByIdWithDetails(tramiteId);

    if (!tramite) {
      throw new Error('Trámite no encontrado');
    }

    if (usuarioRol === 'analista' &&
        tramite.usuario_analista_c5_id !== usuarioId &&
        !tramite.es_tramite_dependencia) {
      throw new Error('No tienes permiso para ver este trámite');
    }

    const [personas, historial] = await Promise.all([
      PersonaTramiteModel.findByTramite(tramiteId),
      HistorialModel.findByTramite(tramiteId)
    ]);

    return {
      ...tramite,
      personas,
      historial
    };
  }

  async eliminarBorradorNoEnviado(tramiteId, usuarioId) {
    const tramite = await TramiteAltaModel.findById(tramiteId);

    if (!tramite) {
      throw new Error('Trámite no encontrado');
    }

    if (tramite.usuario_analista_c5_id !== usuarioId) {
      throw new Error('No tienes permiso para eliminar este trámite');
    }

    const fasesBorrador = ['datos_solicitud', 'validacion_personal'];
    if (!fasesBorrador.includes(tramite.fase_actual)) {
      throw new Error('Solo se pueden eliminar borradores no enviados a C3');
    }

    return await TramiteAltaModel.transaction(async (connection) => {
      const existeTabla = async (tableName) => {
        const [rows] = await connection.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
          [tableName]
        );
        return rows.length > 0;
      };

      if (await existeTabla('finalizados')) {
        await connection.query('DELETE FROM finalizados WHERE tramite_alta_id = ?', [tramiteId]);
      }

      if (await existeTabla('citas_biometricas')) {
        await connection.query('DELETE FROM citas_biometricas WHERE tramite_alta_id = ?', [tramiteId]);
      }

      await connection.query('DELETE FROM historial_tramites_alta WHERE tramite_alta_id = ?', [tramiteId]);
      await connection.query('DELETE FROM personas_tramite_alta WHERE tramite_alta_id = ?', [tramiteId]);

      const [result] = await connection.query('DELETE FROM tramites_alta WHERE id = ?', [tramiteId]);
      if (!result.affectedRows) {
        throw new Error('No fue posible eliminar el borrador');
      }

      return { eliminado: true, tramite_id: Number(tramiteId) };
    });
  }

  async agregarPersonas(tramiteId, usuarioId, personas) {
    const tramite = await TramiteAltaModel.findById(tramiteId);
    if (!tramite) throw new Error('Trámite no encontrado');
    if (tramite.usuario_analista_c5_id !== usuarioId) throw new Error('No tienes permiso para modificar este trámite');
    if (tramite.fase_actual !== 'datos_solicitud' && tramite.fase_actual !== 'validacion_personal') {
      throw new Error('No se pueden agregar personas en la fase actual del trámite');
    }

    return await TramiteAltaModel.transaction(async (connection) => {
      const personasCreadas = [];

      for (const persona of personas) {
        const personaNormalizada = {
          ...persona,
          nombre: normalizarNombrePersona(persona?.nombre),
          apellido_paterno: normalizarNombrePersona(persona?.apellido_paterno),
          apellido_materno: normalizarNombrePersona(persona?.apellido_materno),
          numero_oficio_c3: normalizarNumeroOficioC3(persona?.numero_oficio_c3)
        };

        const [existing] = await connection.query(
          'SELECT COUNT(*) as count FROM personas_tramite_alta WHERE tramite_alta_id = ? AND curp = ?',
          [tramiteId, personaNormalizada.curp]
        );
        if (existing[0].count > 0) {
          throw new Error(`El CURP ${personaNormalizada.curp} ya está registrado en este trámite`);
        }

        const [result] = await connection.query(
          `INSERT INTO personas_tramite_alta SET ?`,
          [{ tramite_alta_id: tramiteId, ...personaNormalizada }]
        );

        personasCreadas.push({ id: result.insertId, ...personaNormalizada });
      }

      if (tramite.fase_actual === 'datos_solicitud') {
        await connection.query(
          `UPDATE tramites_alta SET fase_actual = 'validacion_personal', updated_at = NOW() WHERE id = ?`,
          [tramiteId]
        );
        await connection.query(
          `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
           VALUES (?, ?, 'datos_solicitud', 'validacion_personal', ?)`,
          [tramiteId, usuarioId, `Personas agregadas - ${personas.length} persona(s) agregada(s) al trámite`]
        );
      }

      return personasCreadas;
    });
  }

  async enviarSolicitudAC3(tramiteId, usuarioId) {
    const tramite = await TramiteAltaModel.findById(tramiteId);
    if (!tramite) throw new Error('Trámite no encontrado');

    const esDependencia = tramite.es_tramite_dependencia === 1 || tramite.es_tramite_dependencia === true;
    if (tramite.usuario_analista_c5_id !== usuarioId) throw new Error('No tienes permiso para modificar este trámite');

    const personas = await PersonaTramiteModel.findByTramite(tramiteId);
    if (personas.length === 0) throw new Error('Debe agregar al menos una persona antes de enviar a C3');
    if (tramite.fase_actual !== 'validacion_personal') throw new Error('El trámite debe estar en fase de validación de personal');

    let personasParaEnviar;
    if (esDependencia) {
      personasParaEnviar = personas.filter(p => !p.rechazado);
      if (personasParaEnviar.length === 0) throw new Error('No hay personas disponibles para enviar a C3');
    } else {
      personasParaEnviar = personas.filter(p => p.validado && !p.rechazado);
      if (personasParaEnviar.length === 0) throw new Error('Debe haber al menos una persona validada para enviar a C3');
    }

    return await TramiteAltaModel.transaction(async (connection) => {
      if (esDependencia) {
        await connection.query(
          `UPDATE personas_tramite_alta SET validado = TRUE, updated_at = NOW() WHERE tramite_alta_id = ? AND rechazado = FALSE`,
          [tramiteId]
        );
      }

      await connection.query(`UPDATE tramites_alta SET fase_actual = 'enviado_c3', estatus_id = 2, updated_at = NOW() WHERE id = ?`, [tramiteId]);

      const comentario = esDependencia 
        ? `Enviado a C3 por dependencia - ${personasParaEnviar.length} persona(s) enviada(s) para dictamen C3`
        : `Enviado a C3 - ${personasParaEnviar.length} persona(s) validada(s) enviada(s) para dictamen C3`;
      
      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) VALUES (?, ?, 'validacion_personal', 'enviado_c3', ?)`,
        [tramiteId, usuarioId, comentario]
      );

      const [tramiteActualizado] = await connection.query('SELECT * FROM tramites_alta WHERE id = ?', [tramiteId]);
      return tramiteActualizado[0];
    });
  }

  async obtenerPersonasPendientesC3(filtros = {}) {
    return await PersonaTramiteModel.findPendientesC3(filtros);
  }

  async emitirDictamenPersonaC3(personaId, usuarioId, dictamen, observaciones = null) {
    const persona = await PersonaTramiteModel.findByIdWithTramite(personaId);
    if (!persona) throw new Error('Persona no encontrada');
    if (persona.tramite_fase !== 'enviado_c3') throw new Error('El trámite no está en fase válida para dictamen C3');
    if (persona.rechazado || persona.observaciones_c3) throw new Error('Esta persona ya tiene un dictamen registrado');

    return await TramiteAltaModel.transaction(async (connection) => {
      const esAprobado = dictamen === 'ALTA OK';
      const esRechazado = dictamen === 'NO PUEDE SER DADO DE ALTA' || dictamen === 'PENDIENTE';
      const observacionesFinal = observaciones || (esAprobado ? 'Aprobado por C3' : `Dictamen C3: ${dictamen}`);

      if (esAprobado) {
        await connection.query(`UPDATE personas_tramite_alta SET observaciones_c3 = ?, updated_at = NOW() WHERE id = ?`, [observacionesFinal, personaId]);
      } else {
        await connection.query(`UPDATE personas_tramite_alta SET rechazado = TRUE, validado = FALSE, motivo_rechazo = ?, observaciones_c3 = ?, updated_at = NOW() WHERE id = ?`, [`Dictamen C3: ${dictamen}`, observacionesFinal, personaId]);
      }

      await connection.query(`UPDATE tramites_alta SET usuario_validador_c3_id = COALESCE(usuario_validador_c3_id, ?), updated_at = NOW() WHERE id = ?`, [usuarioId, persona.tramite_alta_id]);

      const [pendientes] = await connection.query(`SELECT COUNT(*) as count FROM personas_tramite_alta WHERE tramite_alta_id = ? AND validado = TRUE AND rechazado = FALSE AND observaciones_c3 IS NULL`, [persona.tramite_alta_id]);
      
      if (pendientes[0].count === 0) {
        const [stats] = await connection.query(`SELECT COUNT(CASE WHEN rechazado = FALSE AND observaciones_c3 IS NOT NULL THEN 1 END) as aprobadas, COUNT(CASE WHEN rechazado = TRUE THEN 1 END) as rechazadas FROM personas_tramite_alta WHERE tramite_alta_id = ? AND validado = TRUE`, [persona.tramite_alta_id]);
        const hayAprobadas = stats[0].aprobadas > 0;
        const faseNueva = hayAprobadas ? 'dictaminado_c3' : 'rechazado_c3';
        const estatusId = hayAprobadas ? 4 : 5;

        await connection.query(`UPDATE tramites_alta SET fase_actual = ?, estatus_id = ?, usuario_validador_c3_id = ?, updated_at = NOW() WHERE id = ?`, [faseNueva, estatusId, usuarioId, persona.tramite_alta_id]);
        await connection.query(`INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) VALUES (?, ?, 'enviado_c3', ?, ?)`, [persona.tramite_alta_id, usuarioId, faseNueva, `Dictamen C3 completado - ${stats[0].aprobadas} aprobada(s), ${stats[0].rechazadas} rechazada(s)`]);
      }

      const [personaActualizada] = await connection.query(`SELECT p.*, t.numero_solicitud, t.municipio_id, t.usuario_analista_c5_id, t.fase_actual as tramite_fase, m.nombre as municipio_nombre, pu.nombre as puesto_nombre, pu.es_competencia_municipal FROM personas_tramite_alta p INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id LEFT JOIN municipios m ON t.municipio_id = m.id LEFT JOIN puestos pu ON p.puesto_id = pu.id WHERE p.id = ?`, [personaId]);
      return personaActualizada[0];
    });
  }

  // ============================================
  // 🔥 CORRECCIÓN 1: JUSTICIA PARA RENATA (C3)
  // ============================================
  async obtenerHistorialC3(filtros = {}) {
    const where = [
      `(
        t.fase_actual IN ('dictaminado_c3', 'rechazado_c3', 'validado_c3', 'rechazado', 'rechazado_no_corresponde', 'revision_requisitos', 'validacion_cuip', 'cita_programada', 'finalizado')
        OR (
          t.fase_actual = 'enviado_c3'
          AND EXISTS (
            SELECT 1 FROM personas_tramite_alta px WHERE px.tramite_alta_id = t.id AND (px.rechazado = TRUE OR px.observaciones_c3 IS NOT NULL)
          )
        )
      )`
    ];
    const params = [];

    if (filtros.validador_id) { 
      where.push('(t.usuario_validador_c3_id = ? OR t.usuario_validador_c3_id IS NULL)'); 
      params.push(filtros.validador_id); 
    }
    if (filtros.fecha_inicio && filtros.fecha_fin) { 
      where.push('t.updated_at BETWEEN ? AND ?'); 
      params.push(filtros.fecha_inicio, filtros.fecha_fin); 
    }
    if (filtros.busqueda) { 
      where.push('(t.numero_solicitud LIKE ? OR m.nombre LIKE ? OR dep.nombre LIKE ? OR ua.nombre_completo LIKE ?)'); 
      const searchTerm = `%${filtros.busqueda}%`; 
      params.push(searchTerm, searchTerm, searchTerm, searchTerm); 
    }
    if (filtros.dictamen) { 
      where.push('t.fase_actual = ?'); 
      params.push(filtros.dictamen); 
    }

    const sql = `
      SELECT t.*, m.nombre as municipio_nombre, r.nombre as region_nombre, tof.nombre as tipo_oficio_nombre, dep.nombre as dependencia_nombre, ua.nombre_completo as analista_nombre, ua.extension as analista_extension, uv.nombre_completo as validador_c3_nombre
      FROM tramites_alta t
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN regiones r ON m.region_id = r.id
      LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id
      LEFT JOIN usuarios uv ON t.usuario_validador_c3_id = uv.id
      WHERE ${where.join(' AND ')} ORDER BY t.updated_at DESC
    `;
    
    const tramites = await TramiteAltaModel.query(sql, params);
    
    for (const tramite of tramites) {
      const stats = await PersonaTramiteModel.getEstadisticasTramite(tramite.id);
      tramite.personas_stats = stats;
      const personas = await PersonaTramiteModel.findByTramite(tramite.id);
      
      tramite.personas = personas.filter((persona) => {
        const observacionesC3 = typeof persona.observaciones_c3 === 'string' ? persona.observaciones_c3.trim() : '';
        const motivoRechazo = typeof persona.motivo_rechazo === 'string' ? persona.motivo_rechazo.trim() : '';
        return observacionesC3.length > 0 || motivoRechazo.startsWith('Dictamen C3:');
      }).map(persona => {
        const p = { ...persona };
        const motivo = p.motivo_rechazo || '';
        // Si C5 la rechazó posteriormente en Cita/CUIP/Revisión, a C3 no le importa, para ellos SÍ pasó.
        if (p.rechazado && !motivo.startsWith('Dictamen C3:')) {
          p.rechazado = 0; // Fingimos que no está rechazada para la vista de C3
        }
        return p;
      });
    }
    return tramites;
  }

  // ============================================
  // 🔥 CORRECCIÓN 2: JOSUE (CITA) Y BELÉN (FINALIZADO)
  // ============================================
  async obtenerTodasLasPersonasC5(filtros = {}) {
    const where = ['1=1'];
    const params = [];

    if (filtros.usuario_rol === 'analista') {
      where.push('(t.usuario_analista_c5_id = ? OR t.es_tramite_dependencia = TRUE)');
      params.push(filtros.usuario_id);
    }
    if (filtros.busqueda) {
      where.push('(p.nombre LIKE ? OR p.apellido_paterno LIKE ? OR p.apellido_materno LIKE ? OR t.numero_solicitud LIKE ?)');
      const searchTerm = `%${filtros.busqueda}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (filtros.fase_tramite) {
      where.push('t.fase_actual = ?');
      params.push(filtros.fase_tramite);
    }
    if (filtros.estatus_persona) {
      if (filtros.estatus_persona === 'validado') where.push('p.validado = TRUE');
      else if (filtros.estatus_persona === 'rechazado') where.push('p.rechazado = TRUE');
      else if (filtros.estatus_persona === 'pendiente') where.push('p.validado = FALSE AND p.rechazado = FALSE');
    }
    if (filtros.municipio_id) {
      where.push('t.municipio_id = ?');
      params.push(filtros.municipio_id);
    }
    if (filtros.municipio_nombre) {
      where.push('m.nombre LIKE ?');
      params.push(`%${filtros.municipio_nombre}%`);
    }

    const sql = `
      SELECT 
        p.id, p.tramite_alta_id, p.nombre, p.apellido_paterno, p.apellido_materno,
        p.fecha_nacimiento, p.numero_oficio_c3, p.puesto_id, p.validado, p.rechazado,
        p.motivo_rechazo, p.observaciones_c3, p.puesto_propuesto_c3_id, p.fase_revision,
        p.fase_cuip, p.created_at, p.updated_at,
        CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo,
        t.numero_solicitud, t.fase_actual as tramite_fase, t.es_tramite_dependencia,
        t.proceso_movimiento, t.fecha_solicitud, t.usuario_analista_c5_id,
        pu.nombre as puesto_original_nombre, pu.es_competencia_municipal as puesto_original_es_municipal,
        pp.nombre as puesto_propuesto_nombre, m.nombre as municipio_nombre,
        dep.nombre as dependencia_nombre, ua.nombre_completo as analista_nombre,
        uv.nombre_completo as validador_c3_nombre,
        
        CASE 
          WHEN p.rechazado = TRUE AND p.motivo_rechazo LIKE 'Dictamen C3:%' THEN 'Rechazado por C3'
          WHEN p.rechazado = TRUE AND (p.motivo_rechazo LIKE 'Cita cancelada%' OR p.motivo_rechazo LIKE 'No asistió%') THEN 'Rechazado en Cita'
          WHEN p.rechazado = TRUE AND p.fase_cuip = 'rechazado_cuip' THEN 'Rechazado en CUIP'
          WHEN p.rechazado = TRUE AND p.fase_revision = 'rechazado_revision' THEN 'Rechazado en Revisión'
          WHEN p.rechazado = TRUE THEN 'Rechazado'
          
          WHEN p.fase_cuip = 'en_proceso' THEN 'CUIP en proceso'
          WHEN p.fase_revision = 'completado' THEN 'Revisión Completa'
          WHEN p.fase_revision IN ('en_proceso', 'antecedentes', 'documentos') THEN 'Revisión en Proceso'
          
          WHEN p.validado = TRUE AND p.observaciones_c3 IS NOT NULL THEN 'Aprobado por C3'
          WHEN p.validado = TRUE AND t.fase_actual = 'enviado_c3' THEN 'Pendiente dictamen C3'
          WHEN t.fase_actual = 'rechazado_c3' THEN 'Rechazado por C3'
          WHEN t.fase_actual = 'datos_solicitud' THEN 'En captura'
          WHEN t.fase_actual = 'validacion_personal' THEN 'En validación C5'
          ELSE 'Pendiente'
        END as estatus_descriptivo,

        CASE
          WHEN p.rechazado = TRUE THEN 'ver_rechazados'
          WHEN p.fase_cuip = 'en_proceso' THEN 'persona_en_cuip'
          WHEN p.fase_revision = 'completado' AND (p.fase_cuip IS NULL OR p.fase_cuip = 'pendiente') THEN 'revision_completada'
          WHEN p.fase_revision IN ('en_proceso', 'antecedentes', 'documentos') THEN 'persona_en_revision'
          WHEN p.validado = TRUE
            AND p.rechazado = FALSE
            AND p.observaciones_c3 IS NOT NULL
            AND (p.fase_revision IS NULL OR p.fase_revision = 'pendiente')
            AND (p.fase_cuip IS NULL OR p.fase_cuip = 'pendiente')
          THEN 'revision_requisitos'
          ELSE 'pendiente'
        END as accion_disponible
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN puestos pp ON p.puesto_propuesto_c3_id = pp.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id
      LEFT JOIN usuarios uv ON t.usuario_validador_c3_id = uv.id
      WHERE ${where.join(' AND ')}
      ORDER BY t.created_at DESC, p.created_at ASC
    `;

    const personas = await TramiteAltaModel.query(sql, params);

    // MAGIA JS PARA FINALIZADOS/CITAS (Sin tocar las columnas)
    try {
      const tramiteIds = [...new Set(personas.map(p => p.tramite_alta_id))];
      if (tramiteIds.length > 0) {
        const idsStr = tramiteIds.join(',');
        let finalizadosRows = [];
        let citasRows = [];
        
        try { citasRows = await TramiteAltaModel.query(`SELECT * FROM citas_biometricas WHERE tramite_alta_id IN (${idsStr})`); } catch (e) { }
        try { finalizadosRows = await TramiteAltaModel.query(`SELECT * FROM finalizados WHERE tramite_alta_id IN (${idsStr})`); } catch (e) { }

        personas.forEach(p => {
          if (p.rechazado) return;

          if (p.fase_cuip === 'completado') {
            const isFinalizado = finalizadosRows.some(row => Object.values(row).includes(p.id));
            if (isFinalizado) {
              p.estatus_descriptivo = 'Finalizado';
              p.accion_disponible = 'finalizado';
              return;
            }

            const isCita = citasRows.some(row => Object.values(row).includes(p.id));
            if (isCita) {
              p.estatus_descriptivo = 'Cita Programada';
              p.accion_disponible = 'cita_programada';
              return;
            }
            
            p.estatus_descriptivo = 'Validación CUIP Completada';
            p.accion_disponible = 'revision_completada';
          }
        });
      }
    } catch (error) {
      console.error('Error procesando Citas/Finalizados:', error.message);
    }

    return personas;
  }

  async obtenerTramitesConRechazosC3(filtros = {}) {
    const where = ["t.fase_actual = 'rechazos_c3'"];
    const params = [];

    if (filtros.usuario_rol === 'analista') {
      where.push('(t.usuario_analista_c5_id = ? OR t.es_tramite_dependencia = TRUE)');
      params.push(filtros.usuario_id);
    } else if (!['admin', 'super_admin'].includes(filtros.usuario_rol)) {
      where.push('t.usuario_analista_c5_id = ?');
      params.push(filtros.usuario_id);
    }

    if (filtros.busqueda) {
      where.push('(t.numero_solicitud LIKE ? OR m.nombre LIKE ? OR dep.nombre LIKE ? OR r.nombre LIKE ? OR uv.nombre_completo LIKE ?)');
      const searchTerm = `%${filtros.busqueda}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const sql = `
      SELECT t.*, m.nombre as municipio_nombre, r.nombre as region_nombre, tof.nombre as tipo_oficio_nombre, dep.nombre as dependencia_nombre, ua.nombre_completo as analista_nombre, uv.nombre_completo as validador_c3_nombre
      FROM tramites_alta t
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN regiones r ON m.region_id = r.id
      LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id
      LEFT JOIN usuarios uv ON t.usuario_validador_c3_id = uv.id
      WHERE ${where.join(' AND ')} ORDER BY t.updated_at DESC
    `;

    const tramites = await TramiteAltaModel.query(sql, params);
    for (const tramite of tramites) {
      const personas = await PersonaTramiteModel.findByTramite(tramite.id);
      tramite.personas = personas;
      tramite.total_rechazadas = personas.filter(p => p.rechazado).length;
      tramite.total_validadas = personas.filter(p => p.validado && !p.rechazado).length;
    }
    return tramites;
  }

  async obtenerPersonasRechazadas(filtros = {}) {
    const where = ['p.rechazado = TRUE'];
    const params = [];

    if (filtros.usuario_rol === 'analista') {
      where.push('t.usuario_analista_c5_id = ?');
      params.push(filtros.usuario_id);
    } else if (filtros.usuario_rol === 'validador_c3') {
      where.push('(t.usuario_validador_c3_id = ? OR t.usuario_validador_c3_id IS NULL)');
      params.push(filtros.usuario_id);
    }

    if (filtros.analista_id && ['admin', 'super_admin', 'coordinador', 'direccion'].includes(filtros.usuario_rol)) {
      where.push('t.usuario_analista_c5_id = ?');
      params.push(Number(filtros.analista_id));
    }

    if (filtros.fecha_inicio) { where.push('p.updated_at >= ?'); params.push(filtros.fecha_inicio); }
    if (filtros.fecha_fin) { where.push('p.updated_at <= ?'); params.push(`${filtros.fecha_fin} 23:59:59`); }
    if (filtros.busqueda) {
      where.push('(p.nombre LIKE ? OR p.apellido_paterno LIKE ? OR p.apellido_materno LIKE ? OR t.numero_solicitud LIKE ? OR m.nombre LIKE ? OR dep.nombre LIKE ?)');
      const s = `%${filtros.busqueda}%`;
      params.push(s, s, s, s, s, s);
    }

    if (filtros.etapa_rechazo) {
      switch (filtros.etapa_rechazo) {
        case 'competencia': where.push('pu.es_competencia_municipal = FALSE'); break;
        case 'c3': where.push("p.motivo_rechazo LIKE 'Dictamen C3:%'"); break;
        case 'revision': where.push("p.fase_revision = 'rechazado_revision'"); break;
        case 'cuip': where.push("p.fase_cuip = 'rechazado_cuip'"); break;
        case 'cita': where.push("(p.motivo_rechazo LIKE 'No asistió a la cita biométrica%' OR p.motivo_rechazo LIKE 'Cita cancelada/reagendada:%')"); break;
        case 'c5':
          where.push("pu.es_competencia_municipal = TRUE");
          where.push("p.motivo_rechazo NOT LIKE 'Dictamen C3:%'");
          where.push("p.fase_revision <> 'rechazado_revision'");
          where.push("p.fase_cuip <> 'rechazado_cuip'");
          where.push("p.motivo_rechazo NOT LIKE 'No asistió a la cita biométrica%'");
          where.push("p.motivo_rechazo NOT LIKE 'Cita cancelada/reagendada:%'");
          break;
      }
    }

    const countSql = `SELECT COUNT(*) as total FROM personas_tramite_alta p INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id LEFT JOIN puestos pu ON p.puesto_id = pu.id LEFT JOIN municipios m ON t.municipio_id = m.id LEFT JOIN dependencias dep ON t.dependencia_id = dep.id WHERE ${where.join(' AND ')}`;
    const countResult = await TramiteAltaModel.query(countSql, params);
    const total = countResult[0]?.total || 0;

    const page = parseInt(filtros.page) || 1;
    const limit = parseInt(filtros.limit) || 15;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT p.id, p.nombre, p.apellido_paterno, p.apellido_materno, CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo, p.fecha_nacimiento, p.numero_oficio_c3, p.motivo_rechazo, p.observaciones_c3, p.created_at, p.updated_at, p.tramite_alta_id, t.numero_solicitud, t.fase_actual as fase_tramite, t.fecha_solicitud, t.es_tramite_dependencia, pu.nombre as puesto_solicitado, pu.es_competencia_municipal, pu.motivo_no_competencia, m.nombre as municipio_nombre, r.nombre as region_nombre, dep.nombre as dependencia_nombre, ua.nombre_completo as analista_nombre, uv.nombre_completo as validador_c3_nombre,
        CASE 
          WHEN pu.es_competencia_municipal = FALSE THEN 'competencia'
          WHEN p.fase_cuip = 'rechazado_cuip' THEN 'cuip'
          WHEN p.fase_revision = 'rechazado_revision' THEN 'revision'
          WHEN p.motivo_rechazo LIKE 'No asistió a la cita biométrica%' OR p.motivo_rechazo LIKE 'Cita cancelada/reagendada:%' THEN 'cita'
          WHEN p.motivo_rechazo LIKE 'Dictamen C3:%' THEN 'c3'
          ELSE 'c5'
        END as etapa_rechazo_codigo,
        CASE 
          WHEN pu.es_competencia_municipal = FALSE THEN 'Filtro de Competencia'
          WHEN p.fase_cuip = 'rechazado_cuip' THEN 'Validacion CUIP'
          WHEN p.fase_revision = 'rechazado_revision' THEN 'Revision Documental'
          WHEN p.motivo_rechazo LIKE 'No asistió a la cita biométrica%' OR p.motivo_rechazo LIKE 'Cita cancelada/reagendada:%' THEN 'Cita Biometrica'
          WHEN p.motivo_rechazo LIKE 'Dictamen C3:%' THEN 'Validacion C3'
          ELSE 'Validacion C5'
        END as etapa_rechazo,
        CASE 
          WHEN pu.es_competencia_municipal = FALSE THEN COALESCE(NULLIF(TRIM(pu.motivo_no_competencia), ''), 'No corresponde por competencia municipal')
          WHEN p.fase_cuip = 'rechazado_cuip' THEN COALESCE(NULLIF(TRIM(p.motivo_rechazo), ''), 'Sin motivo especificado')
          WHEN p.fase_revision = 'rechazado_revision' THEN COALESCE(NULLIF(TRIM(p.motivo_rechazo), ''), 'Sin motivo especificado')
          WHEN p.motivo_rechazo LIKE 'No asistió a la cita biométrica%' OR p.motivo_rechazo LIKE 'Cita cancelada/reagendada:%' THEN COALESCE(NULLIF(TRIM(p.motivo_rechazo), ''), 'Sin motivo especificado')
          WHEN p.motivo_rechazo LIKE 'Dictamen C3:%' THEN COALESCE(NULLIF(TRIM(p.observaciones_c3), ''), NULLIF(TRIM(p.motivo_rechazo), ''), 'Sin motivo especificado')
          ELSE COALESCE(NULLIF(TRIM(p.motivo_rechazo), ''), NULLIF(TRIM(p.observaciones_c3), ''), 'Sin motivo especificado')
        END as motivo_especifico
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN regiones r ON m.region_id = r.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id
      LEFT JOIN usuarios uv ON t.usuario_validador_c3_id = uv.id
      WHERE ${where.join(' AND ')}
      ORDER BY p.updated_at DESC
      LIMIT ? OFFSET ?
    `;
    const personas = await TramiteAltaModel.query(sql, [...params, limit, offset]);
    return { personas, paginacion: { total, pagina: page, limite: limit, total_paginas: Math.ceil(total / limit) } };
  }

  async actualizarMotivoRechazo(personaId, nuevoMotivo, usuarioId) {
    if (!nuevoMotivo || nuevoMotivo.trim() === '') throw new Error('El motivo de rechazo no puede estar vacío');
    const persona = await PersonaTramiteModel.findByIdWithTramite(personaId);
    if (!persona) throw new Error('Persona no encontrada');
    if (!persona.rechazado) throw new Error('Esta persona no está rechazada');

    const esRechazoC3 = String(persona.motivo_rechazo || '').startsWith('Dictamen C3:');
    const updates = { updated_at: new Date() };

    if (esRechazoC3) updates.observaciones_c3 = nuevoMotivo.trim();
    updates.motivo_rechazo = nuevoMotivo.trim();

    await PersonaTramiteModel.update(personaId, updates);
    await HistorialModel.registrar(persona.tramite_alta_id, usuarioId, persona.tramite_fase || 'rechazado', persona.tramite_fase || 'rechazado', `Motivo de rechazo actualizado para ${persona.nombre} ${persona.apellido_paterno}: "${nuevoMotivo.trim()}"`);
    return { success: true, message: 'Motivo actualizado correctamente' };
  }

  async generarOficioRechazo(personaId) {
    const sql = `
      SELECT p.id, p.nombre, p.apellido_paterno, p.apellido_materno, CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo, p.fecha_nacimiento, p.motivo_rechazo, p.observaciones_c3, p.numero_oficio_c3, p.updated_at as fecha_rechazo, t.numero_solicitud, t.fecha_solicitud, t.es_tramite_dependencia, pu.nombre as puesto_solicitado, pu.es_competencia_municipal, pu.motivo_no_competencia, m.nombre as municipio_nombre, r.nombre as region_nombre, dep.nombre as dependencia_nombre, ua.nombre_completo as analista_nombre, uv.nombre_completo as validador_c3_nombre,
        CASE 
          WHEN pu.es_competencia_municipal = FALSE THEN 'Filtro de Competencia'
          WHEN p.fase_cuip = 'rechazado_cuip' THEN 'Validacion CUIP'
          WHEN p.fase_revision = 'rechazado_revision' THEN 'Revision Documental'
          WHEN p.motivo_rechazo LIKE 'No asistió a la cita biométrica%' OR p.motivo_rechazo LIKE 'Cita cancelada/reagendada:%' THEN 'Cita Biometrica'
          WHEN p.motivo_rechazo LIKE 'Dictamen C3:%' THEN 'Validacion C3'
          ELSE 'Validacion C5'
        END as etapa_rechazo,
        CASE 
          WHEN pu.es_competencia_municipal = FALSE THEN COALESCE(NULLIF(TRIM(pu.motivo_no_competencia), ''), 'No corresponde por competencia municipal')
          WHEN p.fase_cuip = 'rechazado_cuip' THEN COALESCE(NULLIF(TRIM(p.motivo_rechazo), ''), 'Sin motivo especificado')
          WHEN p.fase_revision = 'rechazado_revision' THEN COALESCE(NULLIF(TRIM(p.motivo_rechazo), ''), 'Sin motivo especificado')
          WHEN p.motivo_rechazo LIKE 'No asistió a la cita biométrica%' OR p.motivo_rechazo LIKE 'Cita cancelada/reagendada:%' THEN COALESCE(NULLIF(TRIM(p.motivo_rechazo), ''), 'Sin motivo especificado')
          WHEN p.motivo_rechazo LIKE 'Dictamen C3:%' THEN COALESCE(NULLIF(TRIM(p.observaciones_c3), ''), NULLIF(TRIM(p.motivo_rechazo), ''), 'Sin motivo especificado')
          ELSE COALESCE(NULLIF(TRIM(p.motivo_rechazo), ''), NULLIF(TRIM(p.observaciones_c3), ''), 'Sin motivo especificado')
        END as motivo_especifico
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN regiones r ON m.region_id = r.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id
      LEFT JOIN usuarios uv ON t.usuario_validador_c3_id = uv.id
      WHERE p.id = ? AND p.rechazado = TRUE
    `;

    const personas = await TramiteAltaModel.query(sql, [personaId]);
    if (personas.length === 0) throw new Error('Persona rechazada no encontrada');

    const p = personas[0];
    const fechaRechazo = new Date(p.fecha_rechazo);
    const fechaHoy = new Date();

    return {
      oficio: { numero_solicitud: p.numero_solicitud, numero_oficio_c3: p.numero_oficio_c3 || '', fecha_emision: fechaHoy.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), fecha_emision_iso: fechaHoy.toISOString() },
      persona: { id: p.id, nombre_completo: p.nombre_completo, fecha_nacimiento: p.fecha_nacimiento ? new Date(p.fecha_nacimiento).toLocaleDateString('es-MX') : 'No registrada', puesto_solicitado: p.puesto_solicitado },
      rechazo: { etapa: p.etapa_rechazo, motivo: p.motivo_especifico || p.motivo_rechazo || 'Sin especificar', fecha: fechaRechazo.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), fecha_iso: p.fecha_rechazo },
      contexto: { municipio: p.municipio_nombre || 'No aplica', region: p.region_nombre || 'No aplica', dependencia: p.dependencia_nombre || 'No aplica', es_dependencia: p.es_tramite_dependencia ? true : false, analista: p.analista_nombre || 'No asignado', validador_c3: p.validador_c3_nombre || 'No asignado' }
    };
  }

  async obtenerTramitesDependencias(filtros = {}) {
    if (!['admin', 'analista', 'super_admin'].includes(filtros.usuario_rol)) throw new Error('Solo usuarios de C5 pueden acceder a esta información');
    const where = ['t.es_tramite_dependencia = TRUE'];
    const params = [];
    if (filtros.fase_actual) { where.push('t.fase_actual = ?'); params.push(filtros.fase_actual); }
    if (filtros.dependencia_id) { where.push('t.dependencia_id = ?'); params.push(filtros.dependencia_id); }

    const sql = `SELECT t.id, t.numero_solicitud, t.tipo_oficio_id, t.municipio_id, t.dependencia_id, t.fase_actual, t.estatus_id, t.fecha_solicitud, t.created_at, t.updated_at, t.observaciones, tof.nombre as tipo_oficio_nombre, m.nombre as municipio_nombre, dep.nombre as dependencia_nombre, est.nombre as estatus_nombre, u.nombre_completo as creado_por FROM tramites_alta t LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id LEFT JOIN municipios m ON t.municipio_id = m.id LEFT JOIN dependencias dep ON t.dependencia_id = dep.id LEFT JOIN estatus_solicitudes est ON t.estatus_id = est.id LEFT JOIN usuarios u ON t.usuario_analista_c5_id = u.id WHERE ${where.join(' AND ')} ORDER BY t.created_at DESC`;
    const tramites = await TramiteAltaModel.query(sql, params);

    for (const tramite of tramites) {
      const stats = await PersonaTramiteModel.getEstadisticasTramite(tramite.id);
      tramite.total_personas = stats.total || 0;
      tramite.personas_aprobadas = stats.aprobados_c3 || 0;
      tramite.personas_rechazadas = stats.rechazados_c3 || 0;
      tramite.personas_pendientes = stats.pendientes_c3 || 0;
    }
    return tramites;
  }

  async obtenerDashboardMunicipios(analistaId) { return await DashboardMunicipioModel.findByAnalista(analistaId); }
  async agregarMunicipioDashboard(analistaId, regionId, municipioId) {
    const municipioValido = await MunicipioModel.belongsToRegion(municipioId, regionId);
    if (!municipioValido) throw new Error('El municipio no pertenece a tu región asignada');
    return await DashboardMunicipioModel.agregar(analistaId, municipioId);
  }
  async eliminarMunicipioDashboard(analistaId, municipioId) {
    const tieneTramites = await DashboardMunicipioModel.tieneTramitesIniciados(analistaId, municipioId);
    if (tieneTramites) throw new Error('No puedes eliminar este municipio porque tiene trámites iniciados. Completa o cancela los trámites primero.');
    const result = await DashboardMunicipioModel.eliminarByAnalistaMunicipio(analistaId, municipioId);
    if (result.affectedRows === 0) throw new Error('El municipio no está en tu dashboard');
    return { success: true };
  }
  async obtenerMunicipiosDisponibles(analistaId, regionId) { return await DashboardMunicipioModel.getMunicipiosDisponibles(analistaId, regionId); }
  
  async obtenerEstadisticasAnalista(analistaId) {
    const [estadisticas, dashboard] = await Promise.all([TramiteAltaModel.getEstadisticasAnalista(analistaId), DashboardMunicipioModel.findByAnalista(analistaId)]);
    return { tramites: estadisticas, municipios_dashboard: dashboard.length, municipios_con_tramites: dashboard.filter(m => m.tramites_activos > 0).length };
  }

  async obtenerTramitesPendientesC3(filtros = {}) {
    const where = ["t.fase_actual IN ('enviado_c3', 'dictaminado_c3', 'rechazado_c3', 'validado_c3', 'rechazado', 'rechazado_no_corresponde')"];
    const params = [];
    if (filtros.tramite_id) { where.push('t.id = ?'); params.push(filtros.tramite_id); }
    if (filtros.busqueda) { where.push("(t.numero_solicitud LIKE ? OR m.nombre LIKE ? OR dep.nombre LIKE ?)"); const searchTerm = `%${filtros.busqueda}%`; params.push(searchTerm, searchTerm, searchTerm); }
    const sql = `SELECT t.*, m.nombre as municipio_nombre, r.nombre as region_nombre, tof.nombre as tipo_oficio_nombre, dep.nombre as dependencia_nombre, ua.nombre_completo as analista_nombre, ua.extension as analista_extension, uv.nombre_completo as validador_c3_nombre FROM tramites_alta t LEFT JOIN municipios m ON t.municipio_id = m.id LEFT JOIN regiones r ON m.region_id = r.id LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id LEFT JOIN dependencias dep ON t.dependencia_id = dep.id LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id LEFT JOIN usuarios uv ON t.usuario_validador_c3_id = uv.id WHERE ${where.join(' AND ')} ORDER BY t.created_at DESC`;
    return await TramiteAltaModel.query(sql, params);
  }

  async agregarPersona(tramiteId, usuarioId, datosPersona) {
    const tramite = await TramiteAltaModel.findById(tramiteId);
    if (!tramite) throw new Error('Trámite no encontrado');
    if (tramite.usuario_analista_c5_id !== usuarioId) throw new Error('No tienes permiso para modificar este trámite');

    return await TramiteAltaModel.transaction(async (connection) => {
      const datosPersonaNormalizados = {
        ...datosPersona,
        nombre: normalizarNombrePersona(datosPersona?.nombre),
        apellido_paterno: normalizarNombrePersona(datosPersona?.apellido_paterno),
        apellido_materno: normalizarNombrePersona(datosPersona?.apellido_materno),
        numero_oficio_c3: normalizarNumeroOficioC3(datosPersona?.numero_oficio_c3)
      };

      if (!tramite.es_tramite_dependencia && datosPersonaNormalizados.puesto_id) {
        const [puestoInfo] = await connection.query('SELECT nombre, es_competencia_municipal, motivo_no_competencia FROM puestos WHERE id = ?', [datosPersonaNormalizados.puesto_id]);
        if (puestoInfo.length > 0 && !puestoInfo[0].es_competencia_municipal) {
          throw new Error(`NO CORRESPONDE A COMPETENCIA MUNICIPAL: El puesto no puede ser dado de alta por C5.`);
        }
      }

      const [result] = await connection.query(
        'INSERT INTO personas_tramite_alta SET ?',
        [{ tramite_alta_id: tramiteId, ...datosPersonaNormalizados, validado: false, rechazado: false }]
      );

      if (tramite.fase_actual === 'datos_solicitud') {
        await connection.query(`UPDATE tramites_alta SET fase_actual = 'validacion_personal' WHERE id = ?`, [tramiteId]);
      }

      const [persona] = await connection.query('SELECT * FROM personas_tramite_alta WHERE id = ?', [result.insertId]);
      return persona[0];
    });
  }

  async editarPersona(personaId, usuarioId, datosPersona) {
    const persona = await PersonaTramiteModel.findByIdWithTramite(personaId);
    if (!persona) throw new Error('Persona no encontrada');
    if (persona.usuario_analista_c5_id !== usuarioId) throw new Error('No tienes permiso para editar esta persona');
    if (persona.validado || persona.rechazado) throw new Error('Solo se pueden editar personas pendientes');

    const camposPermitidos = ['nombre', 'apellido_paterno', 'apellido_materno', 'fecha_nacimiento', 'numero_oficio_c3', 'puesto_id'];
    const updates = {};
    camposPermitidos.forEach((campo) => {
      if (datosPersona[campo] !== undefined) {
        if (campo === 'numero_oficio_c3') updates[campo] = normalizarNumeroOficioC3(datosPersona[campo]);
        else if (['nombre', 'apellido_paterno', 'apellido_materno'].includes(campo)) updates[campo] = normalizarNombrePersona(datosPersona[campo]);
        else updates[campo] = datosPersona[campo];
      }
    });

    if (Object.keys(updates).length === 0) throw new Error('No se enviaron campos para actualizar');
    return await PersonaTramiteModel.update(personaId, updates);
  }

  async validarPersona(personaId, usuarioId) {
    const persona = await PersonaTramiteModel.findByIdWithTramite(personaId);
    if (!persona) throw new Error('Persona no encontrada');
    if (persona.usuario_analista_c5_id !== usuarioId) throw new Error('No tienes permiso para validar esta persona');
    if (persona.rechazado) throw new Error('No se puede validar una persona rechazada');

    const nuevoEstadoValidado = !Boolean(persona.validado);
    return await PersonaTramiteModel.update(personaId, { validado: nuevoEstadoValidado, rechazado: false, motivo_rechazo: null });
  }

  async rechazarPersona(personaId, usuarioId, motivoRechazo) {
    const persona = await PersonaTramiteModel.findByIdWithTramite(personaId);
    if (!persona) throw new Error('Persona no encontrada');
    if (persona.usuario_analista_c5_id !== usuarioId) throw new Error('No tienes permiso para rechazar esta persona');
    if (!motivoRechazo) throw new Error('Debes proporcionar un motivo de rechazo');
    if (persona.rechazado) throw new Error('La persona ya fue rechazada y no se puede deshacer');

    return await TramiteAltaModel.transaction(async (connection) => {
      await connection.query(`UPDATE personas_tramite_alta SET rechazado = TRUE, validado = FALSE, motivo_rechazo = ?, updated_at = NOW() WHERE id = ?`, [motivoRechazo, personaId]);
      const nombrePersona = [persona.nombre, persona.apellido_paterno, persona.apellido_materno].filter(Boolean).join(' ').trim();
      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) VALUES (?, ?, ?, ?, ?)`,
        [persona.tramite_alta_id, usuarioId, persona.tramite_fase || 'validacion_personal', persona.tramite_fase || 'validacion_personal', `Persona rechazada en validación de personal: ${nombrePersona || `ID ${personaId}`}. Motivo: ${motivoRechazo}`]
      );
      const [actualizada] = await connection.query('SELECT * FROM personas_tramite_alta WHERE id = ?', [personaId]);
      return actualizada[0];
    });
  }

  async emitirDecisionFinalC5_DEPRECATED() {
    throw new Error('Función eliminada del flujo actual');
  }
}

export default new TramiteAltaService();