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

    console.log('Ejecutando migracion: crear_finalizados...');

    const [[hasFinalizados]] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finalizados'
    `);

    const [[hasOldTable]] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ciclo_vida_alta_final'
    `);

    if (Number(hasFinalizados?.total || 0) === 0 && Number(hasOldTable?.total || 0) > 0) {
      await connection.query('RENAME TABLE ciclo_vida_alta_final TO finalizados');
      console.log('Tabla legacy renombrada a finalizados');
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS finalizados (
        id INT PRIMARY KEY AUTO_INCREMENT,
        cita_id INT NOT NULL,
        persona_tramite_id INT NOT NULL,
        tramite_alta_id INT NOT NULL,
        nombre_elemento VARCHAR(255) NOT NULL,
        puesto_elemento VARCHAR(255) NULL,
        numero_oficio VARCHAR(120) NULL,
        fecha_termino DATE NULL,
        cuip VARCHAR(50) NULL,
        fase1_estado ENUM('pendiente','en_revision','rechazado','firmado') NOT NULL DEFAULT 'pendiente',
        acuse_original_name VARCHAR(255) NULL,
        acuse_stored_name VARCHAR(255) NULL,
        acuse_relative_path VARCHAR(500) NULL,
        acuse_uploaded_at TIMESTAMP NULL,
        acuse_uploaded_by_id INT NULL,
        repositorio_folder_id INT NULL,
        repositorio_file_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_finalizado_cita FOREIGN KEY (cita_id) REFERENCES citas_biometricas(id) ON DELETE CASCADE,
        CONSTRAINT fk_finalizado_persona FOREIGN KEY (persona_tramite_id) REFERENCES personas_tramite_alta(id) ON DELETE CASCADE,
        CONSTRAINT fk_finalizado_tramite FOREIGN KEY (tramite_alta_id) REFERENCES tramites_alta(id) ON DELETE CASCADE,
        CONSTRAINT fk_finalizado_upload_user FOREIGN KEY (acuse_uploaded_by_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        UNIQUE KEY uk_finalizado_cita (cita_id),
        INDEX idx_finalizado_cuip (cuip),
        INDEX idx_finalizado_fase1 (fase1_estado),
        INDEX idx_finalizado_created (created_at)
      )
    `);

    const [[repoTable]] = await connection.query(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'repositorio_folders'
    `);

    if (Number(repoTable?.total || 0) > 0) {
      const [roots] = await connection.query(`
        SELECT id FROM repositorio_folders
        WHERE parent_id IS NULL AND nombre = 'Acuses alta'
        ORDER BY id ASC
        LIMIT 1
      `);

      if (roots.length === 0) {
        await connection.query(`
          INSERT INTO repositorio_folders (parent_id, nombre, folder_type, creado_por_id)
          VALUES (NULL, 'Acuses alta', 'custom', NULL)
        `);
      }
    }

    console.log('Migracion crear_finalizados completada');
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
