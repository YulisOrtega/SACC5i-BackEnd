import ExcelJS from 'exceljs';
import pool from '../config/database.js';

class ConsultaService {
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

  _resolverCondicionMunicipio(municipioId) {
    const id = Number(municipioId);
    if (id === 0) {
      return {
        sql: 'm.id IS NULL',
        params: []
      };
    }

    return {
      sql: 'm.id = ?',
      params: [id]
    };
  }

  async listarMunicipiosConFinalizados({ busqueda = '', pagina = 1, limit = 10 } = {}) {
    const connection = await pool.getConnection();
    try {
      const tablaFinalizados = await this._resolverTablaFinalizados(connection);
      if (!tablaFinalizados) {
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

      const [[{ total }]] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM (
           SELECT COALESCE(m.id, 0) AS municipio_id
           FROM ${tablaFinalizados} f
           LEFT JOIN tramites_alta t ON t.id = f.tramite_alta_id
           LEFT JOIN municipios m ON m.id = t.municipio_id
           WHERE (? = '' OR IFNULL(m.nombre, 'Sin municipio') LIKE ?)
           GROUP BY COALESCE(m.id, 0)
         ) q`,
        [cleanSearch, like]
      );

      const [rows] = await connection.query(
        `SELECT
           COALESCE(m.id, 0) AS municipio_id,
           IFNULL(m.nombre, 'Sin municipio') AS municipio_nombre,
           COUNT(f.id) AS total_personas,
           MAX(f.updated_at) AS ultima_actualizacion
         FROM ${tablaFinalizados} f
         LEFT JOIN tramites_alta t ON t.id = f.tramite_alta_id
         LEFT JOIN municipios m ON m.id = t.municipio_id
         WHERE (? = '' OR IFNULL(m.nombre, 'Sin municipio') LIKE ?)
         GROUP BY COALESCE(m.id, 0), IFNULL(m.nombre, 'Sin municipio')
         ORDER BY IFNULL(m.nombre, 'Sin municipio') ASC
         LIMIT ? OFFSET ?`,
        [cleanSearch, like, parsedLimit, offset]
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

async listarPersonasFinalizadasPorMunicipio(
  municipioId,
  { busqueda = '', pagina = 1, limit = 10, municipioNombre = '' } = {}
) {
  const connection = await pool.getConnection();

  try {
    const tablaFinalizados = await this._resolverTablaFinalizados(connection);

    if (!tablaFinalizados) {
      return {
        municipio: { id: Number(municipioId) || 0, nombre: municipioNombre || 'Sin municipio' },
        registros: [],
        paginacion: { total: 0, totalPaginas: 1, pagina: Number(pagina) || 1, limit: Number(limit) || 10 }
      };
    }

    const parsedPage = Math.max(1, Number(pagina) || 1);
    const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (parsedPage - 1) * parsedLimit;
    const cleanSearch = String(busqueda || '').trim();
    const like = `%${cleanSearch}%`;

    const cleanMunicipioNombre = String(municipioNombre || '').trim();

    const condMunicipio = cleanMunicipioNombre
      ? {
          sql: 'm.nombre LIKE ?',
          params: [`%${cleanMunicipioNombre}%`]
        }
      : this._resolverCondicionMunicipio(municipioId);

    const [[municipioInfo]] = await connection.query(
      `SELECT
         COALESCE(m.id, 0) AS municipio_id,
         IFNULL(m.nombre, 'Sin municipio') AS municipio_nombre
       FROM ${tablaFinalizados} f
       LEFT JOIN tramites_alta t ON t.id = f.tramite_alta_id
       LEFT JOIN municipios m ON m.id = t.municipio_id
       WHERE ${condMunicipio.sql}
       LIMIT 1`,
      condMunicipio.params
    );

    const whereSearch = `(? = ''
      OR IFNULL(pta.nombre, '') LIKE ?
      OR IFNULL(pta.apellido_paterno, '') LIKE ?
      OR IFNULL(pta.apellido_materno, '') LIKE ?
      OR CONCAT(IFNULL(pta.nombre, ''), ' ', IFNULL(pta.apellido_paterno, ''), ' ', IFNULL(pta.apellido_materno, '')) LIKE ?)`;

    const [[{ total }]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM ${tablaFinalizados} f
       LEFT JOIN personas_tramite_alta pta ON pta.id = f.persona_tramite_id
       LEFT JOIN tramites_alta t ON t.id = f.tramite_alta_id
       LEFT JOIN municipios m ON m.id = t.municipio_id
       WHERE ${condMunicipio.sql}
         AND ${whereSearch}`,
      [...condMunicipio.params, cleanSearch, like, like, like, like]
    );

    const [rows] = await connection.query(
      `SELECT
         f.id AS finalizado_id,
         pta.id AS persona_id,
         IFNULL(pta.nombre, f.nombre_elemento) AS nombre,
         IFNULL(pta.apellido_paterno, '') AS apellido_paterno,
         IFNULL(pta.apellido_materno, '') AS apellido_materno,
         pta.fecha_nacimiento
       FROM ${tablaFinalizados} f
       LEFT JOIN personas_tramite_alta pta ON pta.id = f.persona_tramite_id
       LEFT JOIN tramites_alta t ON t.id = f.tramite_alta_id
       LEFT JOIN municipios m ON m.id = t.municipio_id
       WHERE ${condMunicipio.sql}
         AND ${whereSearch}
       ORDER BY IFNULL(pta.apellido_paterno, ''), IFNULL(pta.apellido_materno, ''), IFNULL(pta.nombre, f.nombre_elemento)
       LIMIT ? OFFSET ?`,
      [...condMunicipio.params, cleanSearch, like, like, like, like, parsedLimit, offset]
    );

    return {
      municipio: {
        id: municipioInfo?.municipio_id ?? (Number(municipioId) || 0),
        nombre: municipioInfo?.municipio_nombre || cleanMunicipioNombre || 'Sin municipio'
      },
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

  async exportarExcelPersonasMunicipio(municipioId, { busqueda = '', ids = [] } = {}) {
    const connection = await pool.getConnection();
    try {
      const tablaFinalizados = await this._resolverTablaFinalizados(connection);
      if (!tablaFinalizados) {
        throw new Error('No existe la tabla de finalizados');
      }

      const condMunicipio = this._resolverCondicionMunicipio(municipioId);
      const cleanSearch = String(busqueda || '').trim();
      const like = `%${cleanSearch}%`;
      const selectedIds = Array.isArray(ids)
        ? ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [];

      const whereSearch = `(? = ''
          OR IFNULL(pta.nombre, '') LIKE ?
          OR IFNULL(pta.apellido_paterno, '') LIKE ?
          OR IFNULL(pta.apellido_materno, '') LIKE ?
          OR CONCAT(IFNULL(pta.nombre, ''), ' ', IFNULL(pta.apellido_paterno, ''), ' ', IFNULL(pta.apellido_materno, '')) LIKE ?)`;

      const idsClause = selectedIds.length > 0
        ? `AND f.id IN (${selectedIds.map(() => '?').join(',')})`
        : '';

      const [rows] = await connection.query(
        `SELECT
           f.id AS finalizado_id,
           IFNULL(m.nombre, 'Sin municipio') AS municipio_nombre,
           IFNULL(pta.nombre, f.nombre_elemento) AS nombre,
           IFNULL(pta.apellido_paterno, '') AS apellido_paterno,
           IFNULL(pta.apellido_materno, '') AS apellido_materno,
           pta.fecha_nacimiento
         FROM ${tablaFinalizados} f
         LEFT JOIN personas_tramite_alta pta ON pta.id = f.persona_tramite_id
         LEFT JOIN tramites_alta t ON t.id = f.tramite_alta_id
         LEFT JOIN municipios m ON m.id = t.municipio_id
         WHERE ${condMunicipio.sql}
           AND ${whereSearch}
           ${idsClause}
         ORDER BY IFNULL(pta.apellido_paterno, ''), IFNULL(pta.apellido_materno, ''), IFNULL(pta.nombre, f.nombre_elemento)`,
        [...condMunicipio.params, cleanSearch, like, like, like, like, ...selectedIds]
      );

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'RPSP';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Consulta Finalizados');
      sheet.columns = [
        { header: 'No.', key: 'numero', width: 8 },
        { header: 'Nombre', key: 'nombre', width: 28 },
        { header: 'Apellido Paterno', key: 'apellido_paterno', width: 24 },
        { header: 'Apellido Materno', key: 'apellido_materno', width: 24 },
        { header: 'Fecha de nacimiento', key: 'fecha_nacimiento', width: 20 }
      ];

      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 22;

      rows.forEach((item, index) => {
        sheet.addRow({
          numero: index + 1,
          nombre: item.nombre || '',
          apellido_paterno: item.apellido_paterno || '',
          apellido_materno: item.apellido_materno || '',
          fecha_nacimiento: item.fecha_nacimiento
            ? new Date(item.fecha_nacimiento).toLocaleDateString('es-MX')
            : ''
        });
      });

      const totalRows = sheet.rowCount;
      for (let i = 1; i <= totalRows; i += 1) {
        const row = sheet.getRow(i);
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
          };
          if (i > 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });
      }

      const municipioNombre = rows[0]?.municipio_nombre || 'Sin municipio';
      return {
        buffer: await workbook.xlsx.writeBuffer(),
        nombreArchivo: `Consulta_${municipioNombre.replace(/\s+/g, '_')}.xlsx`
      };
    } finally {
      connection.release();
    }
  }
}

export default new ConsultaService();
