import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { obtenerPanelDireccion } from '../controllers/direccionController.js';

const router = express.Router();

router.use(authMiddleware);

// Panel unificado de solo lectura para Direccion.
router.get('/panel', requireRole('direccion', 'admin', 'super_admin', 'coordinador'), obtenerPanelDireccion);

export default router;
