import BajaService from '../services/BajaService.js';

export const obtenerCatalogoBajas = async (req, res) => {
  try {
    const data = await BajaService.obtenerCatalogoBajas();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const listarDisponiblesBaja = async (req, res) => {
  try {
    const { busqueda = '', pagina = 1, limit = 10, analista_id = null } = req.query;
    const data = await BajaService.listarDisponiblesBaja({ busqueda, pagina, limit, analistaId: analista_id });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const listarBajasRegistradas = async (req, res) => {
  try {
    const { busqueda = '', pagina = 1, limit = 10, analista_id = null } = req.query;
    const data = await BajaService.listarBajasRegistradas({ busqueda, pagina, limit, analistaId: analista_id });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const registrarBaja = async (req, res) => {
  try {
    const { finalizado_id, tipo_baja, motivo_baja, fecha_baja, numero_oficio_municipio, observaciones } = req.body;
    await BajaService.registrarBaja(
      Number(finalizado_id),
      {
        tipo_baja,
        motivo_baja,
        fecha_baja,
        numero_oficio_municipio,
        observaciones
      },
      req.userId
    );

    res.json({ success: true, message: 'Baja registrada correctamente' });
  } catch (err) {
    const code = err.message.includes('invalido') || err.message.includes('obligatorios') || err.message.includes('no encontrado') || err.message.includes('ya fue dado de baja')
      ? 400
      : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

export const listarBajasEditables = async (req, res) => {
  try {
    const { busqueda = '' } = req.query;
    const data = await BajaService.listarBajasEditables({
      busqueda,
      usuarioId: req.userId
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const crearBajaEditable = async (req, res) => {
  try {
    const data = await BajaService.crearBajaEditable(req.body, req.userId);
    res.json({ success: true, data, message: 'Registro editable guardado correctamente' });
  } catch (err) {
    const code = err.message.includes('obligatorios') || err.message.includes('invalido')
      ? 400
      : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

export const editarBajaEditable = async (req, res) => {
  try {
    const data = await BajaService.editarBajaEditable(Number(req.params.id), req.body, req.userId);
    res.json({ success: true, data, message: 'Registro editable actualizado correctamente' });
  } catch (err) {
    const code = err.message.includes('obligatorios') || err.message.includes('invalido') || err.message.includes('no encontrado')
      ? 400
      : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

export const eliminarBajaEditable = async (req, res) => {
  try {
    await BajaService.eliminarBajaEditable(Number(req.params.id), req.userId);
    res.json({ success: true, message: 'Registro editable eliminado correctamente' });
  } catch (err) {
    const code = err.message.includes('no encontrado') || err.message.includes('invalido')
      ? 400
      : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};
