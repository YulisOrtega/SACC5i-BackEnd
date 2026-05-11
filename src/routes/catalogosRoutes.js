import express from 'express';
import {
  getTiposOficio,
  getMunicipios,
  getRegiones,
  getEstatus,
  getDependencias,
  getPuestos
} from '../controllers/catalogosController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación 
router.use(authMiddleware);

/**
 * @swagger
 * /api/catalogos/tipos-oficio:
 *   get:
 *     tags: [Catálogos]
 *     summary: Obtener todos los tipos de oficio
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tipos de oficio (Alta, Baja, Consulta, etc)
 */
router.get('/tipos-oficio', getTiposOficio);

/**
 * @swagger
 * /api/catalogos/municipios:
 *   get:
 *     tags: [Catálogos]
 *     summary: Obtener todos los municipios
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: region_id
 *         schema: { type: integer }
 *         description: Filtrar por región
 *     responses:
 *       200:
 *         description: Lista de municipios de Puebla
 */
router.get('/municipios', getMunicipios);

/**
 * @swagger
 * /api/catalogos/regiones:
 *   get:
 *     tags: [Catálogos]
 *     summary: Obtener todas las regiones
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de regiones del estado
 */
router.get('/regiones', getRegiones);

/**
 * @swagger
 * /api/catalogos/estatus:
 *   get:
 *     tags: [Catálogos]
 *     summary: Obtener todos los estatus de solicitudes
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de estatus (Pendiente, En Proceso, Aprobada, etc)
 */
router.get('/estatus', getEstatus);

/**
 * @swagger
 * /api/catalogos/dependencias:
 *   get:
 *     tags: [Catálogos]
 *     summary: Obtener todas las dependencias del C5i
 *     description: Catálogo de las 28 dependencias del Centro C5i
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de dependencias (CECSNSP, CERESOS, CGC5I, etc)
 */
router.get('/dependencias', getDependencias);

/**
 * @swagger
 * /api/catalogos/puestos:
 *   get:
 *     tags: [Catálogos]
 *     summary: Obtener todos los puestos con filtro de competencia
 *     description: Catálogo de puestos. Los que tienen es_competencia_municipal=FALSE (CUSTODIO, GUARDIA NACIONAL, MILITAR) serán rechazados automáticamente.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de puestos con flag de competencia municipal
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       nombre: { type: string }
 *                       es_competencia_municipal: { type: boolean }
 *                       motivo_no_competencia: { type: string }
 */
router.get('/puestos', getPuestos);

export default router;
