import OficiosRespuestaService from '../services/OficiosRespuestaService.js';
import ActividadOperadorService from '../services/ActividadOperadorService.js';
import archiver from 'archiver';

const registrarActividad = async (req, data) => {
	await ActividadOperadorService.registrar({
		userId: req.userId,
		userRole: req.userRole,
		...data
	});
};

const streamZipResponse = async (res, folderName, files) => {
	const safeFolderName = String(folderName || 'oficios-respuesta')
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/(^-|-$)/g, '');

	const fileName = `${safeFolderName || 'oficios-respuesta'}-completo.zip`;
	res.setHeader('Content-Type', 'application/zip');
	res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

	const archive = archiver('zip', { zlib: { level: 9 } });
	archive.on('error', (error) => {
		throw error;
	});

	archive.pipe(res);

	files.forEach((file, index) => {
		const safeName = String(file.original_name || file.stored_name || `archivo-${index + 1}`)
			.replace(/[\\/:*?"<>|]/g, '_')
			.trim();

		archive.file(file.absolutePath, {
			name: `${String(index + 1).padStart(5, '0')}_${safeName}`
		});
	});

	await archive.finalize();
};

export const obtenerTree = async (req, res) => {
	try {
		const tree = await OficiosRespuestaService.obtenerTree();
		res.json({ success: true, data: tree });
	} catch (error) {
		console.error('Error al obtener árbol de oficios de respuesta:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};

export const crearYear = async (req, res) => {
	try {
		const { year } = req.body;
		const result = await OficiosRespuestaService.crearYearConEstructura(year, req.userId);

		await registrarActividad(req, {
			modulo: 'oficios_respuesta',
			accion: 'crear_anio',
			entidad: 'oficios_respuesta_folders',
			entidadId: result.id,
			descripcion: `Creó la estructura del año ${year} en oficios de respuesta`,
			metadata: { year, alreadyExists: result.alreadyExists }
		});

		res.status(200).json({
			success: true,
			data: result,
			message: `Carpeta anual ${year} lista para uso`
		});
	} catch (error) {
		console.error('Error al crear año en oficios de respuesta:', error);
		res.status(400).json({ success: false, message: error.message });
	}
};

export const crearSubcarpeta = async (req, res) => {
	try {
		res.status(400).json({
			success: false,
			message: 'La creación de subcarpetas fue deshabilitada en el modelo anual compartido'
		});
	} catch (error) {
		console.error('Error al crear subcarpeta:', error);
		res.status(400).json({ success: false, message: error.message });
	}
};

export const listarChildren = async (req, res) => {
	try {
		const folderId = req.query.parentId ? Number(req.query.parentId) : null;
		const search = req.query.search || '';

		const rows = await OficiosRespuestaService.obtenerChildren(folderId, search);
		res.json({ success: true, data: rows });
	} catch (error) {
		console.error('Error al listar carpetas hijas:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};

export const listarFiles = async (req, res) => {
	try {
		const { folderId } = req.params;
		const search = req.query.search || '';
		const pagina = Number(req.query.pagina || 1);
		const limit = Number(req.query.limit || 10);
		const fecha = req.query.fecha || '';

		const result = await OficiosRespuestaService.obtenerFiles(Number(folderId), search, pagina, limit, fecha);
		res.json({ success: true, ...result });
	} catch (error) {
		console.error('Error al listar archivos:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};

export const listarDias = async (req, res) => {
	try {
		const { folderId } = req.params;
		const search = req.query.search || '';
		const dias = await OficiosRespuestaService.obtenerResumenPorDias(Number(folderId), search);
		res.json({ success: true, data: dias });
	} catch (error) {
		console.error('Error al listar dias:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};

export const subirFile = async (req, res) => {
	try {
		const { folderId } = req.params;
		const fileId = await OficiosRespuestaService.subirArchivo(
			Number(folderId),
			req.file,
			req.body,
			req.userId
		);

		await registrarActividad(req, {
			modulo: 'oficios_respuesta',
			accion: 'subir_archivo',
			entidad: 'oficios_respuesta_files',
			entidadId: fileId,
			descripcion: `Subió archivo "${req.file?.originalname || fileId}" a oficios de respuesta`,
			metadata: {
				folderId: Number(folderId),
				filename: req.file?.originalname || null
			}
		});

		res.status(201).json({
			success: true,
			data: { id: fileId },
			message: 'Archivo subido correctamente'
		});
	} catch (error) {
		console.error('Error al subir archivo:', error);
		res.status(400).json({ success: false, message: error.message });
	}
};

export const verFile = async (req, res) => {
	try {
		const file = await OficiosRespuestaService.obtenerFileById(Number(req.params.fileId));
		if (!file) {
			return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
		}

		res.setHeader('Content-Type', file.mime_type || 'application/pdf');
		res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
		res.sendFile(file.absolutePath);
	} catch (error) {
		console.error('Error al visualizar archivo:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};

export const eliminarFile = async (req, res) => {
	try {
		const fileId = Number(req.params.fileId);
		const ok = await OficiosRespuestaService.eliminarArchivo(fileId);
		if (!ok) {
			return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
		}

		await registrarActividad(req, {
			modulo: 'oficios_respuesta',
			accion: 'eliminar_archivo',
			entidad: 'oficios_respuesta_files',
			entidadId: fileId,
			descripcion: `Eliminó archivo ${fileId} de oficios de respuesta`,
			metadata: { fileId }
		});

		res.json({ success: true, message: 'Archivo eliminado' });
	} catch (error) {
		console.error('Error al eliminar archivo:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};

export const eliminarFilesMasivo = async (req, res) => {
	try {
		const { ids } = req.body;
		const deleted = await OficiosRespuestaService.eliminarArchivosMasivo(Array.isArray(ids) ? ids : []);

		await registrarActividad(req, {
			modulo: 'oficios_respuesta',
			accion: 'eliminar_archivos_masivo',
			entidad: 'oficios_respuesta_files',
			descripcion: `Eliminó ${deleted} archivo(s) en lote de oficios de respuesta`,
			metadata: { ids, deleted }
		});

		res.json({ success: true, message: `${deleted} archivo(s) eliminado(s)` });
	} catch (error) {
		console.error('Error al eliminar archivos en lote:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};

export const eliminarCarpeta = async (req, res) => {
	try {
		res.status(400).json({
			success: false,
			message: 'La eliminación de carpetas fue deshabilitada en el modelo anual compartido'
		});
	} catch (error) {
		console.error('Error al eliminar carpeta:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};

export const descargarFolderCompleto = async (req, res) => {
	try {
		const { folderId } = req.params;
		const { folder, files } = await OficiosRespuestaService.obtenerArchivosParaDescargaMasiva(Number(folderId));

		if (!files.length) {
			return res.status(404).json({ success: false, message: 'No hay archivos para descargar en esta carpeta anual' });
		}

		await streamZipResponse(res, folder.nombre, files);

		await registrarActividad(req, {
			modulo: 'oficios_respuesta',
			accion: 'descargar_archivos_masivo',
			entidad: 'oficios_respuesta_files',
			descripcion: `Descargó ${files.length} archivo(s) en ZIP de la carpeta anual ${folder.nombre}`,
			metadata: { folderId: Number(folderId), filesCount: files.length }
		});

	} catch (error) {
		console.error('Error al descargar carpeta completa:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};

export const descargarSeleccionadosZip = async (req, res) => {
	try {
		const { folderId } = req.params;
		const { ids } = req.body;
		const folder = await OficiosRespuestaService.obtenerFolder(Number(folderId));
		if (!folder) {
			return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
		}

		const files = await OficiosRespuestaService.obtenerArchivosPorIds(ids);

		if (!files.length) {
			return res.status(404).json({ success: false, message: 'No se encontraron archivos seleccionados para descargar' });
		}

		await streamZipResponse(res, `${folder.nombre}-seleccionados`, files);

		await registrarActividad(req, {
			modulo: 'oficios_respuesta',
			accion: 'descargar_archivos_seleccionados_zip',
			entidad: 'oficios_respuesta_files',
			descripcion: `Descargó ${files.length} archivo(s) seleccionados en ZIP de la carpeta anual ${folder.nombre}`,
			metadata: { folderId: Number(folderId), filesCount: files.length, ids }
		});
	} catch (error) {
		console.error('Error al descargar archivos seleccionados en ZIP:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};
