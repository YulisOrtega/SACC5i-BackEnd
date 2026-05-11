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

    console.log('🔄 Ejecutando migración: crear_accesos_temporales_usuarios...\n');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios_accesos_temporales (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id INT NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        duracion_dias INT NOT NULL,
        expires_at DATETIME NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        motivo VARCHAR(255) NULL,
        creado_por_id INT NOT NULL,
        revocado_por_id INT NULL,
        revocado_at DATETIME NULL,
        revocado_motivo VARCHAR(255) NULL,
        ultimo_uso_at DATETIME NULL,
        total_usos INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_uat_usuario
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        CONSTRAINT fk_uat_creado_por
          FOREIGN KEY (creado_por_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
        CONSTRAINT fk_uat_revocado_por
          FOREIGN KEY (revocado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        INDEX idx_uat_usuario_activo_expira (usuario_id, activo, expires_at),
        INDEX idx_uat_expires_at (expires_at)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios_accesos_temporales_bitacora (
        id INT PRIMARY KEY AUTO_INCREMENT,
        acceso_temporal_id INT NULL,
        usuario_objetivo_id INT NOT NULL,
        actor_id INT NULL,
        actor_rol VARCHAR(50) NULL,
        accion ENUM('generada', 'revocada', 'usada', 'expirada') NOT NULL,
        descripcion VARCHAR(255) NOT NULL,
        metadata_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_uatb_acceso_temporal
          FOREIGN KEY (acceso_temporal_id) REFERENCES usuarios_accesos_temporales(id) ON DELETE SET NULL,
        CONSTRAINT fk_uatb_usuario_objetivo
          FOREIGN KEY (usuario_objetivo_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        CONSTRAINT fk_uatb_actor
          FOREIGN KEY (actor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        INDEX idx_uatb_usuario_objetivo (usuario_objetivo_id),
        INDEX idx_uatb_accion (accion),
        INDEX idx_uatb_created_at (created_at)
      )
    `);

    console.log('✅ Tablas de acceso temporal y bitácora creadas/verificadas');
    console.log('\n🎉 Migración crear_accesos_temporales_usuarios completada exitosamente');
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
