import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Cargar variables de entorno (por si la BD tiene contraseña)
dotenv.config();

const crearUsuariosMunicipios = async () => {
  let connection;
  try {
    // 1. Conectar a la base de datos (igual que en tu seedData)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sacc5i_db'
    });

    console.log('🔄 Iniciando creación de 217 usuarios de municipio...\n');

    // 2. Obtener todos los municipios
    const [municipios] = await connection.query('SELECT id, nombre FROM municipios');
    
    // 3. Generar la contraseña genérica una sola vez para optimizar
    const passwordGenerico = await bcrypt.hash('Municipio2026*', 10);

    for (const municipio of municipios) {
      // Limpiar el nombre para el usuario: minúsculas, sin acentos y guiones bajos en vez de espacios
      const nombreLimpio = municipio.nombre
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quita acentos (ej. á -> a)
        .replace(/\s+/g, '_'); // Cambia espacios por guiones bajos
        
      const nombreUsuario = `mun_${nombreLimpio}`;

      // 4. Insertar usuario (Usamos INSERT IGNORE por si lo corres dos veces, no duplique)
      await connection.query(`
        INSERT IGNORE INTO usuarios 
        (nombre_completo, usuario, email, password, rol, activo, password_changed, municipio_id)
        VALUES (?, ?, ?, ?, 'municipio', true, false, ?)
      `, [
        `Enlace ${municipio.nombre}`,       // nombre_completo
        nombreUsuario,                      // usuario (ej. mun_puebla)
        `${nombreUsuario}@sistema.gob.mx`,  // email ficticio
        passwordGenerico,                   // password
        municipio.id                        // municipio_id
      ]);
    }

    console.log(`✅ ¡Éxito! Se procesaron ${municipios.length} usuarios de municipio.`);
    console.log('Contraseña por defecto para todos: Municipio2026*');

  } catch (error) {
    console.error('❌ Error creando usuarios:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

crearUsuariosMunicipios();