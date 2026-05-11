import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migracion: crear_dashboard_municipios_analista
 * Crea la tabla de municipios configurados en dashboard por analista.
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

    console.log('Ejecutando migracion: crear_dashboard_municipios_analista...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS analista_municipios_dashboard (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_analista_id INT NOT NULL,
        municipio_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_dashboard_analista_municipio (usuario_analista_id, municipio_id),
        INDEX idx_dashboard_usuario_analista (usuario_analista_id),
        INDEX idx_dashboard_municipio (municipio_id),
        CONSTRAINT fk_dashboard_usuario_analista
          FOREIGN KEY (usuario_analista_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        CONSTRAINT fk_dashboard_municipio
          FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE CASCADE
      )
    `);

    console.log('Migracion crear_dashboard_municipios_analista completada.');
  } catch (error) {
    console.error('Error en migracion crear_dashboard_municipios_analista:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration().catch(() => process.exit(1));
