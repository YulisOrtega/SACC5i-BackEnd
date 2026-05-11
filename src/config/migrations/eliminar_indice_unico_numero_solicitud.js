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

    console.log('Ejecutando migracion: eliminar_indice_unico_numero_solicitud...');

    const [rows] = await connection.query(
      `SHOW INDEX FROM tramites_alta WHERE Key_name = 'numero_solicitud'`
    );

    const existeIndiceUnicoGlobal =
      rows.length > 0 && rows.every((row) => Number(row.Non_unique) === 0);

    if (existeIndiceUnicoGlobal) {
      await connection.query('ALTER TABLE tramites_alta DROP INDEX numero_solicitud');
      console.log('Indice unico global eliminado: numero_solicitud');
    } else {
      console.log('No existe indice unico global numero_solicitud');
    }

    const [compositeIndex] = await connection.query(
      `SHOW INDEX FROM tramites_alta WHERE Key_name = 'uk_tramites_alta_usuario_numero'`
    );

    if (compositeIndex.length === 0) {
      await connection.query(
        `ALTER TABLE tramites_alta
         ADD UNIQUE KEY uk_tramites_alta_usuario_numero (usuario_analista_c5_id, numero_solicitud)`
      );
      console.log('Indice compuesto creado: uk_tramites_alta_usuario_numero');
    }

    console.log('Migracion eliminar_indice_unico_numero_solicitud completada');
  } catch (error) {
    console.error('Error en migracion eliminar_indice_unico_numero_solicitud:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

export default migration;
