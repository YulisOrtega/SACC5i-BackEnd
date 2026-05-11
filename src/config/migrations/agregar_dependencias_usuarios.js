import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const agregarCamposDependencias = async () => {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sacc5i_db'
    });

    console.log('🔄 Iniciando migración: Agregar soporte para rol Dependencias...\n');

    // 1. Verificar si el campo dependencia_id ya existe
    console.log('📋 Verificando campo dependencia_id en tabla usuarios...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'usuarios' 
      AND COLUMN_NAME = 'dependencia_id'
    `, [process.env.DB_NAME || 'sacc5i_db']);

    if (columns.length === 0) {
      console.log('➕ Agregando campo dependencia_id a tabla usuarios...');
      await connection.query(`
        ALTER TABLE usuarios 
        ADD COLUMN dependencia_id INT NULL AFTER region_id,
        ADD CONSTRAINT fk_usuario_dependencia FOREIGN KEY (dependencia_id) REFERENCES dependencias(id)
      `);
      console.log('✅ Campo dependencia_id agregado correctamente');
    } else {
      console.log('✓ Campo dependencia_id ya existe');
    }

    // 2. Verificar y actualizar el ENUM de rol
    console.log('\n📋 Verificando ENUM de rol en tabla usuarios...');
    const [enumInfo] = await connection.query(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'usuarios' 
      AND COLUMN_NAME = 'rol'
    `, [process.env.DB_NAME || 'sacc5i_db']);

    if (enumInfo.length > 0) {
      const enumValues = enumInfo[0].COLUMN_TYPE;
      if (!enumValues.includes('dependencia')) {
        console.log('➕ Agregando valor "dependencia" al ENUM de rol...');
        await connection.query(`
          ALTER TABLE usuarios 
          MODIFY COLUMN rol ENUM('super_admin', 'admin', 'analista', 'validador_c3', 'dependencia') NOT NULL
        `);
        console.log('✅ ENUM de rol actualizado correctamente');
      } else {
        console.log('✓ ENUM de rol ya incluye "dependencia"');
      }
    }

    // 3. Verificar si el campo es_tramite_dependencia ya existe
    console.log('\n📋 Verificando campo es_tramite_dependencia en tabla tramites_alta...');
    const [tramiteColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'tramites_alta' 
      AND COLUMN_NAME = 'es_tramite_dependencia'
    `, [process.env.DB_NAME || 'sacc5i_db']);

    if (tramiteColumns.length === 0) {
      console.log('➕ Agregando campo es_tramite_dependencia a tabla tramites_alta...');
      await connection.query(`
        ALTER TABLE tramites_alta 
        ADD COLUMN es_tramite_dependencia BOOLEAN DEFAULT FALSE AFTER fase_actual
      `);
      console.log('✅ Campo es_tramite_dependencia agregado correctamente');
    } else {
      console.log('✓ Campo es_tramite_dependencia ya existe');
    }

    console.log('\n🎉 Migración completada exitosamente!');
    console.log('\n📊 Cambios realizados:');
    console.log('   ✅ Campo dependencia_id agregado a usuarios');
    console.log('   ✅ ENUM rol actualizado con valor "dependencia"');
    console.log('   ✅ Campo es_tramite_dependencia agregado a tramites_alta');
    console.log('\n💡 Ahora puedes ejecutar: node src/config/seedData.js');

  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Ejecutar migración si se llama directamente
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  agregarCamposDependencias()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default agregarCamposDependencias;
