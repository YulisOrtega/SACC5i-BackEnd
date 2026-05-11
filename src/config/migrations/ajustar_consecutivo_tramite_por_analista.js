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

    console.log('Ejecutando migracion: ajustar_consecutivo_tramite_por_analista...');

    const [uniqueIndexes] = await connection.query(
      `SELECT s.index_name
       FROM information_schema.statistics s
       JOIN (
         SELECT index_name, COUNT(*) AS total_cols
         FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name = 'tramites_alta'
           AND non_unique = 0
           AND index_name <> 'PRIMARY'
         GROUP BY index_name
       ) idx ON idx.index_name = s.index_name
       WHERE s.table_schema = DATABASE()
         AND s.table_name = 'tramites_alta'
         AND s.non_unique = 0
         AND s.column_name = 'numero_solicitud'
         AND idx.total_cols = 1`
    );

    for (const row of uniqueIndexes) {
      const safeIndexName = String(row.index_name || '').replace(/`/g, '');
      if (!safeIndexName) continue;

      await connection.query(`ALTER TABLE tramites_alta DROP INDEX \`${safeIndexName}\``);
      console.log(`Indice unico eliminado: ${safeIndexName}`);
    }

    const [compositeIndex] = await connection.query(
      `SELECT 1
       FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = 'tramites_alta'
         AND index_name = 'uk_tramites_alta_usuario_numero'
       LIMIT 1`
    );

    if (compositeIndex.length === 0) {
      await connection.query(
        `ALTER TABLE tramites_alta
         ADD UNIQUE KEY uk_tramites_alta_usuario_numero (usuario_analista_c5_id, numero_solicitud)`
      );
      console.log('Indice unico compuesto creado: uk_tramites_alta_usuario_numero');
    } else {
      console.log('Indice compuesto ya existe: uk_tramites_alta_usuario_numero');
    }

    console.log('Migracion ajustar_consecutivo_tramite_por_analista completada');
  } catch (error) {
    console.error('Error en migracion ajustar_consecutivo_tramite_por_analista:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default migration;
