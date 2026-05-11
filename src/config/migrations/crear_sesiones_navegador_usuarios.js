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

    console.log('Ejecutando migracion: crear_sesiones_navegador_usuarios...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios_sesiones (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        session_id VARCHAR(64) NOT NULL,
        usuario_id INT NOT NULL,
        user_agent VARCHAR(512) NULL,
        ip_address VARCHAR(64) NULL,
        ultima_actividad_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME NULL,
        CONSTRAINT fk_usuarios_sesiones_usuario
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        UNIQUE KEY uk_usuarios_sesiones_session_id (session_id),
        INDEX idx_usuarios_sesiones_usuario_estado (usuario_id, closed_at, ultima_actividad_at),
        INDEX idx_usuarios_sesiones_ultima_actividad (ultima_actividad_at)
      )
    `);

    console.log('Tabla usuarios_sesiones creada/verificada');
    console.log('Migracion crear_sesiones_navegador_usuarios completada');
  } catch (error) {
    console.error('Error en migracion crear_sesiones_navegador_usuarios:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default migration;
