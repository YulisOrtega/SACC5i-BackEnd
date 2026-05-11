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

    console.log('🔄 Ejecutando migración: ajustar_enum_fase_actual_cita_programada...\n');

    const [[column]] = await connection.query(
      `SELECT COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tramites_alta'
         AND COLUMN_NAME = 'fase_actual'
       LIMIT 1`
    );

    if (!column?.COLUMN_TYPE) {
      throw new Error('No se encontró la columna tramites_alta.fase_actual');
    }

    const columnType = String(column.COLUMN_TYPE);
    if (columnType.includes("'cita_programada'")) {
      console.log('✅ El ENUM de fase_actual ya incluye cita_programada');
      return;
    }

    const valores = [];
    const regex = /'((?:\\'|[^'])*)'/g;
    let match;
    while ((match = regex.exec(columnType)) !== null) {
      valores.push(match[1]);
    }

    if (!valores.includes('cita_programada')) {
      valores.push('cita_programada');
    }

    const enumSql = valores.map((v) => `'${v.replace(/'/g, "\\'")}'`).join(',');

    await connection.query(
      `ALTER TABLE tramites_alta
       MODIFY COLUMN fase_actual ENUM(${enumSql}) DEFAULT 'datos_solicitud'`
    );

    console.log('✅ ENUM fase_actual actualizado con cita_programada');
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

export default migration;
