import { body } from 'express-validator';

export const createSolicitudValidation = [
  body('tipo_documento')
    .optional()
    .isIn(['Oficio', 'Volante', 'Folio']).withMessage('El tipo de documento debe ser Oficio, Volante o Folio'),
  
  body('tipo_oficio_id')
    .notEmpty().withMessage('El tipo de oficio es requerido')
    .isInt().withMessage('El tipo de oficio debe ser un número'),
  
  body('municipio_id')
    .notEmpty().withMessage('El municipio es requerido')
    .isInt().withMessage('El municipio debe ser un número'),
  
  body('dependencia')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('La dependencia no puede exceder 255 caracteres'),
  
  body('proceso_movimiento')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('El proceso/movimiento no puede exceder 255 caracteres'),
  
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

export const updateSolicitudValidation = [
  body('tipo_oficio_id')
    .optional()
    .isInt().withMessage('El tipo de oficio debe ser un número'),
  
  body('municipio_id')
    .optional()
    .isInt().withMessage('El municipio debe ser un número'),
  
  body('dependencia')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('La dependencia no puede exceder 255 caracteres'),
  
  body('proceso_movimiento')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('El proceso/movimiento no puede exceder 255 caracteres'),
  
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
  
  body('observaciones')
    .optional()
    .trim()
];

export const updateEstatusValidation = [
  body('estatus_id')
    .notEmpty().withMessage('El estatus es requerido')
    .isInt().withMessage('El estatus debe ser un número'),
  
  body('comentario')
    .optional()
    .trim()
];
