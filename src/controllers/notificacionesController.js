import NotificacionService from '../services/NotificacionService.js';

const obtenerUsuarioId = (req) => {
  return (
    req.user?.id ||
    req.usuario?.id ||
    req.userId ||
    req.usuarioId ||
    req.user?.usuario_id ||
    req.usuario?.usuario_id ||
    req.query.usuario_id
  );
};

class NotificacionesController {
  async listar(req, res, next) {
    try {
      const usuarioId = obtenerUsuarioId(req);

      if (!usuarioId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const limit = req.query.limit || 20;

      const [notificaciones, noLeidas] = await Promise.all([
        NotificacionService.obtenerPorUsuario(usuarioId, limit),
        NotificacionService.contarNoLeidas(usuarioId)
      ]);

      return res.json({
        success: true,
        data: {
          notificaciones,
          no_leidas: noLeidas
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async marcarLeida(req, res, next) {
    try {
      const usuarioId = obtenerUsuarioId(req);

      if (!usuarioId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      await NotificacionService.marcarLeida(req.params.id, usuarioId);

      return res.json({
        success: true,
        message: 'Notificación marcada como leída'
      });
    } catch (error) {
      next(error);
    }
  }

  async marcarTodasLeidas(req, res, next) {
    try {
      const usuarioId = obtenerUsuarioId(req);

      if (!usuarioId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      await NotificacionService.marcarTodasLeidas(usuarioId);

      return res.json({
        success: true,
        message: 'Notificaciones marcadas como leídas'
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new NotificacionesController();