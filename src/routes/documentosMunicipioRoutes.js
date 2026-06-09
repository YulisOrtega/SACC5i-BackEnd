import express from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';
import pool from '../config/database.js'; 
import jwt from 'jsonwebtoken';

const router = express.Router();
const upload = multer({ dest: 'uploads/municipios/' }); 

router.use(authMiddleware);

// ==========================================
// FUNCIÓN DEFINITIVA (BLINDADA CONTRA ERRORES)
// ==========================================
const rastrearInfo = async (req) => {
    let token_user_id = null;
    
    // 1. Extraemos el token con cuidado (Optional Chaining)
    const authHeader = req?.headers?.authorization;
    const tokenCrudo = authHeader ? authHeader.split(' ')[1] : null;

    if (tokenCrudo) {
        // Lo desencriptamos nosotros mismos
        const payload = jwt.decode(tokenCrudo);
        if (payload) {
            token_user_id = payload.id || payload.usuario_id || payload.id_usuario;
        }
    }

    if (token_user_id) {
        const [uDb] = await pool.query('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [token_user_id]);
        
        if (uDb.length > 0) {
            let dbUser = uDb[0];
            
            // Si ya tiene su municipio, lo regresamos
            if (dbUser.municipio_id) return { municipio_id: dbUser.municipio_id, usuario_id: dbUser.id };
            
            // Si no lo tiene, lo buscamos y reparamos la tabla
            let nombreString = (dbUser.usuario || dbUser.nombre_completo || '').toLowerCase();
            let nombreLimpio = nombreString.replace('mun_', '').replace('municipio de ', '').replace('municipio ', '').replace(/_/g, ' ').trim();
            let clave = nombreLimpio.substring(0, 4);
            
            if (clave.length >= 3) {
                const [mDb] = await pool.query('SELECT id FROM municipios WHERE nombre LIKE ? LIMIT 1', [`%${clave}%`]);
                if (mDb.length > 0) {
                    await pool.query('UPDATE usuarios SET municipio_id = ? WHERE id = ?', [mDb[0].id, dbUser.id]);
                    return { municipio_id: mDb[0].id, usuario_id: dbUser.id };
                }
            }
        }
    }

    // Último recurso
    const [fallbackUser] = await pool.query("SELECT id FROM usuarios LIMIT 1");
    const [fallbackMuni] = await pool.query("SELECT id FROM municipios LIMIT 1");
    
    return { 
        municipio_id: fallbackMuni.length > 0 ? fallbackMuni[0].id : 1, 
        usuario_id: fallbackUser.length > 0 ? fallbackUser[0].id : 1 
    };
};

const obtenerRegionDelAnalista = async (req) => {
  const usuarioActivo = req.usuario || req.user || {};
  let usuarioId = usuarioActivo.id || req.userId || null;

  if (!usuarioId) {
    const authHeader = req?.headers?.authorization;
    const tokenCrudo = authHeader ? authHeader.split(' ')[1] : null;

    if (tokenCrudo) {
      const payload = jwt.decode(tokenCrudo);
      usuarioId = payload?.id || payload?.usuario_id || payload?.id_usuario || null;
    }
  }

  if (!usuarioId) {
    throw new Error('No se pudo identificar al usuario analista');
  }

  const [usuarios] = await pool.query(
    `
    SELECT id, rol, region_id
    FROM usuarios
    WHERE id = ?
    LIMIT 1
    `,
    [usuarioId]
  );

  if (usuarios.length === 0) {
    throw new Error('Usuario no encontrado');
  }

  const usuario = usuarios[0];
  const rol = String(usuario.rol || '').toLowerCase();

  if (['admin', 'super_admin', 'direccion'].includes(rol)) {
    return {
      filtrarPorRegion: false,
      region_id: null
    };
  }

  if (rol === 'analista') {
    if (!usuario.region_id) {
      throw new Error('El analista no tiene una región asignada');
    }

    return {
      filtrarPorRegion: true,
      region_id: usuario.region_id
    };
  }

  return {
    filtrarPorRegion: false,
    region_id: null
  };
};

// ==========================================
// RUTAS PARA EL MUNICIPIO
// ==========================================

// 1. Cargar nuevo documento
router.post('/cargar', requireRole('municipio', 'admin', 'super_admin'), upload.single('documento'), async (req, res) => {
  try {
    const { tipo_movimiento } = req.body;
    const archivo = req.file;

    if (!archivo) return res.status(400).json({ success: false, message: 'Debe subir un archivo PDF' });

    const { municipio_id, usuario_id } = await rastrearInfo(req);

    const [result] = await pool.query(`
      INSERT INTO documentos_municipio (municipio_id, tipo_movimiento, archivo_nombre, archivo_url, estatus)
      VALUES (?, ?, ?, ?, 'En revisión')
    `, [municipio_id, tipo_movimiento, archivo.originalname, archivo.path]);

    await pool.query(`
      INSERT INTO bitacora_documentos (documento_id, usuario_id, estatus_nuevo, observaciones)
      VALUES (?, ?, 'En revisión', 'Documento cargado y enviado a C5')
    `, [result.insertId, usuario_id]);

    res.status(201).json({ success: true, message: 'Documento cargado y guardado en BD' });
  } catch (error) {
    console.error("ERROR EN BD:", error);
    res.status(500).json({ success: false, message: 'Error al guardar en BD' });
  }
});

// 2. ACTUALIZAR documento rechazado (NUEVO)
router.put('/:id/actualizar', requireRole('municipio', 'admin', 'super_admin'), upload.single('documento'), async (req, res) => {
  try {
    const documento_id = req.params.id;
    const archivo = req.file;

    if (!archivo) return res.status(400).json({ success: false, message: 'Debe subir un archivo PDF corregido' });

    const { usuario_id } = await rastrearInfo(req);

    // Actualizamos el archivo y lo regresamos a "En revisión"
    await pool.query(`
      UPDATE documentos_municipio 
      SET archivo_nombre = ?, archivo_url = ?, estatus = 'En revisión', fecha_carga = NOW()
      WHERE id = ?
    `, [archivo.originalname, archivo.path, documento_id]);

    // Agregamos el movimiento a la bitácora para mantener la continuidad
    await pool.query(`
      INSERT INTO bitacora_documentos (documento_id, usuario_id, estatus_nuevo, observaciones)
      VALUES (?, ?, 'En revisión', 'Documento corregido y reenviado a C5')
    `, [documento_id, usuario_id]);

    res.json({ success: true, message: 'Documento actualizado y enviado a revisión' });
  } catch (error) {
    console.error("ERROR AL ACTUALIZAR:", error);
    res.status(500).json({ success: false, message: 'Error al actualizar documento' });
  }
});

// 3. ELIMINAR documento (NUEVO)
router.delete('/:id', requireRole('municipio', 'admin', 'super_admin'), async (req, res) => {
  try {
    const documento_id = req.params.id;
    
    // Primero borramos la bitácora asociada (para evitar errores de Foreign Key)
    await pool.query('DELETE FROM bitacora_documentos WHERE documento_id = ?', [documento_id]);
    
    // Luego borramos el documento
    await pool.query('DELETE FROM documentos_municipio WHERE id = ?', [documento_id]);

    res.json({ success: true, message: 'Documento eliminado correctamente' });
  } catch (error) {
    console.error("ERROR AL ELIMINAR:", error);
    res.status(500).json({ success: false, message: 'Error al eliminar el documento' });
  }
});

router.get('/mis-documentos', requireRole('municipio', 'admin', 'super_admin'), async (req, res) => {
  try {
    const { municipio_id } = await rastrearInfo(req);
    
    const [documentos] = await pool.query(`
      SELECT * FROM documentos_municipio WHERE municipio_id = ? ORDER BY fecha_carga DESC
    `, [municipio_id]);

    res.json({ success: true, data: documentos });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al consultar BD' });
  }
});

router.get('/:id/archivo', requireRole('analista', 'admin', 'super_admin', 'direccion', 'municipio'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT archivo_url, archivo_nombre FROM documentos_municipio WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Documento no encontrado' });
    
    const filepath = path.resolve(rows[0].archivo_url);
    res.download(filepath, rows[0].archivo_nombre);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al descargar el archivo' });
  }
});

// ==========================================
// RUTAS PARA EL ANALISTA C5
// ==========================================

router.get('/pendientes', requireRole('analista', 'admin', 'super_admin', 'direccion'), async (req, res) => {
  try {
    const regionInfo = await obtenerRegionDelAnalista(req);

    const where = ["d.estatus = 'En revisión'"];
    const params = [];

    if (regionInfo.filtrarPorRegion) {
      where.push('m.region_id = ?');
      params.push(regionInfo.region_id);
    }

    const [pendientes] = await pool.query(`
      SELECT 
        d.id,
        d.municipio_id,
        m.nombre AS municipio_nombre,
        m.region_id,
        d.tipo_movimiento,
        d.archivo_nombre,
        d.estatus,
        d.fecha_carga
      FROM documentos_municipio d
      INNER JOIN municipios m ON d.municipio_id = m.id
      WHERE ${where.join(' AND ')}
      ORDER BY d.fecha_carga ASC
    `, params);

    res.json({ success: true, data: pendientes });
  } catch (error) {
    console.error("ERROR AL CONSULTAR PENDIENTES:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error al consultar pendientes' 
    });
  }
});

router.put('/:id/evaluar', requireRole('analista', 'admin', 'super_admin'), async (req, res) => {
  try {
    const documento_id = req.params.id;
    const { estatus_nuevo, observaciones } = req.body; 
    
    const usuarioActivo = req.usuario || req.user || {};
    let usuario_id = usuarioActivo.id || usuarioActivo.usuario_id || req.userId;

    if (!usuario_id) {
      const authHeader = req?.headers?.authorization;
      const tokenCrudo = authHeader ? authHeader.split(' ')[1] : null;
      const payload = tokenCrudo ? jwt.decode(tokenCrudo) : null;

      usuario_id = payload?.id || payload?.usuario_id || payload?.id_usuario;
    }

    if (!usuario_id) {
      return res.status(401).json({
        success: false,
        message: 'No se pudo identificar al analista'
      });
    }

    await pool.query('UPDATE documentos_municipio SET estatus = ? WHERE id = ?', [estatus_nuevo, documento_id]);

    await pool.query(`
      INSERT INTO bitacora_documentos (documento_id, usuario_id, estatus_nuevo, observaciones)
      VALUES (?, ?, ?, ?)
    `, [documento_id, usuario_id, estatus_nuevo, observaciones]);

    res.json({ success: true, message: `Documento marcado como ${estatus_nuevo}` });
  } catch (error) {
    console.error("ERROR AL EVALUAR:", error);
    res.status(500).json({ success: false, message: 'Error al evaluar documento' });
  }
});

// ==========================================
// RUTAS DE HISTORIAL Y BITÁCORA
// ==========================================

// Obtener la línea de tiempo (Bitácora) de un documento específico
router.get('/:id/historial', requireRole('municipio', 'analista', 'admin', 'super_admin', 'direccion'), async (req, res) => {
  try {
    const [historial] = await pool.query(`
      SELECT b.id, b.estatus_nuevo, b.observaciones, b.fecha_movimiento AS fecha_registro, 
             COALESCE(u.nombre_completo, u.usuario, 'Sistema') AS operador
      FROM bitacora_documentos b
      LEFT JOIN usuarios u ON b.usuario_id = u.id
      WHERE b.documento_id = ?
      ORDER BY b.fecha_movimiento DESC
    `, [req.params.id]);
    
    res.json({ success: true, data: historial });
  } catch (error) {
    console.error("Error al obtener historial:", error);
    res.status(500).json({ success: false, message: 'Error al consultar historial' });
  }
});

// Obtener la tabla de documentos YA evaluados (Historial del Analista)
router.get('/evaluados', requireRole('analista', 'admin', 'super_admin', 'direccion'), async (req, res) => {
  try {
    const regionInfo = await obtenerRegionDelAnalista(req);

    const where = ["d.estatus != 'En revisión'"];
    const params = [];

    if (regionInfo.filtrarPorRegion) {
      where.push('m.region_id = ?');
      params.push(regionInfo.region_id);
    }

    const [evaluados] = await pool.query(`
      SELECT 
        d.id,
        d.municipio_id,
        m.nombre AS municipio_nombre,
        m.region_id,
        d.tipo_movimiento,
        d.archivo_nombre,
        d.estatus,
        d.fecha_carga
      FROM documentos_municipio d
      INNER JOIN municipios m ON d.municipio_id = m.id
      WHERE ${where.join(' AND ')}
      ORDER BY d.fecha_carga DESC
    `, params);

    res.json({ success: true, data: evaluados });
  } catch (error) {
    console.error("ERROR AL CONSULTAR EVALUADOS:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error al consultar documentos evaluados' 
    });
  }
});

export default router;