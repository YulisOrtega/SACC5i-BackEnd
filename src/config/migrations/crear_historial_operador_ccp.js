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

    console.log('🔄 Ejecutando migración: crear_historial_operador_ccp...\n');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS historial_operador_ccp (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id INT NOT NULL,
        usuario_rol VARCHAR(50) NOT NULL,
        modulo VARCHAR(80) NOT NULL,
        accion VARCHAR(80) NOT NULL,
        entidad VARCHAR(80) NOT NULL,
        entidad_id INT NULL,
        descripcion VARCHAR(255) NOT NULL,
        metadata_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_historial_operador_usuario
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        INDEX idx_historial_operador_usuario (usuario_id),
        INDEX idx_historial_operador_modulo (modulo),
        INDEX idx_historial_operador_created_at (created_at)
      )
    `);

    console.log('✅ Tabla historial_operador_ccp creada/verificada');
    console.log('\n🎉 Migración crear_historial_operador_ccp completada exitosamente');
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
