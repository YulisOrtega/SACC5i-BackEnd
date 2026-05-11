# 🏢 RPSP Backend

Backend para el Registro de Personal de Seguridad Publica del Estado de Puebla.

## 📚 Documentación Completa

Este proyecto tiene documentación extensa para facilitar la integración y el desarrollo:

### 📖 Para Desarrolladores Frontend
- **[RESUMEN_EJECUTIVO.md](./RESUMEN_EJECUTIVO.md)** ⭐ **EMPIEZA AQUÍ** - 3 pasos para conectar el frontend (5 minutos)
- **[PASOS_RAPIDOS_FRONTEND.md](./PASOS_RAPIDOS_FRONTEND.md)** - Guía paso a paso con código completo
- **[README_FRONTEND_INTEGRATION.md](./README_FRONTEND_INTEGRATION.md)** - Documentación completa de integración
- **[ARQUITECTURA_Y_FLUJOS.md](./ARQUITECTURA_Y_FLUJOS.md)** - Diagramas y flujos del sistema
- **[.env.frontend.example](./.env.frontend.example)** - Ejemplo de configuración para el frontend

### 📖 Para Desarrolladores Backend
- **[README_ACADEMICO.md](./README_ACADEMICO.md)** - Documentación académica del módulo de Alta
- Este README - Configuración e instalación del backend

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+ 
- MySQL 8.0+
- npm o yarn

### Instalación

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
```bash
# Copiar el archivo de ejemplo
copy .env.example .env

# Editar .env con tus credenciales de MySQL
```

3. **Crear la base de datos:**
```bash
npm run db:init
```

4. **Iniciar el servidor:**
```bash
npm run dev
```

El servidor estará disponible en: **http://localhost:5000**

### 🔄 Migraciones (Para bases de datos existentes)

Si ya tienes una base de datos creada y obtienes errores como:
```
Error: Unknown column 'p.observaciones_c3' in 'field list'
```

**Opción 1 - Ejecutar todas las migraciones:**
```bash
npm run db:migrate
```

**Opción 2 - Ejecutar una migración específica:**
```bash
node src/config/migrations/agregar_observaciones_c3.js
```

📚 **Ver lista completa de migraciones:** [src/config/migrations/README.md](./src/config/migrations/README.md)

**⚠️ Nota:** Si usas `npm run db:init` en una instalación nueva, **NO necesitas ejecutar migraciones** (ya incluye todas las columnas).

---

## 🛠️ Tecnologías

- **Node.js + Express** - Framework web
- **MySQL** - Base de datos (mysql2 con promesas)
- **JWT** - Autenticación y autorización
- **Bcrypt** - Encriptación de contraseñas
- **Express Validator** - Validación de datos
- **Swagger** - Documentación automática de API
- **CORS** - Configurado para desarrollo

---

## 📡 API y Documentación

### Swagger/OpenAPI
Documentación interactiva disponible en: **http://localhost:5000/api-docs**

### Endpoints Principales

#### 🔐 Autenticación (`/api/auth`)
- `POST /login` - Iniciar sesión
- `GET /profile` - Obtener perfil
- `PUT /profile` - Actualizar perfil
- `PUT /change-password` - Cambiar contraseña

#### 👥 Administración (`/api/admin`) - Requiere rol admin
- `GET /usuarios` - Listar usuarios
- `POST /usuarios` - Crear usuario
- `PUT /usuarios/:id` - Actualizar usuario
- `PATCH /usuarios/:id/activate` - Activar usuario
- `PATCH /usuarios/:id/deactivate` - Desactivar usuario
- `PATCH /usuarios/:id/reset-password` - Resetear contraseña
- `GET /estadisticas` - Estadísticas del sistema

#### 📚 Catálogos (`/api/catalogos`)
- `GET /tipos-oficio` - Tipos de oficio
- `GET /municipios` - Municipios de Puebla
- `GET /regiones` - Regiones
- `GET /estatus` - Estatus de trámites
- `GET /dependencias` - Dependencias
- `GET /puestos` - Puestos de trabajo

#### 📝 Trámites Alta (`/api/tramites/alta`)
- `GET /mis-solicitudes` - Mis trámites
- `POST /solicitudes` - Crear solicitud
- `GET /solicitudes/:id` - Ver solicitud
- `POST /tramites/:id/personas` - Agregar persona
- `GET /tramites/:id/personas` - Listar personas
- `PATCH /personas/:id/validar` - Validar persona (C5)
- `PATCH /personas/:id/rechazar` - Rechazar persona (C5)
- `POST /tramites/:id/enviar-c3` - Enviar a C3
- `GET /c3/pendientes` - Ver pendientes C3
- `POST /c3/personas/:id/dictamen` - Emitir dictamen (C3)
- `GET /c5/propuestas-c3` - Ver propuestas C3
- `POST /c5/personas/:id/decision-final` - Decisión final (C5)

**Ver documentación completa en Swagger:** http://localhost:5000/api-docs

---

## 📁 Estructura del Proyecto

```
src/
src/
├── config/                    # Configuraciones
│   ├── database.js           # Conexión a MySQL
│   ├── initDB.js             # Crear base de datos
│   ├── seedData.js           # Datos iniciales
│   ├── dropTables.js         # Limpiar base de datos
│   └── migrations/           # Migraciones de esquema
├── controllers/              # Lógica de negocio
│   ├── authController.js     # Autenticación
│   ├── adminController.js    # Gestión de usuarios
│   ├── altaController.js     # Trámites de alta
│   └── catalogosController.js# Catálogos
├── middlewares/              # Middlewares
│   ├── authMiddleware.js     # Verificar JWT
│   ├── roleMiddleware.js     # Verificar roles
│   ├── validationMiddleware.js# Validar datos
│   └── errorMiddleware.js    # Manejo de errores
├── routes/                   # Definición de rutas
│   ├── index.js              # Router principal
│   ├── authRoutes.js         # Rutas de auth
│   ├── adminRoutes.js        # Rutas de admin
│   ├── tramitesAltaRoutes.js # Rutas de trámites
│   └── catalogosRoutes.js    # Rutas de catálogos
├── validators/               # Validaciones
│   ├── authValidators.js     # Validar auth
│   └── solicitudValidators.js# Validar solicitudes
├── utils/                    # Utilidades
│   ├── helpers.js            # Funciones auxiliares
│   └── responses.js          # Respuestas estandarizadas
└── server.js                 # Punto de entrada
```

---

## 🗄️ Base de Datos

### Tablas Principales

- **usuarios** - Usuarios del sistema (super_admin, admin, analista)
- **regiones** - Regiones de Puebla
- **municipios** - 217 municipios de Puebla
- **tramites** - Solicitudes de trámites (Alta, Baja, etc.)
- **personas_tramite** - Personas agregadas a cada trámite
- **dashboard_municipios** - Municipios favoritos por usuario

### Catálogos

- **tipos_oficio** - Alta, Baja, Consulta, etc.
- **estatus_solicitudes** - Estados de los trámites
- **dependencias** - Dependencias de gobierno
- **puestos** - Puestos de trabajo
- **regiones** - Regiones de Puebla

---

## 🔒 Seguridad

- ✅ Contraseñas encriptadas con **bcrypt** (10 rounds)
- ✅ Autenticación con **JWT**
- ✅ Validación de datos con **express-validator**
- ✅ Protección de rutas con **middlewares**
- ✅ Control de acceso basado en **roles**
- ✅ CORS configurado para desarrollo
- ✅ SQL con **prepared statements** (previene SQL injection)

---

## 👥 Usuarios de Prueba

El sistema incluye 3 usuarios de prueba (creados con `npm run db:init`):
Define `SEED_DEFAULT_PASSWORD` en tu `.env` antes de correr el seed para controlar la contraseña inicial.

```javascript
// Super Admin - Acceso total
Usuario: orla_developer
Contraseña: definida por SEED_DEFAULT_PASSWORD
Rol: super_admin

// Admin - Gestión de analistas
Usuario: leslie_admin
Contraseña: definida por SEED_DEFAULT_PASSWORD
Rol: admin

// Analista - Crear trámites
Usuario: belen_rodriguez
Contraseña: definida por SEED_DEFAULT_PASSWORD
Rol: analista
```

---

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Iniciar servidor con auto-reload

# Producción
npm start                # Iniciar servidor

# Base de datos
npm run db:init          # Crear base de datos y tablas
npm run seed             # Cargar datos iniciales
npm run db:drop          # Eliminar todas las tablas
npm run db:reset         # Resetear base de datos completa
npm run db:migrate       # Ejecutar todas las migraciones pendientes

# Utilidades
npm run limpiar:tramites # Limpiar trámites de prueba
```

---

## 🔗 Enlaces Útiles

- **API:** http://localhost:5000/api
- **Swagger:** http://localhost:5000/api-docs
- **Health Check:** http://localhost:5000/api/health

---

## 🚀 Integrar con Frontend

**Si necesitas conectar el frontend React/Vite con este backend:**

1. Lee **[RESUMEN_EJECUTIVO.md](./RESUMEN_EJECUTIVO.md)** (5 minutos)
2. Sigue **[PASOS_RAPIDOS_FRONTEND.md](./PASOS_RAPIDOS_FRONTEND.md)**
3. Solo 3 pasos: instalar axios, crear .env, actualizar api.js

**¡Listo para producción!** ✅
