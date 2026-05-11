import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const hasColumn = async (connection, tableName, columnName) => {
  const [rows] = await connection.query(
    'SHOW COLUMNS FROM ?? LIKE ?',
    [tableName, columnName]
  );
  return Array.isArray(rows) && rows.length > 0;
};

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

    console.log('Agregando volante_numero a CCP...');

    if (!(await hasColumn(connection, 'copias_conocimiento', 'volante_numero'))) {
      await connection.query(`
        ALTER TABLE copias_conocimiento
        ADD COLUMN volante_numero VARCHAR(50) NULL AFTER folio_numero
      `);
      console.log('✅ Columna volante_numero agregada en copias_conocimiento');
    } else {
      console.log('ℹ️ copias_conocimiento.volante_numero ya existe');
    }

    if (!(await hasColumn(connection, 'historial_registros_ccp', 'volante_numero'))) {
      await connection.query(`
        ALTER TABLE historial_registros_ccp
        ADD COLUMN volante_numero VARCHAR(50) NULL AFTER folio_numero
      `);
      console.log('✅ Columna volante_numero agregada en historial_registros_ccp');
    } else {
      console.log('ℹ️ historial_registros_ccp.volante_numero ya existe');
    }

    await connection.query(`
      UPDATE copias_conocimiento
      SET volante_numero = folio_numero
      WHERE volante_numero IS NULL AND folio_numero IS NOT NULL
    `);

    console.log('Migración agregar_volante_numero_ccp completada.');
  } catch (error) {
    console.error('Error en migración agregar_volante_numero_ccp:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration().catch(() => process.exit(1));