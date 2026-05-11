import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dropTables = async () => {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sacc5i_db'
    });

    console.log('🔄 Eliminando todas las tablas...\n');

    // Desactivar verificación de claves foráneas temporalmente
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Eliminar tablas en orden inverso a las dependencias
    const tables = [
      'historial_tramites_alta',
      'personas_tramite_alta',
      'tramites_alta',
      'analista_municipios_dashboard',
      'usuarios',
      'puestos',
      'dependencias',
      'estatus_solicitudes',
      'tipos_oficio',
      'municipios',
      'regiones'
    ];

    for (const table of tables) {
      await connection.query(`DROP TABLE IF EXISTS ${table}`);
      console.log(`✅ Tabla ${table} eliminada`);
    }

    // Reactivar verificación de claves foráneas
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n🎉 Todas las tablas han sido eliminadas\n');

  } catch (error) {
    console.error('❌ Error al eliminar tablas:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Ejecutar si se llama directamente
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  dropTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default dropTables;
