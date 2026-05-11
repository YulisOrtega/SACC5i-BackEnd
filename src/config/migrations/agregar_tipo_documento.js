import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Migración: Agregar campo tipo_documento a tramites_alta
 * Y actualizar tipos_oficio para usar Emitido/Recibido
 */
const agregarTipoDocumento = async () => {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sacc5i_db'
    });

    console.log('🔄 Iniciando migración: Agregar tipo_documento...\n');

    // Deshabilitar foreign key checks temporalmente
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Agregar campo tipo_documento a tramites_alta
    console.log('📝 Agregando campo tipo_documento a tramites_alta...');
    try {
      await connection.query(`
        ALTER TABLE tramites_alta 
        ADD COLUMN tipo_documento ENUM('Oficio', 'Volante') DEFAULT 'Oficio' 
        COMMENT 'Tipo de documento: Oficio o Volante'
        AFTER es_tramite_dependencia
      `);
      console.log('✅ Campo tipo_documento agregado');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  Campo tipo_documento ya existe, continuando...');
      } else {
        throw error;
      }
    }

    // 2. Primero, poner tipo_oficio_id en NULL en trámites existentes
    console.log('\n🔄 Preparando trámites existentes...');
    await connection.query(`
      UPDATE tramites_alta 
      SET tipo_oficio_id = NULL
      WHERE tipo_oficio_id IS NOT NULL
    `);
    console.log('✅ Trámites preparados');

    // 3. Limpiar tipos_oficio antiguos
    console.log('\n🗑️  Limpiando tipos de oficio antiguos...');
    await connection.query('DELETE FROM tipos_oficio');
    console.log('✅ Tipos de oficio antiguos eliminados');

    // 4. Insertar nuevos tipos de oficio (Emitido y Recibido)
    console.log('\n📋 Insertando nuevos tipos de oficio...');
    const nuevosTipos = [
      ['Emitido', 'Documento emitido por la dependencia'],
      ['Recibido', 'Documento recibido de otra instancia']
    ];

    for (const [nombre, descripcion] of nuevosTipos) {
      await connection.query(
        'INSERT INTO tipos_oficio (nombre, descripcion) VALUES (?, ?)',
        [nombre, descripcion]
      );
      console.log(`   ✓ ${nombre}`);
    }

    // 5. Actualizar tramites_alta existentes para usar tipo_oficio_id = 1 (Emitido) por defecto
    console.log('\n🔄 Actualizando trámites existentes...');
    const [result] = await connection.query(`
      UPDATE tramites_alta 
      SET tipo_oficio_id = 1, tipo_documento = 'Oficio'
      WHERE tipo_oficio_id IS NULL
    `);
    console.log(`✅ ${result.affectedRows} trámites actualizados`);

    // Reactivar foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n✅ Migración completada exitosamente!\n');
    console.log('📋 Resumen de cambios:');
    console.log('   - Campo tipo_documento agregado a tramites_alta');
    console.log('   - Tipos de oficio actualizados: Emitido y Recibido');
    console.log('   - Trámites existentes actualizados\n');

  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Ejecutar si se llama directamente
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  agregarTipoDocumento()
    .then(() => {
      console.log('✅ Script ejecutado correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error al ejecutar script:', error);
      process.exit(1);
    });
}

export default agregarTipoDocumento;
