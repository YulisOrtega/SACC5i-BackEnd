import pool from '../config/database.js';

// Middleware para verificar roles específicos
export const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const connection = await pool.getConnection();
      
      const [users] = await connection.query(
        'SELECT rol FROM usuarios WHERE id = ?',
        [req.userId]
      );
      
      connection.release();

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      const userRole = users[0].rol;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para realizar esta acción'
        });
      }

      req.userRole = userRole;
      next();
    } catch (error) {
      console.error('Error al verificar rol:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos',
        error: error.message
      });
    }
  };
};

// Middleware solo para Super Admin
export const requireSuperAdmin = requireRole('super_admin');

// Middleware para Admin y Super Admin
export const requireAdmin = requireRole('super_admin', 'admin');

// Middleware para todos los roles autenticados
export const requireAnyRole = requireRole(
  'super_admin',
  'admin',
  'direccion',
  'analista',
  'validador_c3',
  'dependencia',
  'operador_ccp'
);
