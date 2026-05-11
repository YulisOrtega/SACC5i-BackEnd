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

    console.log('Ejecutando migracion: corregir_indice_unico_global_numero_solicitud...');

    const [singleUniqueIndex] = await connection.query(
      `SELECT s.index_name
       FROM information_schema.statistics s
       JOIN (
         SELECT table_schema, table_name, index_name, COUNT(*) AS total_cols
         FROM information_schema.statistics
         WHERE table_schema = DATABASE()
           AND table_name = 'tramites_alta'
           AND non_unique = 0
           AND index_name <> 'PRIMARY'
         GROUP BY table_schema, table_name, index_name
       ) idx
         ON idx.table_schema = s.table_schema
        AND idx.table_name = s.table_name
        AND idx.index_name = s.index_name
       WHERE s.table_schema = DATABASE()
         AND s.table_name = 'tramites_alta'
         AND s.non_unique = 0
         AND s.column_name = 'numero_solicitud'
         AND idx.total_cols = 1
       LIMIT 1`
    );

    if (singleUniqueIndex.length > 0) {
      const safeIndexName = String(singleUniqueIndex[0].index_name || '').replace(/`/g, '');
      if (safeIndexName) {
        await connection.query(`ALTER TABLE tramites_alta DROP INDEX \`${safeIndexName}\``);
        console.log(`Indice unico global eliminado: ${safeIndexName}`);
      }
    } else {
      console.log('No existe indice unico global sobre numero_solicitud');
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
      console.log('Indice compuesto creado: uk_tramites_alta_usuario_numero');
    }

    console.log('Migracion corregir_indice_unico_global_numero_solicitud completada');
  } catch (error) {
    console.error('Error en migracion corregir_indice_unico_global_numero_solicitud:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default migration;
