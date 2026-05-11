import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migracion: Normalizar destinatario fijo en CCP
 * - area, funcionario y cargo siempre en mayusculas
 * - rellena vacios con valores por defecto
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

    console.log('Normalizando destinatario fijo en CCP...');

    const [result] = await connection.query(`
      UPDATE copias_conocimiento
      SET
        area = UPPER(TRIM(COALESCE(NULLIF(area, ''), 'DIRECCIÓN DE TELECOMUNICACIONES DEL C5I'))),
        funcionario = UPPER(TRIM(COALESCE(NULLIF(funcionario, ''), 'ALEJANDRA LUIS COSMES'))),
        cargo = UPPER(TRIM(COALESCE(NULLIF(cargo, ''), 'DIRECTORA DE TELECOMUNICACIONES DEL C5I')))
    `);

    console.log(`Registros normalizados: ${result.affectedRows || 0}`);
    console.log('Migracion normalizar_destinatario_fijo_ccp completada.');
  } catch (error) {
    console.error('Error en migracion normalizar_destinatario_fijo_ccp:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration().catch(() => process.exit(1));
