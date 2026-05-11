import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migración: Agregar justificacion_rnpsp a personas_tramite_alta
 *
 * Hace que RNPSP sea simétrico a SUIC:
 * - justificacion_rnpsp: Texto obligatorio cuando resultado_rnpsp = 'con_antecedentes'
 *
 * Además actualiza el comentario de tiene_antecedentes para reflejar
 * que ahora aplica a RNPSP O SUIC.
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

    console.log('🔄 Ejecutando migración: agregar_justificacion_rnpsp...\n');

    try {
      await connection.query(`
        ALTER TABLE personas_tramite_alta
        ADD COLUMN justificacion_rnpsp TEXT NULL
        COMMENT 'Justificación obligatoria cuando resultado_rnpsp = con_antecedentes'
        AFTER resultado_rnpsp
      `);
      console.log("  ✅ Columna 'justificacion_rnpsp' agregada");
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log("  ⏭️  Columna 'justificacion_rnpsp' ya existe, omitiendo");
      } else {
        throw err;
      }
    }

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
