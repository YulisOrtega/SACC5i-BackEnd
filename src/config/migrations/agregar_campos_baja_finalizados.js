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

    console.log('Ejecutando migracion: agregar_campos_baja_finalizados...');

    const [[tabla]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'finalizados'`
    );

    if (Number(tabla?.total || 0) === 0) {
      console.log('Tabla finalizados no existe. Se omite migracion.');
      return;
    }

    const asegurarColumna = async (columnName, definition) => {
      const [[exists]] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'finalizados'
           AND COLUMN_NAME = ?`,
        [columnName]
      );

      if (Number(exists?.total || 0) > 0) return;

      await connection.query(`ALTER TABLE finalizados ADD COLUMN ${definition}`);
      console.log(`Columna agregada: ${columnName}`);
    };

    await asegurarColumna('is_baja', 'is_baja TINYINT(1) NOT NULL DEFAULT 0');
    await asegurarColumna('baja_tipo', 'baja_tipo VARCHAR(255) NULL');
    await asegurarColumna('baja_motivo', 'baja_motivo VARCHAR(255) NULL');
    await asegurarColumna('baja_fecha', 'baja_fecha DATE NULL');
    await asegurarColumna('baja_observaciones', 'baja_observaciones TEXT NULL');
    await asegurarColumna('baja_usuario_id', 'baja_usuario_id INT NULL');
    await asegurarColumna('baja_registrada_at', 'baja_registrada_at TIMESTAMP NULL');

    const [[idxIsBaja]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'finalizados'
         AND INDEX_NAME = 'idx_finalizados_is_baja'`
    );

    if (Number(idxIsBaja?.total || 0) === 0) {
      await connection.query('CREATE INDEX idx_finalizados_is_baja ON finalizados (is_baja)');
      console.log('Indice creado: idx_finalizados_is_baja');
    }

    const [[idxBajaFecha]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'finalizados'
         AND INDEX_NAME = 'idx_finalizados_baja_fecha'`
    );

    if (Number(idxBajaFecha?.total || 0) === 0) {
      await connection.query('CREATE INDEX idx_finalizados_baja_fecha ON finalizados (baja_fecha)');
      console.log('Indice creado: idx_finalizados_baja_fecha');
    }

    console.log('Migracion agregar_campos_baja_finalizados completada');
  } catch (error) {
    console.error('Error en migracion:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default migration;
