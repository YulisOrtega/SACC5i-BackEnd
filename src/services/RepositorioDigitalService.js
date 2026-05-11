import fs from 'fs';
import path from 'path';
import pool from '../config/database.js';

const uploadsRoot = path.resolve('uploads', 'repositorio-digital');
const ANNUAL_MAX_FILES = 10000;
const ANNUAL_FOLDER_PREFIX = 'Acuses compartidos';

const ensureUploadsRoot = async () => {
  await fs.promises.mkdir(uploadsRoot, { recursive: true });
};

const buildAnnualFolderName = (year) => `${ANNUAL_FOLDER_PREFIX} ${year}`;

const buildTree = (rows) => {
  return [...rows]
    .sort((a, b) => (b.year_value || 0) - (a.year_value || 0))
    .map((row) => ({ ...row, children: [] }));
};

const RepositorioDigitalService = {
  async asegurarCarpetaAnual(year, userId, connection = null) {
    const parsedYear = Number(year);
    if (!parsedYear || parsedYear < 2000 || parsedYear > 2100) {
      throw new Error('Año inválido para repositorio anual');
    }

    const db = connection || pool;
    const folderName = buildAnnualFolderName(parsedYear);

    const [[existing]] = await db.query(
      `SELECT id
       FROM repositorio_folders
       WHERE parent_id IS NULL
         AND folder_type = 'year'
         AND year_value = ?
       LIMIT 1`,
      [parsedYear]
    );

    if (existing?.id) {
      await db.query(
        `UPDATE repositorio_folders
         SET nombre = ?, month_value = NULL, parent_id = NULL
         WHERE id = ?`,
        [folderName, existing.id]
      );
      return Number(existing.id);
    }

    const [insert] = await db.query(
      `INSERT INTO repositorio_folders (parent_id, nombre, folder_type, year_value, month_value, creado_por_id)
       VALUES (NULL, ?, 'year', ?, NULL, ?)`,
      [folderName, parsedYear, userId || null]
    );

    return Number(insert.insertId);
  },

  async asegurarCarpetaAnualActual(userId) {
    const currentYear = Number(new Date().getFullYear());
    return this.asegurarCarpetaAnual(currentYear, userId || null);
  },

  async obtenerTree() {
    await this.asegurarCarpetaAnualActual(null);

    const [rows] = await pool.query(
      `SELECT id, parent_id, nombre, folder_type, year_value, month_value, created_at
       FROM repositorio_folders
       WHERE parent_id IS NULL
         AND folder_type = 'year'
       ORDER BY year_value DESC`
    );

    return buildTree(rows);
  },

  async crearYearConEstructura(year, userId) {
    const folderId = await this.asegurarCarpetaAnual(year, userId || null);
    return { id: folderId, alreadyExists: true };
  },

  async crearSubcarpeta() {
    throw new Error('La estructura por subcarpetas fue deshabilitada');
  },

  async obtenerChildren(folderId, search = '') {
    const cleanSearch = String(search || '').trim().toLowerCase();
    if (folderId !== null && folderId !== undefined) return [];

    const tree = await this.obtenerTree();
    return tree
      .filter((row) => !cleanSearch || String(row.nombre || '').toLowerCase().includes(cleanSearch))
      .map((row) => ({
        id: row.id,
        parent_id: null,
        nombre: row.nombre,
        folder_type: row.folder_type,
        year_value: row.year_value,
        month_value: null,
        created_at: row.created_at,
        children_count: 0,
        files_count: 0
      }));
  },

  async obtenerFolder(folderId) {
    const [[row]] = await pool.query(
      `SELECT id, parent_id, nombre, folder_type, year_value, month_value
       FROM repositorio_folders WHERE id = ? LIMIT 1`,
      [folderId]
    );
    return row || null;
  },

  async obtenerIdsDescendencia(folderId) {
    const parsed = Number(folderId);
    if (!parsed) return [];
    return [parsed];
  },

  async obtenerResumenPorDias(folderId, search = '') {
    const searchText = String(search || '').trim();
    const like = `%${searchText}%`;

    const [rows] = await pool.query(
      `SELECT
         DATE_FORMAT(created_at, '%Y-%m-%d') AS fecha_key,
         DATE_FORMAT(created_at, '%d/%m/%Y') AS fecha_formateada,
         COUNT(*) AS total
       FROM repositorio_files
       WHERE folder_id = ?
         AND (
           ? = '' OR
           original_name LIKE ? OR
           IFNULL(folio, '') LIKE ? OR
           DATE_FORMAT(created_at, '%d/%m/%Y') LIKE ? OR
           DATE_FORMAT(created_at, '%Y-%m-%d') LIKE ?
         )
       GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d'), DATE_FORMAT(created_at, '%d/%m/%Y')
       ORDER BY fecha_key DESC`,
      [folderId, searchText, like, like, like, like]
    );

    return rows;
  },

  async obtenerFiles(folderId, search = '', pagina = 1, limit = 10, fecha = '') {
    const parsedPage = Math.max(1, Number(pagina) || 1);
    const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (parsedPage - 1) * parsedLimit;
    const searchText = String(search || '').trim();
    const cleanFecha = String(fecha || '').trim();
    const like = `%${searchText}%`;

    const totalQuery = cleanFecha
      ? `SELECT COUNT(*) AS total
         FROM repositorio_files
         WHERE folder_id = ?
           AND DATE(created_at) = ?
           AND (
             ? = '' OR
             original_name LIKE ? OR
             IFNULL(folio, '') LIKE ? OR
             DATE_FORMAT(created_at, '%d/%m/%Y') LIKE ? OR
             DATE_FORMAT(created_at, '%Y-%m-%d') LIKE ?
           )`
      : `SELECT COUNT(*) AS total
         FROM repositorio_files
         WHERE folder_id = ?
           AND (
             ? = '' OR
             original_name LIKE ? OR
             IFNULL(folio, '') LIKE ? OR
             DATE_FORMAT(created_at, '%d/%m/%Y') LIKE ? OR
             DATE_FORMAT(created_at, '%Y-%m-%d') LIKE ?
           )`;

    const countParams = cleanFecha
      ? [folderId, cleanFecha, searchText, like, like, like, like]
      : [folderId, searchText, like, like, like, like];

    const [[countRow]] = await pool.query(totalQuery, countParams);
    const totalArchivos = Number(countRow?.total || 0);

    const filesQuery = cleanFecha
      ? `SELECT id, folder_id, original_name, mime_type, size_bytes, folio, created_at,
                DATE_FORMAT(created_at, '%Y-%m-%d') AS fecha_key
         FROM repositorio_files
         WHERE folder_id = ?
           AND DATE(created_at) = ?
           AND (
             ? = '' OR
             original_name LIKE ? OR
             IFNULL(folio, '') LIKE ? OR
             DATE_FORMAT(created_at, '%d/%m/%Y') LIKE ? OR
             DATE_FORMAT(created_at, '%Y-%m-%d') LIKE ?
           )
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      : `SELECT id, folder_id, original_name, mime_type, size_bytes, folio, created_at,
                DATE_FORMAT(created_at, '%Y-%m-%d') AS fecha_key
         FROM repositorio_files
         WHERE folder_id = ?
           AND (
             ? = '' OR
             original_name LIKE ? OR
             IFNULL(folio, '') LIKE ? OR
             DATE_FORMAT(created_at, '%d/%m/%Y') LIKE ? OR
             DATE_FORMAT(created_at, '%Y-%m-%d') LIKE ?
           )
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(
      filesQuery,
      cleanFecha
        ? [folderId, cleanFecha, searchText, like, like, like, like, parsedLimit, offset]
        : [folderId, searchText, like, like, like, like, parsedLimit, offset]
    );

    return {
      data: rows,
      total: totalArchivos,
      pagina: parsedPage,
      totalPaginas: Math.max(1, Math.ceil(totalArchivos / parsedLimit))
    };
  },

  async subirArchivo(folderId, file, metadata, userId) {
    if (!file) throw new Error('Archivo no enviado');
    const folio = String(metadata?.folio || '').trim().toUpperCase();
    const originalName = String(metadata?.original_name || file.originalname || '').trim() || file.originalname;

    const folder = await this.obtenerFolder(folderId);
    if (!folder) throw new Error('Carpeta no encontrada');
    if (folder.folder_type !== 'year') {
      throw new Error('Solo puedes subir archivos en la carpeta anual compartida');
    }

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM repositorio_files WHERE folder_id = ?',
      [folderId]
    );

    if (Number(total || 0) >= ANNUAL_MAX_FILES) {
      throw new Error(`La carpeta anual ya alcanzó el límite de ${ANNUAL_MAX_FILES} archivos`);
    }

    await ensureUploadsRoot();

    const folderDir = path.join(uploadsRoot, String(folderId));
    await fs.promises.mkdir(folderDir, { recursive: true });

    const safeOriginal = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${Date.now()}_${safeOriginal}`;
    const absolutePath = path.join(folderDir, storedName);

    await fs.promises.writeFile(absolutePath, file.buffer);

    const relativePath = path.join('repositorio-digital', String(folderId), storedName).replace(/\\/g, '/');

    const [result] = await pool.query(
      `INSERT INTO repositorio_files
       (folder_id, original_name, stored_name, relative_path, mime_type, size_bytes, folio, subido_por_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        folderId,
        originalName,
        storedName,
        relativePath,
        file.mimetype,
        file.size,
        folio || null,
        userId || null
      ]
    );

    return result.insertId;
  },

  async obtenerFileById(fileId) {
    const [[row]] = await pool.query(
      `SELECT id, folder_id, original_name, stored_name, relative_path, mime_type, size_bytes, folio, created_at
       FROM repositorio_files WHERE id = ? LIMIT 1`,
      [fileId]
    );

    if (!row) return null;

    return {
      ...row,
      absolutePath: path.resolve('uploads', row.relative_path)
    };
  },

  async eliminarArchivo(fileId) {
    const file = await this.obtenerFileById(fileId);
    if (!file) return false;

    await pool.query('DELETE FROM repositorio_files WHERE id = ?', [fileId]);

    try {
      await fs.promises.unlink(file.absolutePath);
    } catch {
      // Si no existe físicamente, no bloquea la operación lógica.
    }

    return true;
  },

  async eliminarArchivosMasivo(ids = []) {
    const validIds = ids.map(Number).filter(Boolean);
    if (validIds.length === 0) return 0;

    let deleted = 0;
    for (const id of validIds) {
      const ok = await this.eliminarArchivo(id);
      if (ok) deleted += 1;
    }

    return deleted;
  },

  async eliminarCarpeta(folderId) {
    const id = Number(folderId);
    if (!id) throw new Error('Carpeta inválida');

    const folder = await this.obtenerFolder(id);
    if (!folder) return null;

    throw new Error('Eliminar carpetas está deshabilitado en el modelo anual compartido');
  },

  async obtenerArchivosParaDescargaMasiva(folderId) {
    const folder = await this.obtenerFolder(folderId);
    if (!folder) throw new Error('Carpeta no encontrada');

    const [rows] = await pool.query(
      `SELECT id, original_name, stored_name, relative_path, mime_type, size_bytes, created_at
       FROM repositorio_files
       WHERE folder_id = ?
       ORDER BY created_at DESC`,
      [folderId]
    );

    const files = [];
    for (const row of rows) {
      const absolutePath = path.resolve('uploads', row.relative_path);
      if (fs.existsSync(absolutePath)) {
        files.push({
          ...row,
          absolutePath
        });
      }
    }

    return {
      folder,
      files
    };
  },

  async obtenerArchivosSeleccionadosParaZip(folderId, ids = []) {
    const folder = await this.obtenerFolder(folderId);
    if (!folder) throw new Error('Carpeta no encontrada');

    const validIds = (Array.isArray(ids) ? ids : []).map(Number).filter(Boolean);
    if (!validIds.length) {
      throw new Error('No se enviaron archivos seleccionados para descarga');
    }

    const placeholders = validIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT id, original_name, stored_name, relative_path, mime_type, size_bytes, created_at
       FROM repositorio_files
       WHERE folder_id = ?
         AND id IN (${placeholders})
       ORDER BY created_at DESC`,
      [folderId, ...validIds]
    );

    const files = [];
    for (const row of rows) {
      const absolutePath = path.resolve('uploads', row.relative_path);
      if (fs.existsSync(absolutePath)) {
        files.push({
          ...row,
          absolutePath
        });
      }
    }

    return {
      folder,
      files
    };
  }
};

export default RepositorioDigitalService;
