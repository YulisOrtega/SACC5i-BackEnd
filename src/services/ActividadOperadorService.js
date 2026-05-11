import pool from '../config/database.js';

const ActividadOperadorService = {
  async registrar({ userId, userRole, modulo, accion, entidad, entidadId = null, descripcion = '', metadata = null }) {
    if (!userId) return;

    // El requerimiento funcional está enfocado en operador CCP.
    if (userRole !== 'operador_ccp') return;

    try {
      await pool.query(
        `INSERT INTO historial_operador_ccp
         (usuario_id, usuario_rol, modulo, accion, entidad, entidad_id, descripcion, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          userRole,
          modulo,
          accion,
          entidad,
          entidadId,
          descripcion,
          metadata ? JSON.stringify(metadata) : null
        ]
      );
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE') {
        // Evita caída del flujo si la migración aún no se aplicó.
        return;
      }
      throw error;
    }
  },

  async obtenerPorUsuario({ userId, pagina = 1, limit = 20 }) {
    const parsedPage = Math.max(1, Number(pagina) || 1);
    const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (parsedPage - 1) * parsedLimit;

    try {
      const [[{ total }]] = await pool.query(
        'SELECT COUNT(*) AS total FROM historial_operador_ccp WHERE usuario_id = ?',
        [userId]
      );

      const [rows] = await pool.query(
        `SELECT id, usuario_id, usuario_rol, modulo, accion, entidad, entidad_id, descripcion, metadata_json, created_at
         FROM historial_operador_ccp
         WHERE usuario_id = ?
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
        [userId, parsedLimit, offset]
      );

      return {
        data: rows,
        total,
        pagina: parsedPage,
        totalPaginas: Math.max(1, Math.ceil(total / parsedLimit))
      };
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE') {
        return {
          data: [],
          total: 0,
          pagina: parsedPage,
          totalPaginas: 1
        };
      }
      throw error;
    }
  }
};

export default ActividadOperadorService;
