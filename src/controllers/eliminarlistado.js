export const eliminarListado = async (req, res) => {
  try {
    const { id } = req.params;

    // Aquí buscas el registro
    const [rows] = await pool.query(
      'SELECT archivo_ruta FROM listados_nominales WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado'
      });
    }

    // Eliminar archivo físico
    if (fs.existsSync(rows[0].archivo_ruta)) {
      fs.unlinkSync(rows[0].archivo_ruta);
    }

    // Eliminar registro de BD
    await pool.query(
      'DELETE FROM listados_nominales WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Archivo eliminado correctamente'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar archivo'
    });
  }
};