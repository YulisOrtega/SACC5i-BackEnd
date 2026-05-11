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

    console.log('🔄 Ejecutando migración: crear_citas_bitacora...\n');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS citas_bitacora (
        id INT PRIMARY KEY AUTO_INCREMENT,
        cita_id INT NOT NULL,
        usuario_id INT NULL,
        evento VARCHAR(80) NOT NULL,
        titulo VARCHAR(180) NOT NULL,
        detalle TEXT NULL,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cita_id) REFERENCES citas_biometricas(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        INDEX idx_cita_id (cita_id),
        INDEX idx_evento (evento),
        INDEX idx_created_at (created_at)
      )
    `);

    console.log('✅ Tabla citas_bitacora creada/verificada');
    console.log('\n🎉 Migración completada exitosamente');
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default migration;
