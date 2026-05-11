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

    console.log('🔄 Ejecutando migración: crear_repositorio_digital...\n');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS repositorio_folders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        parent_id INT NULL,
        nombre VARCHAR(150) NOT NULL,
        folder_type ENUM('year','month','category','custom') NOT NULL DEFAULT 'custom',
        year_value SMALLINT NULL,
        month_value TINYINT NULL,
        creado_por_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_repo_folder_parent
          FOREIGN KEY (parent_id) REFERENCES repositorio_folders(id) ON DELETE CASCADE,
        CONSTRAINT fk_repo_folder_user
          FOREIGN KEY (creado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        UNIQUE KEY uk_repo_folder_parent_name (parent_id, nombre),
        INDEX idx_repo_folder_parent (parent_id),
        INDEX idx_repo_folder_type (folder_type),
        INDEX idx_repo_folder_year (year_value),
        INDEX idx_repo_folder_month (month_value)
      )
    `);
    console.log('✅ Tabla repositorio_folders creada/verificada');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS repositorio_files (
        id INT PRIMARY KEY AUTO_INCREMENT,
        folder_id INT NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        relative_path VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size_bytes INT NOT NULL,
        folio VARCHAR(120) NULL,
        nombre_expediente VARCHAR(255) NULL,
        subido_por_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_repo_file_folder
          FOREIGN KEY (folder_id) REFERENCES repositorio_folders(id) ON DELETE CASCADE,
        CONSTRAINT fk_repo_file_user
          FOREIGN KEY (subido_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        INDEX idx_repo_file_folder (folder_id),
        INDEX idx_repo_file_folio (folio),
        INDEX idx_repo_file_nombre (nombre_expediente),
        INDEX idx_repo_file_created_at (created_at)
      )
    `);
    console.log('✅ Tabla repositorio_files creada/verificada');

    console.log('\n🎉 Migración crear_repositorio_digital completada exitosamente');
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
