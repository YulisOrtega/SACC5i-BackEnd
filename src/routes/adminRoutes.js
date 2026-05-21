import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middlewares/validationMiddleware.js';
import {
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  purgeAnalistaRegistros,
  deactivateUsuario,
  activateUsuario,
  resetPassword,
  generarPasswordTemporal,
  obtenerPasswordTemporal,
  revocarPasswordTemporal,
  getEstadisticasAdmin
} from '../controllers/adminController.js';
import { requireAdmin, requireSuperAdmin } from '../middlewares/roleMiddleware.js';

const router = express.Router();

// Validaciones para crear usuario
const createUsuarioValidation = [
  body('usuario')
    .trim()
    .notEmpty().withMessage('El usuario es requerido')
    .isLength({ min: 3, max: 50 }).withMessage('El usuario debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('El usuario solo puede contener letras, números y guiones bajos'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('El correo electrónico es requerido')
    .isEmail().withMessage('Debe proporcionar un correo electrónico válido')
    .normalizeEmail(),
  
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  
  body('apellido')
    .trim()
    .notEmpty().withMessage('El apellido es requerido')
    .isLength({ min: 2, max: 100 }).withMessage('El apellido debe tener entre 2 y 100 caracteres'),
  
  body('extension')
    .trim()
    .notEmpty().withMessage('La extensión es requerida')
    .isLength({ min: 4, max: 20 }).withMessage('La extensión debe tener entre 4 y 20 caracteres'),
  
  body('rol')
    .optional()
    .isIn(['super_admin', 'admin', 'direccion', 'analista', 'validador_c3', 'dependencia', 'operador_ccp', 'municipio', 'coordinador']).withMessage('Rol inválido'),
  
  body('region_id')
    .optional()
    .isInt().withMessage('La región debe ser un número válido')
];

// Validaciones para actualizar usuario
const updateUsuarioValidation = [
  body('usuario')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('El usuario debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('El usuario solo puede contener letras, números y guiones bajos'),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Debe proporcionar un correo electrónico válido')
    .normalizeEmail(),
  
  body('nombre')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  
  body('apellido')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('El apellido debe tener entre 2 y 100 caracteres'),
  
  body('extension')
    .optional()
    .trim()
    .isLength({ min: 4, max: 20 }).withMessage('La extensión debe tener entre 4 y 20 caracteres'),
  
  body('rol')
    .optional()
    .isIn(['super_admin', 'admin', 'direccion', 'analista', 'validador_c3', 'dependencia', 'operador_ccp', 'municipio', 'coordinador']).withMessage('Rol inválido'),
  
  body('region_id')
    .optional()
    .isInt().withMessage('La región debe ser un número válido')
];

const generarPasswordTemporalValidation = [
  body('duracion_dias')
    .isInt({ min: 1, max: 365 }).withMessage('La duración debe ser un número entero entre 1 y 365 días'),

  body('motivo')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('El motivo no puede exceder 255 caracteres')
];

const revocarPasswordTemporalValidation = [
  body('motivo')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('El motivo no puede exceder 255 caracteres')
];

/**
 * @swagger
 * /api/admin/usuarios:
 *   get:
 *     summary: Obtener lista de usuarios (Admin/Super Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rol
 *         schema:
 *           type: string
 *           enum: [super_admin, admin, analista]
 *         description: Filtrar por rol
 *       - in: query
 *         name: activo
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado activo/inactivo
 *       - in: query
 *         name: region_id
 *         schema:
 *           type: integer
 *         description: Filtrar por región
 *       - in: query
 *         name: buscar
 *         schema:
 *           type: string
 *         description: Buscar por nombre, apellido, usuario o extensión
 *         example: "Orlando"
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *       403:
 *         description: No autorizado
 */
router.get('/usuarios', requireAdmin, getUsuarios);

/**
 * @swagger
 * /api/admin/usuarios:
 *   post:
 *     summary: Crear nuevo usuario (Admin/Super Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - usuario
 *               - email
 *               - nombre
 *               - apellido
 *               - extension
 *               - rol
 *             properties:
 *               usuario:
 *                 type: string
 *                 example: juan_perez
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan.perez@c5i.puebla.gob.mx
 *               nombre:
 *                 type: string
 *                 example: Juan
 *               apellido:
 *                 type: string
 *                 example: Pérez
 *               extension:
 *                 type: string
 *                 example: "12345"
 *               rol:
 *                 type: string
 *                 enum: [admin, analista]
 *                 example: analista
 *               region_id:
 *                 type: integer
 *                 example: 1
 *                 description: Opcional - requerido solo para analistas
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No autorizado
 */
router.post('/usuarios', requireAdmin, createUsuarioValidation, validate, createUsuario);

/**
 * @swagger
 * /api/admin/usuarios/{id}:
 *   put:
 *     summary: Actualizar perfil de OTRO usuario (Admin/Super Admin)
 *     description: Este endpoint permite a Admin/Super Admin actualizar el perfil de cualquier usuario. Para actualizar TU PROPIO perfil usa /api/auth/profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID del usuario a actualizar
 *         schema:
 *           type: integer
 *         example: 4
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Todos los campos son opcionales - solo envía los que quieres cambiar
 *             properties:
 *               usuario:
 *                 type: string
 *                 example: "tomas_alva"
 *                 description: Nombre de usuario único (username)
 *               nombre:
 *                 type: string
 *                 example: "Tomás"
 *               apellido:
 *                 type: string
 *                 example: "Alva Edison"
 *               extension:
 *                 type: string
 *                 example: "78453"
 *               region_id:
 *                 type: integer
 *                 example: 2
 *                 description: Opcional - usar null para remover región
 *               rol:
 *                 type: string
 *                 enum: [admin, analista, super_admin]
 *                 example: analista
 *                 description: Solo Super Admin puede cambiar roles
 *           example:
 *             usuario: "tomas_alva"
 *             nombre: "Tomás"
 *             apellido: "Alva Edison"
 *             extension: "78453"
 *             region_id: 1
 *             rol: "super_admin"
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *       404:
 *         description: Usuario no encontrado
 *       403:
 *         description: No autorizado (requiere rol Admin o Super Admin)
 */
router.put('/usuarios/:id', requireAdmin, updateUsuarioValidation, validate, updateUsuario);

/**
 * @swagger
 * /api/admin/usuarios/{id}:
 *   delete:
 *     summary: Eliminar usuario permanentemente (Solo Super Admin)
 *     description: Permite eliminar cualquier tipo de usuario, incluyendo super_admin, excepto al usuario de la sesion actual.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario eliminado exitosamente
 *       403:
 *         description: Operacion no permitida
 */
router.delete('/usuarios/:id', requireSuperAdmin, deleteUsuario);

/**
 * @swagger
 * /api/admin/usuarios/{id}/registros-analista:
 *   delete:
 *     summary: Borrar todos los registros asociados a un analista (Solo Super Admin)
 *     description: Elimina tramites y registros relacionados donde el usuario sea el analista C5 responsable.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Registros del analista eliminados exitosamente
 *       400:
 *         description: Operacion valida solo para usuarios con rol analista
 */
router.delete('/usuarios/:id/registros-analista', requireSuperAdmin, purgeAnalistaRegistros);

/**
 * @swagger
 * /api/admin/usuarios/{id}/deactivate:
 *   patch:
 *     summary: Desactivar usuario (Admin/Super Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario desactivado
 *       400:
 *         description: No se puede desactivar Super Admin
 */
router.patch('/usuarios/:id/deactivate', requireAdmin, deactivateUsuario);

/**
 * @swagger
 * /api/admin/usuarios/{id}/activate:
 *   patch:
 *     summary: Activar usuario (Admin/Super Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Usuario activado
 */
router.patch('/usuarios/:id/activate', requireAdmin, activateUsuario);

/**
 * @swagger
 * /api/admin/usuarios/{id}/reset-password:
 *   patch:
 *     summary: Resetear contraseña al nombre de usuario (Admin/Super Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contraseña reseteada al nombre de usuario
 */
router.patch('/usuarios/:id/reset-password', requireAdmin, resetPassword);

/**
 * @swagger
 * /api/admin/usuarios/{id}/temporary-password:
 *   post:
 *     summary: Generar contraseña temporal para delegación de trabajo (Admin/Super Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [duracion_dias]
 *             properties:
 *               duracion_dias:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 example: 7
 *               motivo:
 *                 type: string
 *                 example: Cobertura por vacaciones
 *     responses:
 *       200:
 *         description: Contraseña temporal generada exitosamente
 */
router.post(
  '/usuarios/:id/temporary-password',
  requireAdmin,
  generarPasswordTemporalValidation,
  validate,
  generarPasswordTemporal
);

/**
 * @swagger
 * /api/admin/usuarios/{id}/temporary-password:
 *   get:
 *     summary: Obtener estado y bitácora de contraseña temporal (Admin/Super Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Máximo de registros de bitácora
 *     responses:
 *       200:
 *         description: Estado y bitácora obtenidos exitosamente
 */
router.get('/usuarios/:id/temporary-password', requireAdmin, obtenerPasswordTemporal);

/**
 * @swagger
 * /api/admin/usuarios/{id}/temporary-password:
 *   delete:
 *     summary: Revocar contraseña temporal activa (Admin/Super Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *                 example: Regreso del titular a sus actividades
 *     responses:
 *       200:
 *         description: Contraseña temporal revocada exitosamente
 */
router.delete(
  '/usuarios/:id/temporary-password',
  requireAdmin,
  revocarPasswordTemporalValidation,
  validate,
  revocarPasswordTemporal
);

/**
 * @swagger
 * /api/admin/estadisticas:
 *   get:
 *     summary: Obtener estadísticas del sistema (Admin/Super Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas del sistema
 */
router.get('/estadisticas', requireAdmin, getEstadisticasAdmin);

export default router;
