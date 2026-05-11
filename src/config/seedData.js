import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const seedDatabase = async () => {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sacc5i_db'
    });

    console.log('🔄 Iniciando carga de datos reales del C5i...\n');

    // ============================================
    // 1. REGIONES (9 regiones)
    // ============================================
    console.log('📦 Cargando Regiones...');
    const regiones = [
      { nombre: 'Huejotzingo', total: 16 },
      { nombre: 'Izúcar', total: 52 },
      { nombre: 'Cuapiaxtla de Madero', total: 24 },
      { nombre: 'Libres', total: 14 },
      { nombre: 'Puebla', total: 10 },
      { nombre: 'Tehuacán', total: 27 },
      { nombre: 'Teziutlán', total: 29 },
      { nombre: 'Zacatlán', total: 33 },
      { nombre: 'Palmar de Bravo', total: 12 }
    ];

    for (const region of regiones) {
      await connection.query(
        'INSERT IGNORE INTO regiones (nombre, total_municipios) VALUES (?, ?)',
        [region.nombre, region.total]
      );
    }
    console.log(`✅ ${regiones.length} regiones cargadas`);

    // ============================================
    // 2. MUNICIPIOS CON CLAVES OFICIALES
    // ============================================
    console.log('🏘️  Cargando Municipios con claves oficiales...');
    
    const municipiosPorRegion = {
      'Huejotzingo': [
        [26, 'Calpan'], [48, 'Chiautzingo'], [60, 'Domingo Arenas'], [74, 'Huejotzingo'],
        [90, 'Juan C. Bonilla'], [102, 'Nealtican'], [122, 'San Felipe Teotlalcingo'],
        [126, 'San Jerónimo Tecuanipan'], [132, 'San Martín Texmelucan'], [134, 'San Matías Tlalancaleca'],
        [136, 'San Miguel Xoxtla'], [138, 'San Nicolás de los Ranchos'], [143, 'San Salvador El Verde'],
        [175, 'Tianguismanalco'], [180, 'Tlahuapan'], [181, 'Tlaltenango']
      ],
      'Izúcar': [
        [3, 'Acatlán de Osorio'], [5, 'Acteopan'], [7, 'Ahuatlán'], [9, 'Ahuehuetitla'],
        [11, 'Albino Zertuche'], [21, 'Atzala'], [22, 'Atzitzihuacan'], [24, 'Axutla'],
        [47, 'Chiautla'], [51, 'Chietla'], [52, 'Chigmecatitlán'], [55, 'Chila'],
        [56, 'Chila de la Sal'], [59, 'Chinantla'], [31, 'Coatzingo'], [32, 'Cohetzala'],
        [33, 'Cohuecan'], [42, 'Cuayuca de Andrade'], [62, 'Epatlán'], [66, 'Guadalupe'],
        [69, 'Huaquechula'], [70, 'Huatlatlauca'], [73, 'Huehuetlan El Chico'], [150, 'Huehuetlan El Grande'],
        [81, 'Ixcamilpa de Guerrero'], [85, 'Izucar de Matamoros'], [87, 'Jolalpan'], [95, 'Magdalena Tlatlauquitepec'],
        [112, 'Petlalcingo'], [113, 'Piaxtla'], [121, 'San Diego La Mesa Tochimiltzingo'], [127, 'San Jeronimo Xayacatlan'],
        [133, 'San Martin Totoltepec'], [135, 'San Miguel Ixitlán'], [139, 'San Pablo Anicano'], [141, 'San Pedro Yeloixtlahuaca'],
        [146, 'Santa Catarina Tlaltempa'], [155, 'Tecomatlán'], [157, 'Tehuitzingo'], [159, 'Teopantlan'],
        [160, 'Teotlalco'], [165, 'Tepemaxalco'], [166, 'Tepeojuma'], [168, 'Tepexco'],
        [176, 'Tilapa'], [185, 'Tlapanalá'], [190, 'Totoltepec de Guerrero'], [191, 'Tulcingo'],
        [196, 'Xayacatlán De Bravo'], [198, 'Xicotlán'], [201, 'Xochiltepec'], [206, 'Zacapala']
      ],
      'Cuapiaxtla de Madero': [
        [1, 'Acajete'], [4, 'Acatzingo'], [15, 'Amozoc'], [20, 'Atoyatempan'],
        [38, 'Cuapiaxtla de Madero'], [40, 'Cuautinchan'], [79, 'Huitziltepec'], [97, 'Mixtla'],
        [115, 'Quecholac'], [118, 'Reyes de Juárez'], [131, 'San Juan Atzompa'], [144, 'San Salvador Huixcolotla'],
        [147, 'Santa Inés Ahuatempan'], [151, 'Santo Tomas Hueyotlipan'], [153, 'Tecali de Herrera'], [154, 'Tecamachalco'],
        [163, 'Tepatlaxco de Hidalgo'], [164, 'Tepeaca'], [171, 'Tepeyahualco de Cuauhtémoc'], [182, 'Tlanepantla'],
        [189, 'Tochtepec'], [193, 'Tzicatlacoyan'], [203, 'Xochitlán Todos Santos'], [205, 'Yehualtepec']
      ],
      'Libres': [
        [50, 'Chichiquila'], [58, 'Chilchotla'], [44, 'Cuyoaco'], [67, 'Guadalupe Victoria'],
        [83, 'Ixtacamaxtitlán'], [93, 'Lafragua'], [94, 'Libres'], [104, 'Nopalucan'],
        [105, 'Ocotepec'], [108, 'Oriental'], [116, 'Quimixtlán'], [117, 'Rafael Lara Grajales'],
        [128, 'San Jose Chiapa'], [170, 'Tepeyahualco']
      ],
      'Puebla': [
        [19, 'Atlixco'], [34, 'Coronango'], [41, 'Cuautlancingo'], [106, 'Ocoyucan'],
        [119, 'San Andrés Cholula'], [125, 'San Gregorio Atzompa'], [140, 'San Pedro Cholula'],
        [148, 'Santa Isabel Cholula'], [188, 'Tochimilco'], [114, 'Puebla']
      ],
      'Tehuacán': [
        [10, 'Ajalpan'], [13, 'Altepexi'], [18, 'Atexcal'], [27, 'Caltepec'],
        [99, 'Cañada Morelos'], [46, 'Chapulco'], [35, 'Coxcatlán'], [36, 'Coyomeapan'],
        [37, 'Coyotepec'], [61, 'Eloxochitlán'], [82, 'Ixcaquixtla'], [92, 'Juan N. Mendez'],
        [98, 'Molcaxac'], [103, 'Nicolas Bravo'], [120, 'San Antonio Cañada'], [124, 'San Gabriel Chilac'],
        [129, 'San Jose Miahuatlán'], [145, 'San Sebastián Tlacotepec'], [149, 'Santiago Miahuatlán'], [156, 'Tehuacán'],
        [161, 'Tepanco de Lopez'], [169, 'Tepexi de Rodríguez'], [177, 'Tlacotepec De Benito Juarez'], [195, 'Vicente Guerrero'],
        [209, 'Zapotitlán'], [214, 'Zinacatepec'], [217, 'Zoquitlán']
      ],
      'Teziutlán': [
        [2, 'Acateno'], [17, 'Atempan'], [80, 'Atlequizayan'], [25, 'Ayotoxco de Guerrero'],
        [29, 'Caxhuacan'], [54, 'Chignautla'], [43, 'Cuetzalan del Progreso'], [72, 'Huehuetla'],
        [75, 'Hueyapan'], [76, 'Hueytamalco'], [78, 'Huitzilan de Serdán'], [84, 'Ixtepec'],
        [88, 'Jonotla'], [101, 'Nauzontla'], [158, 'Tenampulco'], [173, 'Tetéles de Ávila Castillo'],
        [174, 'Teziutlán'], [186, 'Tlatlauquitepec'], [192, 'Tuzamapan de Galeana'], [199, 'Xiutetelco'],
        [200, 'Xochiapulco'], [202, 'Xochitlán de Vicente Suárez'], [204, 'Yaonáhuac'], [207, 'Zacapoaxtla'],
        [210, 'Zapotitlán de Méndez'], [211, 'Zaragoza'], [212, 'Zautla'], [215, 'Zongozotla'],
        [216, 'Zoquiapan']
      ],
      'Zacatlán': [
        [6, 'Ahuacatlan'], [8, 'Ahuazotepec'], [14, 'Amixtlán'], [16, 'Aquixtla'],
        [28, 'Camocuautla'], [49, 'Chiconcuautla'], [53, 'Chignahuapan'], [30, 'Coatepec'],
        [39, 'Cuautempan'], [64, 'Francisco Z. Mena'], [68, 'Hermenegildo Galeana'], [57, 'Honey'],
        [71, 'Huauchinango'], [77, 'Hueytlalpan'], [86, 'Jalpan'], [89, 'Jopala'],
        [91, 'Juan Galindo'], [100, 'Naupan'], [107, 'Olintla'], [109, 'Pahuatlan'],
        [111, 'Pantepec'], [123, 'San Felipe Tepatlán'], [162, 'Tepango de Rodríguez'], [167, 'Tepetzintla'],
        [172, 'Tetela de Ocampo'], [178, 'Tlacuilotepec'], [183, 'Tlaola'], [184, 'Tlapacoya'],
        [187, 'Tlaxco'], [194, 'Venustiano Carranza'], [197, 'Xicotepec'], [208, 'Zacatlán'],
        [213, 'Zihuateutla']
      ],
      'Palmar de Bravo': [
        [12, 'Aljojuca'], [23, 'Atzitzintla'], [45, 'Chalchicomula de Sesma'], [63, 'Esperanza'],
        [65, 'General Felipe Ángeles'], [96, 'Mazapiltepec de Juarez'], [110, 'Palmar de Bravo'], [130, 'San Juan Atenco'],
        [137, 'San Nicolas Buenos Aires'], [142, 'San Salvador El Seco'], [152, 'Soltepec'], [179, 'Tlachichuca']
      ]
    };

    for (const [regionNombre, municipios] of Object.entries(municipiosPorRegion)) {
      const [regionResult] = await connection.query(
        'SELECT id FROM regiones WHERE nombre = ?',
        [regionNombre]
      );
      
      const regionId = regionResult[0].id;
      
      for (const [clave, nombre] of municipios) {
        await connection.query(
          'INSERT IGNORE INTO municipios (clave, nombre, region_id) VALUES (?, ?, ?)',
          [clave, nombre, regionId]
        );
      }
    }
    console.log('✅ Todos los municipios cargados con sus claves oficiales');

    // ============================================
    // 3. USUARIOS REALES DEL C5i
    // ============================================
    console.log('👥 Cargando usuarios reales...');
    
    // Obtener IDs de regiones para asignación
    const [regionesDB] = await connection.query('SELECT id, nombre FROM regiones');
    const regionMap = {};
    regionesDB.forEach(r => regionMap[r.nombre] = r.id);
    const defaultSeedPassword = process.env.SEED_DEFAULT_PASSWORD || 'ChangeMe123!';
    const defaultSeedPasswordHash = await bcrypt.hash(defaultSeedPassword, 10);

    if (!process.env.SEED_DEFAULT_PASSWORD) {
      console.warn('⚠️  SEED_DEFAULT_PASSWORD no está definido. Se usará una contraseña temporal por defecto.');
    }

    const usuarios = [
      // SUPER ADMIN PRINCIPAL (Orlando)
      {
        nombre: 'Orlando',
        apellido: 'Developer',
        usuario: 'orla_developer',
        email: 'orlando.developer@c5i.puebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: null,
        region_id: null,
        rol: 'super_admin',
        password_changed: true
      },
      {
        nombre: 'Dev',
        apellido: 'Sistema',
        usuario: 'dev_sistema',
        email: 'dev.sistema@c5i.puebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: null,
        region_id: null,
        rol: 'super_admin',
        password_changed: true
      },
      
      // ADMIN (Leslie - Gerencia C5)
      {
        nombre: 'Leslie',
        apellido: 'C5',
        usuario: 'leslie_admin',
        email: 'leslie.c5@c5i.puebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: '10000',
        region_id: null,
        rol: 'admin',
        password_changed: false
      },
      
      // ANALISTAS (Operativos reales)
      {
        nombre: 'Belén',
        apellido: 'Rodríguez Marín',
        usuario: 'belen_rodriguez',
        email: 'b.rodriguez@complejopuebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: '11020',
        region_id: regionMap['Izúcar'],
        rol: 'analista',
        password_changed: false
      },
      {
        nombre: 'María de Jesús',
        apellido: 'Palacios Meza',
        usuario: 'maria_palacios',
        email: 'maria.palacios@complejopuebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: '17025',
        region_id: regionMap['Cuapiaxtla de Madero'],
        rol: 'analista',
        password_changed: false
      },
      {
        nombre: 'Elsa Cristina',
        apellido: 'Castillo Reyes',
        usuario: 'elsa_castillo',
        email: 'elsa.castillo@complejopuebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: '41025',
        region_id: regionMap['Libres'],
        rol: 'analista',
        password_changed: false
      },
      {
        nombre: 'Jose Alberto',
        apellido: 'Vázquez Hernández',
        usuario: 'jose_vazquez',
        email: 'avazquez@complejopuebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: '10029',
        region_id: regionMap['Puebla'],
        rol: 'analista',
        password_changed: false
      },
      {
        nombre: 'Guadalupe',
        apellido: 'Serrano Cortés',
        usuario: 'guadalupe_serrano',
        email: 'g.serrano@complejopuebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: '43025',
        region_id: regionMap['Tehuacán'],
        rol: 'analista',
        password_changed: false
      },
      {
        nombre: 'Jaime',
        apellido: 'Fernández Juárez',
        usuario: 'jaime_fernandez',
        email: 'j.fernandez@complejopuebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: '12025',
        region_id: regionMap['Teziutlán'],
        rol: 'analista',
        password_changed: false
      },
      {
        nombre: 'Alejandro',
        apellido: 'Domínguez Domínguez',
        usuario: 'alejandro_dominguez',
        email: 'a.dominguez@complejopuebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: '42025',
        region_id: regionMap['Zacatlán'],
        rol: 'analista',
        password_changed: false
      },
      {
        nombre: 'Itzen Rocío',
        apellido: 'Tapia Rosas',
        usuario: 'analista_huejotzingo',
        email: 'itzen.rocio@complejopuebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: '10028',
        region_id: regionMap['Huejotzingo'],
        rol: 'analista',
        password_changed: false
      },
      {
        nombre: 'María Raquel',
        apellido: 'Trinidad Máximo',
        usuario: 'analista_palmar',
        email: 'maria.trinidad@complejopuebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: '49025',
        region_id: regionMap['Palmar de Bravo'],
        rol: 'analista',
        password_changed: false
      },
      // USUARIOS C3 (VALIDADORES)
      {
        nombre: 'Carlos Alberto',
        apellido: 'Ramírez Soto',
        usuario: 'carlos_c3_validador',
        email: 'carlos.ramirez@c3.puebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: null,
        region_id: null,
        dependencia_id: null,
        rol: 'validador_c3',
        password_changed: false
      },
      {
        nombre: 'Laura Patricia',
        apellido: 'González Méndez',
        usuario: 'laura_c3_validador',
        email: 'laura.gonzalez@c3.puebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: null,
        region_id: null,
        dependencia_id: null,
        rol: 'validador_c3',
        password_changed: false
      },

      // USUARIOS DEPENDENCIAS (FGE, CERESO, AUXILIAR, PRIVADA, SSP)
      {
        nombre: 'Fiscalía General del Estado',
        apellido: 'Puebla',
        usuario: 'fge_dependencia',
        email: 'fge@dependencias.puebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: null,
        region_id: null,
        dependencia_id: 10, // FISCALÍA GENERAL DEL ESTADO (ID 10 en tabla dependencias)
        rol: 'dependencia',
        password_changed: false
      },
      {
        nombre: 'CERESO',
        apellido: 'Puebla',
        usuario: 'cereso_dependencia',
        email: 'cereso@dependencias.puebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: null,
        region_id: null,
        dependencia_id: 2, // CENTROS DE REINSERCIÓN SOCIAL (ID 2 en tabla dependencias)
        rol: 'dependencia',
        password_changed: false
      },
      {
        nombre: 'Policía Auxiliar',
        apellido: 'Puebla',
        usuario: 'auxiliar_dependencia',
        email: 'auxiliar@dependencias.puebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: null,
        region_id: null,
        dependencia_id: 20, // SECRETARÍA DE SEGURIDAD PÚBLICA (ID 20 en tabla dependencias)
        rol: 'dependencia',
        password_changed: false
      },
      {
        nombre: 'Seguridad Privada',
        apellido: 'Puebla',
        usuario: 'privada_dependencia',
        email: 'privada@dependencias.puebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: null,
        region_id: null,
        dependencia_id: 22, // SECRETARÍA DE SEGURIDAD Y PROTECCIÓN CIUDADANA (ID 22 en tabla dependencias)
        rol: 'dependencia',
        password_changed: false
      },
      {
        nombre: 'Secretaría de Seguridad Pública',
        apellido: 'Puebla',
        usuario: 'ssp_dependencia',
        email: 'ssp@dependencias.puebla.gob.mx',
        password: defaultSeedPasswordHash,
        extension: null,
        region_id: null,
        dependencia_id: 20, // SECRETARÍA DE SEGURIDAD PÚBLICA (ID 20 en tabla dependencias)
        rol: 'dependencia',
        password_changed: false
      }
    ];

    for (const user of usuarios) {
      await connection.query(
        `INSERT INTO usuarios (nombre_completo, usuario, email, password, extension, region_id, dependencia_id, rol, password_changed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         nombre_completo = VALUES(nombre_completo),
         email = VALUES(email),
         password = VALUES(password),
         extension = VALUES(extension),
         region_id = VALUES(region_id),
         dependencia_id = VALUES(dependencia_id),
         rol = VALUES(rol),
         password_changed = VALUES(password_changed)`,
        [
          `${user.nombre} ${user.apellido}`,
          user.usuario,
          user.email,
          user.password,
          user.extension,
          user.region_id,
          user.dependencia_id,
          user.rol,
          user.password_changed
        ]
      );
    }
    console.log(`✅ ${usuarios.length} usuarios cargados`);

    // ============================================
    // 4. TIPOS DE OFICIO (Emitido o Recibido)
    // ============================================
    console.log('📋 Cargando tipos de oficio...');
    const tiposOficio = [
      ['Emitido', 'Documento emitido por la dependencia'],
      ['Recibido', 'Documento recibido de otra instancia']
    ];

    for (const [nombre, descripcion] of tiposOficio) {
      await connection.query(
        'INSERT IGNORE INTO tipos_oficio (nombre, descripcion) VALUES (?, ?)',
        [nombre, descripcion]
      );
    }
    console.log('✅ Tipos de oficio cargados');

    // ============================================
    // 5. ESTATUS DE SOLICITUDES
    // ============================================
    console.log('🎨 Cargando estatus...');
    const estatus = [
      ['Pendiente', 'Solicitud recibida, pendiente de revisión', '#FFA500'],
      ['En Proceso', 'Solicitud en proceso de atención', '#2196F3'],
      ['En Revisión', 'Solicitud en revisión por supervisor', '#FF9800'],
      ['Aprobada', 'Solicitud aprobada', '#4CAF50'],
      ['Rechazada', 'Solicitud rechazada', '#F44336'],
      ['Completada', 'Solicitud completada exitosamente', '#8BC34A'],
      ['Cancelada', 'Solicitud cancelada por el usuario', '#9E9E9E']
    ];

    for (const [nombre, descripcion, color] of estatus) {
      await connection.query(
        'INSERT IGNORE INTO estatus_solicitudes (nombre, descripcion, color) VALUES (?, ?, ?)',
        [nombre, descripcion, color]
      );
    }
    console.log('✅ Estatus cargados');

    // ============================================
    // 6. DEPENDENCIAS (28 dependencias del C5i)
    // ============================================
    console.log('🏢 Cargando dependencias...');
    const dependencias = [
      ['CENTRO ESTATAL DE CONTROL, COMANDO, COMUNICACIONES Y CÓMPUTO'],
      ['CENTROS DE REINSERCIÓN SOCIAL'],
      ['CENTRO DE CONTROL, COMANDO, COMUNICACIONES Y CÓMPUTO'],
      ['CUAPIAXTLA DE MADERO'],
      ['DIRECCIÓN GENERAL DE ASUNTOS JURÍDICOS'],
      ['DIRECCIÓN GENERAL DE CULTURA DE LA LEGALIDAD Y USO DE LA FUERZA EFECTIVA'],
      ['DIRECCIÓN GENERAL DE PREVENCIÓN DEL DELITO Y PARTICIPACIÓN CIUDADANA'],
      ['DIRECCIÓN DE SERVICIOS A LA CARRERA POLICIAL'],
      ['DIRECCIÓN TÉCNICA'],
      ['FISCALÍA GENERAL DEL ESTADO'],
      ['FISCALÍA GENERAL DE LA REPÚBLICA'],
      ['HUEJOTZINGO'],
      ['INSTITUTO TÉCNICO DE APLICACIÓN Y PROFESIONALIZACIÓN DE LA SSP'],
      ['IZÚCAR DE MATAMOROS'],
      ['LIBRES'],
      ['PALMAR DE BRAVO'],
      ['PODER JUDICIAL DEL ESTADO DE PUEBLA - TRIBUNAL JUSTICIA ADMINISTRATIVA'],
      ['PODER JUDICIAL DE LA FEDERACIÓN'],
      ['PUEBLA'],
      ['SECRETARÍA DE SEGURIDAD PÚBLICA'],
      ['SECRETARÍA DE SEGURIDAD CIUDADANA - PUEBLA'],
      ['SECRETARÍA DE SEGURIDAD Y PROTECCIÓN CIUDADANA'],
      ['SUBPROCURADURÍA DE CONTROL PROCESAL'],
      ['TEHUACÁN'],
      ['TEZIUTLÁN'],
      ['ZACATLÁN'],
      ['PLATAFORMA DE TRANSPARENCIA'],
      ['DIRECCIÓN DE ASUNTOS JURÍDICOS']
    ];

    for (const [nombre] of dependencias) {
      await connection.query(
        'INSERT IGNORE INTO dependencias (nombre) VALUES (?)',
        [nombre]
      );
    }
    console.log(`✅ ${dependencias.length} dependencias cargadas`);

    // ============================================
    // 7. PUESTOS (Con filtro de competencia)
    // ============================================
    console.log('👮 Cargando puestos...');
    const puestos = [
      // PUESTOS DE COMPETENCIA MUNICIPAL (TRUE)
      ['POLICÍA MUNICIPAL', true, null],
      ['POLICÍA PREVENTIVO', true, null],
      ['POLICÍA AUXILIAR', true, null],
      ['POLICÍA DE TRÁNSITO', true, null],
      ['POLICÍA DE PROXIMIDAD', true, null],
      ['POLICÍA OPERATIVO', true, null],
      ['POLICÍA AUXILIAR VIAL', true, null],
      ['POLICÍA PRIMER RESPONDIENTE', true, null],
      ['OFICIAL', true, null],
      ['SUBOFICIAL', true, null],
      ['CABO', true, null],
      ['INSPECTOR', true, null],
      ['SUBINSPECTOR', true, null],
      ['COMANDANTE', true, null],
      ['DIRECTOR DE SEGURIDAD PÚBLICA', true, null],
      ['COORDINADOR OPERATIVO', true, null],
      ['SUBDIRECTOR', true, null],
      ['JEFE DE TURNO', true, null],
      ['SUPERVISOR DE TURNO', true, null],
      ['ENCARGADO DE DESPACHO', true, null],
      
      // PUESTOS FUERA DE COMPETENCIA MUNICIPAL (FALSE)
      ['CUSTODIO', false, 'No corresponde a competencia Municipal. Los custodios pertenecen al sistema penitenciario estatal (CERESOS).'],
      ['GUARDIA NACIONAL', false, 'No corresponde a competencia Municipal. La Guardia Nacional es una institución federal dependiente de la SSPC.'],
      ['MILITAR', false, 'No corresponde a competencia Municipal. El personal militar pertenece a la SEDENA.'],
      ['AGENTE MINISTERIAL', false, 'No corresponde a competencia Municipal. Los agentes ministeriales dependen de la Fiscalía General del Estado.'],
      ['POLICÍA ESTATAL', false, 'No corresponde a competencia Municipal. La policía estatal depende de la SSP Estatal.'],
      ['POLICÍA FEDERAL', false, 'No corresponde a competencia Municipal. La policía federal es una corporación de nivel federal.']
    ];

    for (const [nombre, es_competencia, motivo] of puestos) {
      await connection.query(
        'INSERT IGNORE INTO puestos (nombre, es_competencia_municipal, motivo_no_competencia) VALUES (?, ?, ?)',
        [nombre, es_competencia, motivo]
      );
    }
    console.log(`✅ ${puestos.length} puestos cargados`);

    console.log('\n🎉 ¡Carga de datos completada exitosamente!\n');
    console.log('📊 Resumen:');
    console.log(`   - 9 Regiones`);
    console.log(`   - 217 Municipios con claves oficiales`);
    console.log(`   - ${usuarios.length} Usuarios (2 Super Admins, 1 Admin, 9 Analistas, 2 Validadores C3, 5 Dependencias)`);
    console.log(`   - 7 Tipos de Oficio`);
    console.log(`   - 7 Estatus de Solicitudes`);
    console.log(`   - ${dependencias.length} Dependencias`);
    console.log(`   - ${puestos.length} Puestos (${puestos.filter(p => p[1]).length} municipales, ${puestos.filter(p => !p[1]).length} fuera de competencia)\n`);

  } catch (error) {
    console.error('❌ Error al cargar datos:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default seedDatabase;
