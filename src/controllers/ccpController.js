import CcpModel from '../models/CcpModel.js';
import { generarExcelUnico, generarZip, generarExcelTabla } from '../services/CcpService.js';
import ActividadOperadorService from '../services/ActividadOperadorService.js';

// ============================================
// LISTAR
// ============================================
export const listarCcp = async (req, res) => {
  try {
    const { busqueda = '', pagina = 1, limit = 10 } = req.query;
    const resultado = await CcpModel.listar({
      busqueda,
      pagina: parseInt(pagina),
      limit: parseInt(limit)
    });
    res.json({ success: true, ...resultado });
  } catch (error) {
    console.error('Error al listar CCP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// LISTAR HISTORIAL DE REGISTROS CCP
// ============================================
export const listarHistorialRegistrosCcp = async (req, res) => {
  try {
    const { busqueda = '', pagina = 1, limit = 10 } = req.query;
    const resultado = await CcpModel.listarHistorialRegistros({
      busqueda,
      pagina: parseInt(pagina, 10),
      limit: parseInt(limit, 10)
    });

    res.json({ success: true, ...resultado });
  } catch (error) {
    console.error('Error al listar historial de registros CCP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// OBTENER POR ID
// ============================================
export const obtenerCcp = async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await CcpModel.obtenerPorId(parseInt(id));
    if (!registro) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }
    res.json({ success: true, data: registro });
  } catch (error) {
    console.error('Error al obtener CCP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// OBTENER PRÓXIMO NÚMERO DE OFICIO
// ============================================
export const obtenerSiguienteNumero = async (req, res) => {
  try {
    const anio = req.query.anio || new Date().getFullYear();
    const ultimo = await CcpModel.ultimoNumeroAnio(parseInt(anio));
    res.json({ success: true, siguiente: ultimo + 1, anio: parseInt(anio) });
  } catch (error) {
    console.error('Error al obtener siguiente número:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// CREAR
// ============================================
export const crearCcp = async (req, res) => {
  try {
    const datos = { ...req.body, creado_por_id: req.userId };
    const nuevo = await CcpModel.crear(datos);

    await ActividadOperadorService.registrar({
      userId: req.userId,
      userRole: req.userRole,
      modulo: 'ccp',
      accion: 'crear',
      entidad: 'copias_conocimiento',
      entidadId: nuevo?.id,
      descripcion: `Creó registro CCP ${nuevo?.numero_oficio || nuevo?.id}`,
      metadata: { numero_oficio: nuevo?.numero_oficio }
    });

    res.status(201).json({ success: true, data: nuevo, message: 'Registro creado exitosamente' });
  } catch (error) {
    console.error('Error al crear CCP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// ACTUALIZAR
// ============================================
export const actualizarCcp = async (req, res) => {
  try {
    const { id } = req.params;
    const existente = await CcpModel.obtenerPorId(parseInt(id));
    if (!existente) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }
    const actualizado = await CcpModel.actualizar(parseInt(id), req.body);

    await ActividadOperadorService.registrar({
      userId: req.userId,
      userRole: req.userRole,
      modulo: 'ccp',
      accion: 'actualizar',
      entidad: 'copias_conocimiento',
      entidadId: actualizado?.id,
      descripcion: `Actualizó registro CCP ${actualizado?.numero_oficio || actualizado?.id}`,
      metadata: { numero_oficio: actualizado?.numero_oficio }
    });

    res.json({ success: true, data: actualizado, message: 'Registro actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar CCP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// ELIMINAR
// ============================================
export const eliminarCcp = async (req, res) => {
  try {
    const { id } = req.params;
    const existente = await CcpModel.obtenerPorId(parseInt(id));
    if (!existente) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }

    await CcpModel.archivarRegistros([existente], {
      usuarioId: req.userId,
      accion: 'ELIMINADO'
    });

    const eliminado = await CcpModel.eliminar(parseInt(id));
    if (!eliminado) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }

    await ActividadOperadorService.registrar({
      userId: req.userId,
      userRole: req.userRole,
      modulo: 'ccp',
      accion: 'eliminar',
      entidad: 'copias_conocimiento',
      entidadId: parseInt(id),
      descripcion: `Eliminó registro CCP ${existente?.numero_oficio || id}`,
      metadata: { numero_oficio: existente?.numero_oficio || null }
    });

    res.json({ success: true, message: 'Registro eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar CCP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const eliminarCcpMasivo = async (req, res) => {
  try {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No se recibieron IDs válidos para eliminar.' });
    }

    const registros = await CcpModel.obtenerPorIds(ids);
    if (registros.length > 0) {
      await CcpModel.archivarRegistros(registros, {
        usuarioId: req.userId,
        accion: 'ELIMINACION_MASIVA'
      });
    }

    const deleted = await CcpModel.eliminarMasivo(ids);

    await ActividadOperadorService.registrar({
      userId: req.userId,
      userRole: req.userRole,
      modulo: 'ccp',
      accion: 'eliminar_masivo',
      entidad: 'copias_conocimiento',
      descripcion: `Eliminó ${deleted} registro(s) CCP en lote`,
      metadata: { ids, deleted }
    });

    res.json({ success: true, deleted, message: `${deleted} registro(s) eliminado(s)` });
  } catch (error) {
    console.error('Error al eliminar CCP masivo:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const eliminarTodosCcp = async (req, res) => {
  try {
    const registros = await CcpModel.obtenerTodos();
    if (registros.length > 0) {
      await CcpModel.archivarRegistros(registros, {
        usuarioId: req.userId,
        accion: 'VACIADO_TABLA'
      });
    }

    const deleted = await CcpModel.eliminarTodos();

    await ActividadOperadorService.registrar({
      userId: req.userId,
      userRole: req.userRole,
      modulo: 'ccp',
      accion: 'eliminar_todos',
      entidad: 'copias_conocimiento',
      descripcion: `Vació la tabla CCP. Registros eliminados: ${deleted}`,
      metadata: { deleted }
    });

    res.json({ success: true, deleted, message: `Se eliminaron ${deleted} registro(s)` });
  } catch (error) {
    console.error('Error al vaciar tabla CCP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// DESCARGAR EXCEL (único registro)
// ============================================
export const descargarExcel = async (req, res) => {
  try {
    const { id } = req.params;
    const buffer = await generarExcelUnico(parseInt(id));

    await ActividadOperadorService.registrar({
      userId: req.userId,
      userRole: req.userRole,
      modulo: 'ccp',
      accion: 'descargar_excel',
      entidad: 'copias_conocimiento',
      entidadId: parseInt(id),
      descripcion: `Descargó Excel del registro CCP ${id}`
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="CCP_${id}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error al generar Excel:', error);
    if (error.message.includes('no encontrado')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// DESCARGAR TABLA COMPLETA EN EXCEL HORIZONTAL
// ============================================
export const descargarTablaExcel = async (req, res) => {
  try {
    const filtro = req.query.busqueda || '';
    const buffer = await generarExcelTabla(filtro);

    await ActividadOperadorService.registrar({
      userId: req.userId,
      userRole: req.userRole,
      modulo: 'ccp',
      accion: 'descargar_tabla_excel',
      entidad: 'copias_conocimiento',
      descripcion: 'Descargó Excel de la tabla CCP',
      metadata: { filtro }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="CCP_Tabla_Completa.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error al generar tabla Excel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// DESCARGAR ZIP (múltiples o todos)
// ============================================
export const descargarZip = async (req, res) => {
  try {
    // ids puede venir como query string: ?ids=1,2,3  o vacío para todos
    const rawIds = req.query.ids;
    const ids = rawIds ? rawIds.split(',').map(Number).filter(Boolean) : [];

    await ActividadOperadorService.registrar({
      userId: req.userId,
      userRole: req.userRole,
      modulo: 'ccp',
      accion: 'descargar_zip',
      entidad: 'copias_conocimiento',
      descripcion: ids.length > 0
        ? `Descargó ZIP con ${ids.length} registro(s) seleccionados`
        : 'Descargó ZIP completo de CCP',
      metadata: { ids }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="CCP_Registros.zip"');

    const stream = await generarZip(ids);
    stream.pipe(res);
  } catch (error) {
    console.error('Error al generar ZIP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const obtenerActividadOperador = async (req, res) => {
  try {
    const { pagina = 1, limit = 20 } = req.query;
    const resultado = await ActividadOperadorService.obtenerPorUsuario({
      userId: req.userId,
      pagina,
      limit
    });

    res.json({ success: true, ...resultado });
  } catch (error) {
    console.error('Error al obtener historial de operador CCP:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
