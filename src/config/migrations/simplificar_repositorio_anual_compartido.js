import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const uploadsRoot = path.resolve('uploads', 'repositorio-digital');

const sanitizeFileName = (name, fallback) => {
  const clean = String(name || fallback || 'archivo').replace(/[\\/:*?"<>|]/g, '_').trim();
  return clean || String(fallback || 'archivo');
};

const folderNameForYear = (year) => `Acuses compartidos ${year}`;

const ensureAnnualFolder = async (connection, year) => {
  const cleanYear = Number(year);
  const [[existing]] = await connection.query(
    `SELECT id
     FROM repositorio_folders
     WHERE parent_id IS NULL
       AND folder_type = 'year'
       AND year_value = ?
     ORDER BY id ASC
     LIMIT 1`,
    [cleanYear]
  );

  if (existing?.id) {
    await connection.query(
      `UPDATE repositorio_folders
       SET nombre = ?, parent_id = NULL, month_value = NULL
       WHERE id = ?`,
      [folderNameForYear(cleanYear), existing.id]
    );
    return Number(existing.id);
  }

  const [insert] = await connection.query(
    `INSERT INTO repositorio_folders (parent_id, nombre, folder_type, year_value, month_value, creado_por_id)
     VALUES (NULL, ?, 'year', ?, NULL, NULL)`,
    [folderNameForYear(cleanYear), cleanYear]
  );

  return Number(insert.insertId);
};

const migration = async () => {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sacc5i_db'
    });

    console.log('Ejecutando migracion: simplificar_repositorio_anual_compartido...');

    const [[repoTable]] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'repositorio_folders'
    `);

    const [[repoFilesTable]] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'repositorio_files'
    `);

    if (Number(repoTable?.total || 0) === 0 || Number(repoFilesTable?.total || 0) === 0) {
      console.log('No existen tablas de repositorio digital, se omite migracion.');
      return;
    }

    await fs.promises.mkdir(uploadsRoot, { recursive: true });

    const [files] = await connection.query(
      `SELECT
         rf.id,
         rf.folder_id,
         rf.original_name,
         rf.stored_name,
         rf.relative_path,
         rf.created_at,
         COALESCE(f.year_value, YEAR(rf.created_at), YEAR(CURDATE())) AS year_value
       FROM repositorio_files rf
       LEFT JOIN repositorio_folders f ON f.id = rf.folder_id
       ORDER BY rf.id ASC`
    );

    const years = new Set();
    files.forEach((row) => years.add(Number(row.year_value || new Date().getFullYear())));
    years.add(Number(new Date().getFullYear()));

    const yearFolderMap = new Map();
    for (const year of years) {
      const folderId = await ensureAnnualFolder(connection, year);
      yearFolderMap.set(Number(year), folderId);
      await fs.promises.mkdir(path.join(uploadsRoot, String(folderId)), { recursive: true });
    }

    for (const row of files) {
      const year = Number(row.year_value || new Date().getFullYear());
      const targetFolderId = yearFolderMap.get(year);
      const oldRelativePath = String(row.relative_path || '');
      const oldAbsolutePath = path.resolve('uploads', oldRelativePath);

      const fallbackName = `${row.id}_${row.stored_name || row.original_name || 'archivo'}`;
      let targetStoredName = sanitizeFileName(row.stored_name, fallbackName);
      const targetDir = path.join(uploadsRoot, String(targetFolderId));
      let targetAbsolutePath = path.join(targetDir, targetStoredName);

      if (fs.existsSync(targetAbsolutePath) && oldAbsolutePath !== targetAbsolutePath) {
        targetStoredName = `${Date.now()}_${sanitizeFileName(row.original_name, fallbackName)}`;
        targetAbsolutePath = path.join(targetDir, targetStoredName);
      }

      const targetRelativePath = path.join('repositorio-digital', String(targetFolderId), targetStoredName).replace(/\\/g, '/');

      if (fs.existsSync(oldAbsolutePath) && oldAbsolutePath !== targetAbsolutePath) {
        await fs.promises.mkdir(path.dirname(targetAbsolutePath), { recursive: true });
        await fs.promises.rename(oldAbsolutePath, targetAbsolutePath);
      }

      await connection.query(
        `UPDATE repositorio_files
         SET folder_id = ?,
             stored_name = ?,
             relative_path = ?
         WHERE id = ?`,
        [targetFolderId, targetStoredName, targetRelativePath, row.id]
      );
    }

    const annualIds = [...yearFolderMap.values()];
    if (annualIds.length > 0) {
      const placeholders = annualIds.map(() => '?').join(',');
      await connection.query(
        `DELETE FROM repositorio_folders
         WHERE id NOT IN (${placeholders})`,
        annualIds
      );
    }

    const [orphanedFiles] = await connection.query(
      `SELECT relative_path
       FROM repositorio_files
       WHERE relative_path IS NOT NULL
         AND relative_path <> ''`
    );

    const keepSet = new Set(orphanedFiles.map((row) => path.resolve('uploads', row.relative_path)));
    if (fs.existsSync(uploadsRoot)) {
      const folderEntries = await fs.promises.readdir(uploadsRoot, { withFileTypes: true });
      for (const entry of folderEntries) {
        if (!entry.isDirectory()) continue;
        const subDir = path.join(uploadsRoot, entry.name);
        const fileEntries = await fs.promises.readdir(subDir, { withFileTypes: true });
        for (const fileEntry of fileEntries) {
          if (!fileEntry.isFile()) continue;
          const absoluteFile = path.join(subDir, fileEntry.name);
          if (!keepSet.has(absoluteFile)) {
            await fs.promises.unlink(absoluteFile).catch(() => {});
          }
        }
      }
    }

    console.log('Migracion simplificar_repositorio_anual_compartido completada');
  } catch (error) {
    console.error('Error en migracion simplificar_repositorio_anual_compartido:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default migration;
