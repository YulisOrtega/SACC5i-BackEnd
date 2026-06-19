import express from "express";
import {
  listarMunicipiosRepositorio,
  obtenerDetalleMunicipioRepositorio
} from "../controllers/repositorioMunicipiosController.js";

const router = express.Router();

router.get("/", listarMunicipiosRepositorio);
router.get("/:municipioId", obtenerDetalleMunicipioRepositorio);

export default router;