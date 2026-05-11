import pool from '../config/database.js';

const DESTINATARIO_DEFAULT = {
  area: 'DIRECCIÓN DE TELECOMUNICACIONES DEL C5I',
  funcionario: 'ALEJANDRA LUIS COSMES',
  cargo: 'DIRECTORA DE TELECOMUNICACIONES DEL C5I'
};

const normalizarReferenciaVolante = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join('|') || 'N/A';
  }

  if (!value) return 'N/A';

  const opciones = String(value)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);

  return opciones.join('|') || 'N/A';
};

const toUpperTrim = (value) => String(value ?? '').trim().toUpperCase();

const normalizarDestinatario = (datos = {}) => ({
  ...datos,
  area: toUpperTrim(datos.area) || DESTINATARIO_DEFAULT.area,
  funcionario: toUpperTrim(datos.funcionario) || DESTINATARIO_DEFAULT.funcionario,
  cargo: toUpperTrim(datos.cargo) || DESTINATARIO_DEFAULT.cargo
});

const normalizarTipoSolicitud = (value) => toUpperTrim(value);

const ACCIONES_HISTORIAL_VALIDAS = new Set(['ELIMINADO', 'ELIMINACION_MASIVA', 'VACIADO_TABLA']);

const normalizarAccionHistorial = (accion) => {
  const valor = toUpperTrim(accion);
  return ACCIONES_HISTORIAL_VALIDAS.has(valor) ? valor : 'ELIMINADO';
};

const getColumnNames = async (connection, tableName) => {
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
};

const buildReferenciaSelect = (hasVolanteColumn) =>
  hasVolanteColumn ? 'c.volante_numero' : 'NULL AS volante_numero';

const buildHistorialReferenciaSelect = (hasVolanteColumn) =>
  hasVolanteColumn ? 'h.volante_numero' : 'NULL AS volante_numero';

/**
 * CcpModel — Copias de Conocimiento
 * Acceso directo a tabla copias_conocimiento
 */
class CcpModel {
  /**
   * Listar registros con paginación y filtros
   */
  async listar({ busqueda = '', pagina = 1, limit = 10 } = {}) {
    const offset = (pagina - 1) * limit;
    const connection = await pool.getConnection();
    try {
      const columns = await getColumnNames(connection, 'copias_conocimiento');
      const hasVolanteColumn = columns.has('volante_numero');
      const volanteSelect = buildReferenciaSelect(hasVolanteColumn);
      let whereClause = '';
      const params = [];

      if (busqueda.trim()) {
        whereClause = `WHERE (
          CONCAT('SSP/SII/C5I/DT/', c.numero_oficio_seq, '/', c.anio) LIKE ? OR
          c.area LIKE ? OR
          c.funcionario LIKE ? OR
          c.cargo LIKE ? OR
          c.oficio_referencia LIKE ?
        )`;
        const like = `%${busqueda}%`;
        params.push(like, like, like, like, like);
      }

      const [[{ total }]] = await connection.query(
        `SELECT COUNT(*) as total FROM copias_conocimiento c ${whereClause}`,
        params
      );

      const [rows] = await connection.query(
        `SELECT
          c.id,
          c.numero_oficio_seq,
          c.anio,
          CONCAT('SSP/SII/C5I/DT/', c.numero_oficio_seq, '/', c.anio) AS numero_oficio,
          DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
          c.area,
          c.funcionario,
          c.cargo,
          c.oficio_referencia,
          DATE_FORMAT(c.fecha_referencia, '%Y-%m-%d') AS fecha_referencia,
          c.tipo_solicitud,
          c.referencia_volante,
          c.folio_numero,
          ${volanteSelect},
          c.creado_por_id,
          c.created_at,
          c.updated_at
        FROM copias_conocimiento c
        ${whereClause}
        ORDER BY c.id DESC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return {
        data: rows,
        total,
        pagina,
        totalPaginas: Math.ceil(total / limit)
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener por ID
   */
  async obtenerPorId(id) {
    const connection = await pool.getConnection();
    try {
      const [[row]] = await connection.query(
        `SELECT
          c.*,
          CONCAT('SSP/SII/C5I/DT/', c.numero_oficio_seq, '/', c.anio) AS numero_oficio,
          DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
          DATE_FORMAT(c.fecha_referencia, '%Y-%m-%d') AS fecha_referencia
        FROM copias_conocimiento c WHERE c.id = ?`,
        [id]
      );
      return row || null;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener último número de oficio del año
   */
  async ultimoNumeroAnio(anio) {
    const connection = await pool.getConnection();
    try {
      const [[row]] = await connection.query(
        'SELECT MAX(numero_oficio_seq) AS ultimo FROM copias_conocimiento WHERE anio = ?',
        [anio]
      );
      return row.ultimo || 0;
    } finally {
      connection.release();
    }
  }

  /**
   * Crear registro
   */
  async crear(datos) {
    const connection = await pool.getConnection();
    try {
      const columns = await getColumnNames(connection, 'copias_conocimiento');
      const hasVolanteColumn = columns.has('volante_numero');
      const datosNormalizados = normalizarDestinatario(datos);
      const {
        numero_oficio_seq, anio, fecha, area, funcionario, cargo,
        oficio_referencia, fecha_referencia, tipo_solicitud,
        referencia_volante, folio_numero, volante_numero, creado_por_id
      } = datosNormalizados;
      const tipoSolicitudNormalizado = normalizarTipoSolicitud(tipo_solicitud);

      const referenciaVolanteNormalizada = normalizarReferenciaVolante(referencia_volante);
      const requiereFolio = referenciaVolanteNormalizada.split('|').includes('folio');
      const requiereVolante = referenciaVolanteNormalizada.split('|').includes('volante');
      const folioNormalizado = requiereFolio ? (folio_numero || null) : null;
      const volanteNormalizado = requiereVolante ? (volante_numero || folio_numero || null) : null;

      const columnas = [
        'numero_oficio_seq', 'anio', 'fecha', 'area', 'funcionario', 'cargo',
        'oficio_referencia', 'fecha_referencia', 'tipo_solicitud',
        'referencia_volante', 'folio_numero', 'creado_por_id'
      ];
      const valores = [
        numero_oficio_seq, anio, fecha, area, funcionario, cargo,
        oficio_referencia, fecha_referencia, tipoSolicitudNormalizado,
        referenciaVolanteNormalizada, folioNormalizado, creado_por_id || null
      ];

      if (hasVolanteColumn) {
        columnas.splice(11, 0, 'volante_numero');
        valores.splice(11, 0, volanteNormalizado);
      }

      const placeholders = columnas.map(() => '?').join(', ');
      const [result] = await connection.query(
        `INSERT INTO copias_conocimiento (${columnas.join(', ')}) VALUES (${placeholders})`,
        valores
      );
      return this.obtenerPorId(result.insertId);
    } finally {
      connection.release();
    }
  }

  /**
   * Actualizar registro
   */
  async actualizar(id, datos) {
    const connection = await pool.getConnection();
    try {
      const columns = await getColumnNames(connection, 'copias_conocimiento');
      const hasVolanteColumn = columns.has('volante_numero');
      const datosNormalizados = normalizarDestinatario(datos);
      const {
        numero_oficio_seq, anio, fecha, area, funcionario, cargo,
        oficio_referencia, fecha_referencia, tipo_solicitud,
        referencia_volante, folio_numero, volante_numero
      } = datosNormalizados;
      const tipoSolicitudNormalizado = normalizarTipoSolicitud(tipo_solicitud);

      const referenciaVolanteNormalizada = normalizarReferenciaVolante(referencia_volante);
      const requiereFolio = referenciaVolanteNormalizada.split('|').includes('folio');
      const requiereVolante = referenciaVolanteNormalizada.split('|').includes('volante');
      const folioNormalizado = requiereFolio ? (folio_numero || null) : null;
      const volanteNormalizado = requiereVolante ? (volante_numero || folio_numero || null) : null;

      const asignaciones = [
        'numero_oficio_seq = ?', 'anio = ?', 'fecha = ?', 'area = ?',
        'funcionario = ?', 'cargo = ?', 'oficio_referencia = ?',
        'fecha_referencia = ?', 'tipo_solicitud = ?',
        'referencia_volante = ?', 'folio_numero = ?'
      ];
      const valores = [
        numero_oficio_seq, anio, fecha, area, funcionario, cargo,
        oficio_referencia, fecha_referencia, tipoSolicitudNormalizado,
        referenciaVolanteNormalizada, folioNormalizado
      ];

      if (hasVolanteColumn) {
        asignaciones.push('volante_numero = ?');
        valores.push(volanteNormalizado);
      }

      valores.push(id);

      await connection.query(
        `UPDATE copias_conocimiento SET ${asignaciones.join(', ')} WHERE id = ?`,
        valores
      );
      return this.obtenerPorId(id);
    } finally {
      connection.release();
    }
  }

  /**
   * Eliminar registro
   */
  async eliminar(id) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        'DELETE FROM copias_conocimiento WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  }

  /**
   * Eliminar múltiples registros por IDs
   */
  async eliminarMasivo(ids = []) {
    const validIds = ids.map(Number).filter(Boolean);
    if (validIds.length === 0) return 0;

    const connection = await pool.getConnection();
    try {
      const placeholders = validIds.map(() => '?').join(',');
      const [result] = await connection.query(
        `DELETE FROM copias_conocimiento WHERE id IN (${placeholders})`,
        validIds
      );
      return result.affectedRows || 0;
    } finally {
      connection.release();
    }
  }

  /**
   * Eliminar todos los registros
   */
  async eliminarTodos() {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query('DELETE FROM copias_conocimiento');
      return result.affectedRows || 0;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener múltiples por IDs (para descarga ZIP)
   */
  async obtenerPorIds(ids) {
    if (!ids || ids.length === 0) return [];
    const connection = await pool.getConnection();
    try {
      const placeholders = ids.map(() => '?').join(',');
      const [rows] = await connection.query(
        `SELECT
          c.*,
          CONCAT('SSP/SII/C5I/DT/', c.numero_oficio_seq, '/', c.anio) AS numero_oficio,
          DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
          DATE_FORMAT(c.fecha_referencia, '%Y-%m-%d') AS fecha_referencia
        FROM copias_conocimiento c WHERE c.id IN (${placeholders}) ORDER BY c.id`,
        ids
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener todos para descarga completa
   */
  async obtenerTodos(filtro = '') {
    const connection = await pool.getConnection();
    try {
      let whereClause = '';
      const params = [];
      if (filtro.trim()) {
        whereClause = 'WHERE (c.area LIKE ? OR c.funcionario LIKE ? OR c.oficio_referencia LIKE ?)';
        const like = `%${filtro}%`;
        params.push(like, like, like);
      }
      const [rows] = await connection.query(
        `SELECT
          c.*,
          CONCAT('SSP/SII/C5I/DT/', c.numero_oficio_seq, '/', c.anio) AS numero_oficio,
          DATE_FORMAT(c.fecha, '%Y-%m-%d') AS fecha,
          DATE_FORMAT(c.fecha_referencia, '%Y-%m-%d') AS fecha_referencia
        FROM copias_conocimiento c ${whereClause} ORDER BY c.id`,
        params
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  /**
   * Archivar registros CCP en historial persistente
   */
  async archivarRegistros(registros = [], { usuarioId = null, accion = 'ELIMINADO' } = {}) {
    const lista = Array.isArray(registros) ? registros.filter(Boolean) : [];
    if (lista.length === 0) return 0;

    const connection = await pool.getConnection();
    try {
      const historialColumns = await getColumnNames(connection, 'historial_registros_ccp');
      const hasVolanteColumn = historialColumns.has('volante_numero');
      const accionNormalizada = normalizarAccionHistorial(accion);
      const values = [];

      const placeholders = lista.map((row) => {
        const referenciaVolante = normalizarReferenciaVolante(row.referencia_volante);
        const requiereFolio = referenciaVolante.split('|').includes('folio');
        const requiereVolante = referenciaVolante.split('|').includes('volante');
        const area = toUpperTrim(row.area) || DESTINATARIO_DEFAULT.area;
        const funcionario = toUpperTrim(row.funcionario) || DESTINATARIO_DEFAULT.funcionario;
        const cargo = toUpperTrim(row.cargo) || DESTINATARIO_DEFAULT.cargo;
        const oficioReferencia = toUpperTrim(row.oficio_referencia);
        const tipoSolicitud = normalizarTipoSolicitud(row.tipo_solicitud);
        const folioNumero = requiereFolio ? (row.folio_numero || null) : null;
        const volanteNumero = requiereVolante ? (row.volante_numero || row.folio_numero || null) : null;

        const rowValues = [
          Number(row.id) || null,
          Number(row.numero_oficio_seq) || 0,
          Number(row.anio) || new Date().getFullYear(),
          row.fecha || new Date().toISOString().slice(0, 10),
          area,
          funcionario,
          cargo,
          oficioReferencia,
          row.fecha_referencia || row.fecha || new Date().toISOString().slice(0, 10),
          tipoSolicitud,
          referenciaVolante,
          folioNumero
        ];

        const rowColumns = [
          'registro_original_id', 'numero_oficio_seq', 'anio', 'fecha',
          'area', 'funcionario', 'cargo', 'oficio_referencia',
          'fecha_referencia', 'tipo_solicitud', 'referencia_volante',
          'folio_numero'
        ];

        if (hasVolanteColumn) {
          rowValues.push(volanteNumero);
          rowColumns.push('volante_numero');
        }

        rowValues.push(accionNormalizada, usuarioId || null);
        rowColumns.push('accion_historial', 'archivado_por_id');

        values.push(...rowValues);

        return `(${rowColumns.map(() => '?').join(', ')})`;
      }).join(', ');

      const historialInsertColumns = [
        'registro_original_id', 'numero_oficio_seq', 'anio', 'fecha',
        'area', 'funcionario', 'cargo', 'oficio_referencia',
        'fecha_referencia', 'tipo_solicitud', 'referencia_volante',
        'folio_numero'
      ];
      if (hasVolanteColumn) historialInsertColumns.push('volante_numero');
      historialInsertColumns.push('accion_historial', 'archivado_por_id');

      const [result] = await connection.query(
        `INSERT INTO historial_registros_ccp (${historialInsertColumns.join(', ')}) VALUES ${placeholders}`,
        values
      );

      return result.affectedRows || 0;
    } finally {
      connection.release();
    }
  }

  /**
   * Listar historial persistente de registros CCP
   */
  async listarHistorialRegistros({ busqueda = '', pagina = 1, limit = 10 } = {}) {
    const offset = (pagina - 1) * limit;
    const connection = await pool.getConnection();
    try {
      const columns = await getColumnNames(connection, 'historial_registros_ccp');
      const hasVolanteColumn = columns.has('volante_numero');
      let whereClause = '';
      const params = [];

      if (busqueda.trim()) {
        whereClause = `WHERE (
          CONCAT('SSP/SII/C5I/DT/', h.numero_oficio_seq, '/', h.anio) LIKE ? OR
          h.area LIKE ? OR
          h.funcionario LIKE ? OR
          h.cargo LIKE ? OR
          h.oficio_referencia LIKE ? OR
          h.tipo_solicitud LIKE ?
        )`;
        const like = `%${busqueda}%`;
        params.push(like, like, like, like, like, like);
      }

      const [[{ total }]] = await connection.query(
        `SELECT COUNT(*) AS total FROM historial_registros_ccp h ${whereClause}`,
        params
      );

      const [rows] = await connection.query(
        `SELECT
          h.id,
          h.registro_original_id,
          h.numero_oficio_seq,
          h.anio,
          CONCAT('SSP/SII/C5I/DT/', h.numero_oficio_seq, '/', h.anio) AS numero_oficio,
          DATE_FORMAT(h.fecha, '%Y-%m-%d') AS fecha,
          h.area,
          h.funcionario,
          h.cargo,
          h.oficio_referencia,
          DATE_FORMAT(h.fecha_referencia, '%Y-%m-%d') AS fecha_referencia,
          h.tipo_solicitud,
          h.referencia_volante,
          h.folio_numero,
          ${buildHistorialReferenciaSelect(hasVolanteColumn)},
          h.accion_historial,
          h.archivado_por_id,
          h.archived_at
        FROM historial_registros_ccp h
        ${whereClause}
        ORDER BY h.id DESC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return {
        data: rows,
        total,
        pagina,
        totalPaginas: Math.ceil(total / limit)
      };
    } finally {
      connection.release();
    }
  }
}

export default new CcpModel();
