import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migración: Agregar campos para Validación de CUIP (Cédula Única de Identificación Personal)
 * 
 * Flujo: Revisión Requisitos (completado) → Validación CUIP (32 secciones checklist)
 * 
 * Nuevas columnas en personas_tramite_alta:
 * - fase_cuip: Fase actual de validación CUIP
 * - cuip_validacion: JSON con estado de cada sección/campo del checklist
 * - cuip_excepciones: JSON con secciones marcadas como NINGUNO/NINGUNA
 * - fecha_inicio_cuip: Cuándo se inició la validación CUIP
 * - fecha_fin_cuip: Cuándo se completó
 * - cuip_revisado_por_id: Quién realizó la validación
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

    console.log('🔄 Ejecutando migración: agregar_validacion_cuip...\n');

    // 1. Agregar columnas a personas_tramite_alta
    const columnas = [
      {
        nombre: 'fase_cuip',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN fase_cuip ENUM('pendiente','en_proceso','completado','rechazado_cuip') 
              DEFAULT 'pendiente' 
              COMMENT 'Fase actual de validación CUIP'`
      },
      {
        nombre: 'cuip_validacion',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN cuip_validacion JSON NULL 
              COMMENT 'Estado de validación de cada sección/campo del CUIP'`
      },
      {
        nombre: 'cuip_excepciones',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN cuip_excepciones JSON NULL 
              COMMENT 'Secciones marcadas como NINGUNO/NINGUNA'`
      },
      {
        nombre: 'fecha_inicio_cuip',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN fecha_inicio_cuip TIMESTAMP NULL 
              COMMENT 'Fecha en que se inició la validación CUIP'`
      },
      {
        nombre: 'fecha_fin_cuip',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN fecha_fin_cuip TIMESTAMP NULL 
              COMMENT 'Fecha en que se completó la validación CUIP'`
      },
      {
        nombre: 'cuip_revisado_por_id',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN cuip_revisado_por_id INT NULL 
              COMMENT 'Analista C5 que realizó la validación CUIP'`
      }
    ];

    for (const col of columnas) {
      try {
        await connection.query(col.sql);
        console.log(`  ✅ Columna '${col.nombre}' agregada`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ⏭️  Columna '${col.nombre}' ya existe, omitiendo`);
        } else {
          throw err;
        }
      }
    }

    // 2. Agregar índice para fase_cuip
    try {
      await connection.query(
        `ALTER TABLE personas_tramite_alta ADD INDEX idx_fase_cuip (fase_cuip)`
      );
      console.log('  ✅ Índice idx_fase_cuip creado');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('  ⏭️  Índice idx_fase_cuip ya existe');
      } else {
        throw err;
      }
    }

    // 3. Agregar FK para cuip_revisado_por_id
    try {
      await connection.query(
        `ALTER TABLE personas_tramite_alta 
         ADD CONSTRAINT fk_cuip_revisado_por 
         FOREIGN KEY (cuip_revisado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL`
      );
      console.log('  ✅ FK cuip_revisado_por_id creada');
    } catch (err) {
      if (err.code === 'ER_FK_DUP_NAME' || err.message.includes('already exists')) {
        console.log('  ⏭️  FK cuip_revisado_por ya existe');
      } else {
        console.log(`  ⚠️  FK no creada: ${err.message}`);
      }
    }

    // 4. Agregar 'validacion_cuip' al ENUM de tramites_alta.fase_actual
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
          'rechazado_no_corresponde',
          'rechazado',
          'finalizado'
        ) DEFAULT 'datos_solicitud'
      `);
      console.log('  ✅ ENUM fase_actual actualizado con "validacion_cuip"');
    } catch (err) {
      console.log(`  ⚠️  ENUM no actualizado: ${err.message}`);
    }

    console.log('\n🎉 Migración CUIP completada exitosamente');

  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

// Ejecutar directamente
migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default migration;
