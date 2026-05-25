import fs from 'fs';
import path from 'path';
import pool from '../config/database.js';

class BajaService {
  _leerCatalogoBajas() {
    const filePath = path.resolve('docs', 'tipo_y_motivo_De_baja.txt');
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    const parsed = JSON.parse(`[${raw}]`);

    const catalogo = {};
    for (const bloque of parsed) {
      for (const [tipo, motivos] of Object.entries(bloque || {})) {
        if (!catalogo[tipo]) catalogo[tipo] = [];
        const lista = Array.isArray(motivos) ? motivos : [];
        for (const motivo of lista) {
          if (!catalogo[tipo].includes(motivo)) {
            catalogo[tipo].push(motivo);
          }
        }
      }
    }

    return catalogo;
  }

  _normalizarCatalogoTexto(value = '') {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  _resolverTipoMotivoCatalogo(tipoInput = '', motivoInput = '', catalogo = this._leerCatalogoBajas()) {
    const tipoNormalizado = this._normalizarCatalogoTexto(tipoInput);
    const tipoCanonical = Object.keys(catalogo || {}).find(
      (tipo) => this._normalizarCatalogoTexto(tipo) === tipoNormalizado
    );

    if (!tipoCanonical) {
      throw new Error('Tipo de baja invalido');
    }

    const motivosPermitidos = catalogo[tipoCanonical] || [];
    if (motivosPermitidos.length === 0) {
      const motivoNormalizado = this._normalizarCatalogoTexto(motivoInput);
      if (motivoNormalizado && motivoNormalizado !== this._normalizarCatalogoTexto(tipoCanonical)) {
        throw new Error('Motivo de baja invalido para el tipo seleccionado');
      }
      return {
        tipoBaja: tipoCanonical,
        motivoBaja: tipoCanonical
      };
    }

    const motivoNormalizado = this._normalizarCatalogoTexto(motivoInput);
    const motivoCanonical = motivosPermitidos.find(
      (motivo) => this._normalizarCatalogoTexto(motivo) === motivoNormalizado
    );

    if (!motivoCanonical) {
      throw new Error('Motivo de baja invalido para el tipo seleccionado');
    }

    return {
      tipoBaja: tipoCanonical,
      motivoBaja: motivoCanonical
    };
  }

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

  async obtenerCatalogoBajas() {
    const catalogo = this._leerCatalogoBajas();
    const tipos = Object.keys(catalogo);
    const totalMotivos = tipos.reduce((acc, tipo) => acc + (catalogo[tipo]?.length || 0), 0);

    return {
      catalogo,
      tipos,
      totalTipos: tipos.length,
      totalMotivos
    };
  }

  async listarDisponiblesBaja({ busqueda = '', pagina = 1, limit = 10, analistaId = null, municipioId = null } = {}) {
    const connection = await pool.getConnection();
    try {
      const tablaFinalizados = await this._resolverTablaFinalizados(connection);
      if (!tablaFinalizados) {
        return {
          registros: [],
          paginacion: { total: 0, totalPaginas: 1, pagina: Number(pagina), limit: Number(limit) }
        };
      }

      const tieneIsBaja = await this._tablaFinalizadosTieneColumna(connection, tablaFinalizados, 'is_baja');
      const parsedPage = Math.max(1, Number(pagina) || 1);
      const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 10));
      const offset = (parsedPage - 1) * parsedLimit;
      const cleanSearch = String(busqueda || '').trim();
      const like = `%${cleanSearch}%`;
      const filtroBaja = tieneIsBaja ? 'AND IFNULL(f.is_baja, 0) = 0' : '';
      const parsedAnalistaId = Number(analistaId) || 0;
      const filtroAnalista = parsedAnalistaId > 0 ? 'AND t.usuario_analista_c5_id = ?' : '';
      const analistaParams = parsedAnalistaId > 0 ? [parsedAnalistaId] : [];
      const parsedMunicipioId = Number(municipioId) || 0;
      const filtroMunicipio = parsedMunicipioId > 0 ? 'AND t.municipio_id = ?' : '';
      const municipioParams = parsedMunicipioId > 0 ? [parsedMunicipioId] : [];

      const [[{ total }]] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM ${tablaFinalizados} f
         LEFT JOIN tramites_alta t ON t.id = f.tramite_alta_id
         LEFT JOIN municipios m ON m.id = t.municipio_id
         WHERE (? = ''
            OR f.nombre_elemento LIKE ?
            OR IFNULL(f.numero_oficio, '') LIKE ?
            OR IFNULL(f.cuip, '') LIKE ?
            OR IFNULL(m.nombre, '') LIKE ?)
          ${filtroAnalista}
          ${filtroMunicipio}
          ${filtroBaja}`,
        [cleanSearch, like, like, like, like, ...analistaParams, ...municipioParams]
      );

      const [rows] = await connection.query(
        `SELECT
           f.id,
           f.tramite_alta_id,
           f.persona_tramite_id,
           f.nombre_elemento,
           f.puesto_elemento,
           f.numero_oficio,
           f.fecha_termino,
           f.cuip,
           IFNULL(m.nombre, '') AS municipio_nombre,
           f.created_at,
           f.updated_at
         FROM ${tablaFinalizados} f
         LEFT JOIN tramites_alta t ON t.id = f.tramite_alta_id
         LEFT JOIN municipios m ON m.id = t.municipio_id
         WHERE (? = ''
            OR f.nombre_elemento LIKE ?
            OR IFNULL(f.numero_oficio, '') LIKE ?
            OR IFNULL(f.cuip, '') LIKE ?
            OR IFNULL(m.nombre, '') LIKE ?)
          ${filtroAnalista}
          ${filtroMunicipio}
          ${filtroBaja}
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`,
        [cleanSearch, like, like, like, like, ...analistaParams, ...municipioParams, parsedLimit, offset]
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

  async listarBajasRegistradas({ busqueda = '', pagina = 1, limit = 10, analistaId = null, municipioId = null } = {}) {
    const connection = await pool.getConnection();
    try {
      const tablaFinalizados = await this._resolverTablaFinalizados(connection);
      if (!tablaFinalizados) {
        return {
          registros: [],
          paginacion: { total: 0, totalPaginas: 1, pagina: Number(pagina), limit: Number(limit) }
        };
      }

      const tieneIsBaja = await this._tablaFinalizadosTieneColumna(connection, tablaFinalizados, 'is_baja');
      const tieneBajaTipo = await this._tablaFinalizadosTieneColumna(connection, tablaFinalizados, 'baja_tipo');
      const tieneBajaMotivo = await this._tablaFinalizadosTieneColumna(connection, tablaFinalizados, 'baja_motivo');
      const tieneBajaFecha = await this._tablaFinalizadosTieneColumna(connection, tablaFinalizados, 'baja_fecha');
      const tieneNumeroOficioMunicipio = await this._tablaFinalizadosTieneColumna(connection, tablaFinalizados, 'numero_oficio_municipio');

      if (!tieneIsBaja || !tieneBajaTipo || !tieneBajaMotivo || !tieneBajaFecha || !tieneNumeroOficioMunicipio) {
        return {
          registros: [],
          paginacion: { total: 0, totalPaginas: 1, pagina: Number(pagina) || 1, limit: Number(limit) || 10 }
        };
      }

      const parsedPage = Math.max(1, Number(pagina) || 1);
      const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 10));
      const offset = (parsedPage - 1) * parsedLimit;
      const cleanSearch = String(busqueda || '').trim();
      const like = `%${cleanSearch}%`;
      const parsedAnalistaId = Number(analistaId) || 0;
      const filtroAnalista = parsedAnalistaId > 0 ? 'AND t.usuario_analista_c5_id = ?' : '';
      const analistaParams = parsedAnalistaId > 0 ? [parsedAnalistaId] : [];
      const parsedMunicipioId = Number(municipioId) || 0;
      const filtroMunicipio = parsedMunicipioId > 0 ? 'AND t.municipio_id = ?' : '';
      const municipioParams = parsedMunicipioId > 0 ? [parsedMunicipioId] : [];

      const [[{ total }]] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM ${tablaFinalizados} f
         LEFT JOIN tramites_alta t ON t.id = f.tramite_alta_id
         LEFT JOIN municipios m ON m.id = t.municipio_id
         WHERE IFNULL(f.is_baja, 0) = 1
           AND (? = ''
            OR f.nombre_elemento LIKE ?
            OR IFNULL(f.numero_oficio, '') LIKE ?
            OR IFNULL(f.numero_oficio_municipio, '') LIKE ?
            OR IFNULL(f.cuip, '') LIKE ?
            OR IFNULL(m.nombre, '') LIKE ?
            OR IFNULL(f.baja_tipo, '') LIKE ?
            OR IFNULL(f.baja_motivo, '') LIKE ?)
          ${filtroAnalista}
          ${filtroMunicipio}`,
        [cleanSearch, like, like, like, like, like, like, like, ...analistaParams, ...municipioParams]
      );

      const [rows] = await connection.query(
        `SELECT
           f.id,
           f.tramite_alta_id,
           f.persona_tramite_id,
           f.nombre_elemento,
           f.puesto_elemento,
           f.numero_oficio,
           f.numero_oficio_municipio,
           f.fecha_termino,
           f.cuip,
           IFNULL(m.nombre, '') AS municipio_nombre,
           f.baja_tipo,
           f.baja_motivo,
           f.baja_fecha,
           f.baja_observaciones,
           f.baja_registrada_at,
           f.updated_at
         FROM ${tablaFinalizados} f
         LEFT JOIN tramites_alta t ON t.id = f.tramite_alta_id
         LEFT JOIN municipios m ON m.id = t.municipio_id
         WHERE IFNULL(f.is_baja, 0) = 1
           AND (? = ''
            OR f.nombre_elemento LIKE ?
            OR IFNULL(f.numero_oficio, '') LIKE ?
            OR IFNULL(f.numero_oficio_municipio, '') LIKE ?
            OR IFNULL(f.cuip, '') LIKE ?
            OR IFNULL(m.nombre, '') LIKE ?
            OR IFNULL(f.baja_tipo, '') LIKE ?
            OR IFNULL(f.baja_motivo, '') LIKE ?)
          ${filtroAnalista}
          ${filtroMunicipio}
         ORDER BY IFNULL(f.baja_fecha, DATE(f.updated_at)) DESC, f.updated_at DESC
         LIMIT ? OFFSET ?`,
        [cleanSearch, like, like, like, like, like, like, like, ...analistaParams, parsedLimit, offset]
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

  async registrarBaja(finalizadoId, data = {}, userId = null) {
    const connection = await pool.getConnection();
    try {
      const tablaFinalizados = await this._resolverTablaFinalizados(connection);
      if (!tablaFinalizados) throw new Error('No existe la tabla de finalizados');

      const columnasRequeridas = ['is_baja', 'baja_tipo', 'baja_motivo', 'baja_fecha', 'baja_observaciones', 'baja_usuario_id', 'baja_registrada_at', 'numero_oficio_municipio'];
      for (const column of columnasRequeridas) {
        const exists = await this._tablaFinalizadosTieneColumna(connection, tablaFinalizados, column);
        if (!exists) {
          throw new Error('La base de datos no tiene columnas de baja. Ejecuta migraciones.');
        }
      }

      const tipoBajaRaw = String(data.tipo_baja || '').trim();
      const motivoBajaRaw = String(data.motivo_baja || '').trim();
      const fechaBaja = String(data.fecha_baja || '').trim();
      const numeroOficioMunicipio = String(data.numero_oficio_municipio || '').trim();
      const observaciones = String(data.observaciones || '').trim();

      if (!tipoBajaRaw || !motivoBajaRaw) {
        throw new Error('Tipo y motivo de baja son obligatorios');
      }

      const catalogo = this._leerCatalogoBajas();
      const { tipoBaja, motivoBaja } = this._resolverTipoMotivoCatalogo(tipoBajaRaw, motivoBajaRaw, catalogo);

      const registro = await this._obtenerRegistroFinalizadoPorId(connection, finalizadoId);
      if (!registro) throw new Error('Registro finalizado no encontrado');
      if (Number(registro.is_baja || 0) === 1) {
        throw new Error('Este elemento ya fue dado de baja');
      }

      await connection.query(
        `UPDATE ${registro._tabla_finalizados || 'finalizados'}
         SET is_baja = 1,
             baja_tipo = ?,
             baja_motivo = ?,
             baja_fecha = ?,
             numero_oficio_municipio = ?,
             baja_observaciones = ?,
             baja_usuario_id = ?,
             baja_registrada_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [
          tipoBaja,
          motivoBaja,
          fechaBaja || new Date().toISOString().slice(0, 10),
          numeroOficioMunicipio || null,
          observaciones || null,
          userId || null,
          Number(finalizadoId)
        ]
      );

      return { ok: true };
    } finally {
      connection.release();
    }
  }

  _normalizarEditablePayload(data = {}) {
    const nombreElemento = String(data.nombre_elemento || '').trim();
    const apellidoPaterno = String(data.apellido_paterno || '').trim();
    const apellidoMaterno = String(data.apellido_materno || '').trim();
    const municipioNombre = String(data.municipio_nombre || '').trim();
    const cuip = String(data.cuip || '').trim();
    const numeroOficioMunicipio = String(data.numero_oficio_municipio || data.numero_oficio || '').trim();

    const tipoBaja = String(data.tipo_baja || data.baja_tipo || '').trim();
    const motivoBaja = String(data.motivo_baja || data.baja_motivo || '').trim();
    const fechaBaja = String(data.fecha_baja || data.baja_fecha || '').trim();
    const observaciones = String(data.observaciones || '').trim();

    return {
      nombreElemento,
      apellidoPaterno,
      apellidoMaterno,
      municipioNombre,
      cuip,
      numeroOficioMunicipio,
      tipoBaja,
      motivoBaja,
      fechaBaja,
      observaciones
    };
  }

  async listarBajasEditables({ busqueda = '', usuarioId } = {}) {
    if (!usuarioId) {
      throw new Error('Usuario invalido para listar registros editables');
    }

    const connection = await pool.getConnection();
    try {
      const cleanSearch = String(busqueda || '').trim();
      const like = `%${cleanSearch}%`;

      const [rows] = await connection.query(
        `SELECT
           id,
           usuario_id,
           nombre_elemento,
           apellido_paterno,
           apellido_materno,
           municipio_nombre,
           cuip,
           numero_oficio_municipio,
           baja_tipo,
           baja_motivo,
           baja_fecha,
           observaciones,
           created_at,
           updated_at
         FROM bajas_editables_exportacion
         WHERE usuario_id = ?
           AND (? = ''
            OR nombre_elemento LIKE ?
            OR apellido_paterno LIKE ?
            OR IFNULL(apellido_materno, '') LIKE ?
            OR IFNULL(cuip, '') LIKE ?
            OR IFNULL(numero_oficio_municipio, '') LIKE ?
            OR IFNULL(municipio_nombre, '') LIKE ?
            OR IFNULL(baja_tipo, '') LIKE ?
            OR IFNULL(baja_motivo, '') LIKE ?)
         ORDER BY created_at DESC`,
        [Number(usuarioId), cleanSearch, like, like, like, like, like, like, like, like]
      );

      return { registros: rows || [] };
    } finally {
      connection.release();
    }
  }

  async crearBajaEditable(data = {}, usuarioId) {
    if (!usuarioId) {
      throw new Error('Usuario invalido para guardar registro editable');
    }

    const payload = this._normalizarEditablePayload(data);
    if (!payload.nombreElemento || !payload.apellidoPaterno || !payload.municipioNombre || !payload.tipoBaja || !payload.motivoBaja || !payload.fechaBaja) {
      throw new Error('Nombre, apellido paterno, municipio, tipo, motivo y fecha de baja son obligatorios');
    }

    const catalogo = this._leerCatalogoBajas();
    const { tipoBaja, motivoBaja } = this._resolverTipoMotivoCatalogo(payload.tipoBaja, payload.motivoBaja, catalogo);

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        `INSERT INTO bajas_editables_exportacion (
          usuario_id,
          nombre_elemento,
          apellido_paterno,
          apellido_materno,
          municipio_nombre,
          cuip,
          numero_oficio_municipio,
          baja_tipo,
          baja_motivo,
          baja_fecha,
          observaciones,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          Number(usuarioId),
          payload.nombreElemento,
          payload.apellidoPaterno,
          payload.apellidoMaterno || null,
          payload.municipioNombre,
          payload.cuip || null,
          payload.numeroOficioMunicipio || null,
          tipoBaja,
          motivoBaja,
          payload.fechaBaja,
          payload.observaciones || null
        ]
      );

      const [[row]] = await connection.query(
        `SELECT
           id,
           usuario_id,
           nombre_elemento,
           apellido_paterno,
           apellido_materno,
           municipio_nombre,
           cuip,
           numero_oficio_municipio,
           baja_tipo,
           baja_motivo,
           baja_fecha,
           observaciones,
           created_at,
           updated_at
         FROM bajas_editables_exportacion
         WHERE id = ? AND usuario_id = ?
         LIMIT 1`,
        [Number(result.insertId), Number(usuarioId)]
      );

      return { registro: row || null };
    } finally {
      connection.release();
    }
  }

  async editarBajaEditable(id, data = {}, usuarioId) {
    const editableId = Number(id);
    if (!editableId || editableId <= 0) {
      throw new Error('ID de registro editable invalido');
    }
    if (!usuarioId) {
      throw new Error('Usuario invalido para actualizar registro editable');
    }

    const payload = this._normalizarEditablePayload(data);
    if (!payload.nombreElemento || !payload.apellidoPaterno || !payload.municipioNombre || !payload.tipoBaja || !payload.motivoBaja || !payload.fechaBaja) {
      throw new Error('Nombre, apellido paterno, municipio, tipo, motivo y fecha de baja son obligatorios');
    }

    const catalogo = this._leerCatalogoBajas();
    const { tipoBaja, motivoBaja } = this._resolverTipoMotivoCatalogo(payload.tipoBaja, payload.motivoBaja, catalogo);

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        `UPDATE bajas_editables_exportacion
         SET nombre_elemento = ?,
             apellido_paterno = ?,
             apellido_materno = ?,
             municipio_nombre = ?,
             cuip = ?,
           numero_oficio_municipio = ?,
             baja_tipo = ?,
             baja_motivo = ?,
             baja_fecha = ?,
             observaciones = ?,
             updated_at = NOW()
         WHERE id = ? AND usuario_id = ?`,
        [
          payload.nombreElemento,
          payload.apellidoPaterno,
          payload.apellidoMaterno || null,
          payload.municipioNombre,
          payload.cuip || null,
          payload.numeroOficioMunicipio || null,
          tipoBaja,
          motivoBaja,
          payload.fechaBaja,
          payload.observaciones || null,
          editableId,
          Number(usuarioId)
        ]
      );

      if (Number(result.affectedRows || 0) === 0) {
        throw new Error('Registro editable no encontrado');
      }

      const [[row]] = await connection.query(
        `SELECT
           id,
           usuario_id,
           nombre_elemento,
           apellido_paterno,
           apellido_materno,
           municipio_nombre,
           cuip,
           numero_oficio_municipio,
           baja_tipo,
           baja_motivo,
           baja_fecha,
           observaciones,
           created_at,
           updated_at
         FROM bajas_editables_exportacion
         WHERE id = ? AND usuario_id = ?
         LIMIT 1`,
        [editableId, Number(usuarioId)]
      );

      return { registro: row || null };
    } finally {
      connection.release();
    }
  }

  async eliminarBajaEditable(id, usuarioId) {
    const editableId = Number(id);
    if (!editableId || editableId <= 0) {
      throw new Error('ID de registro editable invalido');
    }
    if (!usuarioId) {
      throw new Error('Usuario invalido para eliminar registro editable');
    }

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        `DELETE FROM bajas_editables_exportacion
         WHERE id = ? AND usuario_id = ?`,
        [editableId, Number(usuarioId)]
      );

      if (Number(result.affectedRows || 0) === 0) {
        throw new Error('Registro editable no encontrado');
      }

      return { ok: true };
    } finally {
      connection.release();
    }
  }
}

export default new BajaService();
