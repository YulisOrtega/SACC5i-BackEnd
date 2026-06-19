import pool from "../config/database.js";

class RepositorioMunicipiosService {
  async listarMunicipios({ rol, regionId, busqueda = "" }) {
    const cleanSearch = String(busqueda || "").trim();
    const like = `%${cleanSearch}%`;

    const params = [];
    let filtroRegion = "";

    if (rol === "analista" && regionId) {
      filtroRegion = "AND m.region_id = ?";
      params.push(regionId);
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
      [cleanSearch, like, ...params]
    );

    return rows;
  }

  async obtenerDetalleMunicipio({ municipioId, rol, regionId }) {
    const params = [municipioId];
    let filtroRegion = "";

    if (rol === "analista" && regionId) {
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