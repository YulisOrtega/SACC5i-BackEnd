import express from 'express';
import multer from 'multer';
import {
  crearNuevaSolicitud,
  obtenerMisSolicitudes,
  obtenerDashboardMunicipios,
  obtenerMunicipiosDisponibles,
  agregarMunicipioDashboard,
  eliminarMunicipioDashboard,
  obtenerSolicitudPorId,
  eliminarBorradorNoEnviado,
  agregarPersona,
  obtenerPersonasPorTramite,
  editarPersona,
  validarPersona,
  rechazarPersona,
  enviarSolicitudAC3,
  obtenerPersonasPendientesC3,
  obtenerSolicitudParaC3,
  obtenerHistorialC3,
  emitirDictamenPersonaC3,
  obtenerTodasLasPersonasC5,
  obtenerPersonasRechazadas,
  actualizarMotivoRechazo,
  generarOficioRechazo,
  obtenerPropuestasC3,
  debugTramiteEstado
} from '../controllers/altaController.js';

// Revisión de Requisitos
import {
  obtenerPendientesRevision,
  obtenerEnProcesoRevision,
  iniciarRevision,
  obtenerDetalleRevision,
  guardarAntecedentes,
  validarDocumentoRevision,
  validarTodosDocumentos,
  completarRevision,
  rechazarEnRevision
} from '../controllers/revisionController.js';

// Validación CUIP
import {
  obtenerPendientesCuip,
  obtenerEnProcesoCuip,
  iniciarCuip,
  obtenerDetalleCuip,
  validarCampoCuip,
  validarSeccionCuip,
  marcarExcepcionCuip,
  validarTodoCuip,
  completarCuip,
  rechazarEnCuip,
  aprobarYGenerarCita
} from '../controllers/cuipController.js';
import {
  listarCitas,
  getEstadisticasCitas,
  actualizarEstadoCita,
  obtenerBitacoraCita,
  reprogramarCita,
  cancelarCita,
  finalizarFlujoCita,
  listarFinalizados,
  actualizarFase1Finalizado,
  subirAcuseFinalizado,
  subirAcusePersonaFinalizado,
  eliminarAcuseFinalizado,
  eliminarAcusePersonaFinalizado,
  verConstanciaFinalizado,
  verAcusePersonaFinalizado
} from '../controllers/citasController.js';
import {
  obtenerCatalogoBajas,
  listarDisponiblesBaja,
  listarBajasRegistradas,
  registrarBaja,
  listarBajasEditables,
  crearBajaEditable,
  editarBajaEditable,
  eliminarBajaEditable
} from '../controllers/bajaController.js';
import {
  listarMunicipiosConsulta,
  listarPersonasConsultaPorMunicipio,
  exportarExcelConsultaMunicipio
} from '../controllers/consultaController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import { municipioFilterMiddleware } from '../middlewares/municipioFilterMiddleware.js';
import { validate } from '../middlewares/validationMiddleware.js';
import { body, param } from 'express-validator';

const router = express.Router();

const uploadAcuse = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdfMime && !isPdfExt) {
      return cb(new Error('Solo se permiten archivos PDF'));
    }
    cb(null, true);
  }
});

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Validaciones para crear nueva solicitud
const validarNuevaSolicitud = [
  body('region_id')
    .optional({ values: 'falsy' })
    .isInt().withMessage('La region debe ser un numero'),

  body('tipo_oficio_id')
    .notEmpty().withMessage('El tipo de oficio es requerido')
    .isInt().withMessage('El tipo de oficio debe ser un número'),
  
  body('municipio_id')
    .notEmpty().withMessage('El municipio es requerido')
    .isInt().withMessage('El municipio debe ser un número'),
  
  body('termino')
    .optional()
    .isIn(['Sin termino', 'Normal']).withMessage('El término debe ser Sin termino o Normal'),
  
  body('dias_horas')
    .optional()
    .isIn(['Normal', 'Dias', 'Horas']).withMessage('El campo dias_horas debe ser Normal, Dias u Horas'),
  
  body('fecha_sello_c5')
    .optional()
    .isDate().withMessage('Fecha sello C5 inválida'),
  
  body('fecha_recibido_dt')
    .optional()
    .isDate().withMessage('Fecha recibido DT inválida'),

  body('numero_oficio_c5')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 }).withMessage('El número de oficio C5 no puede exceder 100 caracteres')
    .matches(/^[A-Za-z0-9/]+$/).withMessage('El número de oficio C5 solo puede contener letras, números y diagonales'),
  
  body('fecha_solicitud')
    .notEmpty().withMessage('La fecha de solicitud es requerida')
    .isDate().withMessage('Fecha de solicitud inválida'),
  
  body('observaciones')
    .optional()
    .trim()
];

// ============================================
// DASHBOARD DE MUNICIPIOS
// ============================================

/**
 * @swagger
 * /api/tramites/alta/dashboard-municipios:
 *   get:
 *     summary: Obtener dashboard de municipios con estadísticas de trámites
 *     description: |
 *       **Vista principal del analista para gestionar trámites por municipio**
 *       
 *       **Colores visuales:**
 *       - 🟢 Verde: Todos los trámites finalizados correctamente
 *       - 🟡 Amarillo: Municipio con trámites en proceso de alta
 *       - ⚪ Gris: Municipio sin trámites asignados
 *       
 *       **Acciones por municipio:**
 *       - `Iniciar proceso`: Solo si no hay trámites (botón visible)
 *       - `Ver proceso`: Cuando ya existe un trámite iniciado
 *       - `Ver detalles`: Siempre disponible para consultar resumen
 *       
 *       **Funcionalidad:**
 *       - Organiza trámites por municipio de la región del analista
 *       - Muestra estadísticas: validados, rechazados, en proceso
 *       - Facilita navegación y seguimiento de procesos
 *     tags:
 *       - 📊 Dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard cargado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     analista:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         nombre:
 *                           type: string
 *                         region_id:
 *                           type: integer
 *                     municipios:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           municipio_id:
 *                             type: integer
 *                           municipio_nombre:
 *                             type: string
 *                             example: "Huauchinango"
 *                           region_nombre:
 *                             type: string
 *                           estado_visual:
 *                             type: string
 *                             enum: [gris, amarillo, verde]
 *                             example: "verde"
 *                           estado_descriptivo:
 *                             type: string
 *                             example: "Trámites finalizados correctamente"
 *                           estadisticas:
 *                             type: object
 *                             properties:
 *                               total_tramites:
 *                                 type: integer
 *                               validados:
 *                                 type: integer
 *                                 example: 5
 *                               rechazados:
 *                                 type: integer
 *                                 example: 1
 *                               en_proceso:
 *                                 type: integer
 *                                 example: 0
 *                           acciones:
 *                             type: object
 *                             properties:
 *                               boton_principal:
 *                                 type: string
 *                                 enum: [iniciar_proceso, ver_proceso]
 *                               puede_iniciar:
 *                                 type: boolean
 *                               puede_ver_proceso:
 *                                 type: boolean
 *                               puede_ver_detalles:
 *                                 type: boolean
 *       403:
 *         description: Solo analistas pueden acceder
 */
router.get(
  '/dashboard-municipios',
  requireRole('analista'),
  obtenerDashboardMunicipios
);

/**
 * @swagger
 * /api/tramites/alta/municipios-disponibles:
 *   get:
 *     summary: Obtener municipios disponibles para agregar (catálogo)
 *     tags: [📊 Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de municipios disponibles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       municipio_id:
 *                         type: integer
 *                       municipio_nombre:
 *                         type: string
 *                       region_nombre:
 *                         type: string
 *                 total:
 *                   type: integer
 */
router.get('/municipios-disponibles', requireRole('analista'), obtenerMunicipiosDisponibles);

/**
 * @swagger
 * /api/tramites/alta/dashboard-municipios/agregar:
 *   post:
 *     summary: Agregar un municipio al dashboard personal
 *     tags: [📊 Dashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               municipio_id:
 *                 type: integer
 *                 example: 42
 *     responses:
 *       201:
 *         description: Municipio agregado exitosamente
 *       400:
 *         description: Municipio ya existe o no pertenece a la región
 */
router.post('/dashboard-municipios/agregar',
  requireRole('analista'),
  [
    body('municipio_id')
      .notEmpty().withMessage('El ID del municipio es requerido')
      .isInt().withMessage('El ID debe ser un número')
  ],
  validate,
  agregarMunicipioDashboard
);

/**
 * @swagger
 * /api/tramites/alta/dashboard-municipios/{dashboard_id}:
 *   delete:
 *     summary: Eliminar un municipio del dashboard (solo si no tiene trámites)
 *     tags: [📊 Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dashboard_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Municipio eliminado exitosamente
 *       400:
 *         description: No se puede eliminar porque tiene trámites iniciados
 */
router.delete('/dashboard-municipios/:dashboard_id', requireRole('analista'), eliminarMunicipioDashboard);

// ============================================
// PASO 1: NUEVA SOLICITUD DE ALTA
// ============================================

/**
 * @swagger
 * /api/tramites/alta/nueva-solicitud:
 *   post:
 *     tags: [C5 - Gestión de Trámites]
 *     summary: PASO 1 - Crear nueva solicitud de ALTA
 *     description: Crea una nueva solicitud de ALTA según formulario de la Imagen 5 del mockup. Solo analistas C5 pueden crear solicitudes.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo_documento, tipo_oficio_id, municipio_id, dependencia_id, fecha_solicitud]
 *             properties:
 *               tipo_documento:
 *                 type: string
 *                 enum: [Oficio, Volante, Folio]
 *                 example: "Oficio"
 *                 description: Tipo de documento (Oficio, Volante o Folio)
 *               tipo_oficio_id: 
 *                 type: integer
 *                 example: 1
 *                 description: Tipo de oficio (1=Emitido, 2=Recibido)
 *               municipio_id: 
 *                 type: integer
 *                 example: 114
 *                 description: ID del municipio
 *               proceso_movimiento: 
 *                 type: string
 *                 example: "ALTA"
 *                 description: Fijo en ALTA para este módulo
 *               termino: 
 *                 type: string
 *                 enum: [Sin termino, Normal]
 *                 example: "Normal"
 *                 description: Término del trámite (Sin termino o Normal)
 *               dias_horas: 
 *                 type: string
 *                 enum: [Normal, Dias, Horas]
 *                 example: "Dias"
 *                 description: Normal (cuando termino=Sin termino), Dias u Horas (cuando termino=Normal)
 *               fecha_sello_c5: 
 *                 type: string
 *                 format: date
 *                 example: "2026-01-20"
 *               fecha_recibido_dt: 
 *                 type: string
 *                 format: date
 *                 example: "2026-01-20"
 *               numero_oficio_c5:
 *                 type: string
 *                 example: "SSP/SII/C5I/DT/3263/2026"
 *                 description: Número de oficio C5 en formato institucional
 *               fecha_solicitud: 
 *                 type: string
 *                 format: date
 *                 example: "2026-01-20"
 *               observaciones: 
 *                 type: string
 *                 example: "Trámite urgente"
 *     responses:
 *       201:
 *         description: Solicitud creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     numero_solicitud: { type: string, example: "ALTA-2026-000001" }
 *                     fase_actual: { type: string, example: "datos_solicitud" }
 *       403:
 *         description: Solo analistas C5 pueden crear solicitudes
 */
router.post('/nueva-solicitud', 
  requireRole('analista', 'admin', 'super_admin'), 
  validarNuevaSolicitud, 
  validate, 
  crearNuevaSolicitud
);

/**
 * @swagger
 * /api/tramites/alta/mis-solicitudes:
 *   get:
 *     tags: [C5 - Gestión de Trámites]
 *     summary: Listar mis solicitudes de ALTA
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fase
 *         schema: { type: string }
 *         description: Filtrar por fase actual
 *       - in: query
 *         name: busqueda
 *         schema: { type: string }
 *         description: Buscar por número de solicitud o dependencia
 *     responses:
 *       200:
 *         description: Lista de solicitudes del analista
 */
router.get('/mis-solicitudes', 
  requireRole('analista', 'admin', 'super_admin'), 
  municipioFilterMiddleware,
  obtenerMisSolicitudes
);

// ============================================
// NUEVAS RUTAS C3 - VISTA POR PERSONA
// ============================================

/**
 * @swagger
 * /api/tramites/alta/personas-pendientes-c3:
 *   get:
 *     tags: [C3 - Validación]
 *     summary: Ver PERSONAS pendientes de dictamen (Vista por persona)
 *     description: C3 ve una tabla de personas individuales, no de trámites. Cada fila es una persona que necesita dictamen.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: busqueda
 *         schema: { type: string }
 *         description: Buscar por nombre o número de solicitud
 *     responses:
 *       200:
 *         description: Lista de personas pendientes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer, example: 15 }
 *                       nombre_completo: { type: string, example: "María Hernández Martínez" }
 *                       puesto_nombre: { type: string, example: "POLICÍA TERCERO" }
 *                       numero_solicitud: { type: string, example: "ALTA-2026-000002" }
 *                       fecha_solicitud: { type: string, format: date }
 *                       municipio_nombre: { type: string, example: "Puebla" }
 *                       dependencia_nombre: { type: string, example: "SSP MUNICIPAL" }
 *                       analista_nombre: { type: string }
 *                 total: { type: integer }
 *       403:
 *         description: Solo validadores C3
 */
router.get('/personas-pendientes-c3',
  requireRole('validador_c3'),
  municipioFilterMiddleware,
  obtenerPersonasPendientesC3
);

/**
 * @swagger
 * /api/tramites/alta/persona/{persona_id}/dictamen-c3:
 *   post:
 *     tags: [C3 - Validación]
 *     summary: Emitir dictamen para UNA persona (NO para el trámite completo)
 *     description: |
 *       C3 dicta sobre una persona individual que C5 validó previamente.
 *       
 *       **Opciones de C3:**
 *       1. **ALTA OK** - Persona aprobada, continúa el flujo
 *       2. **NO PUEDE SER DADO DE ALTA** - Rechazada, va a tabla de rechazados
 *       3. **PENDIENTE** - Rechazada (pendiente = rechazado), va a tabla de rechazados
 *       
 *       Cuando se dictaminan todas las personas, el trámite cambia de fase automáticamente
 *       y el estatus se actualiza para que C5/Dependencias vean el resultado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: persona_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estatus]
 *             properties:
 *               estatus:
 *                 type: string
 *                 enum: [ALTA OK, NO PUEDE SER DADO DE ALTA, PENDIENTE]
 *                 example: "ALTA OK"
 *               observaciones_c3:
 *                 type: string
 *                 example: "Cumple requisitos"
 *           examples:
 *             aprobar:
 *               summary: Aprobar persona
 *               value:
 *                 estatus: "ALTA OK"
 *                 observaciones_c3: "Aprobado, cumple requisitos"
 *             rechazar:
 *               summary: Rechazar persona
 *               value:
 *                 estatus: "NO PUEDE SER DADO DE ALTA"
 *                 observaciones_c3: "No cumple perfil requerido"
 *             pendiente:
 *               summary: Marcar como pendiente (rechazado)
 *               value:
 *                 estatus: "PENDIENTE"
 *                 observaciones_c3: "Documentación insuficiente, requiere revisión"
 *     responses:
 *       200:
 *         description: Dictamen registrado
 *       403:
 *         description: Solo validadores C3
 */
router.post('/persona/:persona_id/dictamen-c3',
  requireRole('validador_c3'),
  [
    body('estatus')
      .isIn(['ALTA OK', 'NO PUEDE SER DADO DE ALTA', 'PENDIENTE'])
      .withMessage('Estatus inválido'),
    body('observaciones_c3').optional().trim()
  ],
  validate,
  emitirDictamenPersonaC3
);

// ============================================
// NUEVAS RUTAS C5 - VISTA UNIFICADA DE PERSONAS
// ============================================

/**
 * @swagger
 * /api/tramites/alta/todas-personas-c5:
 *   get:
 *     tags: [Tramites Alta - C5]
 *     summary: Ver TODAS las personas (Vista unificada para C5)
 *     description: C5 ve una tabla con TODAS las personas de TODOS sus trámites, sin importar estatus. La tabla no filtra automáticamente, solo el botón refrescar actualiza los estatus visibles.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: busqueda
 *         schema: { type: string }
 *       - in: query
 *         name: fase_tramite
 *         schema: { type: string }
 *         description: Filtrar por fase del trámite
 *       - in: query
 *         name: estatus_persona
 *         schema: 
 *           type: string
 *           enum: [validado, rechazado, pendiente]
 *         description: Filtrar por estatus de la persona
 *     responses:
 *       200:
 *         description: Lista de todas las personas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       nombre_completo: { type: string }
 *                       numero_solicitud: { type: string }
 *                       tramite_fase: { type: string }
 *                       es_tramite_dependencia: { type: boolean }
 *                       puesto_original_nombre: { type: string }
 *                       estatus_descriptivo: { type: string, example: "Aprobado por C3" }
 *                       accion_disponible: { type: string, enum: [ver_rechazados, revision_requisitos, pendiente] }
 *                       observaciones_c3: { type: string }
 *                       validado: { type: boolean }
 *                       rechazado: { type: boolean }
 *                 total: { type: integer }
 *       403:
 *         description: Solo analistas C5
 */
router.get('/todas-personas-c5',
  requireRole('admin', 'super_admin', 'direccion', 'coordinador'),
  municipioFilterMiddleware,
  obtenerTodasLasPersonasC5
);

/**
 * @swagger
 * /api/tramites/alta/historial-c3:
 *   get:
 *     tags: [C3 - Validación]
 *     summary: Historial de trámites procesados por C3
 *     description: Obtiene todos los trámites que el validador C3 ya procesó (validados, rechazados). Para el tab "Enviados" del panel C3.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema: { type: string, format: date }
 *         description: Fecha inicio para filtrar
 *       - in: query
 *         name: fecha_fin
 *         schema: { type: string, format: date }
 *         description: Fecha fin para filtrar
 *       - in: query
 *         name: busqueda
 *         schema: { type: string }
 *         description: Buscar por número, municipio o dependencia
 *       - in: query
 *         name: dictamen
 *         schema: 
 *           type: string
 *           enum: [validado_c3, rechazado, rechazado_no_corresponde]
 *         description: Filtrar por tipo de dictamen
 *     responses:
 *       200:
 *         description: Lista de trámites procesados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       numero_solicitud: { type: string }
 *                       fase_actual: { type: string }
 *                       municipio_nombre: { type: string }
 *                       region_nombre: { type: string }
 *                       personas_stats:
 *                         type: object
 *                         properties:
 *                           total: { type: integer }
 *                           validadas: { type: integer }
 *                           rechazadas: { type: integer }
 *                 total: { type: integer }
 *       403:
 *         description: Solo validadores C3
 */
router.get('/historial-c3', 
  requireRole('validador_c3'), 
  obtenerHistorialC3
);

/**
 * @swagger
 * /api/tramites/alta/c3/{id}:
 *   get:
 *     tags: [C3 - Validación]
 *     summary: Ver detalle de solicitud para C3
 *     description: Obtiene todos los detalles de una solicitud incluyendo todas las personas agregadas, historial y datos completos. Solo para validadores C3.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: 
 *           type: integer
 *         description: ID del trámite a consultar
 *     responses:
 *       200:
 *         description: Detalles completos de la solicitud con personas e historial
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     numero_solicitud: { type: string, example: "ALTA-2026-000002" }
 *                     municipio_nombre: { type: string }
 *                     region_nombre: { type: string }
 *                     dependencia_nombre: { type: string }

 *                     analista_nombre: { type: string }
 *                     analista_extension: { type: string }
 *                     fase_actual: { type: string }
 *                     termino: { type: string }
 *                     observaciones: { type: string }
 *                     personas:
 *                       type: array
 *                       description: Todas las personas del trámite
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           nombre: { type: string }
 *                           apellido_paterno: { type: string }
 *                           apellido_materno: { type: string }
 *                           fecha_nacimiento: { type: string, format: date }
 *                           numero_oficio_c3: { type: string }
 *                           puesto_nombre: { type: string }
 *                           es_competencia_municipal: { type: boolean }
 *                           validado: { type: boolean }
 *                           rechazado: { type: boolean }
 *                           motivo_rechazo: { type: string }
 *                     historial:
 *                       type: array
 *                       description: Historial de cambios del trámite
 *                       items:
 *                         type: object
 *                         properties:
 *                           fase_anterior: { type: string }
 *                           fase_nueva: { type: string }
 *                           comentario: { type: string }
 *                           usuario_nombre: { type: string }
 *                           created_at: { type: string, format: date-time }
 *       403:
 *         description: Solo validadores C3 pueden acceder
 *       404:
 *         description: Solicitud no encontrada o no disponible para C3
 */
router.get('/c3/:id', 
  requireRole('validador_c3'), 
  obtenerSolicitudParaC3
);

// ============================================
// HISTÓRICO DE TRÁMITES NO PROCEDENTES
// ============================================

/**
 * @swagger
 * /api/tramites/alta/personas-rechazadas:
 *   get:
 *     summary: Historial de personas rechazadas (con paginación)
 *     tags: [📊 Historial y Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: fecha_fin
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: busqueda
 *         schema: { type: string }
 *       - in: query
 *         name: etapa_rechazo
 *         schema: { type: string, enum: [competencia, c5, c3] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 15 }
 *     responses:
 *       200:
 *         description: Lista paginada de personas rechazadas
 */
router.get('/personas-rechazadas',
  requireRole('analista', 'admin', 'super_admin', 'direccion'),
  obtenerPersonasRechazadas
);

/**
 * @swagger
 * /api/tramites/alta/personas-rechazadas/{persona_id}/motivo:
 *   put:
 *     summary: Actualizar motivo de rechazo
 *     tags: [📊 Historial y Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: persona_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [motivo_rechazo]
 *             properties:
 *               motivo_rechazo: { type: string, example: "Documentación incompleta" }
 *     responses:
 *       200:
 *         description: Motivo actualizado
 */
router.put('/personas-rechazadas/:persona_id/motivo',
  requireRole('analista', 'admin', 'super_admin'),
  actualizarMotivoRechazo
);

/**
 * @swagger
 * /api/tramites/alta/personas-rechazadas/{persona_id}/oficio:
 *   get:
 *     summary: Generar oficio de rechazo
 *     tags: [📊 Historial y Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: persona_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos del oficio de rechazo
 */
router.get('/personas-rechazadas/:persona_id/oficio',
  requireRole('analista', 'admin', 'super_admin'),
  generarOficioRechazo
);

/**
 * @swagger
 * /api/tramites/alta/rechazos-c3:
 *   get:
 *     summary: Obtener trámites con rechazos de C3 pendientes de revisión (Solo C5)
 *     tags: [C5 - Gestión de Trámites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: busqueda
 *         schema:
 *           type: string
 *         description: Búsqueda por número de solicitud, municipio o dependencia
 *     responses:
 *       200:
 *         description: Lista de trámites con personas rechazadas por C3
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       numero_solicitud:
 *                         type: string
 *                       fase_actual:
 *                         type: string
 *                         example: "rechazos_c3"
 *                       municipio_nombre:
 *                         type: string
 *                       dependencia_nombre:
 *                         type: string
 *                       validador_c3_nombre:
 *                         type: string
 *                       total_rechazadas:
 *                         type: integer
 *                         description: Cantidad de personas rechazadas por C3
 *                       personas:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             nombre:
 *                               type: string
 *                             puesto_nombre:
 *                               type: string
 *                             rechazado:
 *                               type: boolean
 *                             motivo_rechazo:
 *                               type: string
 *                             observaciones_c3:
 *                               type: string
 *                 total:
 *                   type: integer
 *                 message:
 *                   type: string
 *       403:
 *         description: Solo analistas C5
 */
router.get('/rechazos-c3',
  requireRole('analista'),
  obtenerPropuestasC3  // Reutilizamos el controlador, lo actualizaremos después
);

/**
 * @swagger
 * /api/tramites/alta/{id}:
 *   get:
 *     tags: [C5 - Gestión de Trámites]
 *     summary: Obtener detalles de una solicitud con historial
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Detalles de la solicitud
 *       404:
 *         description: Solicitud no encontrada
 */
router.get('/:id(\\d+)', 
  requireRole('analista', 'admin', 'super_admin'), 
  obtenerSolicitudPorId
);

router.delete('/:tramite_id(\\d+)/borrador',
  requireRole('analista', 'admin', 'super_admin'),
  eliminarBorradorNoEnviado
);

// ============================================
// PASO 2: VALIDACIÓN DE PERSONAL
// ============================================

/**
 * @swagger
 * /api/tramites/alta/{tramite_id}/personas:
 *   post:
 *     tags: [C5 - Gestión de Trámites]
 *     summary: PASO 2 - Agregar persona al trámite
 *     description: |
 *       Agrega una persona al trámite.
 *       
 *       **Para analistas C5:**
 *       - Solo puede agregar puestos de competencia municipal (POLICÍA MUNICIPAL, AUXILIAR, etc.)
 *       - Si intenta agregar un puesto NO municipal (CUSTODIO, MILITAR, GUARDIA NACIONAL, etc.) → Error 400
 *       
 *       **Para dependencias:**
 *       - Puede agregar cualquier puesto sin restricción
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tramite_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del trámite
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, apellido_paterno, fecha_nacimiento, numero_oficio_c3, puesto_id]
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Juan"
 *               apellido_paterno:
 *                 type: string
 *                 example: "Pérez"
 *               apellido_materno:
 *                 type: string
 *                 example: "García"
 *               fecha_nacimiento:
 *                 type: string
 *                 format: date
 *                 example: "1990-05-15"
 *               numero_oficio_c3:
 *                 type: string
 *                 example: "CECSNSP/DGCECC/0633/2025"
 *               puesto_id:
 *                 type: integer
 *                 example: 1
 *                 description: ID del puesto (ver catálogo de puestos)
 *     responses:
 *       201:
 *         description: Persona agregada correctamente
 *       400:
 *         description: |
 *           Error - Puesto no válido para C5.
 *           Ejemplo: "NO CORRESPONDE A COMPETENCIA MUNICIPAL: El puesto 'CUSTODIO' no puede ser dado de alta por C5"
 *       403:
 *         description: Solo analistas C5 o dependencias
 */
router.post('/:tramite_id/personas',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('nombre').notEmpty().withMessage('El nombre es requerido'),
    body('apellido_paterno').notEmpty().withMessage('El apellido paterno es requerido'),
    body('fecha_nacimiento').notEmpty().isDate().withMessage('Fecha de nacimiento inválida'),
    body('numero_oficio_c3').notEmpty().withMessage('El número de oficio C3 es requerido'),
    body('puesto_id').notEmpty().isInt().withMessage('El puesto es requerido')
  ],
  validate,
  agregarPersona
);

/**
 * @swagger
 * /api/tramites/alta/{tramite_id}/personas:
 *   get:
 *     tags: [C5 - Gestión de Trámites]
 *     summary: PASO 2 - Obtener personas del trámite
 *     description: Lista todas las personas agregadas a un trámite con su estado de validación
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tramite_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de personas
 */
router.get('/:tramite_id/personas',
  requireRole('analista', 'admin', 'super_admin'),
  obtenerPersonasPorTramite
);

router.put('/persona/:persona_id',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body().custom((_, { req }) => {
      const campos = ['nombre', 'apellido_paterno', 'apellido_materno', 'fecha_nacimiento', 'numero_oficio_c3', 'puesto_id'];
      const tieneCampo = campos.some((campo) => req.body?.[campo] !== undefined);
      if (!tieneCampo) {
        throw new Error('Debes enviar al menos un campo para actualizar');
      }
      return true;
    }),
    body('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacío'),
    body('apellido_paterno').optional().notEmpty().withMessage('El apellido paterno no puede estar vacío'),
    body('fecha_nacimiento').optional().isDate().withMessage('Fecha de nacimiento inválida'),
    body('numero_oficio_c3').optional().notEmpty().withMessage('El número de oficio C3 no puede estar vacío'),
    body('puesto_id').optional().isInt().withMessage('El puesto debe ser un número')
  ],
  validate,
  editarPersona
);

/**
 * @swagger
 * /api/tramites/alta/persona/{persona_id}/validar:
 *   put:
 *     tags: [C5 - Gestión de Trámites]
 *     summary: PASO 2 - Validar persona
 *     description: Marca una persona como validada (aprobada)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: persona_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Persona validada
 *       403:
 *         description: Solo analistas C5
 */
router.put('/persona/:persona_id/validar',
  requireRole('analista', 'admin', 'super_admin'),
  validarPersona
);

/**
 * @swagger
 * /api/tramites/alta/persona/{persona_id}/rechazar:
 *   put:
 *     tags: [C5 - Gestión de Trámites]
 *     summary: PASO 2 - Rechazar persona
 *     description: Rechaza una persona con un motivo específico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: persona_id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [motivo_rechazo]
 *             properties:
 *               motivo_rechazo:
 *                 type: string
 *                 example: "Documentación incompleta"
 *     responses:
 *       200:
 *         description: Persona rechazada
 *       403:
 *         description: Solo analistas C5
 */
router.put('/persona/:persona_id/rechazar',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('motivo_rechazo').notEmpty().withMessage('El motivo de rechazo es requerido')
  ],
  validate,
  rechazarPersona
);

// ============================================
// PASO 3: ENVÍO A C3 Y DICTAMEN
// ============================================

/**
 * @swagger
 * /api/tramites/alta/enviar-a-c3:
 *   post:
 *     tags: [C5 - Gestión de Trámites]
 *     summary: Enviar solicitud a C3 para dictamen
 *     description: El analista C5 envía la solicitud a C3 después de completar PASO 1 o PASO 2
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tramite_id]
 *             properties:
 *               tramite_id:
 *                 type: integer
 *                 example: 1
 *                 description: ID del trámite a enviar
 *     responses:
 *       200:
 *         description: Solicitud enviada a C3 exitosamente
 *       404:
 *         description: Trámite no encontrado
 *       403:
 *         description: Sin permisos
 */
router.post('/enviar-a-c3',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('tramite_id')
      .notEmpty().withMessage('El ID del trámite es requerido')
      .isInt().withMessage('El ID debe ser un número')
  ],
  validate,
  enviarSolicitudAC3
);

// ═══════════════════════════════════════════════════════════════
// RUTA DEPRECADA: decision-final-c5 - Ya no es necesaria
// El flujo ahora es: C5 agrega persona → envía a C3 → C3 dictamina → FIN
// No hay "segundo filtro" de competencia ni cambio de puesto
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/tramites/alta/debug/{tramite_id}:
 *   get:
 *     summary: DEBUG - Ver estado de dictámenes
 *     tags: [DEBUG]
 *     parameters:
 *       - in: path
 *         name: tramite_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estado del trámite
 */
router.get('/debug/:tramite_id', authMiddleware, debugTramiteEstado);

// ============================================
// REVISIÓN DE REQUISITOS
// ============================================

// Obtener personas pendientes de revisión (aprobadas C3, sin iniciar)
router.get('/revision/pendientes',
  requireRole('analista', 'admin', 'super_admin'),
  obtenerPendientesRevision
);

// Obtener personas en proceso de revisión (borradores / "En Proceso")
router.get('/revision/en-proceso',
  requireRole('analista', 'admin', 'super_admin', 'direccion'),
  obtenerEnProcesoRevision
);

// Iniciar revisión de requisitos para una persona
router.post('/revision/:persona_id/iniciar',
  requireRole('analista', 'admin', 'super_admin'),
  iniciarRevision
);

// Obtener detalle de persona en revisión
router.get('/revision/:persona_id',
  requireRole('analista', 'admin', 'super_admin'),
  obtenerDetalleRevision
);

// Guardar antecedentes (RNPSP + SUIC)
router.put('/revision/:persona_id/antecedentes',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('resultado_rnpsp').isIn(['sin_antecedentes', 'con_antecedentes']).withMessage('Resultado RNPSP inválido'),
    body('resultado_suic').isIn(['sin_antecedentes', 'con_antecedentes']).withMessage('Resultado SUIC inválido'),
    body('justificacion_rnpsp').optional().trim(),
    body('justificacion_antecedentes').optional().trim()
  ],
  validate,
  guardarAntecedentes
);

// Validar/rechazar un documento individual
router.put('/revision/:persona_id/documento',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('clave').notEmpty().withMessage('La clave del documento es requerida'),
    body('validado').isBoolean().withMessage('El campo validado debe ser booleano')
  ],
  validate,
  validarDocumentoRevision
);

// Validar todos los documentos
router.put('/revision/:persona_id/validar-todos',
  requireRole('analista', 'admin', 'super_admin'),
  validarTodosDocumentos
);

// Completar revisión de requisitos
router.post('/revision/:persona_id/completar',
  requireRole('analista', 'admin', 'super_admin'),
  completarRevision
);

// Rechazar persona en revisión
router.post('/revision/:persona_id/rechazar',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('motivo').notEmpty().withMessage('El motivo de rechazo es obligatorio')
  ],
  validate,
  rechazarEnRevision
);

// ══════════════════════════════════════════════════════════
// VALIDACIÓN CUIP
// ══════════════════════════════════════════════════════════

// Lista pendientes CUIP
router.get('/cuip/pendientes',
  requireRole('analista', 'admin', 'super_admin'),
  obtenerPendientesCuip
);

// Lista en proceso CUIP
router.get('/cuip/en-proceso',
  requireRole('analista', 'admin', 'super_admin', 'direccion'),
  obtenerEnProcesoCuip
);

// Iniciar validación CUIP
router.post('/cuip/:persona_id/iniciar',
  requireRole('analista', 'admin', 'super_admin'),
  iniciarCuip
);

// Detalle persona CUIP
router.get('/cuip/:persona_id',
  requireRole('analista', 'admin', 'super_admin'),
  obtenerDetalleCuip
);

// Validar campo individual
router.put('/cuip/:persona_id/campo',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('seccion_clave').notEmpty().withMessage('La clave de sección es obligatoria'),
    body('campo_num').isInt().withMessage('El número de campo es obligatorio'),
    body('validado').optional({ nullable: true }).isBoolean().withMessage('El campo validado debe ser booleano o null')
  ],
  validate,
  validarCampoCuip
);

// Validar sección completa
router.put('/cuip/:persona_id/seccion',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('seccion_clave').notEmpty().withMessage('La clave de sección es obligatoria')
  ],
  validate,
  validarSeccionCuip
);

// Marcar excepción NINGUNO
router.put('/cuip/:persona_id/excepcion',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('seccion_clave').notEmpty().withMessage('La clave de sección es obligatoria'),
    body('activa').isBoolean().withMessage('El campo activa debe ser booleano')
  ],
  validate,
  marcarExcepcionCuip
);

// Validar todo el CUIP
router.put('/cuip/:persona_id/validar-todo',
  requireRole('analista', 'admin', 'super_admin'),
  validarTodoCuip
);

// Completar validación CUIP
router.post('/cuip/:persona_id/completar',
  requireRole('analista', 'admin', 'super_admin'),
  completarCuip
);

// Rechazar en CUIP
router.post('/cuip/:persona_id/rechazar',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('motivo').notEmpty().withMessage('El motivo de rechazo es obligatorio')
  ],
  validate,
  rechazarEnCuip
);

// Aprobar CUIP y generar cita biométrica
router.post('/cuip/:persona_id/aprobar-cita',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('fecha_cita')
      .notEmpty().withMessage('La fecha y hora de la cita son obligatorias')
      .isISO8601().withMessage('La fecha de cita debe ser una fecha válida'),
    body('lugar').optional().trim(),
    body('notas').optional().trim(),
    body('enviar_notificacion')
      .optional()
      .isBoolean().withMessage('El campo enviar_notificacion debe ser booleano'),
    body('email_override')
      .optional()
      .isEmail().withMessage('El correo de prueba debe ser una dirección válida')
  ],
  validate,
  aprobarYGenerarCita
);

// ============================================
// HISTORIAL DE CITAS
// ============================================

// Estadísticas de citas (debe ir antes de /citas para no conflictar)
router.get('/citas/stats',
  requireRole('analista', 'admin', 'super_admin', 'direccion'),
  getEstadisticasCitas
);

// Listar citas con filtros
router.get('/citas',
  requireRole('analista', 'admin', 'super_admin', 'direccion'),
  listarCitas
);

// Actualizar estado de cita
router.patch('/citas/:id/estado',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('estado')
      .notEmpty().withMessage('El estado es obligatorio')
      .isIn(['programada', 'completada', 'cancelada', 'reprogramada']).withMessage('Estado inválido')
  ],
  validate,
  actualizarEstadoCita
);

router.get('/citas/:id/bitacora',
  requireRole('analista', 'admin', 'super_admin', 'direccion'),
  obtenerBitacoraCita
);

router.patch('/citas/:id/reprogramar',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('fecha_cita').notEmpty().isISO8601().withMessage('La nueva fecha/hora es obligatoria'),
    body('justificacion').notEmpty().isLength({ min: 10 }).withMessage('La justificación debe tener al menos 10 caracteres'),
    body('lugar').optional().trim(),
    body('notas').optional().trim()
  ],
  validate,
  reprogramarCita
);

router.patch('/citas/:id/cancelar',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('motivo').optional().trim()
  ],
  validate,
  cancelarCita
);

router.patch('/citas/:id/finalizar-flujo',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('asistio').isBoolean().withMessage('El campo asistio debe ser booleano'),
    body('sim_sin_antecedentes').optional().isBoolean().withMessage('El campo sim_sin_antecedentes debe ser booleano'),
    body('suim_resultado')
      .optional()
      .isIn(['sin_antecedentes', 'antecedentes_menores', 'antecedentes_graves'])
      .withMessage('El campo suim_resultado es inválido'),
    body('justificacion').optional().trim(),
    body('cuip_capturado').optional().trim()
  ],
  validate,
  finalizarFlujoCita
);

router.get('/finalizados',
  requireRole('analista', 'admin', 'super_admin', 'direccion'),
  listarFinalizados
);

router.patch('/finalizados/:id/fase1',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('fase1_estado')
      .notEmpty().withMessage('El estado de Fase 1 es obligatorio')
      .isIn(['pendiente', 'en_revision', 'rechazado', 'firmado']).withMessage('Estado de Fase 1 invalido')
  ],
  validate,
  actualizarFase1Finalizado
);

router.post('/finalizados/:id/acuse',
  requireRole('analista', 'admin', 'super_admin'),
  uploadAcuse.single('file'),
  subirAcuseFinalizado
);

router.post('/finalizados/:id/acuse-persona',
  requireRole('analista', 'admin', 'super_admin'),
  uploadAcuse.single('file'),
  subirAcusePersonaFinalizado
);

router.get('/finalizados/:id/constancia/view',
  requireRole('analista', 'admin', 'super_admin', 'direccion'),
  verConstanciaFinalizado
);

router.get('/finalizados/:id/acuse/view',
  requireRole('analista', 'admin', 'super_admin', 'direccion'),
  verAcusePersonaFinalizado
);

router.delete('/finalizados/:id/acuse',
  requireRole('analista', 'admin', 'super_admin'),
  eliminarAcuseFinalizado
);

router.delete('/finalizados/:id/acuse-persona',
  requireRole('analista', 'admin', 'super_admin'),
  eliminarAcusePersonaFinalizado
);

router.get('/bajas/catalogo',
  requireRole('analista', 'admin', 'super_admin'),
  obtenerCatalogoBajas
);

router.get('/bajas/disponibles',
  requireRole('analista', 'admin', 'super_admin'),
  municipioFilterMiddleware,
  listarDisponiblesBaja
);

router.get('/bajas',
  requireRole('analista', 'admin', 'super_admin', 'direccion'),
  municipioFilterMiddleware,
  listarBajasRegistradas
);

router.post('/bajas/registrar',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('finalizado_id').isInt().withMessage('El finalizado_id es requerido'),
    body('tipo_baja').notEmpty().withMessage('El tipo de baja es requerido'),
    body('motivo_baja').notEmpty().withMessage('El motivo de baja es requerido'),
    body('fecha_baja').optional().isISO8601().withMessage('La fecha de baja debe tener formato YYYY-MM-DD'),
    body('numero_oficio_municipio').optional().isString().withMessage('Numero de oficio del municipio invalido'),
    body('observaciones').optional().isString().withMessage('Observaciones inválidas')
  ],
  validate,
  registrarBaja
);

router.get('/bajas/editables',
  requireRole('analista', 'admin', 'super_admin', 'direccion'),
  listarBajasEditables
);

router.post('/bajas/editables',
  requireRole('analista', 'admin', 'super_admin'),
  [
    body('nombre_elemento').notEmpty().withMessage('El nombre es requerido'),
    body('apellido_paterno').notEmpty().withMessage('El apellido paterno es requerido'),
    body('apellido_materno').optional().isString().withMessage('Apellido materno invalido'),
    body('municipio_nombre').notEmpty().withMessage('El municipio es requerido'),
    body('cuip').optional().isString().withMessage('CUIP invalido'),
    body('tipo_baja').notEmpty().withMessage('El tipo de baja es requerido'),
    body('motivo_baja').notEmpty().withMessage('El motivo de baja es requerido'),
    body('fecha_baja').notEmpty().withMessage('La fecha de baja es requerida').isISO8601().withMessage('La fecha de baja debe tener formato YYYY-MM-DD'),
    body('observaciones').optional().isString().withMessage('Observaciones invalidas')
  ],
  validate,
  crearBajaEditable
);

router.put('/bajas/editables/:id',
  requireRole('analista', 'admin', 'super_admin'),
  [
    param('id').isInt().withMessage('El id debe ser numerico'),
    body('nombre_elemento').notEmpty().withMessage('El nombre es requerido'),
    body('apellido_paterno').notEmpty().withMessage('El apellido paterno es requerido'),
    body('apellido_materno').optional().isString().withMessage('Apellido materno invalido'),
    body('municipio_nombre').notEmpty().withMessage('El municipio es requerido'),
    body('cuip').optional().isString().withMessage('CUIP invalido'),
    body('tipo_baja').notEmpty().withMessage('El tipo de baja es requerido'),
    body('motivo_baja').notEmpty().withMessage('El motivo de baja es requerido'),
    body('fecha_baja').notEmpty().withMessage('La fecha de baja es requerida').isISO8601().withMessage('La fecha de baja debe tener formato YYYY-MM-DD'),
    body('observaciones').optional().isString().withMessage('Observaciones invalidas')
  ],
  validate,
  editarBajaEditable
);

router.delete('/bajas/editables/:id',
  requireRole('analista', 'admin', 'super_admin'),
  [param('id').isInt().withMessage('El id debe ser numerico')],
  validate,
  eliminarBajaEditable
);

router.get('/consulta/municipios',
  requireRole('analista', 'admin', 'super_admin', 'dependencia', 'direccion'),
  listarMunicipiosConsulta
);

router.get('/consulta/municipios/:municipioId/personas',
  requireRole('analista', 'admin', 'super_admin', 'dependencia', 'direccion'),
  listarPersonasConsultaPorMunicipio
);

router.get('/consulta/municipios/:municipioId/personas/exportar',
  requireRole('analista', 'admin', 'super_admin', 'dependencia', 'direccion'),
  exportarExcelConsultaMunicipio
);

export default router;
