import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  listarMunicipiosRepositorio,
  obtenerDetalleMunicipioRepositorio
} from "../controllers/repositorioMunicipiosController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", listarMunicipiosRepositorio);
router.get("/:municipioId", obtenerDetalleMunicipioRepositorio);

export default router;