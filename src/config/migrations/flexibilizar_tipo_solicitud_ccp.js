import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migracion: flexibilizar tipo_solicitud en CCP
 * - Cambia tipo_solicitud de ENUM a VARCHAR para permitir texto libre.
 * - Normaliza valores existentes a mayusculas.
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

    const [tableRows] = await connection.query("SHOW TABLES LIKE 'copias_conocimiento'");
    if (!Array.isArray(tableRows) || tableRows.length === 0) {
      console.log('Tabla copias_conocimiento no existe. Migracion omitida.');
      return;
    }

    const [columnRows] = await connection.query("SHOW COLUMNS FROM copias_conocimiento LIKE 'tipo_solicitud'");
    if (!Array.isArray(columnRows) || columnRows.length === 0) {
      console.log('Columna tipo_solicitud no existe. Migracion omitida.');
      return;
    }

    const currentType = String(columnRows[0].Type || '').toLowerCase();
    if (!currentType.startsWith('varchar')) {
      console.log('Actualizando tipo_solicitud a VARCHAR(150)...');
      await connection.query(`
        ALTER TABLE copias_conocimiento
        MODIFY COLUMN tipo_solicitud VARCHAR(150) NOT NULL DEFAULT ''
      `);
    } else {
      console.log('tipo_solicitud ya es VARCHAR.');
    }

    const [result] = await connection.query(`
      UPDATE copias_conocimiento
      SET tipo_solicitud = UPPER(TRIM(COALESCE(tipo_solicitud, '')))
    `);

    console.log(`Registros normalizados en tipo_solicitud: ${result.affectedRows || 0}`);
    console.log('Migracion flexibilizar_tipo_solicitud_ccp completada.');
  } catch (error) {
    console.error('Error en migracion flexibilizar_tipo_solicitud_ccp:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration().catch(() => process.exit(1));
