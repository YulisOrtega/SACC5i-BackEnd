import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middlewares/validationMiddleware.js';
import {
  crearSolicitudDependencia,
  obtenerMisSolicitudesDependencia,
  obtenerSolicitudDependenciaPorId
} from '../controllers/dependenciaController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

// Reutilizar funciones de altaController para agregar personas y enviar a C3
import {
  agregarPersona,
  obtenerPersonasPorTramite,
  enviarSolicitudAC3
} from '../controllers/altaController.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Middleware para verificar rol de dependencia
const requireDependencia = requireRole('dependencia');

// Validaciones para crear solicitud - SOLO CAMPOS DE DEPENDENCIA
const validarNuevaSolicitudDependencia = [
  body('tipo_oficio_id')
    .notEmpty().withMessage('El tipo de movimiento es requerido')
    .isInt().withMessage('El tipo de movimiento debe ser un número'),
  
  body('municipio_id')
    .notEmpty().withMessage('La corporación/municipio es requerido')
    .isInt().withMessage('La corporación/municipio debe ser un número')
];

/**
 * @swagger
 * /api/dependencias/solicitudes:
 *   post:
 *     tags: [Dependencias]
 *     summary: Crear nueva solicitud de alta (Dependencia)
 *     description: |
 *       Las dependencias (FGE, CERESO, AUXILIAR, PRIVADA, SSP) crean solicitudes simplificadas con solo 4 campos:
 *       1. **Tipo de Movimiento** (requerido) - Seleccionar del catálogo
 *       2. **Dependencia** (automático) - Se llena automáticamente según el usuario autenticado
 *       3. **Corporación/Municipio** (requerido) - Seleccionar del catálogo
 *       4. **Fecha Solicitud** (automático) - Se asigna la fecha actual
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tipo_oficio_id
 *               - municipio_id
 *             properties:
 *               tipo_oficio_id:
 *                 type: integer
 *                 example: 1
 *                 description: Tipo de Movimiento (Alta=1, Baja=2, etc.)
 *               municipio_id:
 *                 type: integer
 *                 example: 114
 *                 description: Corporación o Municipio del catálogo
 *     responses:
 *       201:
 *         description: Solicitud creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Solicitud de dependencia creada exitosamente
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     numero_solicitud:
 *                       type: string
 *                     tipo_oficio_id:
 *                       type: integer
 *                     municipio_id:
 *                       type: integer
 *                     dependencia_id:
 *                       type: integer
 *                       description: Dependencia asignada automáticamente
 *                     fecha_solicitud:
 *                       type: string
 *                       format: date
 *                       description: Fecha asignada automáticamente
 *                     fase_actual:
 *                       type: string
 *                       example: datos_solicitud
 *       403:
 *         description: No autorizado - solo usuarios con rol 'dependencia'
 */
router.post(
  '/solicitudes',
  requireDependencia,
  validarNuevaSolicitudDependencia,
  validate,
  crearSolicitudDependencia
);

/**
 * @swagger
 * /api/dependencias/mis-solicitudes:
 *   get:
 *     tags: [Dependencias]
 *     summary: Obtener mis solicitudes (Dependencia)
 *     description: Lista de solicitudes creadas por el usuario de dependencia
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fase_actual
 *         schema:
 *           type: string
 *           enum: [datos_solicitud, validacion_personal, enviado_c3, validado_c3, revision_propuesta_c3, finalizado]
 *         description: Filtrar por fase actual
 *       - in: query
 *         name: estatus_id
 *         schema:
 *           type: integer
 *         description: Filtrar por estatus
 *     responses:
 *       200:
 *         description: Lista de solicitudes
 *       403:
 *         description: No autorizado
 */
router.get('/mis-solicitudes', requireDependencia, obtenerMisSolicitudesDependencia);

/**
 * @swagger
 * /api/dependencias/solicitudes/{id}:
 *   get:
 *     tags: [Dependencias]
 *     summary: Obtener solicitud por ID (Dependencia)
 *     description: Ver detalles de una solicitud específica
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la solicitud
 *     responses:
 *       200:
 *         description: Detalles de la solicitud
 *       404:
 *         description: Solicitud no encontrada
 */
router.get('/solicitudes/:id', requireDependencia, obtenerSolicitudDependenciaPorId);

/**
 * @swagger
 * /api/dependencias/tramites/{tramite_id}/personas:
 *   post:
 *     tags: [Dependencias]
 *     summary: Agregar persona al trámite (Dependencia)
 *     description: |
 *       Después de crear la solicitud, la dependencia agrega personas.
 *       Usa la misma funcionalidad que los analistas C5.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tramite_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del trámite
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fecha_nacimiento
 *               - nombre
 *               - apellido_paterno
 *               - apellido_materno
 *               - numero_oficio_c3
 *               - puesto_id
 *             properties:
 *               fecha_nacimiento:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-01"
 *                 description: Fecha de nacimiento
 *               nombre:
 *                 type: string
 *                 example: Juan
 *                 description: Nombre de la persona
 *               apellido_paterno:
 *                 type: string
 *                 example: Pérez
 *                 description: Apellido paterno
 *               apellido_materno:
 *                 type: string
 *                 example: López
 *                 description: Apellido materno
 *               numero_oficio_c3:
 *                 type: string
 *                 example: "CECSNSP/DGCECC/0633/2025"
 *                 description: Número de oficio de C3
 *               puesto_id:
 *                 type: integer
 *                 example: 1
 *                 description: Puesto solicitado para alta
 *     responses:
 *       201:
 *         description: Persona agregada exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post('/tramites/:tramite_id/personas', requireDependencia, agregarPersona);

/**
 * @swagger
 * /api/dependencias/tramites/{tramite_id}/personas:
 *   get:
 *     tags: [Dependencias]
 *     summary: Obtener personas del trámite (Dependencia)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tramite_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de personas del trámite
 */
router.get('/tramites/:tramite_id/personas', requireDependencia, obtenerPersonasPorTramite);

/**
 * @swagger
 * /api/dependencias/tramites/{tramite_id}/enviar-c3:
 *   post:
 *     tags: [Dependencias]
 *     summary: Enviar trámite a C3 para validación (Dependencia)
 *     description: |
 *       Después de agregar todas las personas, la dependencia envía el trámite a C3.
 *       C3 valida y luego envía a C5.
 *       En C5 aparecerá en una tabla separada de "Trámites de Dependencias".
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tramite_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del trámite
 *     responses:
 *       200:
 *         description: Trámite enviado a C3 exitosamente
 *       400:
 *         description: El trámite debe tener al menos una persona agregada
 */
router.post('/tramites/:tramite_id/enviar-c3', requireDependencia, enviarSolicitudAC3);

export default router;
