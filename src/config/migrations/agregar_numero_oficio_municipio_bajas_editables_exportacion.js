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

    console.log('Ejecutando migracion: agregar_numero_oficio_municipio_bajas_editables_exportacion...');

    const [columnas] = await connection.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'bajas_editables_exportacion'
         AND COLUMN_NAME = 'numero_oficio_municipio'`
    );

    if (columnas.length === 0) {
      await connection.query(
        `ALTER TABLE bajas_editables_exportacion
         ADD COLUMN numero_oficio_municipio VARCHAR(120) NULL AFTER cuip`
      );
      console.log('Columna agregada: numero_oficio_municipio');
    } else {
      console.log('Columna numero_oficio_municipio ya existe.');
    }

    console.log('Migracion agregar_numero_oficio_municipio_bajas_editables_exportacion completada');
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
