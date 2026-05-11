import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migracion: crear_historial_registros_ccp
 * Guarda snapshots de registros CCP eliminados para historial persistente.
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

    console.log('Ejecutando migracion: crear_historial_registros_ccp...');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS historial_registros_ccp (
        id INT PRIMARY KEY AUTO_INCREMENT,
        registro_original_id INT NULL,
        numero_oficio_seq INT NOT NULL,
        anio YEAR NOT NULL,
        fecha DATE NOT NULL,
        area VARCHAR(300) NOT NULL,
        funcionario VARCHAR(300) NOT NULL,
        cargo VARCHAR(300) NOT NULL,
        oficio_referencia VARCHAR(100) NOT NULL,
        fecha_referencia DATE NOT NULL,
        tipo_solicitud VARCHAR(150) NOT NULL DEFAULT '',
        referencia_volante VARCHAR(20) NOT NULL DEFAULT 'N/A',
        folio_numero VARCHAR(50) NULL,
        accion_historial ENUM('ELIMINADO', 'ELIMINACION_MASIVA', 'VACIADO_TABLA') NOT NULL DEFAULT 'ELIMINADO',
        archivado_por_id INT NULL,
        archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_historial_registros_ccp_usuario
          FOREIGN KEY (archivado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        INDEX idx_historial_registros_oficio (numero_oficio_seq, anio),
        INDEX idx_historial_registros_archived_at (archived_at),
        INDEX idx_historial_registros_accion (accion_historial),
        INDEX idx_historial_registros_usuario (archivado_por_id)
      )
    `);

    console.log('Migracion crear_historial_registros_ccp completada.');
  } catch (error) {
    console.error('Error en migracion crear_historial_registros_ccp:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration().catch(() => process.exit(1));
