import RepositorioMunicipiosService from "../services/RepositorioMunicipiosService.js";

export const listarMunicipiosRepositorio = async (req, res) => {
  try {
    console.log("ROL:", req.userRole);
    console.log("USER ID:", req.userId);
    console.log("BODY USER:", {
      userId: req.userId,
      userRole: req.userRole,
      regionId: req.regionId
    });

    const data = await RepositorioMunicipiosService.listarMunicipios({
      usuarioId: req.userId,
      rol: req.userRole,
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

export const subirDocumentosMunicipioRepositorio = async (req, res) => {
  try {
    const data = await RepositorioMunicipiosService.subirDocumentosMunicipio({
      municipioId: req.params.municipioId,
      usuarioId: req.userId,
      archivos: req.files || []
    });

    res.json({
      success: true,
      message: "Archivos subidos correctamente",
      data
    });
  } catch (error) {
    console.error("Error en subirDocumentosMunicipioRepositorio:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error al subir documentos"
    });
  }
};

export const verDocumentoRepositorio = async (req, res) => {
  try {
    const doc = await RepositorioMunicipiosService.obtenerDocumentoPorId(
      req.params.documentoId
    );

    res.setHeader("Content-Type", doc.mime_type);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(doc.nombre_original)}"`
    );

    res.sendFile(doc.ruta_archivo, { root: process.cwd() });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: "Documento no encontrado"
    });
  }
};

export const descargarDocumentoRepositorio = async (req, res) => {
  try {
    const doc = await RepositorioMunicipiosService.obtenerDocumentoPorId(
      req.params.documentoId
    );

    res.download(doc.ruta_archivo, doc.nombre_original);
  } catch (error) {
    res.status(404).json({
      success: false,
      message: "Documento no encontrado"
    });
  }
};

export const eliminarDocumentoRepositorio = async (req, res) => {
  try {
    await RepositorioMunicipiosService.eliminarDocumento(
      req.params.documentoId
    );

    res.json({
      success: true,
      message: "Documento eliminado correctamente"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al eliminar documento"
    });
  }
};

export const obtenerDetalleMunicipioRepositorio = async (req, res) => {
  try {
    const data = await RepositorioMunicipiosService.obtenerDetalleMunicipio({
      municipioId: req.params.municipioId,
      usuarioId: req.userId,
      rol: req.userRole,
      regionId: req.regionId
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