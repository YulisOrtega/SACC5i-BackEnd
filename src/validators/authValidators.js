import { body } from 'express-validator';

export const registerValidation = [
  body('nombre_completo')
    .trim()
    .notEmpty().withMessage('El nombre completo es requerido')
    .isLength({ min: 3, max: 150 }).withMessage('El nombre debe tener entre 3 y 150 caracteres'),
  
  body('usuario')
    .trim()
    .notEmpty().withMessage('El usuario es requerido')
    .isLength({ min: 3, max: 50 }).withMessage('El usuario debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('El usuario solo puede contener letras, números y guiones bajos'),
  
  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  
  body('fecha_nacimiento')
    .optional()
    .isDate().withMessage('Fecha de nacimiento inválida'),
  
  body('region')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('La región no puede exceder 100 caracteres'),
  
  body('extension')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('La extensión no puede exceder 20 caracteres')
];

export const loginValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('El usuario es requerido'),
  
  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
];

export const updateProfileValidation = [
  body('nombre_completo')
    .optional()
    .trim()
    .isLength({ min: 3, max: 150 }).withMessage('El nombre completo debe tener entre 3 y 150 caracteres'),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Debe proporcionar un correo electrónico válido')
    .normalizeEmail(),

  body('extension')
    .not()
    .exists()
    .withMessage('La extensión solo puede ser modificada por un administrador')
];

export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('La contraseña actual es requerida'),
  
  body('newPassword')
    .notEmpty().withMessage('La nueva contraseña es requerida')
    .isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
];
