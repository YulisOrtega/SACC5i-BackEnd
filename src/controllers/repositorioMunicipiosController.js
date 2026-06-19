import RepositorioMunicipiosService from "../services/RepositorioMunicipiosService.js";

export const listarMunicipiosRepositorio = async (req, res) => {
  try {
    const data = await RepositorioMunicipiosService.listarMunicipios({
      usuarioId: req.userId,
      rol: req.userRole,
      regionId: req.userRegionId,
      busqueda: req.query.busqueda || ""
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error en listarMunicipiosRepositorio:", error);
    res.status(500).json({
      success: false,
      message: "Error al listar municipios del repositorio"
    });
  }
};

export const obtenerDetalleMunicipioRepositorio = async (req, res) => {
  try {
    const data = await RepositorioMunicipiosService.obtenerDetalleMunicipio({
      municipioId: req.params.municipioId,
      usuarioId: req.userId,
      rol: req.userRole,
      regionId: req.userRegionId
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error en obtenerDetalleMunicipioRepositorio:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener detalle del municipio"
    });
  }
};