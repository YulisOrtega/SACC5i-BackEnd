import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const initDatabase = async () => {
  let connection;
  
  try {
    // Conectar sin especificar la base de datos
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('🔄 Inicializando base de datos SACC5i...\n');

    // Crear base de datos si no existe
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'sacc5i_db'}`);
    console.log('✅ Base de datos creada/verificada');

    // Usar la base de datos
    await connection.query(`USE ${process.env.DB_NAME || 'sacc5i_db'}`);

    // ============================================
    // TABLA: Regiones (Cajas Territoriales)
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS regiones (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        total_municipios INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla regiones creada');

    // ============================================
    // TABLA: Municipios (Con clave oficial)
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS municipios (
        id INT PRIMARY KEY AUTO_INCREMENT,
        clave INT NOT NULL UNIQUE COMMENT 'Clave oficial del municipio',
        nombre VARCHAR(100) NOT NULL,
        region_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (region_id) REFERENCES regiones(id) ON DELETE CASCADE,
        INDEX idx_clave (clave),
        INDEX idx_region (region_id)
      )
    `);
    console.log('✅ Tabla municipios creada');

    // ============================================
    // TABLA: Tipos de Oficio
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tipos_oficio (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        descripcion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla tipos_oficio creada');

    // ============================================
    // TABLA: Estatus de Solicitudes
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS estatus_solicitudes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(50) NOT NULL UNIQUE,
        descripcion VARCHAR(255),
        color VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla estatus_solicitudes creada');

    // ============================================
    // TABLA: Dependencias (Catálogo de 28 dependencias del C5i)
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS dependencias (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(150) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_nombre (nombre)
      )
    `);
    console.log('✅ Tabla dependencias creada');

    // ============================================
    // TABLA: Puestos (Catálogo con filtro de competencia)
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS puestos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(150) NOT NULL UNIQUE,
        es_competencia_municipal BOOLEAN DEFAULT TRUE COMMENT 'FALSE para Custodio, Guardia Nacional, Militar',
        motivo_no_competencia TEXT COMMENT 'Razón por la cual no corresponde',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_competencia (es_competencia_municipal)
      )
    `);
    console.log('✅ Tabla puestos creada');

    // ============================================
    // TABLA: Usuarios (Con jerarquía real del C5i)
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre_completo VARCHAR(150) NOT NULL,
        usuario VARCHAR(50) NOT NULL UNIQUE COMMENT 'Formato: nombre.apellido',
        email VARCHAR(100) NOT NULL UNIQUE COMMENT 'Correo electrónico del usuario',
        password VARCHAR(255) NOT NULL,
        extension VARCHAR(20) COMMENT 'Número de extensión del analista',
        region_id INT NULL COMMENT 'Región asignada (solo para analistas)',
        dependencia_id INT NULL COMMENT 'Dependencia asignada (solo para rol dependencia)',
        rol ENUM('super_admin', 'admin', 'direccion', 'analista', 'validador_c3', 'dependencia', 'operador_ccp') NOT NULL DEFAULT 'analista',
        activo BOOLEAN DEFAULT TRUE,
        password_changed BOOLEAN DEFAULT FALSE COMMENT 'FALSE obliga a cambiar contraseña',
        sesion_activa_id VARCHAR(64) NULL COMMENT 'Identificador de sesion JWT activa',
        sesion_ultima_actividad_at DATETIME NULL COMMENT 'Ultimo instante de actividad autenticada',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (region_id) REFERENCES regiones(id) ON DELETE SET NULL,
        INDEX idx_usuario (usuario),
        INDEX idx_email (email),
        INDEX idx_region (region_id),
        INDEX idx_rol (rol)
      )
    `);
    console.log('✅ Tabla usuarios creada');

    // ============================================
    // TABLA: Sesiones por navegador
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios_sesiones (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        session_id VARCHAR(64) NOT NULL,
        usuario_id INT NOT NULL,
        user_agent VARCHAR(512) NULL,
        ip_address VARCHAR(64) NULL,
        ultima_actividad_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME NULL,
        CONSTRAINT fk_usuarios_sesiones_usuario
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        UNIQUE KEY uk_usuarios_sesiones_session_id (session_id),
        INDEX idx_usuarios_sesiones_usuario_estado (usuario_id, closed_at, ultima_actividad_at),
        INDEX idx_usuarios_sesiones_ultima_actividad (ultima_actividad_at)
      )
    `);
    console.log('✅ Tabla usuarios_sesiones creada');

    // ============================================
    // TABLA: Dashboard de Municipios por Analista
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS analista_municipios_dashboard (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_analista_id INT NOT NULL,
        municipio_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_dashboard_analista_municipio (usuario_analista_id, municipio_id),
        INDEX idx_dashboard_usuario_analista (usuario_analista_id),
        INDEX idx_dashboard_municipio (municipio_id),
        CONSTRAINT fk_dashboard_usuario_analista
          FOREIGN KEY (usuario_analista_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        CONSTRAINT fk_dashboard_municipio
          FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabla analista_municipios_dashboard creada');

    // ============================================
    // TABLA: Trámites de ALTA (Módulo específico)
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tramites_alta (
        id INT PRIMARY KEY AUTO_INCREMENT,
        numero_solicitud VARCHAR(50) NOT NULL,
        usuario_analista_c5_id INT NOT NULL COMMENT 'Analista C5 que crea la solicitud',
        usuario_validador_c3_id INT NULL COMMENT 'Validador C3 que emite dictamen',
        es_tramite_dependencia BOOLEAN DEFAULT FALSE COMMENT 'TRUE si el trámite fue creado por una dependencia',
        tipo_documento ENUM('Oficio', 'Volante', 'Folio') DEFAULT 'Oficio' COMMENT 'Tipo de documento: Oficio, Volante o Folio',
        tipo_oficio_id INT COMMENT 'Emitido o Recibido',
        municipio_id INT,
        dependencia_id INT COMMENT 'Dependencia solicitante (catálogo)',
        proceso_movimiento VARCHAR(255) DEFAULT 'ALTA',
        termino ENUM('Sin termino', 'Normal') DEFAULT 'Normal' COMMENT 'Sin termino o Normal',
        dias_horas ENUM('Normal', 'Dias', 'Horas') DEFAULT 'Normal' COMMENT 'Normal (cuando sin termino), Dias u Horas',
        fecha_sello_c5 DATE COMMENT 'Fecha de sello en C5',
        fecha_recibido_dt DATE COMMENT 'Fecha recibido en DT',
        numero_oficio_c5 VARCHAR(100) NULL COMMENT 'Formato: SSP/SII/C5I/DT/3263/2026',
        fecha_solicitud DATE NOT NULL,
        fase_actual ENUM(
          'datos_solicitud',
          'validacion_personal',
          'enviado_c3',
          'dictaminado_c3',
          'rechazado_c3',
          'validado_c3',
          'revision_propuesta_c3',
          'rechazado_no_corresponde',
          'rechazado',
          'finalizado'
        ) DEFAULT 'datos_solicitud',
        estatus_id INT DEFAULT 1,
        observaciones TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_analista_c5_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_validador_c3_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        FOREIGN KEY (tipo_oficio_id) REFERENCES tipos_oficio(id) ON DELETE SET NULL,
        FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE SET NULL,
        FOREIGN KEY (dependencia_id) REFERENCES dependencias(id) ON DELETE SET NULL,
        FOREIGN KEY (estatus_id) REFERENCES estatus_solicitudes(id) ON DELETE SET NULL,
        INDEX idx_analista (usuario_analista_c5_id),
        INDEX idx_validador (usuario_validador_c3_id),
        INDEX idx_fase (fase_actual),
        INDEX idx_estatus (estatus_id),
        INDEX idx_fecha (fecha_solicitud),
        INDEX idx_dependencia (dependencia_id),
        UNIQUE KEY uk_tramites_alta_usuario_numero (usuario_analista_c5_id, numero_solicitud)
      )
    `);
    console.log('✅ Tabla tramites_alta creada');

    // ============================================
    // TABLA: Personas en Trámite ALTA (PASO 2)
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS personas_tramite_alta (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tramite_alta_id INT NOT NULL COMMENT 'Trámite al que pertenece',
        nombre VARCHAR(100) NOT NULL,
        apellido_paterno VARCHAR(100) NOT NULL,
        apellido_materno VARCHAR(100),
        fecha_nacimiento DATE NOT NULL,
        numero_oficio_c3 VARCHAR(100) NOT NULL COMMENT 'Formato: CECSNSP/DGCECC/0633/2025',
        puesto_id INT NOT NULL COMMENT 'Puesto solicitado originalmente por C5',
        puesto_propuesto_c3_id INT NULL COMMENT 'Puesto propuesto por C3 (opcional)',
        tiene_propuesta_cambio BOOLEAN DEFAULT FALSE COMMENT 'Indica si C3 propuso cambio',
        decision_final_c5 ENUM('original', 'propuesta', 'pendiente') DEFAULT 'pendiente' COMMENT 'Decisión de C5 sobre propuesta',
        validado BOOLEAN DEFAULT FALSE,
        rechazado BOOLEAN DEFAULT FALSE,
        motivo_rechazo TEXT COMMENT 'Razón del rechazo (solo cuando rechazado = TRUE)',
        observaciones_c3 TEXT NULL COMMENT 'Observaciones generales de C3 (propuestas, comentarios, etc.)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tramite_alta_id) REFERENCES tramites_alta(id) ON DELETE CASCADE,
        FOREIGN KEY (puesto_id) REFERENCES puestos(id) ON DELETE RESTRICT,
        FOREIGN KEY (puesto_propuesto_c3_id) REFERENCES puestos(id) ON DELETE RESTRICT,
        INDEX idx_tramite (tramite_alta_id),
        INDEX idx_puesto (puesto_id),
        INDEX idx_validado (validado),
        INDEX idx_rechazado (rechazado),
        INDEX idx_propuesta (tiene_propuesta_cambio)
      )
    `);
    console.log('✅ Tabla personas_tramite_alta creada');

    // ============================================
    // TABLA: Historial de Trámites ALTA
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS historial_tramites_alta (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tramite_alta_id INT NOT NULL,
        usuario_id INT NOT NULL,
        fase_anterior VARCHAR(50),
        fase_nueva VARCHAR(50),
        comentario TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tramite_alta_id) REFERENCES tramites_alta(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        INDEX idx_tramite (tramite_alta_id)
      )
    `);
    console.log('✅ Tabla historial_tramites_alta creada');

    // ============================================
    // TABLA: Repositorio de Oficios de Respuesta
    // ============================================
    await connection.query(`
      CREATE TABLE IF NOT EXISTS oficios_respuesta_folders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        parent_id INT NULL,
        nombre VARCHAR(150) NOT NULL,
        folder_type ENUM('year','month','category','custom') NOT NULL DEFAULT 'custom',
        year_value SMALLINT NULL,
        month_value TINYINT NULL,
        creado_por_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES oficios_respuesta_folders(id) ON DELETE CASCADE,
        FOREIGN KEY (creado_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        UNIQUE KEY uk_oficios_respuesta_folder_parent_name (parent_id, nombre),
        INDEX idx_oficios_respuesta_folder_parent (parent_id),
        INDEX idx_oficios_respuesta_folder_type (folder_type),
        INDEX idx_oficios_respuesta_folder_year (year_value),
        INDEX idx_oficios_respuesta_folder_month (month_value)
      )
    `);
    console.log('✅ Tabla oficios_respuesta_folders creada');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS oficios_respuesta_files (
        id INT PRIMARY KEY AUTO_INCREMENT,
        folder_id INT NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        relative_path VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size_bytes INT NOT NULL,
        folio VARCHAR(120) NULL,
        nombre_expediente VARCHAR(255) NULL,
        subido_por_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES oficios_respuesta_folders(id) ON DELETE CASCADE,
        FOREIGN KEY (subido_por_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        INDEX idx_oficios_respuesta_file_folder (folder_id),
        INDEX idx_oficios_respuesta_file_folio (folio),
        INDEX idx_oficios_respuesta_file_nombre (nombre_expediente),
        INDEX idx_oficios_respuesta_file_created_at (created_at)
      )
    `);
    console.log('✅ Tabla oficios_respuesta_files creada');

    console.log('\n🎉 Estructura de base de datos creada correctamente');
    console.log('📊 Ejecuta el seeder para cargar los datos: npm run seed\n');

  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Ejecutar si se llama directamente
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default initDatabase;
