import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const TABLE_CANDIDATES = ['finalizados', 'ciclo_vida_alta_final'];

const COLUMNS = [
  { name: 'acuse_persona_original_name', definition: 'VARCHAR(255) NULL' },
  { name: 'acuse_persona_stored_name', definition: 'VARCHAR(255) NULL' },
  { name: 'acuse_persona_relative_path', definition: 'VARCHAR(500) NULL' },
  { name: 'acuse_persona_uploaded_at', definition: 'TIMESTAMP NULL' },
  { name: 'acuse_persona_uploaded_by_id', definition: 'INT NULL' },
  { name: 'acuse_persona_repositorio_file_id', definition: 'INT NULL' }
];

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

    console.log('Ejecutando migracion: agregar_acuse_persona_finalizados...');

    for (const tableName of TABLE_CANDIDATES) {
      const [[tableRow]] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [tableName]
      );

      if (Number(tableRow?.total || 0) === 0) {
        console.log(`- Tabla ${tableName} no existe. Se omite.`);
        continue;
      }

      for (const column of COLUMNS) {
        const [[columnRow]] = await connection.query(
          `SELECT COUNT(*) AS total
           FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = ?
             AND COLUMN_NAME = ?`,
          [tableName, column.name]
        );

        if (Number(columnRow?.total || 0) > 0) {
          continue;
        }

        await connection.query(
          `ALTER TABLE ${tableName}
           ADD COLUMN ${column.name} ${column.definition}`
        );
        console.log(`  + Columna agregada en ${tableName}: ${column.name}`);
      }
    }

    console.log('Migracion agregar_acuse_persona_finalizados completada');
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
