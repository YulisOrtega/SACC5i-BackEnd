import express from 'express';
import authRoutes from './authRoutes.js';
import catalogosRoutes from './catalogosRoutes.js';
import adminRoutes from './adminRoutes.js';
import tramitesAltaRoutes from './tramitesAltaRoutes.js';
import dependenciaRoutes from './dependenciaRoutes.js';
import ccpRoutes from './ccpRoutes.js';
import repositorioDigitalRoutes from './repositorioDigitalRoutes.js';
import oficiosRespuestaRoutes from './oficiosRespuestaRoutes.js';
import direccionRoutes from './direccionRoutes.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Rutas de autenticación
router.use('/auth', authRoutes);

// Rutas de administración (requiere autenticación)
router.use('/admin', authMiddleware, adminRoutes);

// MÓDULO: Trámites de ALTA (estructura modular)
router.use('/tramites/alta', tramitesAltaRoutes);

// MÓDULO: Dependencias (FGE, CERESO, AUXILIAR, PRIVADA, SSP)
router.use('/dependencias', dependenciaRoutes);

// MÓDULO: Copias de Conocimiento
router.use('/ccp', ccpRoutes);

// MÓDULO: Repositorio Digital
router.use('/repositorio-digital', repositorioDigitalRoutes);

// MÓDULO: Oficios de Respuesta
router.use('/oficios-respuesta', oficiosRespuestaRoutes);

// MÓDULO: Direccion (panel unificado de solo lectura)
router.use('/direccion', direccionRoutes);

// Rutas de catálogos
router.use('/catalogos', catalogosRoutes);

/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Sistema]
 *     summary: Verificar estado del servidor
 *     responses:
 *       200:
 *         description: Servidor funcionando correctamente
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API RPSP funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

export default router;
