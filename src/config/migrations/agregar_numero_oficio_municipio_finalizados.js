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

    console.log('Ejecutando migracion: agregar_numero_oficio_municipio_finalizados...');

    const [[tabla]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'finalizados'`
    );

    if (Number(tabla?.total || 0) === 0) {
      console.log('Tabla finalizados no existe. Se omite migracion.');
      return;
    }

    const [[columna]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'finalizados'
         AND COLUMN_NAME = 'numero_oficio_municipio'`
    );

    if (Number(columna?.total || 0) === 0) {
      await connection.query(
        'ALTER TABLE finalizados ADD COLUMN numero_oficio_municipio VARCHAR(120) NULL AFTER numero_oficio'
      );
      console.log('Columna agregada: numero_oficio_municipio');
    } else {
      console.log('Columna numero_oficio_municipio ya existe.');
    }

    console.log('Migracion agregar_numero_oficio_municipio_finalizados completada');
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
