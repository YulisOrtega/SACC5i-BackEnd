import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import {
  listarCcp,
  obtenerCcp,
  obtenerSiguienteNumero,
  crearCcp,
  actualizarCcp,
  eliminarCcp,
  eliminarCcpMasivo,
  eliminarTodosCcp,
  listarHistorialRegistrosCcp,
  obtenerActividadOperador,
  descargarExcel,
  descargarZip,
  descargarTablaExcel
} from '../controllers/ccpController.js';

const router = express.Router();

// Todos los endpoints requieren autenticación
router.use(authMiddleware);

// Acceso: operador_ccp, admin, super_admin
const puedeAcceder = requireRole('super_admin', 'admin', 'operador_ccp');

// GET /api/ccp/siguiente?anio=2025  — Próximo número de oficio
router.get('/siguiente', puedeAcceder, obtenerSiguienteNumero);

// GET /api/ccp/download/tabla  — Exportar tabla completa en Excel horizontal
router.get('/download/tabla', puedeAcceder, descargarTablaExcel);

// GET /api/ccp/download/zip?ids=1,2,3  — Descargar ZIP (debe ir antes de /:id)
router.get('/download/zip', puedeAcceder, descargarZip);

// GET /api/ccp/historial/movimientos — Historial de actividad de operador CCP
router.get('/historial/movimientos', puedeAcceder, obtenerActividadOperador);

// GET /api/ccp/historial/registros — Historial persistente de registros CCP
router.get('/historial/registros', puedeAcceder, listarHistorialRegistrosCcp);

// GET /api/ccp/:id/download  — Descargar Excel individual
router.get('/:id/download', puedeAcceder, descargarExcel);

// GET /api/ccp  — Listar
router.get('/', puedeAcceder, listarCcp);

// GET /api/ccp/:id  — Obtener uno
router.get('/:id', puedeAcceder, obtenerCcp);

// POST /api/ccp  — Crear
router.post('/', puedeAcceder, crearCcp);

// PUT /api/ccp/:id  — Actualizar
router.put('/:id', puedeAcceder, actualizarCcp);

// DELETE /api/ccp/:id  — Eliminar (admin, super_admin y operador_ccp)
router.delete('/:id', puedeAcceder, eliminarCcp);

// POST /api/ccp/bulk-delete — Eliminar seleccionados
router.post('/bulk-delete', puedeAcceder, eliminarCcpMasivo);

// DELETE /api/ccp — Vaciar tabla CCP
router.delete('/', puedeAcceder, eliminarTodosCcp);

export default router;
