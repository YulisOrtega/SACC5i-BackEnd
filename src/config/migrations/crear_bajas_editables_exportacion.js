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

    console.log('Ejecutando migracion: crear_bajas_editables_exportacion...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS bajas_editables_exportacion (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id INT NOT NULL,
        nombre_elemento VARCHAR(160) NOT NULL,
        apellido_paterno VARCHAR(120) NOT NULL,
        apellido_materno VARCHAR(120) NULL,
        municipio_nombre VARCHAR(120) NOT NULL,
        cuip VARCHAR(60) NULL,
        baja_tipo VARCHAR(255) NOT NULL,
        baja_motivo VARCHAR(255) NOT NULL,
        baja_fecha DATE NOT NULL,
        observaciones TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        INDEX idx_baja_editable_usuario (usuario_id),
        INDEX idx_baja_editable_fecha (baja_fecha),
        INDEX idx_baja_editable_created_at (created_at)
      )
    `);

    console.log('Migracion crear_bajas_editables_exportacion completada');
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
