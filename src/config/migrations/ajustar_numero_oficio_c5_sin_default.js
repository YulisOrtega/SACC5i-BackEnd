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

    console.log('Iniciando migracion: ajustar_numero_oficio_c5_sin_default...');

    const [columns] = await connection.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tramites_alta'
       AND COLUMN_NAME = 'numero_oficio_c5'
       LIMIT 1`
    );

    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE tramites_alta
        ADD COLUMN numero_oficio_c5 VARCHAR(100) NULL
        COMMENT 'Formato: SSP/SII/C5I/DT/3263/2026'
        AFTER fecha_recibido_dt
      `);
      console.log('Columna numero_oficio_c5 creada sin valor por defecto.');
    } else {
      await connection.query(`
        ALTER TABLE tramites_alta
        MODIFY COLUMN numero_oficio_c5 VARCHAR(100) NULL
        COMMENT 'Formato: SSP/SII/C5I/DT/3263/2026'
      `);
      console.log('Columna numero_oficio_c5 ajustada sin valor por defecto.');
    }

    console.log('Migracion completada.');
  } catch (error) {
    console.error('Error en migracion ajustar_numero_oficio_c5_sin_default:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  migration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default migration;
