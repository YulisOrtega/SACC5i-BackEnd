import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import pool from '../config/database.js';
import TramiteAltaModel from '../models/TramiteAltaModel.js';
import PersonaTramiteModel from '../models/PersonaTramiteModel.js';
import CuipService from './CuipService.js';
import EmailService from './EmailService.js';
import CitaLifecycleService from './CitaLifecycleService.js';

/**
 * CitaService — Lógica de negocio para Citas Biométricas
 *
 * Flujo:
 *   1. Analista completa validación CUIP → hace clic en "Aprobar y generar cita"
 *   2. Se registra la cita en citas_biometricas
 *   3. Se marca fase_cuip = 'completado' y tramite.fase_actual = 'cita_programada'
 *   4. Se genera el PDF acuse
 *   5. Se envía notificación por correo (no bloquea si falla)
 */
class CitaService {
  async _tablaFinalizadosTieneColumna(connection, tablaFinalizados, columnName) {
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?`,
      [tablaFinalizados, columnName]
    );

    return Number(row?.total || 0) > 0;
  }

  async _registrarBitacora(connection, citaId, usuarioId, evento, titulo, detalle = null, metadata = null) {
    await connection.query(
      `INSERT INTO citas_bitacora (cita_id, usuario_id, evento, titulo, detalle, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [citaId, usuarioId || null, evento, titulo, detalle, metadata ? JSON.stringify(metadata) : null]
    );
  }

  async _obtenerCitaConContexto(connection, citaId) {
    const [[cita]] = await connection.query(
      `SELECT
         cb.*,
         pta.id AS persona_id,
         pta.tramite_alta_id,
         pu.nombre AS puesto_nombre,
         pta.numero_oficio_c3,
         pta.nombre,
         pta.apellido_paterno,
         pta.apellido_materno,
         CONCAT(pta.nombre, ' ', pta.apellido_paterno, ' ', IFNULL(pta.apellido_materno, '')) AS nombre_completo,
         ta.fase_actual AS tramite_fase_actual
       FROM citas_biometricas cb
       JOIN personas_tramite_alta pta ON pta.id = cb.persona_tramite_id
       JOIN tramites_alta ta ON ta.id = cb.tramite_alta_id
       LEFT JOIN puestos pu ON pu.id = pta.puesto_id
       WHERE cb.id = ?
       LIMIT 1`,
      [citaId]
    );

    return cita || null;
  }
  async _resolverFaseDestinoCita(connection) {
    const [[row]] = await connection.query(
      `SELECT COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tramites_alta'
         AND COLUMN_NAME = 'fase_actual'
       LIMIT 1`
    );

    const columnType = row?.COLUMN_TYPE || '';
    const soportaCitaProgramada = columnType.includes("'cita_programada'");

    // Fallback seguro para bases que aún no aplican la migración del ENUM.
    return soportaCitaProgramada ? 'cita_programada' : 'validacion_cuip';
  }

  async _resolverFaseRechazo(connection) {
    const [[row]] = await connection.query(
      `SELECT COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tramites_alta'
         AND COLUMN_NAME = 'fase_actual'
       LIMIT 1`
    );

    const columnType = row?.COLUMN_TYPE || '';
    return columnType.includes("'rechazado'") ? 'rechazado' : 'validacion_cuip';
  }

  async _resolverTablaFinalizados(connection) {
    const [[tablaNueva]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'finalizados'`
    );

    if (Number(tablaNueva?.total || 0) > 0) return 'finalizados';

    const [[tablaLegacy]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'ciclo_vida_alta_final'`
    );

    if (Number(tablaLegacy?.total || 0) > 0) return 'ciclo_vida_alta_final';
    return null;
  }

  async _obtenerRegistroFinalizadoPorId(connection, finalizadoId) {
    const tablaFinalizados = await this._resolverTablaFinalizados(connection);
    if (!tablaFinalizados) return null;

    const [[row]] = await connection.query(
      `SELECT * FROM ${tablaFinalizados} WHERE id = ? LIMIT 1`,
      [finalizadoId]
    );
    if (!row) return null;
    return { ...row, _tabla_finalizados: tablaFinalizados };
  }

  _obtenerAnioRepositorioAcuses() {
    const tz = 'America/Mexico_City';
    const now = new Date();
    const yearValue = Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: tz }).format(now));
    return yearValue;
  }

  async _asegurarCarpetaAcusesAnual(connection, userId) {
    const yearValue = this._obtenerAnioRepositorioAcuses();
    const folderName = `Acuses compartidos ${yearValue}`;

    const [[yearFolder]] = await connection.query(
      `SELECT id
       FROM repositorio_folders
       WHERE parent_id IS NULL
         AND folder_type = 'year'
         AND year_value = ?
       LIMIT 1`,
      [yearValue]
    );

    let yearFolderId = yearFolder?.id;
    if (!yearFolderId) {
      const [insertYear] = await connection.query(
        `INSERT INTO repositorio_folders (parent_id, nombre, folder_type, year_value, month_value, creado_por_id)
         VALUES (NULL, ?, 'year', ?, NULL, ?)`,
        [folderName, yearValue, userId || null]
      );
      yearFolderId = insertYear.insertId;
    } else {
      await connection.query(
        `UPDATE repositorio_folders
         SET nombre = ?, month_value = NULL, parent_id = NULL
         WHERE id = ?`,
        [folderName, yearFolderId]
      );
    }

    return Number(yearFolderId);
  }

  async _guardarDocumentoFinalizadoEnRepositorio(connection, registro, file, userId, { folderLimitError } = {}) {
    const folderId = await this._asegurarCarpetaAcusesAnual(connection, userId);
    const [[{ total }]] = await connection.query(
      'SELECT COUNT(*) AS total FROM repositorio_files WHERE folder_id = ?',
      [folderId]
    );

    if (Number(total || 0) >= 10000) {
      throw new Error(folderLimitError || 'La carpeta anual de acuses alcanzó el límite de 10,000 archivos');
    }

    const uploadsRoot = path.resolve('uploads', 'repositorio-digital');
    await fs.promises.mkdir(path.join(uploadsRoot, String(folderId)), { recursive: true });

    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${Date.now()}_${safeOriginal}`;
    const absolutePath = path.join(uploadsRoot, String(folderId), storedName);
    await fs.promises.writeFile(absolutePath, file.buffer);

    const relativePath = path.join('repositorio-digital', String(folderId), storedName).replace(/\\/g, '/');

    const [insertFile] = await connection.query(
      `INSERT INTO repositorio_files
       (folder_id, original_name, stored_name, relative_path, mime_type, size_bytes, folio, nombre_expediente, subido_por_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        folderId,
        file.originalname,
        storedName,
        relativePath,
        file.mimetype,
        file.size,
        registro.numero_oficio || null,
        registro.nombre_elemento || null,
        userId || null
      ]
    );

    return {
      folderId,
      repoFileId: insertFile.insertId,
      originalName: file.originalname,
      storedName,
      relativePath
    };
  }

  async _guardarAcuseEnRepositorio(connection, registro, file, userId) {
    return this._guardarDocumentoFinalizadoEnRepositorio(connection, registro, file, userId, {
      folderLimitError: 'La carpeta anual de constancias alcanzó el límite de 10,000 archivos'
    });
  }

  async _guardarAcusePersonaEnRepositorio(connection, registro, file, userId) {
    return this._guardarDocumentoFinalizadoEnRepositorio(connection, registro, file, userId, {
      folderLimitError: 'La carpeta anual de acuses alcanzó el límite de 10,000 archivos'
    });
  }

  async _eliminarDocumentoAdjunto(connection, registro, pathField, repoFileIdField) {
    const relativePath = registro?.[pathField];
    if (!relativePath) return;

    const repoFileId = registro?.[repoFileIdField];
    if (repoFileId) {
      await connection.query('DELETE FROM repositorio_files WHERE id = ?', [repoFileId]);
    }

    try {
      await fs.promises.unlink(path.resolve('uploads', relativePath));
    } catch {
      // Si no existe fisicamente no bloquea la eliminacion logica.
    }
  }

  async _eliminarAcuseActual(connection, registro) {
    await this._eliminarDocumentoAdjunto(connection, registro, 'acuse_relative_path', 'repositorio_file_id');
  }

  async _eliminarAcusePersonaActual(connection, registro) {
    await this._eliminarDocumentoAdjunto(
      connection,
      registro,
      'acuse_persona_relative_path',
      'acuse_persona_repositorio_file_id'
    );
  }

  async _asegurarColumnasAcusePersona(connection, tablaFinalizados) {
    const requiredColumns = [
      'acuse_persona_original_name',
      'acuse_persona_stored_name',
      'acuse_persona_relative_path',
      'acuse_persona_uploaded_at',
      'acuse_persona_uploaded_by_id',
      'acuse_persona_repositorio_file_id'
    ];

    for (const columnName of requiredColumns) {
      const exists = await this._tablaFinalizadosTieneColumna(connection, tablaFinalizados, columnName);
      if (!exists) {
        throw new Error('La base de datos no esta actualizada para acuse de persona. Ejecuta migraciones.');
      }
    }
  }

  async _upsertFinalizado(connection, cita, cuipCapturado) {
    const tablaFinalizados = await this._resolverTablaFinalizados(connection);
    if (!tablaFinalizados) return null;

    const cuip = String(cuipCapturado || '').trim();
    const nombreCompleto = `${cita.nombre || ''} ${cita.apellido_paterno || ''} ${cita.apellido_materno || ''}`.trim();
    const fechaTermino = new Date().toISOString().slice(0, 10);

    const [[existing]] = await connection.query(
      `SELECT id
       FROM ${tablaFinalizados}
       WHERE cita_id = ?
       LIMIT 1`,
      [cita.id]
    );

    if (existing?.id) {
      await connection.query(
        `UPDATE ${tablaFinalizados}
         SET nombre_elemento = ?,
             puesto_elemento = ?,
             numero_oficio = ?,
             fecha_termino = ?,
             cuip = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          nombreCompleto,
          cita.puesto_nombre || null,
          cita.numero_oficio_c3 || null,
          fechaTermino,
          cuip,
          existing.id
        ]
      );
      return Number(existing.id);
    }

    const [insert] = await connection.query(
      `INSERT INTO ${tablaFinalizados}
       (cita_id, persona_tramite_id, tramite_alta_id, nombre_elemento, puesto_elemento, numero_oficio, fecha_termino, cuip, fase1_estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [
        cita.id,
        cita.persona_id,
        cita.tramite_alta_id,
        nombreCompleto,
        cita.puesto_nombre || null,
        cita.numero_oficio_c3 || null,
        fechaTermino,
        cuip
      ]
    );

    return Number(insert.insertId);
  }

  /**
   * Generar folio único para la cita (formato: CITA-YYYY-NNNNN)
   */
  async _generarFolio(connection) {
    const year = new Date().getFullYear();
    const prefix = `CITA-${year}-`;
    const [[row]] = await connection.query(
      `SELECT MAX(CAST(SUBSTRING_INDEX(folio_cita, '-', -1) AS UNSIGNED)) AS max_seq
       FROM citas_biometricas
       WHERE folio_cita LIKE ?`,
      [`${prefix}%`]
    );
    const seq = Number(row?.max_seq || 0) + 1;
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  _esErrorDuplicadoFolio(error) {
    if (!error || error.code !== 'ER_DUP_ENTRY') return false;
    const msg = String(error.sqlMessage || error.message || '').toLowerCase();
    return msg.includes('folio_cita');
  }

  /**
   * Obtener email del analista responsable del trámite
   */
  async _obtenerEmailAnalista(tramiteAltaId) {
    const connection = await pool.getConnection();
    try {
      const [[row]] = await connection.query(
        `SELECT u.email, u.nombre_completo
         FROM tramites_alta ta
         JOIN usuarios u ON ta.usuario_analista_c5_id = u.id
         WHERE ta.id = ?`,
        [tramiteAltaId]
      );
      return row || null;
    } finally {
      connection.release();
    }
  }

  /**
   * Operación principal: Aprobar CUIP + Crear cita + Enviar correo (atómico)
   *
   * @param {number} personaId - ID de personas_tramite_alta
   * @param {number} usuarioId - ID del usuario que aprueba
   * @param {Object} datosCita
   * @param {string} datosCita.fecha_cita - ISO datetime (ej. "2026-03-20T10:00:00")
   * @param {string} [datosCita.lugar] - Lugar de la cita
   * @param {string} [datosCita.notas] - Notas adicionales
  * @param {string} [datosCita.email_override] - Email alternativo (solo para pruebas)
  * @param {boolean} [datosCita.enviar_notificacion] - Cuando true intenta enviar correo
   * @returns {Promise<{cita, persona, correoEnviado}>}
   */
  async aprobarYGenerarCita(personaId, usuarioId, datosCita) {
    const persona = await PersonaTramiteModel.findForCuip(personaId);
    if (!persona) throw new Error('Persona no encontrada');
    if (persona.fase_cuip !== 'en_proceso') {
      throw new Error('La validación CUIP debe estar en proceso para generar la cita');
    }

    // Verificar que todas las secciones del CUIP estén revisadas
    const cuip = CuipService.parsarYMigrarCuip(persona.cuip_validacion);
    for (const seccion of cuip) {
      const sinRevisar = seccion.campos.filter(c => c.validado === null);
      if (sinRevisar.length > 0) {
        throw new Error(`La sección "${seccion.nombre}" tiene ${sinRevisar.length} campo(s) sin revisar`);
      }
    }

    const lugar = datosCita.lugar?.trim() || 'C5i Puebla — Área de Toma de Datos Biométricos';
    const fechaCita = datosCita.fecha_cita;
    const notas = datosCita.notas?.trim() || null;
    const enviarNotificacion = datosCita.enviar_notificacion === true;

    // Obtener email del analista como destinatario
    const analista = await this._obtenerEmailAnalista(persona.tramite_alta_id);
    const emailDestino =
      datosCita.email_override?.trim() ||
      analista?.email ||
      'correo.pendiente@c5i.local';

    let citaId;
    let folio;

    // Transacción atómica
    await TramiteAltaModel.transaction(async (connection) => {
      const faseDestino = await this._resolverFaseDestinoCita(connection);
      const maxIntentosFolio = 6;

      // 1. Completar fase CUIP
      await connection.query(
        `UPDATE personas_tramite_alta
         SET fase_cuip = 'completado', fecha_fin_cuip = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [personaId]
      );

      // 2. Mover trámite a la fase disponible para cita programada
      await connection.query(
        `UPDATE tramites_alta SET fase_actual = ?, updated_at = NOW() WHERE id = ?`,
        [faseDestino, persona.tramite_alta_id]
      );

      // 3. Crear registro de cita con reintento ante colisiones de folio.
      for (let intento = 1; intento <= maxIntentosFolio; intento += 1) {
        folio = await this._generarFolio(connection);
        try {
          const [result] = await connection.query(
            `INSERT INTO citas_biometricas
               (persona_tramite_id, tramite_alta_id, folio_cita, fecha_cita, lugar, notas, correo_destinatario, creado_por_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [personaId, persona.tramite_alta_id, folio, fechaCita, lugar, notas, emailDestino, usuarioId]
          );
          citaId = result.insertId;
          break;
        } catch (error) {
          const esUltimoIntento = intento === maxIntentosFolio;
          if (!this._esErrorDuplicadoFolio(error) || esUltimoIntento) {
            throw error;
          }
        }
      }

      if (!citaId) {
        throw new Error('No fue posible generar un folio de cita único. Intente nuevamente.');
      }

      // 4. Historial con folio final confirmado.
      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario)
         VALUES (?, ?, 'validacion_cuip', ?, ?)`,
        [
          persona.tramite_alta_id,
          usuarioId,
          faseDestino,
          `CUIP aprobado. Cita biométrica programada: ${folio}`
        ]
      );

      await this._registrarBitacora(
        connection,
        citaId,
        usuarioId,
        'cita_programada',
        'Cita programada',
        `Cita ${folio} agendada para ${fechaCita}`,
        { fecha_cita: fechaCita, lugar, notificacion_solicitada: enviarNotificacion }
      );
    });

    // Leer cita recién creada
    const cita = await this.obtenerCitaPorId(citaId);

    // Leer persona actualizada
    const personaActualizada = await PersonaTramiteModel.findForCuip(personaId);

    // Generar PDF acuse
    let pdfBuffer;
    let correoEnviado = false;
    try {
      pdfBuffer = await this._generarAcusePDF(cita, personaActualizada);
    } catch (pdfErr) {
      console.error('Error al generar PDF acuse:', pdfErr.message);
    }

    // Enviar correo (no bloquea si falla)
    if (enviarNotificacion && pdfBuffer) {
      correoEnviado = await EmailService.enviarNotificacionCita(
        cita, personaActualizada, emailDestino, pdfBuffer
      );
      if (correoEnviado) {
        const conn = await pool.getConnection();
        try {
          await conn.query(
            'UPDATE citas_biometricas SET notificacion_enviada = TRUE WHERE id = ?',
            [citaId]
          );
        } finally {
          conn.release();
        }
      }
    }

    return { cita, persona: personaActualizada, correoEnviado };
  }

  /**
   * Obtener cita por ID
   */
  async obtenerCitaPorId(citaId) {
    const connection = await pool.getConnection();
    try {
      const [[cita]] = await connection.query(
        `SELECT cb.*, u.nombre_completo AS creado_por_nombre
         FROM citas_biometricas cb
         JOIN usuarios u ON cb.creado_por_id = u.id
         WHERE cb.id = ?`,
        [citaId]
      );
      return cita || null;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener cita de una persona
   */
  async obtenerCitaPorPersona(personaId) {
    const connection = await pool.getConnection();
    try {
      const [[cita]] = await connection.query(
        `SELECT cb.*, u.nombre_completo AS creado_por_nombre
         FROM citas_biometricas cb
         JOIN usuarios u ON cb.creado_por_id = u.id
         WHERE cb.persona_tramite_id = ?
         ORDER BY cb.created_at DESC LIMIT 1`,
        [personaId]
      );
      return cita || null;
    } finally {
      connection.release();
    }
  }

  /**
   * Generar PDF del acuse de cita
   * @returns {Promise<Buffer>}
   */
  _generarAcusePDF(cita, persona) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Acuse Cita ${cita.folio_cita}` } });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const GUINDA = '#6e1530';
        const GOLD = '#b3a060';
        const DARK = '#1a1a1a';
        const GRAY = '#666666';
        const PAGE_W = 595.28 - 100; // A4 - margins

        const nombreCompleto = persona.nombre_completo ||
          `${persona.nombre} ${persona.apellido_paterno} ${persona.apellido_materno || ''}`.trim();
        const fechaObj = new Date(cita.fecha_cita);
        const fechaFormateada = fechaObj.toLocaleDateString('es-MX', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          timeZone: 'America/Mexico_City'
        });
        const horaFormateada = fechaObj.toLocaleTimeString('es-MX', {
          hour: '2-digit', minute: '2-digit', hour12: true,
          timeZone: 'America/Mexico_City'
        });

        // ── Cabecera guinda ──
        doc.rect(0, 0, 595.28, 88).fill(GUINDA);
        doc.fontSize(9).fillColor(GOLD).text('GOBIERNO DEL ESTADO DE PUEBLA', 50, 22, { align: 'left' });
        doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold')
          .text('C5i · Secretaría de Seguridad Pública', 50, 36);
        doc.fontSize(9).fillColor('#e0c8a0').font('Helvetica')
          .text('Sistema de Acreditación y Control de Competencias — SACC5i', 50, 56);
        // Banda dorada
        doc.rect(0, 88, 595.28, 3).fill(GOLD);

        // ── Título del documento ──
        doc.moveDown(2).font('Helvetica-Bold').fontSize(16).fillColor(GUINDA)
          .text('ACUSE DE CITA BIOMÉTRICA', 50, 110, { align: 'center', width: PAGE_W });
        doc.font('Helvetica').fontSize(10).fillColor(GRAY)
          .text('Documento expedido automáticamente por el sistema SACC5i', 50, 132, { align: 'center', width: PAGE_W });

        // Línea separadora
        doc.moveTo(50, 152).lineTo(545, 152).stroke(GOLD);

        let y = 165;

        // ── Folio ──
        doc.rect(50, y, PAGE_W, 38).fill('#fdf6f0').stroke('#e0c0b0');
        doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text('FOLIO DE CITA', 60, y + 6);
        doc.font('Helvetica-Bold').fontSize(18).fillColor(GUINDA)
          .text(cita.folio_cita, 60, y + 16);
        y += 52;

        // ── Datos del elemento ──
        doc.font('Helvetica-Bold').fontSize(10).fillColor(GUINDA).text('Datos del Elemento', 50, y);
        y += 14;
        doc.rect(50, y, PAGE_W, 56).fill('#fafafa').stroke('#dddddd');

        doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text('Nombre completo:', 60, y + 7);
        doc.font('Helvetica').fontSize(12).fillColor(DARK).text(nombreCompleto, 60, y + 19);
        doc.font('Helvetica').fontSize(9).fillColor(GRAY)
          .text(`Puesto: ${persona.puesto_nombre || 'N/A'}   ·   Oficio C3: ${persona.numero_oficio_c3 || 'N/A'}`, 60, y + 37);
        y += 70;

        // ── Detalles de la cita ──
        doc.font('Helvetica-Bold').fontSize(10).fillColor(GUINDA).text('Detalles de la Cita', 50, y);
        y += 14;
        doc.rect(50, y, PAGE_W, 80).fill(GUINDA);

        doc.font('Helvetica').fontSize(8).fillColor(GOLD).text('FECHA', 60, y + 8);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text(fechaFormateada, 60, y + 19);

        doc.font('Helvetica').fontSize(8).fillColor(GOLD).text('HORA', 60, y + 38);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text(horaFormateada, 60, y + 49);

        doc.font('Helvetica').fontSize(8).fillColor(GOLD).text('LUGAR', 310, y + 8);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(cita.lugar, 310, y + 19, { width: 230 });
        y += 94;

        // ── Documentos requeridos ──
        doc.font('Helvetica-Bold').fontSize(10).fillColor(GUINDA).text('Documentos Requeridos', 50, y);
        y += 14;

        const docs = [
          'Identificación oficial vigente (INE, Cédula Profesional o Pasaporte)',
          'CURP impreso y legible',
          'Comprobante de domicilio reciente (no mayor a 3 meses)',
          'Acta de nacimiento (original o copia certificada)',
          `Número de oficio C3: ${persona.numero_oficio_c3 || 'Ver expediente'}`,
          `Este acuse impreso o en dispositivo (folio: ${cita.folio_cita})`
        ];

        doc.rect(50, y, PAGE_W, 14 + (docs.length * 16) + 8).fill('#f8f8f8').stroke('#dddddd');
        y += 10;
        docs.forEach(d => {
          doc.font('Helvetica').fontSize(9).fillColor(DARK)
            .text(`•  ${d}`, 62, y, { width: PAGE_W - 24 });
          y += 16;
        });
        y += 10;

        // ── Nota importante ──
        doc.rect(50, y, PAGE_W, 42).fill('#fff8e1').stroke('#f0c040');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#7a5a00')
          .text('IMPORTANTE:', 60, y + 8);
        doc.font('Helvetica').fontSize(8).fillColor('#555555')
          .text(
            'Presentarse 10 minutos antes del horario indicado. La cita no puede reprogramarse sin aviso con al menos 24 horas de anticipación.',
            60, y + 19, { width: PAGE_W - 20 }
          );
        y += 56;

        // ── Firma ──
        doc.moveTo(50, y + 30).lineTo(200, y + 30).stroke('#cccccc');
        doc.moveTo(345, y + 30).lineTo(545, y + 30).stroke('#cccccc');
        doc.font('Helvetica').fontSize(8).fillColor(GRAY)
          .text('Firma del elemento', 50, y + 35, { width: 150, align: 'center' })
          .text('Vo. Bo. Responsable C5i', 345, y + 35, { width: 200, align: 'center' });
        y += 60;

        // ── Pie de página ──
        doc.moveTo(50, y).lineTo(545, y).stroke(GOLD);
        y += 6;
        doc.font('Helvetica').fontSize(8).fillColor(GRAY)
          .text(
            `Documento generado el ${new Date().toLocaleDateString('es-MX')} por el sistema SACC5i · C5i Puebla · Folio: ${cita.folio_cita}`,
            50, y, { align: 'center', width: PAGE_W }
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Listar citas con filtros y paginación
   */
  async listarCitas({
    busqueda = '',
    estado = '',
    fecha_vista = 'todas',
    fecha_objetivo = '',
    analista_id = '',
    pagina = 1,
    limit = 10
  } = {}) {
    const connection = await pool.getConnection();
    try {
      await CitaLifecycleService.actualizarInasistencias(connection);
      const tablaFinalizados = await this._resolverTablaFinalizados(connection);
      const joinFinalizados = tablaFinalizados
        ? `LEFT JOIN ${tablaFinalizados} fz ON fz.cita_id = cb.id`
        : '';

      const offset = (Number(pagina) - 1) * Number(limit);
      const conditions = [];
      const params = [];

      if (tablaFinalizados) {
        // Cualquier cita ya promovida a finalizados deja de mostrarse en la bandeja de citas.
        conditions.push('fz.id IS NULL');
      }

      if (estado) {
        conditions.push('cb.estado = ?');
        params.push(estado);
      } else {
        // En Citas no se muestran canceladas; se gestionan en rechazados.
        conditions.push("cb.estado <> 'cancelada'");
      }
      if (busqueda) {
        conditions.push(`(CONCAT(pta.nombre, ' ', pta.apellido_paterno) LIKE ? OR cb.folio_cita LIKE ?)`);
        params.push(`%${busqueda}%`, `%${busqueda}%`);
      }

      const analistaId = Number(analista_id);
      if (Number.isFinite(analistaId) && analistaId > 0) {
        conditions.push('ta.usuario_analista_c5_id = ?');
        params.push(analistaId);
      }

      if (fecha_vista === 'hoy') {
        conditions.push('DATE(cb.fecha_cita) = CURDATE()');
      } else if (fecha_vista === 'proximas') {
        conditions.push('DATE(cb.fecha_cita) > CURDATE()');
      } else if (fecha_vista === 'vencidas') {
        conditions.push("DATE(cb.fecha_cita) < CURDATE() AND cb.estado IN ('programada', 'reprogramada')");
      } else if (fecha_vista === 'vencen_hoy') {
        conditions.push("DATE(cb.fecha_cita) = CURDATE() AND cb.estado IN ('programada', 'reprogramada')");
      } else if (fecha_vista === 'proximas_vencer') {
        conditions.push("DATE(cb.fecha_cita) BETWEEN DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND DATE_ADD(CURDATE(), INTERVAL 3 DAY) AND cb.estado IN ('programada', 'reprogramada')");
      } else if (fecha_vista === 'fecha' && fecha_objetivo) {
        conditions.push('DATE(cb.fecha_cita) = ?');
        params.push(fecha_objetivo);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [[{ total }]] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM citas_biometricas cb
         JOIN personas_tramite_alta pta ON cb.persona_tramite_id = pta.id
         JOIN tramites_alta ta ON cb.tramite_alta_id = ta.id
         ${joinFinalizados}
         ${where}`,
        [...params]
      );

      const [citas] = await connection.query(
        `SELECT
           cb.id, cb.folio_cita, cb.fecha_cita, cb.lugar, cb.notas, cb.estado,
           cb.correo_destinatario, cb.notificacion_enviada, cb.created_at,
           DATE_FORMAT(cb.fecha_cita, '%Y-%m-%d') AS fecha_cita_local,
           DATE_FORMAT(cb.fecha_cita, '%H:%i') AS hora_cita_local,
            CASE WHEN DATE(cb.fecha_cita) = CURDATE() THEN 1 ELSE 0 END AS es_dia_cita,
           pta.id AS persona_id,
           CONCAT(pta.nombre, ' ', pta.apellido_paterno, ' ', IFNULL(pta.apellido_materno, '')) AS nombre_completo,
           pta.numero_oficio_c3,
           m.nombre AS municipio_nombre,
           pu.nombre AS puesto_nombre,
           u.nombre_completo AS analista_nombre
         FROM citas_biometricas cb
         JOIN personas_tramite_alta pta ON cb.persona_tramite_id = pta.id
         JOIN tramites_alta ta ON cb.tramite_alta_id = ta.id
         ${joinFinalizados}
         LEFT JOIN municipios m ON ta.municipio_id = m.id
         LEFT JOIN puestos pu ON pta.puesto_id = pu.id
         LEFT JOIN usuarios u ON ta.usuario_analista_c5_id = u.id
         ${where}
         ORDER BY cb.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, Number(limit), Number(offset)]
      );

      return {
        citas: (citas || []).map((cita) => CitaLifecycleService.enriquecerCitaEstadoTemporal(cita)),
        paginacion: {
          total,
          totalPaginas: Math.ceil(total / Number(limit)),
          pagina: Number(pagina),
          limit: Number(limit)
        }
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Estadísticas de citas (hoy, asistencias, inasistencias, disponibles mañana)
   */
  async getEstadisticasCitas({ analista_id = '' } = {}) {
    const connection = await pool.getConnection();
    try {
      await CitaLifecycleService.actualizarInasistencias(connection);

      const analistaId = Number(analista_id);
      const hasAnalistaFilter = Number.isFinite(analistaId) && analistaId > 0;

      const joinTramites = hasAnalistaFilter
        ? 'LEFT JOIN tramites_alta ta ON ta.id = cb.tramite_alta_id'
        : '';
      const whereClause = hasAnalistaFilter ? 'WHERE ta.usuario_analista_c5_id = ?' : '';
      const params = hasAnalistaFilter ? [analistaId] : [];

      const [[row]] = await connection.query(`
        SELECT
          COUNT(CASE WHEN DATE(cb.fecha_cita) = CURDATE() AND cb.estado != 'cancelada' THEN 1 END) AS citas_hoy,
          COUNT(CASE WHEN DATE(cb.fecha_cita) = CURDATE() AND cb.estado = 'completada' THEN 1 END) AS asistencias,
          COUNT(CASE WHEN DATE(cb.fecha_cita) = CURDATE() AND cb.estado = 'cancelada' THEN 1 END) AS inasistencias,
          COUNT(CASE WHEN DATE(cb.fecha_cita) > CURDATE() AND cb.estado IN ('programada', 'reprogramada') THEN 1 END) AS proximas_citas,
          GREATEST(0, 30 - COUNT(CASE WHEN DATE(cb.fecha_cita) = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND cb.estado = 'programada' THEN 1 END)) AS disponibles_manana
        FROM citas_biometricas cb
        ${joinTramites}
        ${whereClause}
      `, params);
      return row || { citas_hoy: 0, asistencias: 0, inasistencias: 0, proximas_citas: 0, disponibles_manana: 30 };
    } finally {
      connection.release();
    }
  }

  /**
   * Actualizar estado de una cita
   */
  async actualizarEstadoCita(citaId, estado) {
    const ESTADOS_VALIDOS = ['programada', 'completada', 'cancelada', 'reprogramada'];
    if (!ESTADOS_VALIDOS.includes(estado)) {
      throw new Error(`Estado inválido: ${estado}`);
    }
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        'UPDATE citas_biometricas SET estado = ?, updated_at = NOW() WHERE id = ?',
        [estado, citaId]
      );
      if (result.affectedRows === 0) throw new Error('Cita no encontrada');

      await this._registrarBitacora(
        connection,
        citaId,
        null,
        'estado_actualizado',
        'Cambio manual de estado',
        `Estado cambiado a ${estado}`,
        { estado }
      );

      return { ok: true };
    } finally {
      connection.release();
    }
  }

  async obtenerBitacoraCita(citaId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT
           cb.id,
           cb.evento,
           cb.titulo,
           cb.detalle,
           cb.metadata,
           cb.created_at,
           u.nombre_completo AS usuario_nombre
         FROM citas_bitacora cb
         LEFT JOIN usuarios u ON u.id = cb.usuario_id
         WHERE cb.cita_id = ?
         ORDER BY cb.created_at DESC`,
        [citaId]
      );

      return rows.map((row) => {
        let metadata = null;
        if (row.metadata) {
          if (typeof row.metadata === 'string') {
            try {
              metadata = JSON.parse(row.metadata);
            } catch {
              metadata = null;
            }
          } else if (typeof row.metadata === 'object') {
            metadata = row.metadata;
          }
        }

        return {
          ...row,
          metadata
        };
      });
    } finally {
      connection.release();
    }
  }

  async reprogramarCita(citaId, usuarioId, { fecha_cita, justificacion, lugar, notas }) {
    const connection = await pool.getConnection();
    try {
      const cita = await this._obtenerCitaConContexto(connection, citaId);
      if (!cita) throw new Error('Cita no encontrada');
      if (!fecha_cita) throw new Error('La nueva fecha y hora es obligatoria');
      if (!justificacion || justificacion.trim().length < 10) {
        throw new Error('La justificación debe tener al menos 10 caracteres');
      }

      await connection.query(
        `UPDATE citas_biometricas
         SET fecha_cita = ?,
             estado = 'programada',
             lugar = COALESCE(?, lugar),
             notas = COALESCE(?, notas),
             updated_at = NOW()
         WHERE id = ?`,
        [fecha_cita, lugar || null, notas || null, citaId]
      );

      await this._registrarBitacora(
        connection,
        citaId,
        usuarioId,
        'cita_reprogramada',
        'Reprogramación de cita',
        justificacion.trim(),
        {
          fecha_anterior: cita.fecha_cita,
          fecha_nueva: fecha_cita,
          lugar_nuevo: lugar || cita.lugar
        }
      );

      const citaActualizada = await this.obtenerCitaPorId(citaId);
      return { cita: citaActualizada };
    } finally {
      connection.release();
    }
  }

  async cancelarCita(citaId, usuarioId, motivo = 'Cancelada por analista') {
    const connection = await pool.getConnection();
    try {
      const cita = await this._obtenerCitaConContexto(connection, citaId);
      if (!cita) throw new Error('Cita no encontrada');

      await connection.query(
        `UPDATE citas_biometricas SET estado = 'cancelada', updated_at = NOW() WHERE id = ?`,
        [citaId]
      );

      // La persona pasa a rechazados para seguimiento posterior.
      await connection.query(
        `UPDATE personas_tramite_alta
         SET rechazado = TRUE,
             motivo_rechazo = ?,
             fase_cuip = 'rechazado_cuip',
             updated_at = NOW()
         WHERE id = ?`,
        [`Cita cancelada/reagendada: ${motivo}`, cita.persona_id]
      );

      await this._registrarBitacora(
        connection,
        citaId,
        usuarioId,
        'cita_cancelada',
        'Cancelación de cita',
        motivo,
        { persona_id: cita.persona_id }
      );

      return { ok: true };
    } finally {
      connection.release();
    }
  }

  async listarFinalizados({ busqueda = '', analista_id = '', pagina = 1, limit = 10 } = {}) {
    const connection = await pool.getConnection();
    try {
      const tablaFinalizados = await this._resolverTablaFinalizados(connection);
      if (!tablaFinalizados) {
        return {
          registros: [],
          paginacion: { total: 0, totalPaginas: 1, pagina: Number(pagina), limit: Number(limit) }
        };
      }

      const parsedPage = Math.max(1, Number(pagina) || 1);
      const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 10));
      const offset = (parsedPage - 1) * parsedLimit;
      const cleanSearch = String(busqueda || '').trim();
      const like = `%${cleanSearch}%`;
      const analistaId = Number(analista_id);
      const hasAnalistaFilter = Number.isFinite(analistaId) && analistaId > 0;

      const whereConditions = [];
      const whereParams = [];

      if (cleanSearch) {
        whereConditions.push(`(
          f.nombre_elemento LIKE ?
          OR IFNULL(f.numero_oficio, '') LIKE ?
          OR IFNULL(f.cuip, '') LIKE ?
        )`);
        whereParams.push(like, like, like);
      }

      const tablaTieneTramiteAltaId = await this._tablaFinalizadosTieneColumna(
        connection,
        tablaFinalizados,
        'tramite_alta_id'
      );
      const joinTramites = tablaTieneTramiteAltaId
        ? 'LEFT JOIN tramites_alta ta ON ta.id = f.tramite_alta_id'
        : '';
      const analistaSelect = tablaTieneTramiteAltaId
        ? 'ta.usuario_analista_c5_id AS analista_id'
        : 'NULL AS analista_id';
      const tablaTieneAcusePersona = await this._tablaFinalizadosTieneColumna(
        connection,
        tablaFinalizados,
        'acuse_persona_relative_path'
      );
      const acusePersonaSelect = tablaTieneAcusePersona
        ? `CASE WHEN f.acuse_persona_relative_path IS NULL THEN FALSE ELSE TRUE END AS acuse_persona_subido,
           f.acuse_persona_original_name`
        : 'FALSE AS acuse_persona_subido, NULL AS acuse_persona_original_name';

      if (hasAnalistaFilter && tablaTieneTramiteAltaId) {
        whereConditions.push('ta.usuario_analista_c5_id = ?');
        whereParams.push(analistaId);
      }

      const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const [[{ total }]] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM ${tablaFinalizados} f
         ${joinTramites}
         ${whereClause}`,
        whereParams
      );

      const [rows] = await connection.query(
        `SELECT
           f.id,
           f.cita_id,
           f.tramite_alta_id,
           f.nombre_elemento,
           f.puesto_elemento,
           f.numero_oficio,
           f.fecha_termino,
           f.cuip,
           f.fase1_estado,
           CASE WHEN f.acuse_relative_path IS NULL THEN FALSE ELSE TRUE END AS constancia_subida,
           CASE WHEN f.acuse_relative_path IS NULL THEN FALSE ELSE TRUE END AS acuse_subido,
           f.acuse_original_name AS constancia_original_name,
           f.acuse_original_name,
           ${acusePersonaSelect},
           f.repositorio_folder_id,
           f.created_at,
           f.updated_at,
            ${analistaSelect}
        FROM ${tablaFinalizados} f
         ${joinTramites}
         ${whereClause}
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`,
        [...whereParams, parsedLimit, offset]
      );

      return {
        registros: rows || [],
        paginacion: {
          total,
          totalPaginas: Math.max(1, Math.ceil(total / parsedLimit)),
          pagina: parsedPage,
          limit: parsedLimit
        }
      };
    } finally {
      connection.release();
    }
  }

  async actualizarFase1Finalizado(finalizadoId, fase1Estado) {
    const estadosValidos = ['pendiente', 'en_revision', 'rechazado', 'firmado'];
    if (!estadosValidos.includes(fase1Estado)) {
      throw new Error('Estado de Fase 1 invalido');
    }

    const connection = await pool.getConnection();
    try {
      const registro = await this._obtenerRegistroFinalizadoPorId(connection, finalizadoId);
      if (!registro) throw new Error('Registro finalizado no encontrado');

      if (registro.acuse_relative_path || registro.acuse_persona_relative_path) {
        throw new Error('No puedes modificar Fase 1 mientras exista un documento cargado');
      }

      const [result] = await connection.query(
        `UPDATE ${registro._tabla_finalizados || 'finalizados'}
         SET fase1_estado = ?, updated_at = NOW()
         WHERE id = ?`,
        [fase1Estado, finalizadoId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Registro finalizado no encontrado');
      }

      return { ok: true };
    } finally {
      connection.release();
    }
  }

  async subirAcuseFinalizado(finalizadoId, file, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const registro = await this._obtenerRegistroFinalizadoPorId(connection, finalizadoId);
      if (!registro) throw new Error('Registro finalizado no encontrado');
      if (registro.fase1_estado !== 'firmado') {
        throw new Error('Debes marcar Fase 1 como Firmado para subir constancia');
      }

      await this._eliminarAcuseActual(connection, registro);

      const saved = await this._guardarAcuseEnRepositorio(connection, registro, file, userId);
      await connection.query(
        `UPDATE ${registro._tabla_finalizados || 'finalizados'}
         SET acuse_original_name = ?,
             acuse_stored_name = ?,
             acuse_relative_path = ?,
             acuse_uploaded_at = NOW(),
             acuse_uploaded_by_id = ?,
             repositorio_folder_id = ?,
             repositorio_file_id = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          saved.originalName,
          saved.storedName,
          saved.relativePath,
          userId || null,
          saved.folderId,
          saved.repoFileId,
          finalizadoId
        ]
      );

      await connection.commit();
      return { ok: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async eliminarAcuseFinalizado(finalizadoId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const registro = await this._obtenerRegistroFinalizadoPorId(connection, finalizadoId);
      if (!registro) throw new Error('Registro finalizado no encontrado');
      const shouldKeepFolderId = Boolean(registro.acuse_persona_relative_path);

      await this._eliminarAcuseActual(connection, registro);

      await connection.query(
        `UPDATE ${registro._tabla_finalizados || 'finalizados'}
         SET acuse_original_name = NULL,
             acuse_stored_name = NULL,
             acuse_relative_path = NULL,
             acuse_uploaded_at = NULL,
             acuse_uploaded_by_id = NULL,
             repositorio_folder_id = ?,
             repositorio_file_id = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [shouldKeepFolderId ? registro.repositorio_folder_id : null, finalizadoId]
      );

      await connection.commit();
      return { ok: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async subirAcusePersonaFinalizado(finalizadoId, file, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const registro = await this._obtenerRegistroFinalizadoPorId(connection, finalizadoId);
      if (!registro) throw new Error('Registro finalizado no encontrado');
      if (registro.fase1_estado !== 'firmado') {
        throw new Error('Debes marcar Fase 1 como Firmado para subir acuse de persona');
      }

      await this._asegurarColumnasAcusePersona(connection, registro._tabla_finalizados || 'finalizados');
      await this._eliminarAcusePersonaActual(connection, registro);

      const saved = await this._guardarAcusePersonaEnRepositorio(connection, registro, file, userId);
      await connection.query(
        `UPDATE ${registro._tabla_finalizados || 'finalizados'}
         SET acuse_persona_original_name = ?,
             acuse_persona_stored_name = ?,
             acuse_persona_relative_path = ?,
             acuse_persona_uploaded_at = NOW(),
             acuse_persona_uploaded_by_id = ?,
             acuse_persona_repositorio_file_id = ?,
             repositorio_folder_id = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          saved.originalName,
          saved.storedName,
          saved.relativePath,
          userId || null,
          saved.repoFileId,
          saved.folderId,
          finalizadoId
        ]
      );

      await connection.commit();
      return { ok: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async eliminarAcusePersonaFinalizado(finalizadoId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const registro = await this._obtenerRegistroFinalizadoPorId(connection, finalizadoId);
      if (!registro) throw new Error('Registro finalizado no encontrado');

      await this._asegurarColumnasAcusePersona(connection, registro._tabla_finalizados || 'finalizados');
      await this._eliminarAcusePersonaActual(connection, registro);

      const shouldKeepFolderId = Boolean(registro.acuse_relative_path);
      await connection.query(
        `UPDATE ${registro._tabla_finalizados || 'finalizados'}
         SET acuse_persona_original_name = NULL,
             acuse_persona_stored_name = NULL,
             acuse_persona_relative_path = NULL,
             acuse_persona_uploaded_at = NULL,
             acuse_persona_uploaded_by_id = NULL,
             acuse_persona_repositorio_file_id = NULL,
             repositorio_folder_id = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [shouldKeepFolderId ? registro.repositorio_folder_id : null, finalizadoId]
      );

      await connection.commit();
      return { ok: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async obtenerConstanciaFinalizado(finalizadoId) {
    const connection = await pool.getConnection();
    try {
      const registro = await this._obtenerRegistroFinalizadoPorId(connection, finalizadoId);
      if (!registro) throw new Error('Registro finalizado no encontrado');
      if (!registro.acuse_relative_path) {
        throw new Error('Este registro no tiene constancia cargada');
      }

      const absolutePath = path.resolve('uploads', registro.acuse_relative_path);
      if (!fs.existsSync(absolutePath)) {
        throw new Error('No se encontro el archivo de constancia en el servidor');
      }

      return {
        absolutePath,
        originalName: registro.acuse_original_name || 'constancia.pdf'
      };
    } finally {
      connection.release();
    }
  }

  async obtenerAcusePersonaFinalizado(finalizadoId) {
    const connection = await pool.getConnection();
    try {
      const registro = await this._obtenerRegistroFinalizadoPorId(connection, finalizadoId);
      if (!registro) throw new Error('Registro finalizado no encontrado');

      await this._asegurarColumnasAcusePersona(connection, registro._tabla_finalizados || 'finalizados');
      if (!registro.acuse_persona_relative_path) {
        throw new Error('Este registro no tiene acuse de persona cargado');
      }

      const absolutePath = path.resolve('uploads', registro.acuse_persona_relative_path);
      if (!fs.existsSync(absolutePath)) {
        throw new Error('No se encontro el archivo de acuse de persona en el servidor');
      }

      return {
        absolutePath,
        originalName: registro.acuse_persona_original_name || 'acuse_persona.pdf'
      };
    } finally {
      connection.release();
    }
  }

  async finalizarFlujoCita(
    citaId,
    usuarioId,
    {
      asistio,
      sim_sin_antecedentes,
      suim_resultado,
      justificacion,
      cuip_capturado
    }
  ) {
    const connection = await pool.getConnection();
    try {
      const cita = await this._obtenerCitaConContexto(connection, citaId);
      if (!cita) throw new Error('Cita no encontrada');

      const suimResultadoNormalizado = suim_resultado || (sim_sin_antecedentes === true ? 'sin_antecedentes' : null);
      const requiereJustificacion = suimResultadoNormalizado === 'antecedentes_menores';
      const resultadoValido = ['sin_antecedentes', 'antecedentes_menores', 'antecedentes_graves'].includes(suimResultadoNormalizado);

      if (asistio !== true) {
        await connection.query(
          `UPDATE citas_biometricas SET estado = 'cancelada', updated_at = NOW() WHERE id = ?`,
          [citaId]
        );

        await connection.query(
          `UPDATE personas_tramite_alta
           SET rechazado = TRUE,
               motivo_rechazo = ?,
               fase_cuip = 'rechazado_cuip',
               updated_at = NOW()
           WHERE id = ?`,
          ['No asistió a la cita biométrica', cita.persona_id]
        );

        await this._registrarBitacora(
          connection,
          citaId,
          usuarioId,
          'inasistencia',
          'No asistió a cita',
          'Se marcó inasistencia desde filtro final',
          null
        );

        return { ok: true, estado: 'cancelada', rechazado: true };
      }

      if (!resultadoValido) {
        throw new Error('Debes seleccionar un resultado SUIM válido');
      }

      if (requiereJustificacion && (!justificacion || justificacion.trim().length < 15)) {
        throw new Error('La justificación para antecedentes menores debe tener al menos 15 caracteres');
      }

      if (suimResultadoNormalizado !== 'antecedentes_graves' && (!cuip_capturado || !String(cuip_capturado).trim())) {
        throw new Error('La captura de CUIP es obligatoria para finalizar el trámite');
      }

      await connection.query(
        `UPDATE citas_biometricas SET estado = 'completada', updated_at = NOW() WHERE id = ?`,
        [citaId]
      );

      await this._registrarBitacora(
        connection,
        citaId,
        usuarioId,
        'checkin',
        'Validación de asistencia',
        'El solicitante asistió físicamente a la cita',
        null
      );

      if (suimResultadoNormalizado === 'antecedentes_graves') {
        const faseRechazo = await this._resolverFaseRechazo(connection);

        await connection.query(
          `UPDATE personas_tramite_alta
           SET rechazado = TRUE,
               motivo_rechazo = ?,
               fase_cuip = 'rechazado_cuip',
               updated_at = NOW()
           WHERE id = ?`,
          ['Antecedentes graves detectados en consulta SUIM', cita.persona_id]
        );

        await connection.query(
          `UPDATE tramites_alta SET fase_actual = ?, updated_at = NOW() WHERE id = ?`,
          [faseRechazo, cita.tramite_alta_id]
        );

        await connection.query(
          `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario)
           VALUES (?, ?, ?, ?, 'Trámite rechazado por antecedentes graves detectados en SUIM')`,
          [
            cita.tramite_alta_id,
            usuarioId,
            cita.tramite_fase_actual || 'cita_programada',
            faseRechazo
          ]
        );

        await this._registrarBitacora(
          connection,
          citaId,
          usuarioId,
          'tramite_rechazado',
          'Rechazo por SUIM',
          'Se rechazó el trámite por antecedentes graves',
          { suim_resultado: suimResultadoNormalizado }
        );

        return { ok: true, estado: 'completada', rechazado: true, finalizado: false };
      }

      if (suimResultadoNormalizado === 'sin_antecedentes' || suimResultadoNormalizado === 'antecedentes_menores') {
        await connection.query(
          `UPDATE tramites_alta SET fase_actual = 'finalizado', updated_at = NOW() WHERE id = ?`,
          [cita.tramite_alta_id]
        );

        const comentarioHistorial = suimResultadoNormalizado === 'antecedentes_menores'
          ? 'Trámite finalizado con antecedentes menores en SUIM y justificación registrada'
          : 'Trámite finalizado después de validación de cita y filtro SIM sin antecedentes';

        await connection.query(
          `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario)
           VALUES (?, ?, ?, 'finalizado', ?)`,
          [
            cita.tramite_alta_id,
            usuarioId,
            cita.tramite_fase_actual || 'cita_programada',
            comentarioHistorial
          ]
        );

        await this._registrarBitacora(
          connection,
          citaId,
          usuarioId,
          'tramite_finalizado',
          'Cierre de trámite y generación de acuse',
          suimResultadoNormalizado === 'antecedentes_menores'
            ? 'Validación completada con antecedentes menores y justificación del analista'
            : 'Validación completada sin antecedentes en SIM',
          {
            sim_sin_antecedentes: suimResultadoNormalizado === 'sin_antecedentes',
            suim_resultado: suimResultadoNormalizado,
            justificacion: requiereJustificacion ? justificacion.trim() : null,
            cuip_capturado: String(cuip_capturado || '').trim()
          }
        );

        if (await this._resolverTablaFinalizados(connection)) {
          await this._upsertFinalizado(connection, cita, cuip_capturado);
        }
      }

      return {
        ok: true,
        estado: 'completada',
        finalizado: true,
        rechazado: false,
        suim_resultado: suimResultadoNormalizado
      };
    } finally {
      connection.release();
    }
  }
}

export default new CitaService();
