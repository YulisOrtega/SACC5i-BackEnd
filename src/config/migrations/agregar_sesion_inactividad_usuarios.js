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

    console.log('Ejecutando migracion: agregar_sesion_inactividad_usuarios...');

    const [rows] = await connection.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'usuarios'
         AND COLUMN_NAME = 'sesion_ultima_actividad_at'`
    );

    if (rows.length === 0) {
      await connection.query(`
        ALTER TABLE usuarios
        ADD COLUMN sesion_ultima_actividad_at DATETIME NULL COMMENT 'Ultimo instante de actividad autenticada' AFTER sesion_activa_id
      `);
      console.log('Columna sesion_ultima_actividad_at agregada');
    } else {
      console.log('La columna sesion_ultima_actividad_at ya existe, sin cambios');
    }

    console.log('Migracion agregar_sesion_inactividad_usuarios completada');
  } catch (error) {
    console.error('Error en migracion agregar_sesion_inactividad_usuarios:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default migration;
