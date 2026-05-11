import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const migrationsDir = path.resolve('src', 'config', 'migrations');

const safeOrder = [
  'crear_dashboard_municipios_analista.js',
  'agregar_dependencias_usuarios.js',
  'agregar_rol_direccion.js',
  'actualizar_contactos_regionales_usuarios.js',
  'normalizar_contacto_huejotzingo_usuarios.js',
  'agregar_tipo_documento.js',
  'agregar_numero_oficio_c5_tramites_alta.js',
  'ajustar_numero_oficio_c5_sin_default.js',
  'agregar_revision_requisitos.js',
  'agregar_justificacion_rnpsp.js',
  'agregar_validacion_cuip.js',
  'agregar_citas_biometricas.js',
  'crear_citas_bitacora.js',
  'ajustar_enum_fase_actual_cita_programada.js',
  'crear_copias_conocimiento.js',
  'actualizar_referencia_volante_ccp.js',
  'agregar_volante_numero_ccp.js',
  'normalizar_destinatario_fijo_ccp.js',
  'flexibilizar_tipo_solicitud_ccp.js',
  'crear_historial_registros_ccp.js',
  'crear_repositorio_digital.js',
  'crear_oficios_respuesta.js',
  'crear_historial_operador_ccp.js',
  'crear_finalizados.js',
  'agregar_numero_oficio_municipio_finalizados.js',
  'agregar_campos_baja_finalizados.js',
  'crear_bajas_editables_exportacion.js',
  'agregar_numero_oficio_municipio_bajas_editables_exportacion.js',
  'agregar_acuse_persona_finalizados.js',
  'crear_accesos_temporales_usuarios.js',
  'crear_sesiones_navegador_usuarios.js',
  'agregar_sesion_activa_usuarios.js',
  'agregar_sesion_inactividad_usuarios.js',
  'ajustar_consecutivo_tramite_por_analista.js',
  'corregir_indice_unico_global_numero_solicitud.js',
  'eliminar_indice_unico_numero_solicitud.js',
  'normalizar_acuses_alta_en_raiz.js',
  'limpiar_carpetas_sobrantes_acuses.js',
  'simplificar_repositorio_anual_compartido.js'
];

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function runMigrationFile(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [filePath], {
      stdio: 'inherit',
      shell: false
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`La migracion fallo con codigo ${code}: ${path.basename(filePath)}`));
    });
  });
}

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nombre VARCHAR(255) NOT NULL UNIQUE,
      checksum CHAR(64) NOT NULL,
      ejecutada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ejecutada_en (ejecutada_en)
    )
  `);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sacc5i_db'
  });

  try {
    await ensureMigrationsTable(connection);

    const discovered = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.js'))
      .sort((a, b) => a.localeCompare(b, 'es'));

    const inSafeOrder = safeOrder.filter((f) => discovered.includes(f));
    const remaining = discovered.filter((f) => !safeOrder.includes(f));
    const files = [...inSafeOrder, ...remaining];

    if (files.length === 0) {
      console.log('No hay migraciones para ejecutar.');
      return;
    }

    console.log(`Migraciones detectadas: ${files.length}`);

    for (const fileName of files) {
      const absolutePath = path.join(migrationsDir, fileName);
      const checksum = sha256(fs.readFileSync(absolutePath));

      const [rows] = await connection.query(
        'SELECT checksum FROM schema_migrations WHERE nombre = ? LIMIT 1',
        [fileName]
      );

      if (rows.length > 0) {
        const recorded = rows[0].checksum;
        if (recorded !== checksum) {
          throw new Error(
            `Checksum distinto en migracion ya aplicada: ${fileName}. ` +
              'Crea una nueva migracion en lugar de editar una existente.'
          );
        }
        console.log(`- Omitida (ya aplicada): ${fileName}`);
        continue;
      }

      console.log(`- Ejecutando: ${fileName}`);
      await runMigrationFile(absolutePath);

      await connection.query(
        'INSERT INTO schema_migrations (nombre, checksum) VALUES (?, ?)',
        [fileName, checksum]
      );

      console.log(`  Aplicada: ${fileName}`);
    }

    console.log('Migraciones al dia.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Error al ejecutar migraciones:', error.message);
  process.exit(1);
});
