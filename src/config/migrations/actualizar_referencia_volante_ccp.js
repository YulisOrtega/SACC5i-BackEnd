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

    console.log('Actualizando copias_conocimiento.referencia_volante a VARCHAR(20)...');

    await connection.query(`
      ALTER TABLE copias_conocimiento
      MODIFY COLUMN referencia_volante VARCHAR(20) NOT NULL DEFAULT 'N/A'
    `);

    console.log('Migración completada correctamente.');
  } catch (error) {
    console.error('Error al actualizar referencia_volante:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration().catch(console.error);