import express from 'express';
import NotificacionesController from '../controllers/notificacionesController.js';

// CAMBIA ESTE IMPORT POR EL QUE YA USE TU PROYECTO
// Ejemplos posibles:
// import { authenticateToken } from '../middlewares/authMiddleware.js';
// import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Si tu middleware se llama authenticateToken, déjalo así:
// router.use(authenticateToken);

// Si se llama authMiddleware, sería:
// router.use(authMiddleware);

router.get('/', NotificacionesController.listar);
router.patch('/:id/leida', NotificacionesController.marcarLeida);
router.patch('/marcar-todas/leidas', NotificacionesController.marcarTodasLeidas);

export default router;