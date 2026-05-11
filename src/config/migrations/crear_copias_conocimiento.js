import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migración: Crear tabla copias_conocimiento y agregar rol operador_ccp
 *
 * Módulo: Copias de Conocimiento (CCP)
 * - Nueva tabla: copias_conocimiento
 * - Nuevo rol: operador_ccp en ENUM de usuarios.rol
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

    console.log('🔄 Ejecutando migración: crear_copias_conocimiento...\n');

    // 1. Crear tabla copias_conocimiento
    await connection.query(`
      CREATE TABLE IF NOT EXISTS copias_conocimiento (
        id INT PRIMARY KEY AUTO_INCREMENT,
        numero_oficio_seq INT NOT NULL,
        anio YEAR NOT NULL,
        fecha DATE NOT NULL,
        area VARCHAR(300) NOT NULL,
        funcionario VARCHAR(300) NOT NULL,
        cargo VARCHAR(300) NOT NULL,
        oficio_referencia VARCHAR(100) NOT NULL,
        fecha_referencia DATE NOT NULL,
        tipo_solicitud ENUM('Consulta','Alta','Baja') NOT NULL,
        referencia_volante VARCHAR(20) NOT NULL DEFAULT 'N/A',
        folio_numero VARCHAR(50) NULL,
        creado_por_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (creado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        INDEX idx_anio (anio),
        INDEX idx_fecha (fecha),
        INDEX idx_seq (numero_oficio_seq),
        INDEX idx_creado_por (creado_por_id)
      )
    `);
    console.log('✅ Tabla copias_conocimiento creada');

    // 2. Agregar rol 'operador_ccp' al ENUM de usuarios.rol
    try {
      await connection.query(`
        ALTER TABLE usuarios
        MODIFY COLUMN rol ENUM(
          'super_admin',
          'admin',
          'analista',
          'validador_c3',
          'dependencia',
          'operador_ccp'
        ) NOT NULL DEFAULT 'analista'
      `);
      console.log('✅ Rol operador_ccp agregado al ENUM de usuarios.rol');
    } catch (err) {
      console.log(`  ⚠️  ENUM no actualizado (puede que ya exista): ${err.message}`);
    }

    console.log('\n🎉 Migración crear_copias_conocimiento completada exitosamente');

  } catch (error) {
    console.error('❌ Error en migración:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration().catch(console.error);
