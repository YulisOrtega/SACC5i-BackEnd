import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const TARGET_NAMES = [
  'Registro-1-54326463278UIHJHFJG',
  'Registro-2-56426456YRHTHRGH',
  'Registro-4-817274678983248769'
];

const uploadsRoot = path.resolve('uploads');

const getDescendantIds = async (connection, rootId) => {
  const collected = new Set();
  const queue = [Number(rootId)];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || collected.has(current)) continue;

    collected.add(current);

    const [children] = await connection.query(
      'SELECT id FROM repositorio_folders WHERE parent_id = ?',
      [current]
    );

    for (const child of children) queue.push(child.id);
  }

  return [...collected];
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

    console.log('Ejecutando migracion: limpiar_carpetas_sobrantes_acuses...');

    const placeholders = TARGET_NAMES.map(() => '?').join(',');
    const [rows] = await connection.query(
      `SELECT c.id, c.nombre
       FROM repositorio_folders c
       INNER JOIN repositorio_folders p ON p.id = c.parent_id
       WHERE p.nombre = 'Acuses alta'
         AND c.nombre IN (${placeholders})`,
      TARGET_NAMES
    );

    if (!rows.length) {
      console.log('No se encontraron carpetas sobrantes para limpiar.');
      return;
    }

    const descendantIds = new Set();
    for (const row of rows) {
      const ids = await getDescendantIds(connection, row.id);
      ids.forEach((id) => descendantIds.add(id));
    }

    const allIds = [...descendantIds];
    if (!allIds.length) {
      console.log('No hay ids descendientes para limpiar.');
      return;
    }

    const descendantsPlaceholders = allIds.map(() => '?').join(',');
    const [files] = await connection.query(
      `SELECT relative_path FROM repositorio_files WHERE folder_id IN (${descendantsPlaceholders})`,
      allIds
    );

    const topLevelIds = rows.map((row) => row.id);
    const topLevelPlaceholders = topLevelIds.map(() => '?').join(',');
    await connection.query(
      `DELETE FROM repositorio_folders WHERE id IN (${topLevelPlaceholders})`,
      topLevelIds
    );

    for (const file of files) {
      try {
        const absolutePath = path.resolve(uploadsRoot, file.relative_path);
        await fs.promises.unlink(absolutePath);
      } catch {
        // Ignora faltantes fisicos para no bloquear la limpieza logica.
      }
    }

    console.log(`Carpetas eliminadas: ${rows.map((r) => r.nombre).join(', ')}`);
    console.log('Migracion limpiar_carpetas_sobrantes_acuses completada');
  } catch (error) {
    console.error('Error en migracion limpiar_carpetas_sobrantes_acuses:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default migration;
