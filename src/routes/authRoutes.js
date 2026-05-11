import express from 'express';
import {
  register,
  login,
  getProfile,
  heartbeatSession,
  logoutSession,
  updateProfile,
  changePassword
} from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { authLoginRateLimiter } from '../middlewares/rateLimitMiddleware.js';
import { validate } from '../middlewares/validationMiddleware.js';
import {
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation
} from '../validators/authValidators.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Autenticación]
 *     summary: ❌ DESHABILITADO - Solo Admin puede crear usuarios
 *     description: El registro público está deshabilitado. Solo los administradores pueden crear usuarios desde /api/admin/usuarios
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       403:
 *         description: Registro público deshabilitado
 */
router.post('/register', registerValidation, validate, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Autenticación]
 *     summary: Iniciar sesión con usuario o correo electrónico
 *     description: Permite iniciar sesión usando el nombre de usuario o correo electrónico
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: 
 *                 type: string
 *                 description: Nombre de usuario o correo electrónico
 *                 example: "orla_developer"
 *               password: 
 *                 type: string
 *                 example: "ChangeMe123!"
 *           examples:
 *             superAdmin:
 *               summary: Super Admin (Orlando)
 *               value:
 *                 username: "orla_developer"
 *                 password: "ChangeMe123!"
 *             superAdminEmail:
 *               summary: Super Admin con email
 *               value:
 *                 username: "orlando.developer@c5i.puebla.gob.mx"
 *                 password: "ChangeMe123!"
 *             admin:
 *               summary: Admin (Leslie)
 *               value:
 *                 username: "leslie_admin"
 *                 password: "ChangeMe123!"
 *             validadorC3:
 *               summary: Validador C3 (Carlos)
 *               value:
 *                 username: "carlos_c3_validador"
 *                 password: "ChangeMe123!"
 *             analistaC5:
 *               summary: Analista C5 (Belén)
 *               value:
 *                 username: "belen_rodriguez"
 *                 password: "ChangeMe123!"
 *             dependenciaFGE:
 *               summary: Dependencia - FGE
 *               value:
 *                 username: "fge_dependencia"
 *                 password: "ChangeMe123!"
 *             dependenciaCERESO:
 *               summary: Dependencia - CERESO
 *               value:
 *                 username: "cereso_dependencia"
 *                 password: "ChangeMe123!"
 *             dependenciaAUXILIAR:
 *               summary: Dependencia - Policía Auxiliar
 *               value:
 *                 username: "auxiliar_dependencia"
 *                 password: "ChangeMe123!"
 *             dependenciaPRIVADA:
 *               summary: Dependencia - Seguridad Privada
 *               value:
 *                 username: "privada_dependencia"
 *                 password: "ChangeMe123!"
 *             dependenciaSSP:
 *               summary: Dependencia - SSP
 *               value:
 *                 username: "ssp_dependencia"
 *                 password: "ChangeMe123!"
 *     responses:
 *       200:
 *         description: Login exitoso, retorna token JWT y datos del usuario
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', authLoginRateLimiter, loginValidation, validate, login);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     tags: [Autenticación]
 *     summary: Obtener perfil del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del perfil
 *       401:
 *         description: No autenticado
 */
router.get('/profile', authMiddleware, getProfile);

router.post('/heartbeat', authMiddleware, heartbeatSession);

router.post('/logout', authMiddleware, logoutSession);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     tags: [Autenticación]
 *     summary: Actualizar TU PROPIO perfil
 *     description: Actualiza el perfil del usuario autenticado (tú mismo). La extensión NO se puede cambiar aquí; solo Admin/Super Admin puede hacerlo desde /api/admin/usuarios/{id}
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string, example: "Orlando" }
 *               apellido: { type: string, example: "Developer" }
 *               email: { type: string, example: "orlando.developer@c5i.puebla.gob.mx" }
 *           example:
 *             nombre: "Orlando"
 *             apellido: "Developer"
 *             email: "orlando.developer@c5i.puebla.gob.mx"
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 *       401:
 *         description: No autenticado o token inválido
 */
router.put('/profile', authMiddleware, updateProfileValidation, validate, updateProfile);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     tags: [Autenticación]
 *     summary: Cambiar contraseña
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, example: "password123" }
 *               newPassword: { type: string, example: "newPassword456" }
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *       401:
 *         description: Contraseña actual incorrecta
 */
router.put('/change-password', authMiddleware, changePasswordValidation, validate, changePassword);

export default router;
