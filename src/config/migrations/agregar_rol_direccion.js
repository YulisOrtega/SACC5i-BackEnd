import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migracion: agregar rol direccion al ENUM de usuarios.rol
 */
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

    console.log('Ejecutando migracion: agregar_rol_direccion...');

    await connection.query(`
      ALTER TABLE usuarios
      MODIFY COLUMN rol ENUM(
        'super_admin',
        'admin',
        'direccion',
        'analista',
        'validador_c3',
        'dependencia',
        'operador_ccp'
      ) NOT NULL DEFAULT 'analista'
    `);

    console.log('Migracion agregar_rol_direccion completada');
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
