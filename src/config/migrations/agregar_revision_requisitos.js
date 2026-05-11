import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migración: Agregar campos para Revisión de Requisitos
 * 
 * Flujo: RecibidosC3 → "En Proceso" → Revisión Requisitos (Antecedentes + Documentos)
 * 
 * Nuevas columnas en personas_tramite_alta:
 * - fase_revision: Fase actual de la revisión de requisitos
 * - resultado_rnpsp: Resultado de consulta RNPSP
 * - resultado_suic: Resultado de consulta SUIC
 * - tiene_antecedentes: Si SUIC encontró antecedentes
 * - justificacion_antecedentes: Justificación obligatoria cuando hay antecedentes
 * - documentos_validados: JSON con estado de cada documento
 * - fecha_inicio_revision: Cuándo se inició la revisión
 * - fecha_fin_revision: Cuándo se completó la revisión
 * - revisado_por_usuario_id: Quién realizó la revisión
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

    console.log('🔄 Ejecutando migración: agregar_revision_requisitos...\n');

    // 1. Agregar columnas a personas_tramite_alta
    const columnas = [
      {
        nombre: 'fase_revision',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN fase_revision ENUM('pendiente','en_proceso','antecedentes','documentos','completado','rechazado_revision') 
              DEFAULT 'pendiente' 
              COMMENT 'Fase actual de revisión de requisitos'`
      },
      {
        nombre: 'resultado_rnpsp',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN resultado_rnpsp ENUM('pendiente','sin_antecedentes','con_antecedentes') 
              DEFAULT 'pendiente' 
              COMMENT 'Resultado consulta RNPSP'`
      },
      {
        nombre: 'resultado_suic',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN resultado_suic ENUM('pendiente','sin_antecedentes','con_antecedentes') 
              DEFAULT 'pendiente' 
              COMMENT 'Resultado consulta SUIC'`
      },
      {
        nombre: 'tiene_antecedentes',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN tiene_antecedentes BOOLEAN DEFAULT FALSE 
              COMMENT 'TRUE si SUIC detectó antecedentes'`
      },
      {
        nombre: 'justificacion_antecedentes',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN justificacion_antecedentes TEXT NULL 
              COMMENT 'Justificación obligatoria cuando hay antecedentes'`
      },
      {
        nombre: 'documentos_validados',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN documentos_validados JSON NULL 
              COMMENT 'Estado de validación de cada documento requerido'`
      },
      {
        nombre: 'fecha_inicio_revision',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN fecha_inicio_revision TIMESTAMP NULL 
              COMMENT 'Fecha en que se inició la revisión de requisitos'`
      },
      {
        nombre: 'fecha_fin_revision',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN fecha_fin_revision TIMESTAMP NULL 
              COMMENT 'Fecha en que se completó la revisión'`
      },
      {
        nombre: 'revisado_por_usuario_id',
        sql: `ALTER TABLE personas_tramite_alta 
              ADD COLUMN revisado_por_usuario_id INT NULL 
              COMMENT 'Analista C5 que realizó la revisión'`
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

    // 2. Agregar índice para fase_revision
    try {
      await connection.query(
        `ALTER TABLE personas_tramite_alta ADD INDEX idx_fase_revision (fase_revision)`
      );
      console.log('  ✅ Índice idx_fase_revision creado');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('  ⏭️  Índice idx_fase_revision ya existe');
      } else {
        throw err;
      }
    }

    // 3. Agregar FK para revisado_por_usuario_id
    try {
      await connection.query(
        `ALTER TABLE personas_tramite_alta 
         ADD CONSTRAINT fk_revisado_por 
         FOREIGN KEY (revisado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL`
      );
      console.log('  ✅ FK revisado_por_usuario_id creada');
    } catch (err) {
      if (err.code === 'ER_FK_DUP_NAME' || err.message.includes('already exists')) {
        console.log('  ⏭️  FK revisado_por ya existe');
      } else {
        // No es crítico, ignorar
        console.log(`  ⚠️  FK no creada: ${err.message}`);
      }
    }

    // 4. Agregar nueva fase al ENUM de tramites_alta.fase_actual
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
          'rechazado_no_corresponde',
          'rechazado',
          'finalizado'
        ) DEFAULT 'datos_solicitud'
      `);
      console.log('  ✅ ENUM fase_actual actualizado con "revision_requisitos"');
    } catch (err) {
      console.log(`  ⚠️  ENUM no actualizado: ${err.message}`);
    }

    console.log('\n🎉 Migración completada exitosamente');

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
