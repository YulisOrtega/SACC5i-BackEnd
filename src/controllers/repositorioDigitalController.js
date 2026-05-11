import RepositorioDigitalService from '../services/RepositorioDigitalService.js';
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
	const safeFolderName = String(folderName || 'acuses')
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/(^-|-$)/g, '');

	const fileName = `${safeFolderName || 'acuses'}-completo.zip`;
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
		const tree = await RepositorioDigitalService.obtenerTree();
		res.json({ success: true, data: tree });
	} catch (error) {
		console.error('Error al obtener árbol de repositorio:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};

export const crearYear = async (req, res) => {
	try {
		const { year } = req.body;
		const result = await RepositorioDigitalService.crearYearConEstructura(year, req.userId);

		await registrarActividad(req, {
			modulo: 'repositorio_digital',
			accion: 'crear_anio',
			entidad: 'repositorio_folders',
			entidadId: result.id,
			descripcion: `Creó la estructura del año ${year}`,
			metadata: { year, alreadyExists: result.alreadyExists }
		});

		res.status(200).json({
			success: true,
			data: result,
			message: `Carpeta anual ${year} lista para uso`
		});
	} catch (error) {
		console.error('Error al crear año en repositorio:', error);
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

		const rows = await RepositorioDigitalService.obtenerChildren(folderId, search);
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

		const result = await RepositorioDigitalService.obtenerFiles(Number(folderId), search, pagina, limit, fecha);
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
		const dias = await RepositorioDigitalService.obtenerResumenPorDias(Number(folderId), search);
		res.json({ success: true, data: dias });
	} catch (error) {
		console.error('Error al listar dias:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};

export const subirFile = async (req, res) => {
	try {
		const { folderId } = req.params;
		const fileId = await RepositorioDigitalService.subirArchivo(
			Number(folderId),
			req.file,
			req.body,
			req.userId
		);

		await registrarActividad(req, {
			modulo: 'repositorio_digital',
			accion: 'subir_archivo',
			entidad: 'repositorio_files',
			entidadId: fileId,
			descripcion: `Subió archivo "${req.file?.originalname || fileId}"`,
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
		const file = await RepositorioDigitalService.obtenerFileById(Number(req.params.fileId));
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
		const ok = await RepositorioDigitalService.eliminarArchivo(fileId);
		if (!ok) {
			return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
		}

		await registrarActividad(req, {
			modulo: 'repositorio_digital',
			accion: 'eliminar_archivo',
			entidad: 'repositorio_files',
			entidadId: fileId,
			descripcion: `Eliminó archivo ${fileId}`,
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
		const deleted = await RepositorioDigitalService.eliminarArchivosMasivo(Array.isArray(ids) ? ids : []);

		await registrarActividad(req, {
			modulo: 'repositorio_digital',
			accion: 'eliminar_archivos_masivo',
			entidad: 'repositorio_files',
			descripcion: `Eliminó ${deleted} archivo(s) en lote`,
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
		const { folder, files } = await RepositorioDigitalService.obtenerArchivosParaDescargaMasiva(Number(folderId));

		if (!files.length) {
			return res.status(404).json({ success: false, message: 'No hay archivos para descargar en esta carpeta anual' });
		}

		await streamZipResponse(res, folder.nombre, files);

		await registrarActividad(req, {
			modulo: 'repositorio_digital',
			accion: 'descargar_archivos_masivo',
			entidad: 'repositorio_files',
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
		const { folder, files } = await RepositorioDigitalService.obtenerArchivosSeleccionadosParaZip(Number(folderId), ids);

		if (!files.length) {
			return res.status(404).json({ success: false, message: 'No se encontraron archivos seleccionados para descargar' });
		}

		await streamZipResponse(res, `${folder.nombre}-seleccionados`, files);

		await registrarActividad(req, {
			modulo: 'repositorio_digital',
			accion: 'descargar_archivos_seleccionados_zip',
			entidad: 'repositorio_files',
			descripcion: `Descargó ${files.length} archivo(s) seleccionados en ZIP de la carpeta anual ${folder.nombre}`,
			metadata: { folderId: Number(folderId), filesCount: files.length, ids }
		});
	} catch (error) {
		console.error('Error al descargar archivos seleccionados en ZIP:', error);
		res.status(500).json({ success: false, message: error.message });
	}
};
