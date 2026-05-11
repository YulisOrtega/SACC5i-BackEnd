import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RPSP API - Registro de Personal de Seguridad Publica',
      version: '1.0.0',
      description: 'API REST para el Registro de Personal de Seguridad Publica del Estado de Puebla',
      contact: {
        name: 'Gobierno de Puebla',
        url: 'https://puebla.gob.mx'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Servidor de Desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingresa el token JWT obtenido del login'
        }
      },
      schemas: {
        Usuario: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre_completo: { type: 'string', example: 'Yulissa Ortega' },
            usuario: { type: 'string', example: 'yulissa.ortega' },
            fecha_nacimiento: { type: 'string', format: 'date', example: '1995-05-15' },
            region: { type: 'string', example: 'Región III - Centro' },
            extension: { type: 'string', example: '1234' },
            rol: { type: 'string', enum: ['usuario', 'administrador', 'operador'], example: 'usuario' }
          }
        },
        Solicitud: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            numero_solicitud: { type: 'string', example: '1' },
            tipo_documento: { type: 'string', enum: ['Oficio', 'Volante', 'Folio'], example: 'Oficio', description: 'Tipo de documento' },
            tipo_oficio_id: { type: 'integer', example: 1, description: 'ID del tipo de oficio (Emitido o Recibido)' },
            municipio_id: { type: 'integer', example: 1, description: 'ID del municipio' },
            dependencia: { type: 'string', example: 'Seguridad Pública Municipal', description: 'Dependencia solicitante' },
            proceso_movimiento: { type: 'string', example: 'ALTA', description: 'Tipo de movimiento: ALTA, BAJA, CONSULTA' },
            termino: { type: 'string', enum: ['Sin termino', 'Normal'], example: 'Normal', description: 'Término para cumplir el trámite (Sin termino o Normal)' },
            dias_horas: { type: 'string', enum: ['Normal', 'Dias', 'Horas'], example: 'Dias', description: 'Plazo: Normal (cuando sin termino), Dias u Horas' },
            fecha_sello_c5: { type: 'string', format: 'date', example: '2026-01-14', description: 'Fecha de sello en C5' },
            fecha_recibido_dt: { type: 'string', format: 'date', example: '2026-01-14', description: 'Fecha recibido en DT' },
            numero_oficio_c5: { type: 'string', example: 'SSP/SII/C5I/DT/3263/2026', description: 'Numero de oficio C5' },
            fecha_solicitud: { type: 'string', format: 'date', example: '2026-01-14', description: 'Fecha de la solicitud' },
            estatus_id: { type: 'integer', example: 1, description: 'ID del estatus actual' },
            observaciones: { type: 'string', example: 'Solicitud urgente', description: 'Observaciones adicionales' }
          },
          required: ['tipo_oficio_id', 'municipio_id', 'fecha_solicitud']
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error en la operación' }
          }
        }
      }
    },
    tags: [
      { name: 'Autenticación', description: 'Endpoints de registro y login' },
      { name: 'Admin', description: 'Gestión de usuarios (Solo Admin/Super Admin)' },
      { name: 'Trámites - ALTA', description: 'Módulo de trámites de ALTA (4 pasos del mockup)' },
      { name: 'Catálogos', description: 'Catálogos del sistema' },
      { name: 'Sistema', description: 'Información del sistema' }
    ]
  },
  apis: ['./src/routes/*.js', '!./src/routes/*.backup', '!./src/routes/*.old']
};

export default swaggerJsdoc(options);
