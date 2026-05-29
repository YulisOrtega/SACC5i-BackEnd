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

const normalizarNombrePersona = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return '';
  return String(value).trim().toUpperCase();
};

const normalizarNumeroOficioC3 = normalizarNumeroOficio;
const normalizarNumeroOficioC5 = normalizarNumeroOficio;

/**
 * TramiteAltaService - Lógica de negocio para trámites de alta
 * Centraliza operaciones complejas, validaciones y transacciones
 */
class TramiteAltaService {
  /**
   * PASO 1: Crear nueva solicitud de alta
   */
  async crearSolicitud(usuarioId, regionId, datos) {
    // Validar que el municipio pertenezca a la región del analista (si no es dependencia)
    if (!datos.es_tramite_dependencia) {
      const municipioValido = await MunicipioModel.belongsToRegion(
        datos.municipio_id,
        regionId
      );

      if (!municipioValido) {
        throw new Error('El municipio no pertenece a tu región asignada');
      }
    }

    // Verificar duplicados (no crítico, pero útil)
    if (datos.fecha_solicitud) {
      const existeDuplicado = await TramiteAltaModel.existsTramiteDuplicado(
        datos.municipio_id,
        datos.fecha_solicitud
      );

      if (existeDuplicado) {
        console.warn('Advertencia: Ya existe una solicitud similar para este municipio');
      }
    }

    // Usar transacción para crear solicitud + historial
    return await TramiteAltaModel.transaction(async (connection) => {
      // Serializa la generación de consecutivo por usuario para evitar choques concurrentes.
      await connection.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuarioId]);

      // Generar número de solicitud por usuario analista
      const numero_solicitud = await TramiteAltaModel.generarNumeroSolicitud(usuarioId, connection);

      // Preparar datos de la solicitud
      const datosSolicitud = {
        numero_solicitud,
        usuario_analista_c5_id: usuarioId,
        tipo_oficio_id: datos.tipo_oficio_id,
        municipio_id: datos.municipio_id,
        fecha_solicitud: datos.fecha_solicitud || new Date().toISOString().split('T')[0],
        proceso_movimiento: 'ALTA',
        fase_actual: 'datos_solicitud',
        estatus_id: 1, // Pendiente
        es_tramite_dependencia: datos.es_tramite_dependencia || false
      };

      // Campos opcionales
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

      // Crear solicitud
      const [result] = await connection.query(
        `INSERT INTO tramites_alta SET ?`,
        [datosSolicitud]
      );

      const solicitudId = result.insertId;

      // Crear entrada en historial
      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
         VALUES (?, ?, NULL, 'datos_solicitud', 'Solicitud creada - Solicitud inicializada - Paso 1')`,
        [solicitudId, usuarioId]
      );

      // Obtener solicitud completa
      const [solicitud] = await connection.query(
        'SELECT * FROM tramites_alta WHERE id = ?',
        [solicitudId]
      );

      return solicitud[0];
    });
  }

  /**
   * Obtener solicitudes del analista con filtros
   */
  async obtenerSolicitudesAnalista(analistaId, filtros = {}) {
    return await TramiteAltaModel.findByAnalistaWithDetails(analistaId, filtros);
  }

  /**
   * Obtener una solicitud por ID con validación de permisos
   */
  async obtenerSolicitudPorId(tramiteId, usuarioId, usuarioRol) {
    const tramite = await TramiteAltaModel.findByIdWithDetails(tramiteId);

    if (!tramite) {
      throw new Error('Trámite no encontrado');
    }

    // Validar permisos: el trámite debe pertenecer al analista O ser un trámite de dependencia
    // (excepto admin y validadores que ven todo)
    if (usuarioRol === 'analista' &&
        tramite.usuario_analista_c5_id !== usuarioId &&
        !tramite.es_tramite_dependencia) {
      throw new Error('No tienes permiso para ver este trámite');
    }

    // Obtener personas y historial
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

  /**
   * Eliminar borrador no enviado a C3
   * Solo permite borrar trámites en fase de captura/validación previa a envío
   */
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
          `SELECT 1
           FROM information_schema.tables
           WHERE table_schema = DATABASE()
           AND table_name = ?
           LIMIT 1`,
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

  /**
   * PASO 2: Agregar personas al trámite
   */
  async agregarPersonas(tramiteId, usuarioId, personas) {
    // Verificar que el trámite existe y pertenece al analista
    const tramite = await TramiteAltaModel.findById(tramiteId);
    if (!tramite) {
      throw new Error('Trámite no encontrado');
    }

    if (tramite.usuario_analista_c5_id !== usuarioId) {
      throw new Error('No tienes permiso para modificar este trámite');
    }

    // Validar fase
    if (tramite.fase_actual !== 'datos_solicitud' && tramite.fase_actual !== 'validacion_personal') {
      throw new Error('No se pueden agregar personas en la fase actual del trámite');
    }

    // Usar transacción para agregar múltiples personas
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

        // Verificar CURP duplicado en el trámite usando la conexión de la transacción
        const [existing] = await connection.query(
          'SELECT COUNT(*) as count FROM personas_tramite_alta WHERE tramite_alta_id = ? AND curp = ?',
          [tramiteId, personaNormalizada.curp]
        );
        if (existing[0].count > 0) {
          throw new Error(`El CURP ${personaNormalizada.curp} ya está registrado en este trámite`);
        }

        // Insertar persona
        const [result] = await connection.query(
          `INSERT INTO personas_tramite_alta SET ?`,
          [{
            tramite_alta_id: tramiteId,
            ...personaNormalizada
          }]
        );

        personasCreadas.push({ id: result.insertId, ...personaNormalizada });
      }

      // Actualizar fase si es necesario
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

  /**
   * PASO 3: Enviar solicitud a C3
   */
  async enviarSolicitudAC3(tramiteId, usuarioId) {
    const tramite = await TramiteAltaModel.findById(tramiteId);
    if (!tramite) {
      throw new Error('Trámite no encontrado');
    }

    const esDependencia = tramite.es_tramite_dependencia === 1 || tramite.es_tramite_dependencia === true;

    // Validar permisos: el usuario que creó el trámite (analista C5 o dependencia) es el único que puede enviarlo
    if (tramite.usuario_analista_c5_id !== usuarioId) {
      throw new Error('No tienes permiso para modificar este trámite');
    }

    // Validar que tenga personas agregadas
    const personas = await PersonaTramiteModel.findByTramite(tramiteId);
    if (personas.length === 0) {
      throw new Error('Debe agregar al menos una persona antes de enviar a C3');
    }

    // Validar fase actual
    if (tramite.fase_actual !== 'validacion_personal') {
      throw new Error('El trámite debe estar en fase de validación de personal');
    }

    // Para dependencias: no se requiere validación previa, se envían tal cual
    // Para analistas C5: se requiere al menos una persona validada
    let personasParaEnviar;
    if (esDependencia) {
      // Dependencia envía todas las personas sin validar
      personasParaEnviar = personas.filter(p => !p.rechazado);
      if (personasParaEnviar.length === 0) {
        throw new Error('No hay personas disponibles para enviar a C3');
      }
    } else {
      personasParaEnviar = personas.filter(p => p.validado && !p.rechazado);
      if (personasParaEnviar.length === 0) {
        throw new Error('Debe haber al menos una persona validada para enviar a C3');
      }
    }

    // Usar transacción
    return await TramiteAltaModel.transaction(async (connection) => {
      // Para dependencias: marcar personas como validadas automáticamente al enviar
      if (esDependencia) {
        await connection.query(
          `UPDATE personas_tramite_alta SET validado = TRUE, updated_at = NOW() 
           WHERE tramite_alta_id = ? AND rechazado = FALSE`,
          [tramiteId]
        );
      }

      // Actualizar fase del trámite y estatus a "En Proceso"
      await connection.query(
        `UPDATE tramites_alta SET fase_actual = 'enviado_c3', estatus_id = 2, updated_at = NOW() WHERE id = ?`,
        [tramiteId]
      );

      // Registrar en historial
      const comentario = esDependencia 
        ? `Enviado a C3 por dependencia - ${personasParaEnviar.length} persona(s) enviada(s) para dictamen C3`
        : `Enviado a C3 - ${personasParaEnviar.length} persona(s) validada(s) enviada(s) para dictamen C3`;
      
      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
         VALUES (?, ?, 'validacion_personal', 'enviado_c3', ?)`,
        [tramiteId, usuarioId, comentario]
      );

      // Obtener trámite actualizado
      const [tramiteActualizado] = await connection.query(
        'SELECT * FROM tramites_alta WHERE id = ?',
        [tramiteId]
      );

      return tramiteActualizado[0];
    });
  }

  /**
   * C3: Obtener personas pendientes de dictamen
   */
  async obtenerPersonasPendientesC3(filtros = {}) {
    return await PersonaTramiteModel.findPendientesC3(filtros);
  }

  /**
   * C3: Emitir dictamen para una persona
   * Opciones: ALTA OK, NO PUEDE SER DADO DE ALTA, PENDIENTE
   * PENDIENTE = rechazado (va a tabla de rechazados)
   */
  async emitirDictamenPersonaC3(personaId, usuarioId, dictamen, observaciones = null) {
    const persona = await PersonaTramiteModel.findByIdWithTramite(personaId);
    if (!persona) {
      throw new Error('Persona no encontrada');
    }

    // Validar que el trámite esté en fase correcta
    if (persona.tramite_fase !== 'enviado_c3') {
      throw new Error('El trámite no está en fase válida para dictamen C3');
    }

    // Validar que la persona no haya sido dictaminada ya
    if (persona.rechazado || persona.observaciones_c3) {
      throw new Error('Esta persona ya tiene un dictamen registrado');
    }

    // Usar transacción
    return await TramiteAltaModel.transaction(async (connection) => {
      const esAprobado = dictamen === 'ALTA OK';
      const esRechazado = dictamen === 'NO PUEDE SER DADO DE ALTA' || dictamen === 'PENDIENTE';
      const observacionesFinal = observaciones || (esAprobado ? 'Aprobado por C3' : `Dictamen C3: ${dictamen}`);

      if (esAprobado) {
        // ALTA OK: persona aprobada por C3
        await connection.query(
          `UPDATE personas_tramite_alta 
           SET observaciones_c3 = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [observacionesFinal, personaId]
        );
      } else {
        // NO PUEDE SER DADO DE ALTA o PENDIENTE: persona rechazada
        await connection.query(
          `UPDATE personas_tramite_alta 
           SET rechazado = TRUE,
               validado = FALSE,
               motivo_rechazo = ?,
               observaciones_c3 = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [`Dictamen C3: ${dictamen}`, observacionesFinal, personaId]
        );
      }

      // Asignar validador C3 en el primer dictamen si el trámite aún no tiene uno.
      await connection.query(
        `UPDATE tramites_alta
         SET usuario_validador_c3_id = COALESCE(usuario_validador_c3_id, ?),
             updated_at = NOW()
         WHERE id = ?`,
        [usuarioId, persona.tramite_alta_id]
      );

      // Verificar si TODAS las personas validadas del trámite ya tienen dictamen de C3
      const [pendientes] = await connection.query(
        `SELECT COUNT(*) as count 
         FROM personas_tramite_alta 
         WHERE tramite_alta_id = ? 
         AND validado = TRUE 
         AND rechazado = FALSE 
         AND observaciones_c3 IS NULL`,
        [persona.tramite_alta_id]
      );
      const todasDictaminadas = pendientes[0].count === 0;

      if (todasDictaminadas) {
        // Determinar estatus final del trámite
        const [stats] = await connection.query(
          `SELECT 
             COUNT(CASE WHEN rechazado = FALSE AND observaciones_c3 IS NOT NULL THEN 1 END) as aprobadas,
             COUNT(CASE WHEN rechazado = TRUE THEN 1 END) as rechazadas
           FROM personas_tramite_alta 
           WHERE tramite_alta_id = ? AND validado = TRUE`,
          [persona.tramite_alta_id]
        );

        const hayAprobadas = stats[0].aprobadas > 0;
        const faseNueva = hayAprobadas ? 'dictaminado_c3' : 'rechazado_c3';
        // estatus_id: 4=Aprobada, 5=Rechazada
        const estatusId = hayAprobadas ? 4 : 5;

        await connection.query(
          `UPDATE tramites_alta 
           SET fase_actual = ?, estatus_id = ?, usuario_validador_c3_id = ?, updated_at = NOW() 
           WHERE id = ?`,
          [faseNueva, estatusId, usuarioId, persona.tramite_alta_id]
        );

        await connection.query(
          `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
           VALUES (?, ?, 'enviado_c3', ?, ?)`,
          [persona.tramite_alta_id, usuarioId, faseNueva, 
           `Dictamen C3 completado - ${stats[0].aprobadas} aprobada(s), ${stats[0].rechazadas} rechazada(s)`]
        );
      }

      // Obtener la persona actualizada
      const [personaActualizada] = await connection.query(
        `SELECT 
          p.*,
          t.numero_solicitud,
          t.municipio_id,
          t.usuario_analista_c5_id,
          t.fase_actual as tramite_fase,
          m.nombre as municipio_nombre,
          pu.nombre as puesto_nombre,
          pu.es_competencia_municipal
        FROM personas_tramite_alta p
        INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
        LEFT JOIN municipios m ON t.municipio_id = m.id
        LEFT JOIN puestos pu ON p.puesto_id = pu.id
        WHERE p.id = ?`,
        [personaId]
      );

      return personaActualizada[0];
    });
  }

  /**
   * C5: Obtener personas pendientes de revisión
   */
  async obtenerTodasLasPersonasC5(filtros = {}) {
    const where = ['1=1'];
    const params = [];

    // Control de acceso: analistas ven sus trámites + todos los de dependencias
    // Admin/super_admin ven todo
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
      if (filtros.estatus_persona === 'validado') {
        where.push('p.validado = TRUE');
      } else if (filtros.estatus_persona === 'rechazado') {
        where.push('p.rechazado = TRUE');
      } else if (filtros.estatus_persona === 'pendiente') {
        where.push('p.validado = FALSE AND p.rechazado = FALSE');
      }
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
        p.id,
        p.tramite_alta_id,
        p.nombre,
        p.apellido_paterno,
        p.apellido_materno,
        p.fecha_nacimiento,
        p.numero_oficio_c3,
        p.puesto_id,
        p.validado,
        p.rechazado,
        p.motivo_rechazo,
        p.observaciones_c3,
        p.puesto_propuesto_c3_id,
        p.fase_revision,
        p.fase_cuip,
        p.created_at,
        p.updated_at,
        CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo,
        t.numero_solicitud,
        t.fase_actual as tramite_fase,
        t.es_tramite_dependencia,
        t.proceso_movimiento,
        t.fecha_solicitud,
        t.usuario_analista_c5_id,
        pu.nombre as puesto_original_nombre,
        pu.es_competencia_municipal as puesto_original_es_municipal,
        pp.nombre as puesto_propuesto_nombre,
        m.nombre as municipio_nombre,
        dep.nombre as dependencia_nombre,
        ua.nombre_completo as analista_nombre,
        uv.nombre_completo as validador_c3_nombre,
        CASE 
          WHEN p.rechazado = TRUE AND p.observaciones_c3 IS NOT NULL THEN 'Rechazado por C3'
          WHEN p.rechazado = TRUE THEN 'Rechazado'
          WHEN p.validado = TRUE AND t.fase_actual IN ('dictaminado_c3') AND p.observaciones_c3 IS NOT NULL THEN 'Aprobado por C3'
          WHEN p.validado = TRUE AND t.fase_actual = 'enviado_c3' THEN 'Pendiente dictamen C3'
          WHEN t.fase_actual = 'rechazado_c3' THEN 'Rechazado por C3'
          WHEN t.fase_actual = 'datos_solicitud' THEN 'En captura'
          WHEN t.fase_actual = 'validacion_personal' THEN 'En validación C5'
          ELSE 'Pendiente'
        END as estatus_descriptivo,
        CASE
          WHEN p.rechazado = TRUE THEN 'ver_rechazados'
          WHEN p.fase_cuip = 'en_proceso' THEN 'persona_en_cuip'
          WHEN p.fase_revision IN ('en_proceso', 'antecedentes', 'documentos') THEN 'persona_en_revision'
          WHEN p.validado = TRUE
            AND p.rechazado = FALSE
            AND p.observaciones_c3 IS NOT NULL
            AND (p.fase_revision IS NULL OR p.fase_revision = 'pendiente')
            AND (p.fase_cuip IS NULL OR p.fase_cuip = 'pendiente')
            AND t.fase_actual IN ('dictaminado_c3', 'validado_c3', 'revision_requisitos')
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

    return await TramiteAltaModel.query(sql, params);
  }

  /**
   * Obtener trámites con rechazos de C3 pendientes
   */
  async obtenerTramitesConRechazosC3(filtros = {}) {
    const where = ["t.fase_actual = 'rechazos_c3'"];
    const params = [];

    // Control de acceso por rol
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
      SELECT 
        t.*,
        m.nombre as municipio_nombre,
        r.nombre as region_nombre,
        tof.nombre as tipo_oficio_nombre,
        dep.nombre as dependencia_nombre,
        ua.nombre_completo as analista_nombre,
        uv.nombre_completo as validador_c3_nombre
      FROM tramites_alta t
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN regiones r ON m.region_id = r.id
      LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id
      LEFT JOIN usuarios uv ON t.usuario_validador_c3_id = uv.id
      WHERE ${where.join(' AND ')}
      ORDER BY t.updated_at DESC
    `;

    const tramites = await TramiteAltaModel.query(sql, params);

    // Agregar personas para cada trámite
    for (const tramite of tramites) {
      const personas = await PersonaTramiteModel.findByTramite(tramite.id);
      tramite.personas = personas;
      tramite.total_rechazadas = personas.filter(p => p.rechazado).length;
      tramite.total_validadas = personas.filter(p => p.validado && !p.rechazado).length;
    }

    return tramites;
  }

  /**
   * Obtener personas rechazadas con filtros y paginación
   * Historial unificado de TODAS las personas rechazadas en cualquier etapa
   */
  async obtenerPersonasRechazadas(filtros = {}) {
    const where = ['p.rechazado = TRUE'];
    const params = [];

    // Control de acceso por rol
    if (filtros.usuario_rol === 'analista') {
      where.push('t.usuario_analista_c5_id = ?');
      params.push(filtros.usuario_id);
    } else if (filtros.usuario_rol === 'validador_c3') {
      where.push('(t.usuario_validador_c3_id = ? OR t.usuario_validador_c3_id IS NULL)');
      params.push(filtros.usuario_id);
    }
    // admin y super_admin ven todo

    if (filtros.analista_id && ['admin', 'super_admin', 'coordinador', 'direccion'].includes(filtros.usuario_rol)) {
      where.push('t.usuario_analista_c5_id = ?');
      params.push(Number(filtros.analista_id));
    }

    if (filtros.fecha_inicio) {
      where.push('p.updated_at >= ?');
      params.push(filtros.fecha_inicio);
    }
    if (filtros.fecha_fin) {
      where.push('p.updated_at <= ?');
      params.push(`${filtros.fecha_fin} 23:59:59`);
    }

    if (filtros.busqueda) {
      where.push('(p.nombre LIKE ? OR p.apellido_paterno LIKE ? OR p.apellido_materno LIKE ? OR t.numero_solicitud LIKE ? OR m.nombre LIKE ? OR dep.nombre LIKE ?)');
      const searchTerm = `%${filtros.busqueda}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filtros.etapa_rechazo) {
      switch (filtros.etapa_rechazo) {
        case 'competencia':
          where.push('pu.es_competencia_municipal = FALSE');
          break;
        case 'c3':
          where.push("p.motivo_rechazo LIKE 'Dictamen C3:%'");
          break;
        case 'revision':
          where.push("p.fase_revision = 'rechazado_revision'");
          break;
        case 'cuip':
          where.push("p.fase_cuip = 'rechazado_cuip'");
          break;
        case 'cita':
          where.push("(p.motivo_rechazo LIKE 'No asistió a la cita biométrica%' OR p.motivo_rechazo LIKE 'Cita cancelada/reagendada:%')");
          break;
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

    // Contar total para paginación
    const countSql = `
      SELECT COUNT(*) as total
      FROM personas_tramite_alta p
      INNER JOIN tramites_alta t ON p.tramite_alta_id = t.id
      LEFT JOIN puestos pu ON p.puesto_id = pu.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      WHERE ${where.join(' AND ')}
    `;
    const countResult = await TramiteAltaModel.query(countSql, params);
    const total = countResult[0]?.total || 0;

    // Paginación
    const page = parseInt(filtros.page) || 1;
    const limit = parseInt(filtros.limit) || 15;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT 
        p.id,
        p.nombre,
        p.apellido_paterno,
        p.apellido_materno,
        CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo,
        p.fecha_nacimiento,
        p.numero_oficio_c3,
        p.motivo_rechazo,
        p.observaciones_c3,
        p.created_at,
        p.updated_at,
        p.tramite_alta_id,
        t.numero_solicitud,
        t.fase_actual as fase_tramite,
        t.fecha_solicitud,
        t.es_tramite_dependencia,
        pu.nombre as puesto_solicitado,
        pu.es_competencia_municipal,
        pu.motivo_no_competencia,
        m.nombre as municipio_nombre,
        r.nombre as region_nombre,
        dep.nombre as dependencia_nombre,
        ua.nombre_completo as analista_nombre,
        uv.nombre_completo as validador_c3_nombre,
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

    return {
      personas,
      paginacion: {
        total,
        pagina: page,
        limite: limit,
        total_paginas: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Actualizar motivo de rechazo de una persona
   * Permite editar el motivo sin cambiar la etapa
   */
  async actualizarMotivoRechazo(personaId, nuevoMotivo, usuarioId) {
    if (!nuevoMotivo || nuevoMotivo.trim() === '') {
      throw new Error('El motivo de rechazo no puede estar vacío');
    }

    const persona = await PersonaTramiteModel.findByIdWithTramite(personaId);
    if (!persona) {
      throw new Error('Persona no encontrada');
    }
    if (!persona.rechazado) {
      throw new Error('Esta persona no está rechazada');
    }

    // Solo actualizar observaciones_c3 cuando el rechazo sea realmente de C3.
    const esRechazoC3 = String(persona.motivo_rechazo || '').startsWith('Dictamen C3:');
    const updates = { updated_at: new Date() };

    if (esRechazoC3) {
      updates.observaciones_c3 = nuevoMotivo.trim();
    }
    updates.motivo_rechazo = nuevoMotivo.trim();

    await PersonaTramiteModel.update(personaId, updates);

    // Registrar en historial
    await HistorialModel.registrar(
      persona.tramite_alta_id,
      usuarioId,
      persona.tramite_fase || 'rechazado',
      persona.tramite_fase || 'rechazado',
      `Motivo de rechazo actualizado para ${persona.nombre} ${persona.apellido_paterno}: "${nuevoMotivo.trim()}"`
    );

    return { success: true, message: 'Motivo actualizado correctamente' };
  }

  /**
   * Generar datos para oficio de rechazo
   * Retorna un objeto estructurado listo para generar el documento
   */
  async generarOficioRechazo(personaId) {
    const sql = `
      SELECT 
        p.id,
        p.nombre,
        p.apellido_paterno,
        p.apellido_materno,
        CONCAT(p.nombre, ' ', p.apellido_paterno, ' ', IFNULL(p.apellido_materno, '')) as nombre_completo,
        p.fecha_nacimiento,
        p.motivo_rechazo,
        p.observaciones_c3,
        p.numero_oficio_c3,
        p.updated_at as fecha_rechazo,
        t.numero_solicitud,
        t.fecha_solicitud,
        t.es_tramite_dependencia,
        pu.nombre as puesto_solicitado,
        pu.es_competencia_municipal,
        pu.motivo_no_competencia,
        m.nombre as municipio_nombre,
        r.nombre as region_nombre,
        dep.nombre as dependencia_nombre,
        ua.nombre_completo as analista_nombre,
        uv.nombre_completo as validador_c3_nombre,
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
    if (personas.length === 0) {
      throw new Error('Persona rechazada no encontrada');
    }

    const p = personas[0];
    const fechaRechazo = new Date(p.fecha_rechazo);
    const fechaHoy = new Date();

    return {
      oficio: {
        numero_solicitud: p.numero_solicitud,
        numero_oficio_c3: p.numero_oficio_c3 || '',
        fecha_emision: fechaHoy.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
        fecha_emision_iso: fechaHoy.toISOString()
      },
      persona: {
        id: p.id,
        nombre_completo: p.nombre_completo,
        fecha_nacimiento: p.fecha_nacimiento ? new Date(p.fecha_nacimiento).toLocaleDateString('es-MX') : 'No registrada',
        puesto_solicitado: p.puesto_solicitado
      },
      rechazo: {
        etapa: p.etapa_rechazo,
        motivo: p.motivo_especifico || p.motivo_rechazo || 'Sin especificar',
        fecha: fechaRechazo.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
        fecha_iso: p.fecha_rechazo
      },
      contexto: {
        municipio: p.municipio_nombre || 'No aplica',
        region: p.region_nombre || 'No aplica',
        dependencia: p.dependencia_nombre || 'No aplica',
        es_dependencia: p.es_tramite_dependencia ? true : false,
        analista: p.analista_nombre || 'No asignado',
        validador_c3: p.validador_c3_nombre || 'No asignado'
      }
    };
  }

  /**
   * Obtener trámites de dependencias para C5
   */
  async obtenerTramitesDependencias(filtros = {}) {
    // Verificar permisos
    if (!['admin', 'analista', 'super_admin'].includes(filtros.usuario_rol)) {
      throw new Error('Solo usuarios de C5 pueden acceder a esta información');
    }

    const where = ['t.es_tramite_dependencia = TRUE'];
    const params = [];

    if (filtros.fase_actual) {
      where.push('t.fase_actual = ?');
      params.push(filtros.fase_actual);
    }

    if (filtros.dependencia_id) {
      where.push('t.dependencia_id = ?');
      params.push(filtros.dependencia_id);
    }

    const sql = `
      SELECT 
        t.id,
        t.numero_solicitud,
        t.tipo_oficio_id,
        t.municipio_id,
        t.dependencia_id,
        t.fase_actual,
        t.estatus_id,
        t.fecha_solicitud,
        t.created_at,
        t.updated_at,
        t.observaciones,
        tof.nombre as tipo_oficio_nombre,
        m.nombre as municipio_nombre,
        dep.nombre as dependencia_nombre,
        est.nombre as estatus_nombre,
        u.nombre_completo as creado_por
      FROM tramites_alta t
      LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN estatus_solicitudes est ON t.estatus_id = est.id
      LEFT JOIN usuarios u ON t.usuario_analista_c5_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY t.created_at DESC
    `;

    const tramites = await TramiteAltaModel.query(sql, params);

    // Agregar conteo de personas para cada trámite
    for (const tramite of tramites) {
      const stats = await PersonaTramiteModel.getEstadisticasTramite(tramite.id);
      tramite.total_personas = stats.total || 0;
      tramite.personas_aprobadas = stats.aprobados_c3 || 0;
      tramite.personas_rechazadas = stats.rechazados_c3 || 0;
      tramite.personas_pendientes = stats.pendientes_c3 || 0;
    }

    return tramites;
  }

  /**
   * Dashboard: Obtener municipios del analista
   */
  async obtenerDashboardMunicipios(analistaId) {
    return await DashboardMunicipioModel.findByAnalista(analistaId);
  }

  /**
   * Dashboard: Agregar municipio
   */
  async agregarMunicipioDashboard(analistaId, regionId, municipioId) {
    // Validar que el municipio pertenezca a la región del analista
    const municipioValido = await MunicipioModel.belongsToRegion(municipioId, regionId);
    if (!municipioValido) {
      throw new Error('El municipio no pertenece a tu región asignada');
    }

    return await DashboardMunicipioModel.agregar(analistaId, municipioId);
  }

  /**
   * Dashboard: Eliminar municipio
   */
  async eliminarMunicipioDashboard(analistaId, municipioId) {
    // Verificar si tiene trámites iniciados
    const tieneTramites = await DashboardMunicipioModel.tieneTramitesIniciados(analistaId, municipioId);
    if (tieneTramites) {
      throw new Error('No puedes eliminar este municipio porque tiene trámites iniciados. Completa o cancela los trámites primero.');
    }

    const result = await DashboardMunicipioModel.eliminarByAnalistaMunicipio(analistaId, municipioId);
    if (result.affectedRows === 0) {
      throw new Error('El municipio no está en tu dashboard');
    }

    return { success: true };
  }

  /**
   * Dashboard: Obtener municipios disponibles para agregar
   */
  async obtenerMunicipiosDisponibles(analistaId, regionId) {
    return await DashboardMunicipioModel.getMunicipiosDisponibles(analistaId, regionId);
  }

  /**
   * Obtener estadísticas del analista
   */
  async obtenerEstadisticasAnalista(analistaId) {
    const [estadisticas, dashboard] = await Promise.all([
      TramiteAltaModel.getEstadisticasAnalista(analistaId),
      DashboardMunicipioModel.findByAnalista(analistaId)
    ]);

    return {
      tramites: estadisticas,
      municipios_dashboard: dashboard.length,
      municipios_con_tramites: dashboard.filter(m => m.tramites_activos > 0).length
    };
  }

  /**
   * C3: Obtener tramites pendientes de dictamen
   */
  async obtenerTramitesPendientesC3(filtros = {}) {
    const where = ["t.fase_actual IN ('enviado_c3', 'dictaminado_c3', 'rechazado_c3', 'validado_c3', 'rechazado', 'rechazado_no_corresponde')"];
    const params = [];

    if (filtros.tramite_id) {
      where.push('t.id = ?');
      params.push(filtros.tramite_id);
    }

    if (filtros.busqueda) {
      where.push("(t.numero_solicitud LIKE ? OR m.nombre LIKE ? OR dep.nombre LIKE ?)");
      const searchTerm = `%${filtros.busqueda}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const sql = `
      SELECT 
        t.*,
        m.nombre as municipio_nombre,
        r.nombre as region_nombre,
        tof.nombre as tipo_oficio_nombre,
        dep.nombre as dependencia_nombre,
        ua.nombre_completo as analista_nombre,
        ua.extension as analista_extension,
        uv.nombre_completo as validador_c3_nombre
      FROM tramites_alta t
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN regiones r ON m.region_id = r.id
      LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id
      LEFT JOIN usuarios uv ON t.usuario_validador_c3_id = uv.id
      WHERE ${where.join(' AND ')}
      ORDER BY t.created_at DESC
    `;

    return await TramiteAltaModel.query(sql, params);
  }

  /**
   * Agregar una persona individual al trámite
   * C5: Solo puestos de competencia municipal. Si no es municipal, debe rechazar.
   * Dependencias: Pueden agregar cualquier puesto.
   */
  async agregarPersona(tramiteId, usuarioId, datosPersona) {
    // Verificar que el trámite existe y pertenece al usuario
    const tramite = await TramiteAltaModel.findById(tramiteId);
    if (!tramite) {
      throw new Error('Trámite no encontrado');
    }

    if (tramite.usuario_analista_c5_id !== usuarioId) {
      throw new Error('No tienes permiso para modificar este trámite');
    }

    // Usar transacción
    return await TramiteAltaModel.transaction(async (connection) => {
      const datosPersonaNormalizados = {
        ...datosPersona,
        nombre: normalizarNombrePersona(datosPersona?.nombre),
        apellido_paterno: normalizarNombrePersona(datosPersona?.apellido_paterno),
        apellido_materno: normalizarNombrePersona(datosPersona?.apellido_materno),
        numero_oficio_c3: normalizarNumeroOficioC3(datosPersona?.numero_oficio_c3)
      };

      // Verificar CURP duplicado
      if (datosPersonaNormalizados.curp) {
        const [existing] = await connection.query(
          'SELECT COUNT(*) as count FROM personas_tramite_alta WHERE tramite_alta_id = ? AND curp = ?',
          [tramiteId, datosPersonaNormalizados.curp]
        );
        if (existing[0].count > 0) {
          throw new Error(`El CURP ${datosPersonaNormalizados.curp} ya está registrado en este trámite`);
        }
      }

      // FILTRO DE COMPETENCIA MUNICIPAL (Solo para C5, no para dependencias)
      if (!tramite.es_tramite_dependencia && datosPersonaNormalizados.puesto_id) {
        const [puestoInfo] = await connection.query(
          'SELECT nombre, es_competencia_municipal, motivo_no_competencia FROM puestos WHERE id = ?',
          [datosPersonaNormalizados.puesto_id]
        );

        if (puestoInfo.length > 0 && !puestoInfo[0].es_competencia_municipal) {
          throw new Error(
            `NO CORRESPONDE A COMPETENCIA MUNICIPAL: El puesto "${puestoInfo[0].nombre}" no puede ser dado de alta por C5. ${puestoInfo[0].motivo_no_competencia || 'Puesto fuera de competencia municipal.'} Debe rechazar esta persona.`
          );
        }
      }

      // Crear persona
      const [result] = await connection.query(
        'INSERT INTO personas_tramite_alta SET ?',
        [{
          tramite_alta_id: tramiteId,
          ...datosPersonaNormalizados,
          validado: false,
          rechazado: false
        }]
      );
      const personaId = result.insertId;

      // Actualizar fase si es necesario
      if (tramite.fase_actual === 'datos_solicitud') {
        await connection.query(
          `UPDATE tramites_alta SET fase_actual = 'validacion_personal' WHERE id = ?`,
          [tramiteId]
        );

        await connection.query(
          'INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) VALUES (?, ?, ?, ?, ?)',
          [tramiteId, usuarioId, 'datos_solicitud', 'validacion_personal', 'Primera persona agregada - Inicio validación de personal']
        );
      }

      // Obtener la persona creada
      const [persona] = await connection.query(
        'SELECT * FROM personas_tramite_alta WHERE id = ?',
        [personaId]
      );

      return persona[0];
    });
  }

  /**
   * Editar datos de una persona en PASO 2
   */
  async editarPersona(personaId, usuarioId, datosPersona) {
    const persona = await PersonaTramiteModel.findByIdWithTramite(personaId);
    if (!persona) {
      throw new Error('Persona no encontrada');
    }

    if (persona.usuario_analista_c5_id !== usuarioId) {
      throw new Error('No tienes permiso para editar esta persona');
    }

    if (persona.validado || persona.rechazado) {
      throw new Error('Solo se pueden editar personas pendientes');
    }

    const camposPermitidos = [
      'nombre',
      'apellido_paterno',
      'apellido_materno',
      'fecha_nacimiento',
      'numero_oficio_c3',
      'puesto_id'
    ];

    const updates = {};
    camposPermitidos.forEach((campo) => {
      if (datosPersona[campo] !== undefined) {
        if (campo === 'numero_oficio_c3') {
          updates[campo] = normalizarNumeroOficioC3(datosPersona[campo]);
        } else if (['nombre', 'apellido_paterno', 'apellido_materno'].includes(campo)) {
          updates[campo] = normalizarNombrePersona(datosPersona[campo]);
        } else {
          updates[campo] = datosPersona[campo];
        }
      }
    });

    if (Object.keys(updates).length === 0) {
      throw new Error('No se enviaron campos para actualizar');
    }

    if (updates.puesto_id) {
      const tramite = await TramiteAltaModel.findById(persona.tramite_alta_id);
      if (tramite && !tramite.es_tramite_dependencia) {
        const [puestoInfo] = await BaseModel.query(
          'SELECT nombre, es_competencia_municipal, motivo_no_competencia FROM puestos WHERE id = ?',
          [updates.puesto_id]
        );

        if (puestoInfo.length > 0 && !puestoInfo[0].es_competencia_municipal) {
          throw new Error(
            `NO CORRESPONDE A COMPETENCIA MUNICIPAL: El puesto "${puestoInfo[0].nombre}" no puede ser dado de alta por C5. ${puestoInfo[0].motivo_no_competencia || 'Puesto fuera de competencia municipal.'}`
          );
        }
      }
    }

    return await PersonaTramiteModel.update(personaId, updates);
  }

  /**
   * Validar una persona (PASO 2)
   */
  async validarPersona(personaId, usuarioId) {
    const persona = await PersonaTramiteModel.findByIdWithTramite(personaId);
    if (!persona) {
      throw new Error('Persona no encontrada');
    }

    // Verificar permisos
    if (persona.usuario_analista_c5_id !== usuarioId) {
      throw new Error('No tienes permiso para validar esta persona');
    }

    if (persona.rechazado) {
      throw new Error('No se puede validar una persona rechazada');
    }

    // Toggle: validar <-> desvalidar
    const nuevoEstadoValidado = !Boolean(persona.validado);
    return await PersonaTramiteModel.update(personaId, {
      validado: nuevoEstadoValidado,
      rechazado: false,
      motivo_rechazo: null
    });
  }

  /**
   * Rechazar una persona manualmente
   */
  async rechazarPersona(personaId, usuarioId, motivoRechazo) {
    const persona = await PersonaTramiteModel.findByIdWithTramite(personaId);
    if (!persona) {
      throw new Error('Persona no encontrada');
    }

    // Verificar permisos
    if (persona.usuario_analista_c5_id !== usuarioId) {
      throw new Error('No tienes permiso para rechazar esta persona');
    }

    if (!motivoRechazo) {
      throw new Error('Debes proporcionar un motivo de rechazo');
    }

    if (persona.rechazado) {
      throw new Error('La persona ya fue rechazada y no se puede deshacer');
    }

    return await TramiteAltaModel.transaction(async (connection) => {
      await connection.query(
        `UPDATE personas_tramite_alta
         SET rechazado = TRUE,
             validado = FALSE,
             motivo_rechazo = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [motivoRechazo, personaId]
      );

      const nombrePersona = [persona.nombre, persona.apellido_paterno, persona.apellido_materno]
        .filter(Boolean)
        .join(' ')
        .trim();

      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario)
         VALUES (?, ?, ?, ?, ?)`,
        [
          persona.tramite_alta_id,
          usuarioId,
          persona.tramite_fase || 'validacion_personal',
          persona.tramite_fase || 'validacion_personal',
          `Persona rechazada en validación de personal: ${nombrePersona || `ID ${personaId}`}. Motivo: ${motivoRechazo}`
        ]
      );

      const [actualizada] = await connection.query(
        'SELECT * FROM personas_tramite_alta WHERE id = ?',
        [personaId]
      );

      return actualizada[0];
    });
  }

  /**
   * C3: Obtener historial de trámites procesados
   */
  async obtenerHistorialC3(filtros = {}) {
    const where = [
      `(
        t.fase_actual IN ('dictaminado_c3', 'rechazado_c3', 'validado_c3', 'rechazado', 'rechazado_no_corresponde', 'revision_requisitos', 'validacion_cuip')
        OR (
          t.fase_actual = 'enviado_c3'
          AND EXISTS (
            SELECT 1
            FROM personas_tramite_alta px
            WHERE px.tramite_alta_id = t.id
              AND (px.rechazado = TRUE OR px.observaciones_c3 IS NOT NULL)
          )
        )
      )`
    ];
    const params = [];

    // Filtrar por validador C3 (si hay filtro)
    // NO filtrar si no se pasa validador_id, así C3 ve TODOS los trámites dictaminados
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
      SELECT 
        t.*,
        m.nombre as municipio_nombre,
        r.nombre as region_nombre,
        tof.nombre as tipo_oficio_nombre,
        dep.nombre as dependencia_nombre,
        ua.nombre_completo as analista_nombre,
        ua.extension as analista_extension,
        uv.nombre_completo as validador_c3_nombre
      FROM tramites_alta t
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN regiones r ON m.region_id = r.id
      LEFT JOIN tipos_oficio tof ON t.tipo_oficio_id = tof.id
      LEFT JOIN dependencias dep ON t.dependencia_id = dep.id
      LEFT JOIN usuarios ua ON t.usuario_analista_c5_id = ua.id
      LEFT JOIN usuarios uv ON t.usuario_validador_c3_id = uv.id
      WHERE ${where.join(' AND ')}
      ORDER BY t.updated_at DESC
    `;

    const tramites = await TramiteAltaModel.query(sql, params);

    // Agregar estadísticas y arreglo de personas para cada trámite
    for (const tramite of tramites) {
      const stats = await PersonaTramiteModel.getEstadisticasTramite(tramite.id);
      tramite.personas_stats = stats;

      // Mostrar solo personas ya dictaminadas por C3 dentro del historial.
      const personas = await PersonaTramiteModel.findByTramite(tramite.id);
      tramite.personas = personas.filter((persona) => {
        const observacionesC3 = typeof persona.observaciones_c3 === 'string'
          ? persona.observaciones_c3.trim()
          : '';
        const motivoRechazo = typeof persona.motivo_rechazo === 'string'
          ? persona.motivo_rechazo.trim()
          : '';

        return observacionesC3.length > 0 || motivoRechazo.startsWith('Dictamen C3:');
      });
    }

    return tramites;
  }

  /**
   * @deprecated - Funcionalidad de cambio de puesto eliminada
   * Se mantiene por compatibilidad pero ya no se usa
   */
  async emitirDecisionFinalC5_DEPRECATED(tramiteId, usuarioId, decisiones) {
    // Verificar que el trámite existe
    const tramite = await TramiteAltaModel.findById(tramiteId);
    if (!tramite) {
      throw new Error('Trámite no encontrado');
    }

    // Verificar que el trámite esté en fase correcta
    if (tramite.fase_actual !== 'validado_c3') {
      throw new Error('El trámite no está en fase validado_c3');
    }

    // Verificar que el usuario sea el analista del trámite
    if (tramite.usuario_analista_c5_id !== usuarioId) {
      throw new Error('No tiene permisos para tomar decisiones sobre este trámite');
    }

    let decisionesProcesadas = 0;

    return await TramiteAltaModel.transaction(async (connection) => {
      // Procesar cada decisión
      for (const decision of decisiones) {
        const { persona_id, decision: tipoDecision } = decision;

        // Obtener la persona con sus puestos
        const [personas] = await connection.query(
          `SELECT 
            p.id,
            p.puesto_id,
            p.puesto_propuesto_c3_id,
            po.nombre as puesto_original_nombre,
            po.es_competencia_municipal as puesto_original_competencia,
            pp.nombre as puesto_propuesto_nombre,
            pp.es_competencia_municipal as puesto_propuesto_competencia,
            pp.motivo_no_competencia as puesto_propuesto_motivo_no_competencia
          FROM personas_tramite_alta p
          LEFT JOIN puestos po ON p.puesto_id = po.id
          LEFT JOIN puestos pp ON p.puesto_propuesto_c3_id = pp.id
          WHERE p.id = ? AND p.tramite_alta_id = ?`,
          [persona_id, tramiteId]
        );

        if (personas.length === 0) {
          throw new Error(`Persona ${persona_id} no encontrada en el trámite`);
        }

        const persona = personas[0];

        if (tipoDecision === 'propuesta') {
          // Verificar que existe una propuesta
          if (!persona.puesto_propuesto_c3_id) {
            throw new Error(`No hay propuesta de C3 para la persona ${persona_id}`);
          }

          // SEGUNDO FILTRO DE COMPETENCIA: Validar que el puesto propuesto sea de competencia municipal
          if (!persona.puesto_propuesto_competencia) {
            return {
              error: true,
              statusCode: 400,
              message: 'ADVERTENCIA: PUESTO NO CORRESPONDE. No puede aceptar un puesto fuera de competencia municipal',
              detalles: {
                puesto_propuesto: persona.puesto_propuesto_nombre,
                motivo: persona.puesto_propuesto_motivo_no_competencia || 'Puesto fuera de competencia municipal',
                accion_requerida: 'Debe seleccionar el puesto original o rechazar la persona'
              }
            };
          }

          // Aceptar propuesta: cambiar puesto_id al puesto propuesto
          await connection.query(
            `UPDATE personas_tramite_alta 
             SET puesto_id = puesto_propuesto_c3_id, 
                 decision_final_c5 = 'propuesta',
                 updated_at = NOW()
             WHERE id = ?`,
            [persona_id]
          );
        } else if (tipoDecision === 'original') {
          // Mantener puesto original: registrar decisión
          await connection.query(
            `UPDATE personas_tramite_alta 
             SET decision_final_c5 = 'original',
                 updated_at = NOW()
             WHERE id = ?`,
            [persona_id]
          );
        } else {
          throw new Error(`Decisión inválida: ${tipoDecision}. Use "original" o "propuesta"`);
        }

        decisionesProcesadas++;
      }

      // Verificar si quedan personas con propuestas pendientes de decisión
      const [result] = await connection.query(
        `SELECT COUNT(*) as count 
         FROM personas_tramite_alta 
         WHERE tramite_alta_id = ? 
         AND validado = TRUE 
         AND rechazado = FALSE
         AND puesto_propuesto_c3_id IS NOT NULL
         AND decision_final_c5 = 'pendiente'`,
        [tramiteId]
      );

      // Todas las decisiones están tomadas si no quedan personas pendientes
      const todasDecisionesTomadas = result[0].count === 0;

      // Si todas las decisiones están tomadas, avanzar fase
      let faseNueva = tramite.fase_actual;
      if (todasDecisionesTomadas) {
        faseNueva = 'finalizado';
        
        await connection.query(
          `UPDATE tramites_alta 
           SET fase_actual = 'finalizado', updated_at = NOW() 
           WHERE id = ?`,
          [tramiteId]
        );

        await connection.query(
          `INSERT INTO historial_tramites_alta 
           (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
           VALUES (?, ?, ?, ?, ?)`,
          [tramiteId, usuarioId, 'validado_c3', 'finalizado', 'C5 completó revisión de propuestas de C3 - Trámite finalizado']
        );
      }

      return {
        tramite_id: tramiteId,
        decisiones_procesadas: decisionesProcesadas,
        fase_nueva: faseNueva,
        todas_decisiones_tomadas: todasDecisionesTomadas
      };
    });
  }


}

export default new TramiteAltaService();
