import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import { obtenerListados, subirListado, descargarListado,eliminarListado } from '../controllers/listadoNominalController.js';
// Importa tu middleware de autenticación (ajusta la ruta o nombre si es distinto)
import { authMiddleware } from '../middlewares/authMiddleware.js'; 





// Aseguramos que la carpeta de respaldos exista
const uploadDir = 'uploads/listados';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de Multer para guardar el PDF
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({ storage: storage });

const router = Router();

// Rutas protegidas
router.get('/', authMiddleware, obtenerListados);
router.post('/subir', authMiddleware, upload.single('documento'), subirListado);
router.get('/:id/descargar', authMiddleware, descargarListado);
router.delete('/:id', authMiddleware, eliminarListado);

export default router;