import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { testConnection } from './config/database.js';
import swaggerSpec from './config/swagger.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorMiddleware.js';
import { apiRateLimiter } from './middlewares/rateLimitMiddleware.js';
import { requestContextMiddleware } from './middlewares/requestContextMiddleware.js';
import repositorioMunicipiosRoutes from "./routes/repositorioMunicipiosRoutes.js";

// Cargar variables de entorno
dotenv.config();

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 5000;

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Configuración de CORS Corregida
const envOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  ...envOrigins
];

const corsOptions = {
  origin: (origin, callback) => {
    //  ACTUALIZADO: Permite localhost y TODAS las redes privadas (192.168.x.x, 10.x.x.x, 172.x.x.x)
    const isLocalDevelopment = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?$/i.test(origin);

    // Permitir peticiones sin origin (como Postman), orígenes explícitos en la lista o redes locales
    if (!origin || allowedOrigins.includes(origin) || isLocalDevelopment) {
      return callback(null, true);
    }
    
    console.warn(`⚠️ CORS bloqueó la petición desde el origen: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Middlewares globales
app.use(requestContextMiddleware);
app.use(helmet());
app.use(cors(corsOptions));
app.use(apiRateLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas del repositorio de municipios
app.use("/api/repositorio-municipios", repositorioMunicipiosRoutes);

// Swagger UI - Documentación interactiva
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'RPSP API Documentation'
}));

// Rutas de la API
app.use('/api', routes);

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API RPSP - Registro de Personal de Seguridad Publica',
    version: '1.0.0',
    documentation: `http://localhost:${PORT}/api-docs`,
    endpoints: {
      health: '/api/health',
      swagger: '/api-docs',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile'
      },
      solicitudes: {
        list: 'GET /api/solicitudes',
        get: 'GET /api/solicitudes/:id',
        create: 'POST /api/solicitudes',
        update: 'PUT /api/solicitudes/:id',
        updateStatus: 'PUT /api/solicitudes/:id/estatus',
        delete: 'DELETE /api/solicitudes/:id',
        stats: 'GET /api/solicitudes/estadisticas'
      },
      catalogos: {
        tiposOficio: 'GET /api/catalogos/tipos-oficio',
        municipios: 'GET /api/catalogos/municipios',
        regiones: 'GET /api/catalogos/regiones',
        estatus: 'GET /api/catalogos/estatus'
      }
    }
  });
});

// Manejadores de errores
app.use(notFoundHandler);
app.use(errorHandler);

// Iniciar servidor
const startServer = async () => {
  try {
    // Probar conexión a la base de datos
    console.log('🔄 Verificando conexión a la base de datos...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('⚠️  No se pudo conectar a la base de datos');
      console.log('💡 Asegúrate de:');
      console.log('   1. Tener MySQL en ejecución');
      console.log('   2. Configurar correctamente el archivo .env');
      console.log('   3. Ejecutar: npm run db:init');
      console.log('\n');
    }

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      console.log('\n🚀 Servidor RPSP Backend iniciado');
      console.log(`📡 Puerto: ${PORT}`);
      console.log(`📚 Swagger: http://localhost:${PORT}/api-docs\n`);
    });

    server.on('error', (error) => {
      console.error('Error del servidor HTTP:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Manejo de señales de terminación
process.on('SIGINT', () => {
  console.log('\nCerrando servidor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nCerrando servidor...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Excepción no controlada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada no controlada:', reason);
  process.exit(1);
});

// Iniciar
startServer();

export default app;