import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const NUMERO_OFICIO_C5_DEFAULT = 'SSP/SII/C5I/DT/3263/2026';

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

    console.log('Iniciando migracion: agregar_numero_oficio_c5_tramites_alta...');

    try {
      await connection.query(`
        ALTER TABLE tramites_alta
        ADD COLUMN numero_oficio_c5 VARCHAR(100)
        DEFAULT '${NUMERO_OFICIO_C5_DEFAULT}'
        COMMENT 'Formato: SSP/SII/C5I/DT/3263/2026'
        AFTER fecha_recibido_dt
      `);
      console.log('Columna numero_oficio_c5 agregada en tramites_alta.');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('La columna numero_oficio_c5 ya existe, continuando...');
      } else {
        throw error;
      }
    }

    const [result] = await connection.query(
      `UPDATE tramites_alta
       SET numero_oficio_c5 = ?
       WHERE numero_oficio_c5 IS NULL OR TRIM(numero_oficio_c5) = ''`,
      [NUMERO_OFICIO_C5_DEFAULT]
    );

    console.log(`Registros normalizados con numero_oficio_c5 por defecto: ${result.affectedRows}`);
    console.log('Migracion completada.');
  } catch (error) {
    console.error('Error en migracion agregar_numero_oficio_c5_tramites_alta:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  migration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default migration;
