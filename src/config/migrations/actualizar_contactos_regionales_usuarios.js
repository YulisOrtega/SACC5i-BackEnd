import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const CONTACTOS_REGIONALES = [
  {
    usuario: 'belen_rodriguez',
    nombre_completo: 'Belén Rodríguez Marín',
    email: 'b.rodriguez@complejopuebla.gob.mx',
    extension: '11020',
    region_nombre: 'Izúcar'
  },
  {
    usuario: 'maria_palacios',
    nombre_completo: 'María de Jesús Palacios Meza',
    email: 'maria.palacios@complejopuebla.gob.mx',
    extension: '17025',
    region_nombre: 'Cuapiaxtla de Madero'
  },
  {
    usuario: 'elsa_castillo',
    nombre_completo: 'Elsa Cristina Castillo Reyes',
    email: 'elsa.castillo@complejopuebla.gob.mx',
    extension: '41025',
    region_nombre: 'Libres'
  },
  {
    usuario: 'jose_vazquez',
    nombre_completo: 'Jose Alberto Vázquez Hernández',
    email: 'avazquez@complejopuebla.gob.mx',
    extension: '10029',
    region_nombre: 'Puebla'
  },
  {
    usuario: 'guadalupe_serrano',
    nombre_completo: 'Guadalupe Serrano Cortés',
    email: 'g.serrano@complejopuebla.gob.mx',
    extension: '43025',
    region_nombre: 'Tehuacán'
  },
  {
    usuario: 'jaime_fernandez',
    nombre_completo: 'Jaime Fernández Juárez',
    email: 'j.fernandez@complejopuebla.gob.mx',
    extension: '12025',
    region_nombre: 'Teziutlán'
  },
  {
    usuario: 'alejandro_dominguez',
    nombre_completo: 'Alejandro Domínguez Domínguez',
    email: 'a.dominguez@complejopuebla.gob.mx',
    extension: '42025',
    region_nombre: 'Zacatlán'
  },
  {
    usuario: 'analista_huejotzingo',
    nombre_completo: 'Itzen Rocío Tapia Rosas',
    email: 'itzen.rocio@complejopuebla.gob.mx',
    extension: '10028',
    region_nombre: 'Huejotzingo'
  },
  {
    usuario: 'analista_palmar',
    nombre_completo: 'María Raquel Trinidad Máximo',
    email: 'maria.trinidad@complejopuebla.gob.mx',
    extension: '49025',
    region_nombre: 'Palmar de Bravo'
  }
];

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
      console.log('Tabla usuarios no existe. Migración omitida.');
      return;
    }

    const [tablaRegiones] = await connection.query("SHOW TABLES LIKE 'regiones'");
    const existeRegiones = Array.isArray(tablaRegiones) && tablaRegiones.length > 0;

    let actualizados = 0;
    let noEncontrados = 0;

    console.log('Actualizando contactos regionales de analistas...');

    for (const contacto of CONTACTOS_REGIONALES) {
      let regionId = null;

      if (existeRegiones) {
        const [regionRows] = await connection.query(
          'SELECT id FROM regiones WHERE nombre = ? LIMIT 1',
          [contacto.region_nombre]
        );
        regionId = regionRows[0]?.id || null;
      }

      const updateSql = `
        UPDATE usuarios
        SET
          nombre_completo = ?,
          email = ?,
          extension = ?,
          region_id = COALESCE(?, region_id)
        WHERE usuario = ?
      `;

      const [result] = await connection.query(updateSql, [
        contacto.nombre_completo,
        contacto.email,
        contacto.extension,
        regionId,
        contacto.usuario
      ]);

      if ((result?.affectedRows || 0) > 0) {
        actualizados += 1;
      } else {
        noEncontrados += 1;
        console.log(`- No encontrado: ${contacto.usuario}`);
      }
    }

    console.log(`Analistas actualizados: ${actualizados}`);
    if (noEncontrados > 0) {
      console.log(`Usuarios no encontrados: ${noEncontrados}`);
    }
    console.log('Migración actualizar_contactos_regionales_usuarios completada.');
  } catch (error) {
    console.error('Error en migración actualizar_contactos_regionales_usuarios:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

migration().catch(() => process.exit(1));
