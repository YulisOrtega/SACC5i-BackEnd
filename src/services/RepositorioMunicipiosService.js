import pool from "../config/database.js";
import fs from "fs";

  class RepositorioMunicipiosService {
  async listarMunicipios({ rol, usuarioId, busqueda = "" }) {
    const cleanSearch = String(busqueda || "").trim();
    const like = `%${cleanSearch}%`;

    const rolNormalizado = String(rol || "").toLowerCase();

    const params = [cleanSearch, like];

    let filtroRegion = "";

    if (rolNormalizado.includes("analista")) {
      filtroRegion = `
        AND m.region_id = (
          SELECT region_id
          FROM usuarios
          WHERE id = ?
          LIMIT 1
        )
      `;
      params.push(usuarioId);
    }

    const [rows] = await pool.query(
      `
      SELECT
        m.id AS municipio_id,
        m.nombre AS municipio_nombre,
        COUNT(d.id) AS total_documentos,
        SUM(CASE WHEN d.tipo_archivo = 'pdf' THEN 1 ELSE 0 END) AS total_pdf,
        SUM(CASE WHEN d.tipo_archivo = 'excel' THEN 1 ELSE 0 END) AS total_excel,
        SUM(CASE WHEN d.tipo_archivo = 'imagen' THEN 1 ELSE 0 END) AS total_imagen,
        MAX(d.created_at) AS ultima_carga
      FROM municipios m
      LEFT JOIN repositorio_municipios_documentos d
        ON d.municipio_id = m.id
      WHERE (? = '' OR m.nombre LIKE ?)
      ${filtroRegion}
      GROUP BY m.id, m.nombre
      ORDER BY m.nombre ASC
      `,
      params
    );

    return rows;
  }

  async subirDocumentosMunicipio({ municipioId, usuarioId, archivos }) {
  if (!archivos.length) {
    throw new Error("Debes enviar al menos un archivo");
  }

  if (archivos.length > 5) {
  throw new Error("Solo se permiten 5 archivos por carga");
}

  const permitidos = {
    "application/pdf": "pdf",
    "application/vnd.ms-excel": "excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
    "image/jpeg": "imagen",
    "image/png": "imagen",
    "image/webp": "imagen"
  };

  const insertados = [];

  for (const archivo of archivos) {
    const tipoArchivo = permitidos[archivo.mimetype];

    if (!tipoArchivo) {
      throw new Error(`Tipo de archivo no permitido: ${archivo.originalname}`);
    }

    const [result] = await pool.query(
      `
      INSERT INTO repositorio_municipios_documentos (
        municipio_id,
        usuario_id,
        tipo_archivo,
        nombre_original,
        nombre_guardado,
        ruta_archivo,
        mime_type,
        size_bytes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        municipioId,
        usuarioId,
        tipoArchivo,
        archivo.originalname,
        archivo.filename,
        archivo.path,
        archivo.mimetype,
        archivo.size
      ]
    );

    insertados.push({
      id: result.insertId,
      nombre_original: archivo.originalname,
      tipo_archivo: tipoArchivo
    });
  }

  return insertados;
}

async obtenerDocumentoPorId(documentoId) {
  const [[doc]] = await pool.query(
    `
    SELECT *
    FROM repositorio_municipios_documentos
    WHERE id = ?
    LIMIT 1
    `,
    [documentoId]
  );

  if (!doc) {
    throw new Error("Documento no encontrado");
  }

  return doc;
}

async obtenerDocumentoPorId(documentoId) {
  const [[doc]] = await pool.query(
    `
    SELECT *
    FROM repositorio_municipios_documentos
    WHERE id = ?
    LIMIT 1
    `,
    [documentoId]
  );

  if (!doc) {
    throw new Error("Documento no encontrado");
  }

  return doc;
}

async obtenerDocumentoPorId(documentoId) {
  const [[doc]] = await pool.query(
    `
    SELECT *
    FROM repositorio_municipios_documentos
    WHERE id = ?
    LIMIT 1
    `,
    [documentoId]
  );

  if (!doc) {
    throw new Error("Documento no encontrado");
  }

  return doc;
}

async obtenerDocumentoPorId(documentoId) {
  const [[doc]] = await pool.query(
    `
    SELECT *
    FROM repositorio_municipios_documentos
    WHERE id = ?
    LIMIT 1
    `,
    [documentoId]
  );

  if (!doc) {
    throw new Error("Documento no encontrado");
  }

  return doc;
}

async eliminarDocumento(documentoId) {
  const doc = await this.obtenerDocumentoPorId(documentoId);

  await pool.query(
    `
    DELETE FROM repositorio_municipios_documentos
    WHERE id = ?
    `,
    [documentoId]
  );

  if (doc.ruta_archivo && fs.existsSync(doc.ruta_archivo)) {
    fs.unlinkSync(doc.ruta_archivo);
  }

  return true;
}
  async obtenerDetalleMunicipio({ municipioId, rol, regionId }) {
    const params = [municipioId];
    let filtroRegion = "";

    const rolNormalizado = String(rol || "").toLowerCase();

    if (rolNormalizado.includes("analista") && regionId) {
      filtroRegion = "AND m.region_id = ?";
      params.push(regionId);
    }

    const [[municipio]] = await pool.query(
      `
      SELECT
        m.id AS municipio_id,
        m.nombre AS municipio_nombre,

        COUNT(d.id) AS total_documentos,
        SUM(CASE WHEN d.tipo_archivo = 'pdf' THEN 1 ELSE 0 END) AS total_pdf,
        SUM(CASE WHEN d.tipo_archivo = 'excel' THEN 1 ELSE 0 END) AS total_excel,
        SUM(CASE WHEN d.tipo_archivo = 'imagen' THEN 1 ELSE 0 END) AS total_imagen
      FROM municipios m
      LEFT JOIN repositorio_municipios_documentos d
        ON d.municipio_id = m.id
      WHERE m.id = ?
      ${filtroRegion}
      GROUP BY m.id, m.nombre
      `,
      params
    );

    if (!municipio) {
      throw new Error("Municipio no encontrado o sin permisos");
    }

    const [documentos] = await pool.query(
      `
      SELECT
        id,
        municipio_id,
        tipo_archivo,
        nombre_original,
        nombre_guardado,
        ruta_archivo,
        mime_type,
        size_bytes,
        DATE(created_at) AS fecha_carga,
        created_at
      FROM repositorio_municipios_documentos
      WHERE municipio_id = ?
      ORDER BY created_at DESC
      `,
      [municipioId]
    );

    return {
      municipio,
      documentos
    };
  }
}

export default new RepositorioMunicipiosService();