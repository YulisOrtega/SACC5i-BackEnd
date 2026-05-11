import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

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

    console.log('Ejecutando migracion: normalizar_acuses_alta_en_raiz...');

    const [[repoTable]] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'repositorio_folders'
    `);

    if (Number(repoTable?.total || 0) === 0) {
      console.log('repositorio_folders no existe, se omite normalizacion');
      return;
    }

    const [[rootAcuses]] = await connection.query(`
      SELECT id
      FROM repositorio_folders
      WHERE parent_id IS NULL AND nombre = 'Acuses alta'
      LIMIT 1
    `);

    let rootId = rootAcuses?.id;
    if (!rootId) {
      const [insertRoot] = await connection.query(`
        INSERT INTO repositorio_folders (parent_id, nombre, folder_type, creado_por_id)
        VALUES (NULL, 'Acuses alta', 'custom', NULL)
      `);
      rootId = insertRoot.insertId;
    }

    const [acusesDentroDeAnio] = await connection.query(`
      SELECT id
      FROM repositorio_folders
      WHERE nombre = 'Acuses alta' AND parent_id IS NOT NULL
    `);

    for (const row of acusesDentroDeAnio) {
      const oldId = Number(row.id);

      const [children] = await connection.query(
        'SELECT id, nombre FROM repositorio_folders WHERE parent_id = ?',
        [oldId]
      );

      for (const child of children) {
        const childId = Number(child.id);

        const [[existingChild]] = await connection.query(
          'SELECT id FROM repositorio_folders WHERE parent_id = ? AND nombre = ? LIMIT 1',
          [rootId, child.nombre]
        );

        if (existingChild?.id) {
          const targetId = Number(existingChild.id);

          await connection.query(
            'UPDATE repositorio_files SET folder_id = ? WHERE folder_id = ?',
            [targetId, childId]
          );

          await connection.query(
            'UPDATE repositorio_folders SET parent_id = ? WHERE parent_id = ?',
            [targetId, childId]
          );

          await connection.query('DELETE FROM repositorio_folders WHERE id = ?', [childId]);
        } else {
          await connection.query(
            'UPDATE repositorio_folders SET parent_id = ? WHERE id = ?',
            [rootId, childId]
          );
        }
      }

      await connection.query(
        'UPDATE repositorio_files SET folder_id = ? WHERE folder_id = ?',
        [rootId, oldId]
      );

      const [[finalizadosTable]] = await connection.query(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN ('finalizados', 'ciclo_vida_alta_final')
        ORDER BY CASE WHEN TABLE_NAME = 'finalizados' THEN 0 ELSE 1 END
        LIMIT 1
      `);

      if (finalizadosTable?.TABLE_NAME) {
        await connection.query(
          `UPDATE ${finalizadosTable.TABLE_NAME} SET repositorio_folder_id = ? WHERE repositorio_folder_id = ?`,
          [rootId, oldId]
        );
      }

      await connection.query('DELETE FROM repositorio_folders WHERE id = ?', [oldId]);
    }

    console.log('Migracion normalizar_acuses_alta_en_raiz completada');
  } catch (error) {
    console.error('Error en migracion:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default migration;
