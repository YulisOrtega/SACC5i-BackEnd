import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/municipios/' }); 

router.use(authMiddleware);

// Municipio sube un documento
router.post('/cargar', requireRole('municipio', 'admin', 'super_admin'), upload.single('documento'), async (req, res) => {
  // SOLUCIÓN: Atrapamos la sesión ya sea en español (usuario) o inglés (user)
  const usuarioActivo = req.usuario || req.user || {};
  const municipio_id = usuarioActivo.municipio_id || 1; 
  
  const archivo = req.file;

  res.status(201).json({ success: true, message: 'Documento cargado a revisión' });
});

// Municipio consulta sus documentos
router.get('/mis-documentos', requireRole('municipio', 'admin', 'super_admin'), async (req, res) => {
  const usuarioActivo = req.usuario || req.user || {};
  const municipio_id = usuarioActivo.municipio_id || 1;
  
  res.json({ success: true, data: [] });
});

// Obtener historial de un documento
router.get('/:id/historial', requireRole('municipio', 'admin', 'super_admin', 'analista'), async (req, res) => {
  res.json({ success: true, data: [] });
});

// ==========================================
// RUTAS PARA EL ANALISTA C5
// ==========================================

router.get('/pendientes', requireRole('analista', 'admin', 'super_admin', 'direccion'), async (req, res) => {
  res.json({ success: true, data: [] });
});

router.put('/:id/evaluar', requireRole('analista', 'admin', 'super_admin'), async (req, res) => {
  const { estatus_nuevo, observaciones } = req.body; 
  const usuarioActivo = req.usuario || req.user || {};
  const usuario_analista_id = usuarioActivo.id; 

  res.json({ success: true, message: `Documento marcado como ${estatus_nuevo} correctamente.` });
});

export default router;