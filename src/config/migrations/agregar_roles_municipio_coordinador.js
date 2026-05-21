// Este archivo documenta la migración realizada
// Fecha: 2026-05-20
// Descripción: Agregar roles 'municipio' y 'coordinador' al sistema

export const migrationUp = async (connection) => {
  await connection.query(`
    ALTER TABLE usuarios 
    MODIFY COLUMN rol ENUM('super_admin', 'admin', 'direccion', 'analista', 'validador_c3', 'dependencia', 'operador_ccp', 'municipio', 'coordinador') 
    NOT NULL DEFAULT 'analista'
  `);
  console.log('✅ Roles municipio y coordinador agregados');
};