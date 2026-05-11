import pool from '../config/database.js';

/**
 * BaseModel - Clase base para todos los modelos
 * Proporciona operaciones CRUD genéricas y manejo de conexiones
 * Patrón Repository para separar lógica de acceso a datos
 */
class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  /**
   * Ejecutar query con manejo automático de conexión
   * @param {string} query - SQL query
   * @param {Array} params - Parámetros de la query
   * @returns {Promise<Array>} Resultado de la query
   */
  async query(query, params = []) {
    const connection = await pool.getConnection();
    try {
      const [results] = await connection.query(query, params);
      return results;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener todos los registros
   * @param {Object} options - Opciones de filtrado y ordenamiento
   * @returns {Promise<Array>}
   */
  async findAll(options = {}) {
    const { where = {}, orderBy = 'id', orderDir = 'ASC', limit, offset } = options;
    
    let query = `SELECT * FROM ${this.tableName}`;
    const params = [];

    // Construcción dinámica de WHERE
    if (Object.keys(where).length > 0) {
      const conditions = Object.keys(where).map(key => {
        params.push(where[key]);
        return `${key} = ?`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Ordenamiento
    query += ` ORDER BY ${orderBy} ${orderDir}`;

    // Paginación
    if (limit) {
      query += ` LIMIT ?`;
      params.push(limit);
      if (offset) {
        query += ` OFFSET ?`;
        params.push(offset);
      }
    }

    return await this.query(query, params);
  }

  /**
   * Buscar por ID
   * @param {number} id - ID del registro
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const results = await this.query(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return results[0] || null;
  }

  /**
   * Buscar un registro que cumpla condiciones
   * @param {Object} where - Condiciones de búsqueda
   * @returns {Promise<Object|null>}
   */
  async findOne(where) {
    const conditions = Object.keys(where).map(key => `${key} = ?`);
    const params = Object.values(where);
    
    const results = await this.query(
      `SELECT * FROM ${this.tableName} WHERE ${conditions.join(' AND ')} LIMIT 1`,
      params
    );
    return results[0] || null;
  }

  /**
   * Crear nuevo registro
   * @param {Object} data - Datos del nuevo registro
   * @returns {Promise<Object>} Registro creado con su ID
   */
  async create(data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(', ');

    const result = await this.query(
      `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );

    return await this.findById(result.insertId);
  }

  /**
   * Actualizar registro
   * @param {number} id - ID del registro
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object|null>}
   */
  async update(id, data) {
    const fields = Object.keys(data).map(key => `${key} = ?`);
    const values = [...Object.values(data), id];

    await this.query(
      `UPDATE ${this.tableName} SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return await this.findById(id);
  }

  /**
   * Eliminar registro (hard delete)
   * @param {number} id - ID del registro
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const result = await this.query(
      `DELETE FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Soft delete (marcar como inactivo)
   * @param {number} id - ID del registro
   * @returns {Promise<boolean>}
   */
  async softDelete(id) {
    const result = await this.query(
      `UPDATE ${this.tableName} SET activo = FALSE WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Contar registros
   * @param {Object} where - Condiciones de filtrado
   * @returns {Promise<number>}
   */
  async count(where = {}) {
    let query = `SELECT COUNT(*) as total FROM ${this.tableName}`;
    const params = [];

    if (Object.keys(where).length > 0) {
      const conditions = Object.keys(where).map(key => {
        params.push(where[key]);
        return `${key} = ?`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const results = await this.query(query, params);
    return results[0].total;
  }

  /**
   * Verificar si existe un registro
   * @param {Object} where - Condiciones de búsqueda
   * @returns {Promise<boolean>}
   */
  async exists(where) {
    const count = await this.count(where);
    return count > 0;
  }

  /**
   * Ejecutar query con transacción
   * @param {Function} callback - Función que recibe la conexión para ejecutar queries
   * @returns {Promise<any>}
   */
  async transaction(callback) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default BaseModel;
