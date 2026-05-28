import ConsultaService from '../services/ConsultaService.js';

export const listarMunicipiosConsulta = async (req, res) => {
  try {
    const { busqueda = '', pagina = 1, limit = 10 } = req.query;
    const data = await ConsultaService.listarMunicipiosConFinalizados({ busqueda, pagina, limit });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const listarPersonasConsultaPorMunicipio = async (req, res) => {
  try {
    const { municipioId } = req.params;
    const { busqueda = '', pagina = 1, limit = 10, municipio_nombre = '' } = req.query;

    const data = await ConsultaService.listarPersonasFinalizadasPorMunicipio(
      municipioId ? Number(municipioId) : null,
      {
        busqueda,
        pagina,
        limit,
        municipioNombre: municipio_nombre
      }
    );

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const exportarExcelConsultaMunicipio = async (req, res) => {
  try {
    const { municipioId } = req.params;
    const { busqueda = '', ids = '' } = req.query;
    const idsList = String(ids || '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);

    const { buffer, nombreArchivo } = await ConsultaService.exportarExcelPersonasMunicipio(Number(municipioId), {
      busqueda,
      ids: idsList
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombreArchivo)}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
