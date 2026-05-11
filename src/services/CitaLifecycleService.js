import pool from '../config/database.js';

const CITA_LIMITE_MINUTOS = Number(process.env.CITA_LIMITE_MINUTOS || 180);

class CitaLifecycleService {
  async actualizarInasistencias(connection = null) {
    const conn = connection || await pool.getConnection();
    const ownConnection = !connection;

    try {
      const [result] = await conn.query(
        `UPDATE citas_biometricas
         SET estado = 'cancelada', updated_at = NOW()
         WHERE estado = 'programada'
           AND DATE(fecha_cita) < CURDATE()`,
        []
      );
      return result.affectedRows || 0;
    } finally {
      if (ownConnection) conn.release();
    }
  }

  enriquecerCitaEstadoTemporal(cita) {
    if (!cita?.fecha_cita) {
      return {
        ...cita,
        es_dia_cita: false,
        esta_vencida: false,
        limite_minutos: CITA_LIMITE_MINUTOS
      };
    }

    const ahora = new Date();
    const fechaCita = new Date(cita.fecha_cita);

    const mismoDia =
      ahora.getFullYear() === fechaCita.getFullYear() &&
      ahora.getMonth() === fechaCita.getMonth() &&
      ahora.getDate() === fechaCita.getDate();

    const diffMinutos = Math.floor((ahora.getTime() - fechaCita.getTime()) / 60000);
    const hoyLocal = new Date();
    hoyLocal.setHours(0, 0, 0, 0);
    const fechaSoloDia = new Date(fechaCita);
    fechaSoloDia.setHours(0, 0, 0, 0);
    const estaVencida = cita.estado === 'programada' && fechaSoloDia < hoyLocal;

    return {
      ...cita,
      es_dia_cita: mismoDia,
      esta_vencida: estaVencida,
      limite_minutos: CITA_LIMITE_MINUTOS
    };
  }
}

export default new CitaLifecycleService();
