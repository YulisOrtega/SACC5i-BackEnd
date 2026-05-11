/**
 * ⚠️  SCRIPT DE LIMPIEZA - SOLO PARA DESARROLLO
 * 
 * Este script elimina TODOS los datos de trámites, personas e historial.
 * Los catálogos (usuarios, puestos, municipios, etc.) se mantienen intactos.
 * 
 * USO:
 *   npm run limpiar:tramites
 * 
 * ⚠️  ADVERTENCIA: Esta acción es IRREVERSIBLE
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

// Función para pedir confirmación
function preguntarConfirmacion() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n⚠️  ¿Estás seguro de que quieres eliminar TODOS los trámites? (escribe "SI" para confirmar): ', (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'SI');
    });
  });
}

async function limpiarTramites() {
  let connection;
  
  try {
    console.log('\n🚨 SCRIPT DE LIMPIEZA DE TRÁMITES 🚨\n');
    console.log('Este script eliminará:');
    console.log('  ❌ TODOS los trámites');
    console.log('  ❌ TODAS las personas de trámites');
    console.log('  ❌ TODO el historial de trámites');
    console.log('  ❌ TODOS los municipios del dashboard de analistas\n');
    console.log('Se mantendrán:');
    console.log('  ✅ Usuarios');
    console.log('  ✅ Catálogos (puestos, municipios, dependencias, etc.)\n');

    // Pedir confirmación
    const confirmado = await preguntarConfirmacion();
    
    if (!confirmado) {
      console.log('\n❌ Operación cancelada por el usuario\n');
      process.exit(0);
    }

    console.log('\n🔄 Conectando a la base de datos...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sacc5i_db'
    });
    console.log('✅ Conexión establecida\n');

    // Verificar que no estamos en producción
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ ERROR: Este script NO puede ejecutarse en producción\n');
      process.exit(1);
    }

    console.log('🗑️  Limpiando tablas de trámites...\n');

    // Contar registros antes de eliminar
    const [countTramites] = await connection.query('SELECT COUNT(*) as total FROM tramites_alta');
    const [countPersonas] = await connection.query('SELECT COUNT(*) as total FROM personas_tramite_alta');
    const [countHistorial] = await connection.query('SELECT COUNT(*) as total FROM historial_tramites_alta');
    const [countDashboard] = await connection.query('SELECT COUNT(*) as total FROM analista_municipios_dashboard');

    console.log('📊 Registros a eliminar:');
    console.log(`   - Trámites: ${countTramites[0].total}`);
    console.log(`   - Personas: ${countPersonas[0].total}`);
    console.log(`   - Historial: ${countHistorial[0].total}`);
    console.log(`   - Dashboard municipios: ${countDashboard[0].total}\n`);

    // Desactivar checks de foreign keys temporalmente
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // Limpiar en orden (de dependientes a principales)
    console.log('  📋 Limpiando historial_tramites_alta...');
    await connection.query('DELETE FROM historial_tramites_alta');
    console.log('     ✅ Eliminado');

    console.log('  👥 Limpiando personas_tramite_alta...');
    await connection.query('DELETE FROM personas_tramite_alta');
    console.log('     ✅ Eliminado');

    console.log('  📄 Limpiando tramites_alta...');
    await connection.query('DELETE FROM tramites_alta');
    console.log('     ✅ Eliminado');

    console.log('  📊 Limpiando analista_municipios_dashboard...');
    await connection.query('DELETE FROM analista_municipios_dashboard');
    console.log('     ✅ Eliminado');

    // Reiniciar auto_increment para que los nuevos IDs empiecen en 1
    console.log('\n🔄 Reiniciando contadores AUTO_INCREMENT...');
    await connection.query('ALTER TABLE historial_tramites_alta AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE personas_tramite_alta AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE tramites_alta AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE analista_municipios_dashboard AUTO_INCREMENT = 1');
    console.log('   ✅ Contadores reiniciados');

    // Reactivar foreign keys
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n✅ ¡Limpieza completada exitosamente!\n');
    console.log('📊 Estado actual de la base de datos:');
    console.log('   - tramites_alta: 0 registros');
    console.log('   - personas_tramite_alta: 0 registros');
    console.log('   - historial_tramites_alta: 0 registros');
    console.log('   - analista_municipios_dashboard: 0 registros\n');
    console.log('💾 Catálogos preservados:');
    console.log('   ✅ Usuarios (login funcionará normalmente)');
    console.log('   ✅ Puestos');
    console.log('   ✅ Municipios');
    console.log('   ✅ Dependencias');
    console.log('   ✅ Regiones');
    console.log('   ✅ Otros catálogos\n');
    console.log('🚀 Listo para crear nuevos trámites de prueba\n');

  } catch (error) {
    console.error('\n❌ Error durante la limpieza:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada\n');
    }
  }
}

// Ejecutar
limpiarTramites();
