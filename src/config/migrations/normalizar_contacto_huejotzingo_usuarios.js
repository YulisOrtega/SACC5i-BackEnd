import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const TARGET = {
  nombre_completo: 'Itzen Rocio Tapia Rosas',
  email: 'itzen.rocio@complejopuebla.gob.mx',
  extension: '10028',
  region_nombre: 'Huejotzingo'
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

    const [tablaUsuarios] = await connection.query("SHOW TABLES LIKE 'usuarios'");
    if (!Array.isArray(tablaUsuarios) || tablaUsuarios.length === 0) {
      console.log('Tabla usuarios no existe. Migracion omitida.');
      return;
    }

    const [tablaRegiones] = await connection.query("SHOW TABLES LIKE 'regiones'");
    let regionId = null;

    if (Array.isArray(tablaRegiones) && tablaRegiones.length > 0) {
      const [rows] = await connection.query(
        'SELECT id FROM regiones WHERE nombre = ? LIMIT 1',
        [TARGET.region_nombre]
      );
      regionId = rows[0]?.id || null;
    }

    const [candidates] = await connection.query(
      `
      SELECT id, usuario, email, extension, region_id
      FROM usuarios
      WHERE rol = 'analista'
        AND (
          email = ?
          OR usuario IN ('analista_huejotzingo', 'itzen_rocio')
          OR (region_id <=> ?)
        )
      ORDER BY
        CASE
          WHEN email = ? THEN 1
          WHEN usuario = 'analista_huejotzingo' THEN 2
          WHEN usuario = 'itzen_rocio' THEN 3
          WHEN extension = ? THEN 4
          ELSE 5
        END,
        id ASC
      LIMIT 1
      `,
      [TARGET.email, regionId, TARGET.email, TARGET.extension]
    );

    if (!candidates.length) {
      console.log('No se encontro candidato para normalizar contacto de Huejotzingo.');
      return;
    }

    const candidato = candidates[0];

    const [emailInUse] = await connection.query(
      'SELECT id, usuario FROM usuarios WHERE email = ? AND id <> ? LIMIT 1',
      [TARGET.email, candidato.id]
    );

    const canUpdateEmail = emailInUse.length === 0;

    const sql = canUpdateEmail
      ? `
        UPDATE usuarios
        SET
          nombre_completo = ?,
          email = ?,
          extension = ?,
          region_id = COALESCE(?, region_id)
        WHERE id = ?
      `
      : `
        UPDATE usuarios
        SET
          nombre_completo = ?,
          extension = ?,
          region_id = COALESCE(?, region_id)
        WHERE id = ?
      `;

    const params = canUpdateEmail
      ? [TARGET.nombre_completo, TARGET.email, TARGET.extension, regionId, candidato.id]
      : [TARGET.nombre_completo, TARGET.extension, regionId, candidato.id];

    const [result] = await connection.query(sql, params);

    console.log(`Usuario normalizado: ${result?.affectedRows || 0}`);

    if (!canUpdateEmail) {
      const ocupadoPor = emailInUse[0];
      console.log(
        `Email no actualizado porque ya existe en otro usuario (id=${ocupadoPor.id}, usuario=${ocupadoPor.usuario}).`
      );
    }

    console.log('Migracion normalizar_contacto_huejotzingo_usuarios completada.');
  } catch (error) {
    console.error('Error en migracion normalizar_contacto_huejotzingo_usuarios:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration().catch(() => process.exit(1));
