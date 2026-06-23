import express from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  listarMunicipiosRepositorio,
  obtenerDetalleMunicipioRepositorio,
  subirDocumentosMunicipioRepositorio,
  verDocumentoRepositorio,
  descargarDocumentoRepositorio,
  eliminarDocumentoRepositorio
} from "../controllers/repositorioMunicipiosController.js";

const router = express.Router();

const upload = multer({ dest: "uploads/municipios/" });

router.use(authMiddleware);

router.get("/", listarMunicipiosRepositorio);

router.get("/documentos/:documentoId/ver", verDocumentoRepositorio);
router.get("/documentos/:documentoId/descargar", descargarDocumentoRepositorio);
router.delete("/documentos/:documentoId", eliminarDocumentoRepositorio);

router.get("/:municipioId", obtenerDetalleMunicipioRepositorio);

router.post(
  "/:municipioId/documentos",
  upload.array("archivos", 20),
  subirDocumentosMunicipioRepositorio
);

export default router;