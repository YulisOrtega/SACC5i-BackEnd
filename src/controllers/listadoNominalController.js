import pool from '../config/database.js';
import path from 'path';
import fs from 'fs';

export const obtenerListados = async (req, res) => {
  try {
    const { busqueda = '' } = req.query;
    const cleanSearch = `%${busqueda.trim()}%`;
    const userRole = req.userRole; // Extraído de tu token
    const regionId = req.regionId;

    let query = `
      SELECT 
        ln.id, 
        ln.archivo_nombre, 
        ln.estado, 
        ln.created_at,
        m.nombre AS municipio_nombre,
        u.nombre_completo AS subido_por
      FROM listados_nominales ln
      INNER JOIN municipios m ON ln.municipio_id = m.id
      INNER JOIN usuarios u ON ln.usuario_id = u.id
      WHERE (? = '%%' OR m.nombre LIKE ?)
    `;
    const params = [cleanSearch, cleanSearch];

    // 🔥 FILTRO CLAVE: Si no es admin, solo ve los de su región
    if (userRole !== 'admin' && userRole !== 'super_admin' && regionId) {
      query += ` AND m.region_id = ?`;
      params.push(regionId);
    }

    query += ` ORDER BY ln.created_at DESC`;

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al obtener listados nominales:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

export const subirListado = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { municipio_id } = req.body;
    const usuario_id = req.userId; // Viene de tu middleware de autenticación
    const archivo = req.file; 

    if (!municipio_id || !archivo) {
      return res.status(400).json({ success: false, message: 'Faltan datos o el archivo' });
    }

    await connection.beginTransaction();

    // LÓGICA CLAVE: Pasar el listado anterior a estado 'ANTERIOR'
    await connection.query(`
      UPDATE listados_nominales 
      SET estado = 'ANTERIOR' 
      WHERE municipio_id = ? AND estado = 'VIGENTE'
    `, [municipio_id]);

    // Insertar el nuevo como 'VIGENTE'
    const rutaRelativa = `uploads/listados/${archivo.filename}`;
    await connection.query(`
      INSERT INTO listados_nominales (municipio_id, usuario_id, archivo_nombre, archivo_ruta, estado)
      VALUES (?, ?, ?, ?, 'VIGENTE')
    `, [municipio_id, usuario_id, archivo.originalname, rutaRelativa]);

    await connection.commit();
    res.json({ success: true, message: 'Listado nominal subido correctamente' });

  } catch (error) {
    await connection.rollback();
    console.error('Error al subir listado:', error);
    res.status(500).json({ success: false, message: 'Error al guardar el archivo' });
  } finally {
    connection.release();
  }
};

export const descargarListado = async (req, res) => {
  try {
    const { id } = req.params;
    const [[listado]] = await pool.query('SELECT archivo_ruta, archivo_nombre FROM listados_nominales WHERE id = ?', [id]);

    if (!listado) {
      return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
    }

    // Ajusta esta ruta base según cómo tengas configurado tu servidor
    const filePath = path.join(process.cwd(), listado.archivo_ruta); 

    if (fs.existsSync(filePath)) {
      res.download(filePath, listado.archivo_nombre);
    } else {
      res.status(404).json({ success: false, message: 'El archivo físico no existe en el servidor' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};