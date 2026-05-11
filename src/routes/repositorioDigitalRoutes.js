import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import {
  obtenerTree,
  crearYear,
  listarChildren,
  listarDias,
  listarFiles,
  subirFile,
  eliminarFile,
  eliminarFilesMasivo,
  verFile,
  descargarFolderCompleto,
  descargarSeleccionadosZip
} from '../controllers/repositorioDigitalController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
    const isExcelMime = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ].includes(file.mimetype);
    const isExcelExt = file.originalname.toLowerCase().endsWith('.xls') || file.originalname.toLowerCase().endsWith('.xlsx');

    if (!isPdfMime && !isPdfExt && !isExcelMime && !isExcelExt) {
      return cb(new Error('Solo se permiten archivos PDF o Excel (.xls, .xlsx)'));
    }
    cb(null, true);
  }
});

router.use(authMiddleware);

const puedeAcceder = requireRole(
  'super_admin',
  'admin',
  'analista',
  'dependencia',
  'operador_ccp'
);

const puedeSubir = requireRole('super_admin', 'admin', 'operador_ccp');
const puedeCrearAnio = requireRole('super_admin', 'admin', 'operador_ccp');
const puedeDescargarMasivo = requireRole('dependencia', 'analista');

router.get('/tree', puedeAcceder, obtenerTree);
router.get('/folders', puedeAcceder, listarChildren);
router.get('/folders/:folderId/days', puedeAcceder, listarDias);
router.get('/folders/:folderId/files', puedeAcceder, listarFiles);

router.post('/years', puedeCrearAnio, crearYear);
router.post('/folders/:folderId/files', puedeSubir, upload.single('file'), subirFile);
router.delete('/files/:fileId', puedeSubir, eliminarFile);
router.post('/files/bulk-delete', puedeSubir, eliminarFilesMasivo);
router.get('/folders/:folderId/download-all', puedeDescargarMasivo, descargarFolderCompleto);
router.post('/folders/:folderId/download-selected', puedeDescargarMasivo, descargarSeleccionadosZip);

router.get('/files/:fileId/view', puedeAcceder, verFile);

export default router;
