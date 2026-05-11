import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migración: Crear tabla citas_biometricas y agregar fase 'cita_programada'
 *
 * Flujo: Validación CUIP (completado) → Cita Biométrica (cita_programada) → Toma de datos → finalizado
 *
 * Nueva tabla: citas_biometricas
 * Nuevo ENUM en tramites_alta.fase_actual: 'cita_programada'
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

    console.log('🔄 Ejecutando migración: agregar_citas_biometricas...\n');

    // 1. Crear tabla citas_biometricas
    await connection.query(`
      CREATE TABLE IF NOT EXISTS citas_biometricas (
        id INT PRIMARY KEY AUTO_INCREMENT,
        persona_tramite_id INT NOT NULL,
        tramite_alta_id INT NOT NULL,
        folio_cita VARCHAR(50) NOT NULL UNIQUE,
        fecha_cita DATETIME NOT NULL,
        lugar VARCHAR(255) NOT NULL DEFAULT 'C5i Puebla — Área de Toma de Datos Biométricos',
        notas TEXT NULL,
        estado ENUM('programada','completada','cancelada','reprogramada') DEFAULT 'programada',
        correo_destinatario VARCHAR(255) NOT NULL,
        notificacion_enviada BOOLEAN DEFAULT FALSE,
        creado_por_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (persona_tramite_id) REFERENCES personas_tramite_alta(id) ON DELETE CASCADE,
        FOREIGN KEY (tramite_alta_id) REFERENCES tramites_alta(id) ON DELETE CASCADE,
        FOREIGN KEY (creado_por_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        INDEX idx_persona (persona_tramite_id),
        INDEX idx_tramite (tramite_alta_id),
        INDEX idx_estado (estado),
        INDEX idx_fecha (fecha_cita),
        INDEX idx_folio (folio_cita)
      )
    `);
    console.log('✅ Tabla citas_biometricas creada');

    // 2. Agregar 'cita_programada' al ENUM de tramites_alta.fase_actual
    try {
      await connection.query(`
        ALTER TABLE tramites_alta
        MODIFY COLUMN fase_actual ENUM(
          'datos_solicitud',
          'validacion_personal',
          'enviado_c3',
          'dictaminado_c3',
          'rechazado_c3',
          'validado_c3',
          'revision_propuesta_c3',
          'revision_requisitos',
          'validacion_cuip',
          'cita_programada',
          'rechazado_no_corresponde',
          'rechazado',
          'finalizado'
        ) DEFAULT 'datos_solicitud'
      `);
      console.log('✅ ENUM fase_actual actualizado con "cita_programada"');
    } catch (err) {
      console.log(`  ⚠️  ENUM no actualizado (puede que ya exista): ${err.message}`);
    }

    console.log('\n🎉 Migración citas_biometricas completada exitosamente');
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
