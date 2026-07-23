import pool from '../config/database.js';

class NotificacionService {
  async crearRespuestaC3({ connection, persona, dictamen }) {
    if (!connection) {
      throw new Error('Se requiere una conexión activa para crear la notificación');
    }

    if (!persona?.usuario_analista_c5_id) {
      return null;
    }

    const nombreCompleto = [
      persona.nombre,
      persona.apellido_paterno,
      persona.apellido_materno
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    const titulo = 'C3 respondió una solicitud de alta';
    const mensaje = `Se dio respuesta al trámite de ${nombreCompleto || 'una persona'}.`;
    const url = `/dashboard/alta?solicitud=${persona.tramite_alta_id}&persona=${persona.id}`;

    const dataJson = JSON.stringify({
      dictamen,
      persona_id: persona.id,
      tramite_alta_id: persona.tramite_alta_id,
      numero_solicitud: persona.numero_solicitud || null,
      nombre_completo: nombreCompleto || null
    });

    const [result] = await connection.query(
      `
      INSERT INTO notificaciones (
        usuario_id,
        titulo,
        mensaje,
        tipo,
        referencia_tipo,
        referencia_id,
        persona_id,
        url,
        data_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        persona.usuario_analista_c5_id,
        titulo,
        mensaje,
        'respuesta_c3',
        'tramite_alta',
        persona.tramite_alta_id,
        persona.id,
        url,
        dataJson
      ]
    );

    return {
      id: result.insertId,
      usuario_id: persona.usuario_analista_c5_id,
      titulo,
      mensaje,
      tipo: 'respuesta_c3',
      url
    };
  }

  async obtenerPorUsuario(usuarioId, limit = 20) {
    const [rows] = await pool.query(
      `
      SELECT 
        id,
        usuario_id,
        titulo,
        mensaje,
        tipo,
        referencia_tipo,
        referencia_id,
        persona_id,
        url,
        data_json,
        leida,
        created_at,
        read_at
      FROM notificaciones
      WHERE usuario_id = ?
      ORDER BY created_at DESC
      LIMIT ?
      `,
      [Number(usuarioId), Number(limit)]
    );

    return rows;
  }

  async contarNoLeidas(usuarioId) {
    const [rows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM notificaciones
      WHERE usuario_id = ?
        AND leida = 0
      `,
      [Number(usuarioId)]
    );

    return rows[0]?.total || 0;
  }

  async marcarLeida(notificacionId, usuarioId) {
    await pool.query(
      `
      UPDATE notificaciones
      SET leida = 1,
          read_at = NOW()
      WHERE id = ?
        AND usuario_id = ?
      `,
      [Number(notificacionId), Number(usuarioId)]
    );

    return { success: true };
  }

  async marcarTodasLeidas(usuarioId) {
    await pool.query(
      `
      UPDATE notificaciones
      SET leida = 1,
          read_at = NOW()
      WHERE usuario_id = ?
        AND leida = 0
      `,
      [Number(usuarioId)]
    );

    return { success: true };
  }
}

export default new NotificacionService();