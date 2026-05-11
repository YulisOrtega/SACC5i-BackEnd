/**
 * Script seguro para limpiar tramites de un usuario especifico (analista C5).
 *
 * Por defecto corre en modo simulacion (no borra nada).
 * Para aplicar cambios, usa --apply y confirma manualmente.
 *
 * Ejemplos:
 *   node scripts/limpiar-tramites-usuario.js --nombre "Belen Rodriguez"
 *   node scripts/limpiar-tramites-usuario.js --usuario belen.rodriguez --apply
 *   node scripts/limpiar-tramites-usuario.js --id 23 --apply --limpiar-dashboard
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const args = process.argv.slice(2);

function hasFlag(flag) {
  return args.includes(flag);
}

function getArg(flag) {
  const directIndex = args.findIndex((arg) => arg === flag);
  if (directIndex >= 0) {
    const value = args[directIndex + 1];
    return value && !value.startsWith('--') ? value : null;
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  if (!inline) return null;

  const [, value] = inline.split('=');
  return value || null;
}

function printUsage() {
  console.log('Uso:');
  console.log('  npm run limpiar:tramites:usuario -- --usuario <usuario> [--apply] [--limpiar-dashboard]');
  console.log('  npm run limpiar:tramites:usuario -- --id <id> [--apply] [--limpiar-dashboard]');
  console.log('  npm run limpiar:tramites:usuario -- --email <email> [--apply] [--limpiar-dashboard]');
  console.log('  npm run limpiar:tramites:usuario -- --nombre "Nombre Completo" [--apply] [--limpiar-dashboard]');
  console.log('');
  console.log('Flags:');
  console.log('  --apply              Ejecuta la eliminacion (sin este flag solo simula)');
  console.log('  --limpiar-dashboard  Tambien elimina municipios del dashboard del analista');
  console.log('  --help               Muestra esta ayuda');
}

function preguntarConfirmacion(textoEsperado) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(
      `\nEscribe exactamente "${textoEsperado}" para confirmar: `,
      (answer) => {
        rl.close();
        resolve(answer.trim() === textoEsperado);
      }
    );
  });
}

async function tablaExiste(connection, databaseName, tableName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?
     LIMIT 1`,
    [databaseName, tableName]
  );

  return rows.length > 0;
}

async function resolverUsuario(connection, filtros) {
  const baseQuery = `SELECT id, nombre_completo, usuario, email, rol, activo FROM usuarios`;

  if (filtros.id !== null) {
    const [rows] = await connection.query(`${baseQuery} WHERE id = ? LIMIT 1`, [filtros.id]);
    return { usuario: rows[0] || null, coincidencias: rows };
  }

  if (filtros.usuario) {
    const [rows] = await connection.query(`${baseQuery} WHERE usuario = ? LIMIT 1`, [filtros.usuario]);
    return { usuario: rows[0] || null, coincidencias: rows };
  }

  if (filtros.email) {
    const [rows] = await connection.query(`${baseQuery} WHERE email = ? LIMIT 1`, [filtros.email]);
    return { usuario: rows[0] || null, coincidencias: rows };
  }

  const [rows] = await connection.query(
    `${baseQuery} WHERE nombre_completo LIKE ? ORDER BY id ASC`,
    [`%${filtros.nombre}%`]
  );

  return {
    usuario: rows.length === 1 ? rows[0] : null,
    coincidencias: rows
  };
}

async function contarImpacto(connection, databaseName, usuarioId) {
  const [[tramites]] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM tramites_alta
     WHERE usuario_analista_c5_id = ?`,
    [usuarioId]
  );

  const [[personas]] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM personas_tramite_alta p
     INNER JOIN tramites_alta t ON t.id = p.tramite_alta_id
     WHERE t.usuario_analista_c5_id = ?`,
    [usuarioId]
  );

  const [[historial]] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM historial_tramites_alta h
     INNER JOIN tramites_alta t ON t.id = h.tramite_alta_id
     WHERE t.usuario_analista_c5_id = ?`,
    [usuarioId]
  );

  const [[comoValidador]] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM tramites_alta
     WHERE usuario_validador_c3_id = ?`,
    [usuarioId]
  );

  const existeCitas = await tablaExiste(connection, databaseName, 'citas_biometricas');
  const existeFinalizados = await tablaExiste(connection, databaseName, 'finalizados');
  const existeDashboard = await tablaExiste(connection, databaseName, 'analista_municipios_dashboard');

  let citas = { total: 0 };
  if (existeCitas) {
    [[citas]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM citas_biometricas c
       INNER JOIN tramites_alta t ON t.id = c.tramite_alta_id
       WHERE t.usuario_analista_c5_id = ?`,
      [usuarioId]
    );
  }

  let finalizados = { total: 0 };
  if (existeFinalizados) {
    [[finalizados]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM finalizados f
       INNER JOIN tramites_alta t ON t.id = f.tramite_alta_id
       WHERE t.usuario_analista_c5_id = ?`,
      [usuarioId]
    );
  }

  let dashboard = { total: 0 };
  if (existeDashboard) {
    [[dashboard]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM analista_municipios_dashboard
       WHERE usuario_analista_id = ?`,
      [usuarioId]
    );
  }

  return {
    tramites: tramites.total,
    personas: personas.total,
    historial: historial.total,
    citas: citas.total,
    finalizados: finalizados.total,
    dashboard: dashboard.total,
    comoValidador: comoValidador.total,
    existeCitas,
    existeFinalizados,
    existeDashboard
  };
}

async function eliminarPorUsuario(connection, databaseName, usuarioId, limpiarDashboard) {
  const existeCitas = await tablaExiste(connection, databaseName, 'citas_biometricas');
  const existeFinalizados = await tablaExiste(connection, databaseName, 'finalizados');
  const existeDashboard = await tablaExiste(connection, databaseName, 'analista_municipios_dashboard');

  await connection.beginTransaction();

  try {
    if (existeFinalizados) {
      await connection.query(
        `DELETE f
         FROM finalizados f
         INNER JOIN tramites_alta t ON t.id = f.tramite_alta_id
         WHERE t.usuario_analista_c5_id = ?`,
        [usuarioId]
      );
    }

    if (existeCitas) {
      await connection.query(
        `DELETE c
         FROM citas_biometricas c
         INNER JOIN tramites_alta t ON t.id = c.tramite_alta_id
         WHERE t.usuario_analista_c5_id = ?`,
        [usuarioId]
      );
    }

    await connection.query(
      `DELETE h
       FROM historial_tramites_alta h
       INNER JOIN tramites_alta t ON t.id = h.tramite_alta_id
       WHERE t.usuario_analista_c5_id = ?`,
      [usuarioId]
    );

    await connection.query(
      `DELETE p
       FROM personas_tramite_alta p
       INNER JOIN tramites_alta t ON t.id = p.tramite_alta_id
       WHERE t.usuario_analista_c5_id = ?`,
      [usuarioId]
    );

    await connection.query(
      `DELETE FROM tramites_alta
       WHERE usuario_analista_c5_id = ?`,
      [usuarioId]
    );

    if (limpiarDashboard && existeDashboard) {
      await connection.query(
        `DELETE FROM analista_municipios_dashboard
         WHERE usuario_analista_id = ?`,
        [usuarioId]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  if (hasFlag('--help')) {
    printUsage();
    process.exit(0);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Este script no puede ejecutarse en produccion.');
    process.exit(1);
  }

  const idArg = getArg('--id');
  const filtros = {
    id: idArg !== null ? Number(idArg) : null,
    usuario: getArg('--usuario'),
    email: getArg('--email'),
    nombre: getArg('--nombre')
  };

  const cantidadFiltros = [
    filtros.id !== null,
    Boolean(filtros.usuario),
    Boolean(filtros.email),
    Boolean(filtros.nombre)
  ].filter(Boolean).length;

  if (cantidadFiltros !== 1) {
    console.error('ERROR: Debes indicar exactamente un criterio de busqueda (--id, --usuario, --email o --nombre).\n');
    printUsage();
    process.exit(1);
  }

  if (filtros.id !== null && !Number.isInteger(filtros.id)) {
    console.error('ERROR: --id debe ser un numero entero.');
    process.exit(1);
  }

  const apply = hasFlag('--apply');
  const limpiarDashboard = hasFlag('--limpiar-dashboard');
  const databaseName = process.env.DB_NAME || 'sacc5i_db';

  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: databaseName
    });

    const { usuario, coincidencias } = await resolverUsuario(connection, filtros);

    if (!usuario) {
      if (filtros.nombre && coincidencias.length > 1) {
        console.log(`Se encontraron ${coincidencias.length} usuarios con nombre parecido:`);
        coincidencias.forEach((u) => {
          console.log(`  - id=${u.id} | usuario=${u.usuario} | nombre=${u.nombre_completo} | email=${u.email}`);
        });
        console.log('\nVuelve a ejecutar con --id o --usuario para evitar borrar al usuario incorrecto.');
        process.exit(1);
      }

      console.error('No se encontro un usuario con el criterio proporcionado.');
      process.exit(1);
    }

    const impactoAntes = await contarImpacto(connection, databaseName, usuario.id);

    console.log('\nUsuario objetivo:');
    console.log(`  - id: ${usuario.id}`);
    console.log(`  - nombre: ${usuario.nombre_completo}`);
    console.log(`  - usuario: ${usuario.usuario}`);
    console.log(`  - email: ${usuario.email}`);
    console.log(`  - rol: ${usuario.rol}`);
    console.log(`  - activo: ${usuario.activo ? 'SI' : 'NO'}`);

    console.log('\nRegistros asociados al analista que se verian afectados:');
    console.log(`  - tramites_alta: ${impactoAntes.tramites}`);
    console.log(`  - personas_tramite_alta: ${impactoAntes.personas}`);
    console.log(`  - historial_tramites_alta: ${impactoAntes.historial}`);
    if (impactoAntes.existeCitas) console.log(`  - citas_biometricas: ${impactoAntes.citas}`);
    if (impactoAntes.existeFinalizados) console.log(`  - finalizados: ${impactoAntes.finalizados}`);
    if (impactoAntes.existeDashboard) console.log(`  - analista_municipios_dashboard (actual): ${impactoAntes.dashboard}`);
    console.log(`\nNota: Tramites donde aparece como validador C3 (no se borran): ${impactoAntes.comoValidador}`);

    if (!apply) {
      console.log('\nModo simulacion: no se realizaron cambios.');
      console.log('Para ejecutar la limpieza agrega --apply.');
      process.exit(0);
    }

    const textoConfirmacion = `ELIMINAR-${usuario.usuario.toUpperCase()}`;
    console.log(`\nSe eliminaran SOLO los tramites donde usuario_analista_c5_id = ${usuario.id}.`);
    if (limpiarDashboard) {
      console.log('Tambien se eliminaran sus municipios de analista_municipios_dashboard.');
    }

    const confirmado = await preguntarConfirmacion(textoConfirmacion);
    if (!confirmado) {
      console.log('\nOperacion cancelada. No se realizaron cambios.');
      process.exit(0);
    }

    await eliminarPorUsuario(connection, databaseName, usuario.id, limpiarDashboard);

    const impactoDespues = await contarImpacto(connection, databaseName, usuario.id);
    console.log('\nLimpieza completada correctamente.');
    console.log('Estado final:');
    console.log(`  - tramites_alta: ${impactoDespues.tramites}`);
    console.log(`  - personas_tramite_alta: ${impactoDespues.personas}`);
    console.log(`  - historial_tramites_alta: ${impactoDespues.historial}`);
    if (impactoDespues.existeCitas) console.log(`  - citas_biometricas: ${impactoDespues.citas}`);
    if (impactoDespues.existeFinalizados) console.log(`  - finalizados: ${impactoDespues.finalizados}`);
    if (impactoDespues.existeDashboard) console.log(`  - analista_municipios_dashboard: ${impactoDespues.dashboard}`);
  } catch (error) {
    console.error('\nError durante la limpieza por usuario:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
