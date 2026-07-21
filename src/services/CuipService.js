import PersonaTramiteModel from '../models/PersonaTramiteModel.js';
import TramiteAltaModel from '../models/TramiteAltaModel.js';

/**
 * CuipService - Lógica de negocio para Validación CUIP
 * (Cédula Única de Identificación Personal)
 * Capa de servicio separada siguiendo la arquitectura en capas del proyecto.
 */
class CuipService {



  /**
   * Estructura completa de las 34 secciones del CUIP
   * Cada sección tiene: clave, nombre, tiene_excepcion, campos[]
   */
  static CUIP_SECCIONES = [
    {
      clave: 'encabezado_registro', numero: 1,
      nombre: '1. ENCABEZADO / REGISTRO', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'Entidad' },
        { num: 2, nombre: 'Dependencia' },
        { num: 3, nombre: 'CUIP' },
        { num: 4, nombre: 'Folio No.' }
      ]
    },
    {
      clave: 'datos_personales', numero: 2,
      nombre: '2. DATOS PERSONALES', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'Nombre(s)' },
        { num: 2, nombre: 'Apellido Paterno' },
        { num: 3, nombre: 'Apellido Materno' },
        { num: 4, nombre: 'Fecha de Nacimiento' },
        { num: 5, nombre: 'Sexo' },
        { num: 6, nombre: 'R.F.C.' },
        { num: 7, nombre: 'Clave de Elector' },
        { num: 8, nombre: 'Cartilla del S.M.N.' },
        { num: 9, nombre: 'Licencia de Conducir' },
        { num: 10, nombre: 'Vigencia de la licencia' },
        { num: 11, nombre: 'C.U.R.P.' },
        { num: 12, nombre: 'Pasaporte' },
        { num: 13, nombre: 'Modo de Nacionalidad' },
        { num: 14, nombre: 'Fecha de Naturalización' },
        { num: 15, nombre: 'País de Nacimiento' },
        { num: 16, nombre: 'Entidad de Nacimiento' },
        { num: 17, nombre: 'Municipio de Nacimiento' },
        { num: 18, nombre: 'Nacionalidad' },
        { num: 19, nombre: 'Selección de Estado Civil' }
      ]
    },
    {
      clave: 'desarrollo_academico', numero: 3,
      nombre: '3. DESARROLLO ACADÉMICO', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Nivel Máximo de Estudios' },
        { num: 2, nombre: 'Escuela' },
        { num: 3, nombre: 'Especialidad o Estudio' },
        { num: 4, nombre: 'No. de Cédula Profesional' },
        { num: 5, nombre: 'Año de Inicio' },
        { num: 6, nombre: 'Año de Término' },
        { num: 7, nombre: 'Registro SEP' },
        { num: 8, nombre: 'Número de Folio de Certificado' },
        { num: 9, nombre: 'Promedio' }
      ]
    },
    {
      clave: 'domicilio', numero: 4,
      nombre: '4. DOMICILIO', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'Calle' },
        { num: 2, nombre: 'No. Exterior' },
        { num: 3, nombre: 'No. Interior' },
        { num: 4, nombre: 'Colonia' },
        { num: 5, nombre: 'Entre la calle de' },
        { num: 6, nombre: 'Y la calle' },
        { num: 7, nombre: 'Código Postal' },
        { num: 8, nombre: 'Número Telefónico' },
        { num: 9, nombre: 'Entidad Federativa' },
        { num: 10, nombre: 'Municipio' },
        { num: 11, nombre: 'Ciudad' }
      ]
    },
    {
      clave: 'adscripcion', numero: 5,
      nombre: '5. ADSCRIPCIÓN', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'Dependencia' },
        { num: 2, nombre: 'Institución' },
        { num: 3, nombre: 'Fecha de Ingreso' },
        { num: 4, nombre: 'Puesto' },
        { num: 5, nombre: 'Especialidad' },
        { num: 6, nombre: 'Rango o Categoría' },
        { num: 7, nombre: 'Nivel de Mando' },
        { num: 8, nombre: 'Número de Placa' },
        { num: 9, nombre: 'Número de Expediente' },
        { num: 10, nombre: 'Sueldo Base (Mensual)' },
        { num: 11, nombre: 'Compensación (Mensual)' },
        { num: 12, nombre: 'Área' },
        { num: 13, nombre: 'División' },
        { num: 14, nombre: 'Funciones' },
        { num: 15, nombre: 'CUIP del Jefe Inmediato' },
        { num: 16, nombre: 'Nombre del Jefe Inmediato' },
        { num: 17, nombre: 'Entidad Federativa' },
        { num: 18, nombre: 'Municipio' }
      ]
    },
    {
      clave: 'domicilio_adscripcion', numero: 6,
      nombre: '6. DOMICILIO DE ADSCRIPCIÓN', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'Calle' },
        { num: 2, nombre: 'No Exterior' },
        { num: 3, nombre: 'No Interior' },
        { num: 4, nombre: 'Colonia' },
        { num: 5, nombre: 'Entre la calle de' },
        { num: 6, nombre: 'Y la calle' },
        { num: 7, nombre: 'Número Telefónico' },
        { num: 8, nombre: 'Código Postal' },
        { num: 9, nombre: 'Entidad Federativa' },
        { num: 10, nombre: 'Municipio o Delegación' },
        { num: 11, nombre: 'Ciudad o Población' }
      ]
    },
    {
      clave: 'experiencia_docente', numero: 7,
      nombre: '7. EXPERIENCIA DOCENTE', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Nombre del Curso (Reg.1)' },
        { num: 2, nombre: 'Nombre de la Institución (Reg.1)' },
        { num: 3, nombre: 'Fecha de Inicio (Reg.1)' },
        { num: 4, nombre: 'Fecha de Término (Reg.1)' },
        { num: 5, nombre: 'Certificado Por (Reg.1)' },
        { num: 6, nombre: 'Nombre del Curso (Reg.2)' },
        { num: 7, nombre: 'Nombre de la Institución (Reg.2)' },
        { num: 8, nombre: 'Fecha de Inicio (Reg.2)' },
        { num: 9, nombre: 'Fecha de Término (Reg.2)' },
        { num: 10, nombre: 'Certificado Por (Reg.2)' }
      ]
    },
    {
      clave: 'referencias_1', numero: 8,
      nombre: '8. REFERENCIAS (Familiar y Pariente)', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'Apellido Paterno (Familiar)' },
        { num: 2, nombre: 'Apellido Materno (Familiar)' },
        { num: 3, nombre: 'Nombre(s) (Familiar)' },
        { num: 4, nombre: 'Sexo (Familiar)' },
        { num: 5, nombre: 'Ocupación (Familiar)' },
        { num: 6, nombre: 'Relación o Parentesco (Familiar)' },
        { num: 7, nombre: 'Calle (Familiar)' },
        { num: 8, nombre: 'No. Exterior (Familiar)' },
        { num: 9, nombre: 'No. Interior (Familiar)' },
        { num: 10, nombre: 'Colonia (Familiar)' },
        { num: 11, nombre: 'Código Postal (Familiar)' },
        { num: 12, nombre: 'Número Telefónico (Familiar)' },
        { num: 13, nombre: 'País (Familiar)' },
        { num: 14, nombre: 'Entidad Federativa (Familiar)' },
        { num: 15, nombre: 'Municipio o Delegación (Familiar)' },
        { num: 16, nombre: 'Ciudad o Población (Familiar)' },
        { num: 17, nombre: 'Apellido Paterno (Pariente)' },
        { num: 18, nombre: 'Apellido Materno (Pariente)' },
        { num: 19, nombre: 'Nombre(s) (Pariente)' },
        { num: 20, nombre: 'Sexo (Pariente)' },
        { num: 21, nombre: 'Ocupación (Pariente)' },
        { num: 22, nombre: 'Relación o Parentesco (Pariente)' },
        { num: 23, nombre: 'Calle (Pariente)' },
        { num: 24, nombre: 'No. Exterior (Pariente)' },
        { num: 25, nombre: 'No. Interior (Pariente)' },
        { num: 26, nombre: 'Colonia (Pariente)' },
        { num: 27, nombre: 'Código Postal (Pariente)' },
        { num: 28, nombre: 'Número Telefónico (Pariente)' },
        { num: 29, nombre: 'País (Pariente)' },
        { num: 30, nombre: 'Entidad Federativa (Pariente)' },
        { num: 31, nombre: 'Municipio o Delegación (Pariente)' },
        { num: 32, nombre: 'Ciudad o Población (Pariente)' }
      ]
    },
    {
      clave: 'referencias_2', numero: 9,
      nombre: '9. REFERENCIAS (Personal y Laboral)', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'Apellido Paterno (Personal)' },
        { num: 2, nombre: 'Apellido Materno (Personal)' },
        { num: 3, nombre: 'Nombre(s) (Personal)' },
        { num: 4, nombre: 'Sexo (Personal)' },
        { num: 5, nombre: 'Ocupación (Personal)' },
        { num: 6, nombre: 'Relación o Parentesco (Personal)' },
        { num: 7, nombre: 'Calle (Personal)' },
        { num: 8, nombre: 'No. Exterior (Personal)' },
        { num: 9, nombre: 'No. Interior (Personal)' },
        { num: 10, nombre: 'Colonia (Personal)' },
        { num: 11, nombre: 'Código Postal (Personal)' },
        { num: 12, nombre: 'Número Telefónico (Personal)' },
        { num: 13, nombre: 'País (Personal)' },
        { num: 14, nombre: 'Entidad Federativa (Personal)' },
        { num: 15, nombre: 'Municipio o Delegación (Personal)' },
        { num: 16, nombre: 'Ciudad o Población (Personal)' },
        { num: 17, nombre: 'Apellido Paterno (Laboral)' },
        { num: 18, nombre: 'Apellido Materno (Laboral)' },
        { num: 19, nombre: 'Nombre(s) (Laboral)' },
        { num: 20, nombre: 'Sexo (Laboral)' },
        { num: 21, nombre: 'Ocupación (Laboral)' },
        { num: 22, nombre: 'Calle (Laboral)' },
        { num: 23, nombre: 'No. Exterior (Laboral)' },
        { num: 24, nombre: 'No. Interior (Laboral)' },
        { num: 25, nombre: 'Colonia (Laboral)' },
        { num: 26, nombre: 'Código Postal (Laboral)' },
        { num: 27, nombre: 'Número Telefónico (Laboral)' },
        { num: 28, nombre: 'País (Laboral)' },
        { num: 29, nombre: 'Entidad Federativa (Laboral)' },
        { num: 30, nombre: 'Municipio o Delegación (Laboral)' },
        { num: 31, nombre: 'Ciudad o Población (Laboral)' }
      ]
    },
    {
      clave: 'socioeconomico', numero: 10,
      nombre: '10. SOCIOECONÓMICO', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: '¿Vive con su familia?' },
        { num: 2, nombre: 'Ingreso Familiar Adicional (Mensual)' },
        { num: 3, nombre: 'Su Domicilio es' },
        { num: 4, nombre: 'Actividades Culturales o Deportivas' },
        { num: 5, nombre: 'Especificación de Inmuebles y Costo' },
        { num: 6, nombre: 'Inversiones y Monto Aproximado' },
        { num: 7, nombre: 'Vehículo y Costo Aproximado' },
        { num: 8, nombre: 'Calidad de Vida' },
        { num: 9, nombre: 'Vicios' },
        { num: 10, nombre: 'Imagen Pública' },
        { num: 11, nombre: 'Comportamiento Social' }
      ]
    },
    {
      clave: 'conyuge_dependientes', numero: 11,
      nombre: '11. CÓNYUGE Y DEPENDIENTES ECONÓMICOS', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'Apellido Paterno (Reg.1)' },
        { num: 2, nombre: 'Apellido Materno (Reg.1)' },
        { num: 3, nombre: 'Nombre(s) (Reg.1)' },
        { num: 4, nombre: 'Fecha de Nacimiento (Reg.1)' },
        { num: 5, nombre: 'Sexo (Reg.1)' },
        { num: 6, nombre: 'Parentesco (Reg.1)' },
        { num: 7, nombre: 'Apellido Paterno (Reg.2)' },
        { num: 8, nombre: 'Apellido Materno (Reg.2)' },
        { num: 9, nombre: 'Nombre(s) (Reg.2)' },
        { num: 10, nombre: 'Fecha de Nacimiento (Reg.2)' },
        { num: 11, nombre: 'Sexo (Reg.2)' },
        { num: 12, nombre: 'Parentesco (Reg.2)' },
        { num: 13, nombre: 'Apellido Paterno (Reg.3)' },
        { num: 14, nombre: 'Apellido Materno (Reg.3)' },
        { num: 15, nombre: 'Nombre(s) (Reg.3)' },
        { num: 16, nombre: 'Fecha de Nacimiento (Reg.3)' },
        { num: 17, nombre: 'Sexo (Reg.3)' },
        { num: 18, nombre: 'Parentesco (Reg.3)' },
        { num: 19, nombre: 'Apellido Paterno (Reg.4)' },
        { num: 20, nombre: 'Apellido Materno (Reg.4)' },
        { num: 21, nombre: 'Nombre(s) (Reg.4)' },
        { num: 22, nombre: 'Fecha de Nacimiento (Reg.4)' },
        { num: 23, nombre: 'Sexo (Reg.4)' },
        { num: 24, nombre: 'Parentesco (Reg.4)' }
      ]
    },
    {
      clave: 'prestaciones', numero: 12,
      nombre: '12. PRESTACIONES', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Tipo (Reg.1)' },
        { num: 2, nombre: 'Fecha (Reg.1)' },
        { num: 3, nombre: 'Monto (Reg.1)' },
        { num: 4, nombre: 'Justificación (Reg.1)' },
        { num: 5, nombre: 'Tipo (Reg.2)' },
        { num: 6, nombre: 'Fecha (Reg.2)' },
        { num: 7, nombre: 'Monto (Reg.2)' },
        { num: 8, nombre: 'Justificación (Reg.2)' }
      ]
    },
    {
      clave: 'armamento', numero: 13,
      nombre: '13. ARMAMENTO ASIGNADO', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'No. Licencia Portación (Reg.1)' },
        { num: 2, nombre: 'No. Matrícula (Reg.1)' },
        { num: 3, nombre: 'Inicio Vigencia (Reg.1)' },
        { num: 4, nombre: 'Término Vigencia (Reg.1)' },
        { num: 5, nombre: 'Tipo de Arma (Reg.1)' },
        { num: 6, nombre: 'Marca del Arma (Reg.1)' },
        { num: 7, nombre: 'Modelo del Arma (Reg.1)' },
        { num: 8, nombre: 'Calibre del Arma (Reg.1)' },
        { num: 9, nombre: 'Inicio Asignación (Reg.1)' },
        { num: 10, nombre: 'Documento Asignación (Reg.1)' },
        { num: 11, nombre: 'Término Asignación (Reg.1)' },
        { num: 12, nombre: 'Documento Descargo (Reg.1)' },
        { num: 13, nombre: 'No. Licencia Portación (Reg.2)' },
        { num: 14, nombre: 'No. Matrícula (Reg.2)' },
        { num: 15, nombre: 'Inicio Vigencia (Reg.2)' },
        { num: 16, nombre: 'Término Vigencia (Reg.2)' },
        { num: 17, nombre: 'Tipo de Arma (Reg.2)' },
        { num: 18, nombre: 'Marca del Arma (Reg.2)' },
        { num: 19, nombre: 'Modelo del Arma (Reg.2)' },
        { num: 20, nombre: 'Calibre del Arma (Reg.2)' },
        { num: 21, nombre: 'Inicio Asignación (Reg.2)' },
        { num: 22, nombre: 'Documento Asignación (Reg.2)' },
        { num: 23, nombre: 'Término Asignación (Reg.2)' },
        { num: 24, nombre: 'Documento Descargo (Reg.2)' }
      ]
    },
    {
      clave: 'vehiculos', numero: 14,
      nombre: '14. VEHÍCULOS ASIGNADOS', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'VIN' },
        { num: 2, nombre: 'Número de Motor' },
        { num: 3, nombre: 'Número de Serie' },
        { num: 4, nombre: 'NCI' },
        { num: 5, nombre: 'Clase' },
        { num: 6, nombre: 'Tipo' },
        { num: 7, nombre: 'Marca' },
        { num: 8, nombre: 'Submarca' },
        { num: 9, nombre: 'Modelo (Año)' },
        { num: 10, nombre: 'Placa' },
        { num: 11, nombre: 'Tipo de Asignación' },
        { num: 12, nombre: 'Inicio de Asignación' },
        { num: 13, nombre: 'Documento de Asignación' },
        { num: 14, nombre: 'Término de Asignación' },
        { num: 15, nombre: 'Documento de Descargo' }
      ]
    },
    {
      clave: 'equipo_policial', numero: 15,
      nombre: '15. EQUIPO POLICIAL ASIGNADO', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Tipo de Equipo' },
        { num: 2, nombre: 'Marca de Equipo' },
        { num: 3, nombre: 'Modelo de Equipo' },
        { num: 4, nombre: 'Inventario de Equipo' },
        { num: 5, nombre: 'Número de Serie del Equipo' },
        { num: 6, nombre: 'Inicio de Asignación' },
        { num: 7, nombre: 'Documento de Asignación' },
        { num: 8, nombre: 'Término de Asignación' },
        { num: 9, nombre: 'Documento de Descargo' }
      ]
    },
    {
      clave: 'empleos_seg_pub_1', numero: 16,
      nombre: '16. EMPLEOS EN SEGURIDAD PÚBLICA', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Dependencia' },
        { num: 2, nombre: 'Corporación' },
        { num: 3, nombre: 'Calle' },
        { num: 4, nombre: 'No. Exterior' },
        { num: 5, nombre: 'No. Interior' },
        { num: 6, nombre: 'Colonia' },
        { num: 7, nombre: 'Número Telefónico' },
        { num: 8, nombre: 'Código Postal' },
        { num: 9, nombre: 'Fecha de Ingreso' },
        { num: 10, nombre: 'Fecha de Separación' },
        { num: 11, nombre: 'Puesto Funcional' },
        { num: 12, nombre: 'Funciones' },
        { num: 13, nombre: 'Especialidad' },
        { num: 14, nombre: 'Rango o Categoría' },
        { num: 15, nombre: 'Número de Placa' },
        { num: 16, nombre: 'Número de Empleado' },
        { num: 17, nombre: 'Sueldo Base (Mensual)' },
        { num: 18, nombre: 'Compensaciones (Mensual)' },
        { num: 19, nombre: 'Área' },
        { num: 20, nombre: 'División' },
        { num: 21, nombre: 'CUIP del Jefe Inmediato' },
        { num: 22, nombre: 'Nombre del Jefe Inmediato' },
        { num: 23, nombre: 'Entidad Federativa' },
        { num: 24, nombre: 'Municipio o Delegación' },
        { num: 25, nombre: 'Motivo de Separación' },
        { num: 26, nombre: 'Tipo de Separación' },
        { num: 27, nombre: 'Tipo de Baja' },
        { num: 28, nombre: 'Comentarios' }
      ]
    },
    {
      clave: 'empleos_seg_pub_2', numero: 17,
      nombre: '17. EMPLEOS EN SEGURIDAD PÚBLICA (Cont.)', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Dependencia' },
        { num: 2, nombre: 'Corporación' },
        { num: 3, nombre: 'Calle' },
        { num: 4, nombre: 'No. Exterior' },
        { num: 5, nombre: 'No. Interior' },
        { num: 6, nombre: 'Colonia' },
        { num: 7, nombre: 'Número Telefónico' },
        { num: 8, nombre: 'Código Postal' },
        { num: 9, nombre: 'Fecha de Ingreso' },
        { num: 10, nombre: 'Fecha de Separación' },
        { num: 11, nombre: 'Puesto Funcional' },
        { num: 12, nombre: 'Funciones' },
        { num: 13, nombre: 'Especialidad' },
        { num: 14, nombre: 'Rango o Categoría' },
        { num: 15, nombre: 'Número de Placa' },
        { num: 16, nombre: 'Número de Empleado' },
        { num: 17, nombre: 'Sueldo Base (Mensual)' },
        { num: 18, nombre: 'Compensaciones (Mensual)' },
        { num: 19, nombre: 'Área' },
        { num: 20, nombre: 'División' },
        { num: 21, nombre: 'CUIP del Jefe Inmediato' },
        { num: 22, nombre: 'Nombre del Jefe Inmediato' },
        { num: 23, nombre: 'Entidad Federativa' },
        { num: 24, nombre: 'Municipio o Delegación' },
        { num: 25, nombre: 'Motivo de Separación' },
        { num: 26, nombre: 'Tipo de Separación' },
        { num: 27, nombre: 'Tipo de Baja' },
        { num: 28, nombre: 'Comentarios' }
      ]
    },
    {
      clave: 'empleos_diversos', numero: 18,
      nombre: '18. EMPLEOS DIVERSOS', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Empresa' },
        { num: 2, nombre: 'Calle y Número' },
        { num: 3, nombre: 'Colonia' },
        { num: 4, nombre: 'Entidad' },
        { num: 5, nombre: 'Municipio' },
        { num: 6, nombre: 'Código Postal' },
        { num: 7, nombre: 'Número Telefónico' },
        { num: 8, nombre: 'Área o Departamento' },
        { num: 9, nombre: 'Funciones' },
        { num: 10, nombre: 'Ingreso Neto Mensual' },
        { num: 11, nombre: 'Fecha de Ingreso' },
        { num: 12, nombre: 'Fecha de Separación' },
        { num: 13, nombre: 'Motivo de Separación' },
        { num: 14, nombre: 'Tipo de Separación' },
        { num: 15, nombre: 'Descripción' }
      ]
    },
    {
      clave: 'actitudes_empleo', numero: 19,
      nombre: '19. ACTITUDES HACIA EL EMPLEO', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: '¿Por qué eligió este empleo?' },
        { num: 2, nombre: '¿Qué puesto desearía tener?' },
        { num: 3, nombre: '¿En qué área desearía estar?' },
        { num: 4, nombre: '¿En qué tiempo desea ascender?' },
        { num: 5, nombre: '¿Conoce reglamentación de reconocimientos?' },
        { num: 6, nombre: 'Razones sin reconocimiento' },
        { num: 7, nombre: '¿Conoce reglamentación de ascensos?' },
        { num: 8, nombre: 'Razones sin ascenso' },
        { num: 9, nombre: '¿Qué capacitación le gustaría recibir?' }
      ]
    },
    {
      clave: 'disciplina_laboral', numero: 20,
      nombre: '20. DISCIPLINA LABORAL', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Tipo de Disciplina' },
        { num: 2, nombre: 'Subtipo Disciplina' },
        { num: 3, nombre: 'Motivo' },
        { num: 4, nombre: 'Tipo' },
        { num: 5, nombre: 'Fecha de Inicio' },
        { num: 6, nombre: 'Fecha de Término' },
        { num: 7, nombre: 'En caso de Licencia Médica: Duración' }
      ]
    },
    {
      clave: 'capacitaciones_seg_pub', numero: 21,
      nombre: '21. CAPACITACIONES: SEGURIDAD PÚBLICA', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Dependencia Responsable (Reg.1)' },
        { num: 2, nombre: 'Institución Capacitadora (Reg.1)' },
        { num: 3, nombre: 'Nombre del Curso (Reg.1)' },
        { num: 4, nombre: 'Tema del Curso (Reg.1)' },
        { num: 5, nombre: 'Nivel del Curso (Reg.1)' },
        { num: 6, nombre: 'Eficiencia Terminal (Reg.1)' },
        { num: 7, nombre: 'Inicio (Reg.1)' },
        { num: 8, nombre: 'Conclusión (Reg.1)' },
        { num: 9, nombre: 'Duración Horas (Reg.1)' },
        { num: 10, nombre: 'Tipo de Comprobante (Reg.1)' },
        { num: 11, nombre: 'Dependencia Responsable (Reg.2)' },
        { num: 12, nombre: 'Institución Capacitadora (Reg.2)' },
        { num: 13, nombre: 'Nombre del Curso (Reg.2)' },
        { num: 14, nombre: 'Tema del Curso (Reg.2)' },
        { num: 15, nombre: 'Nivel del Curso (Reg.2)' },
        { num: 16, nombre: 'Eficiencia Terminal (Reg.2)' },
        { num: 17, nombre: 'Inicio (Reg.2)' },
        { num: 18, nombre: 'Conclusión (Reg.2)' },
        { num: 19, nombre: 'Duración Horas (Reg.2)' },
        { num: 20, nombre: 'Tipo de Comprobante (Reg.2)' }
      ]
    },
    {
      clave: 'capacitacion_adicional', numero: 22,
      nombre: '22. CAPACITACIÓN ADICIONAL', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Institución o Empresa (Reg.1)' },
        { num: 2, nombre: 'Estudio o Curso (Reg.1)' },
        { num: 3, nombre: 'Tipo de Curso (Reg.1)' },
        { num: 4, nombre: 'El Curso fue (Impartido/Recibido) (Reg.1)' },
        { num: 5, nombre: 'Eficiencia Terminal (Reg.1)' },
        { num: 6, nombre: 'Inicio (Reg.1)' },
        { num: 7, nombre: 'Conclusión (Reg.1)' },
        { num: 8, nombre: 'Duración (Horas) (Reg.1)' },
        { num: 9, nombre: 'Institución o Empresa (Reg.2)' },
        { num: 10, nombre: 'Estudio o Curso (Reg.2)' },
        { num: 11, nombre: 'Tipo de Curso (Reg.2)' },
        { num: 12, nombre: 'El Curso fue (Impartido/Recibido) (Reg.2)' },
        { num: 13, nombre: 'Eficiencia Terminal (Reg.2)' },
        { num: 14, nombre: 'Inicio (Reg.2)' },
        { num: 15, nombre: 'Conclusión (Reg.2)' },
        { num: 16, nombre: 'Duración (Horas) (Reg.2)' }
      ]
    },
    {
      clave: 'idiomas_dialectos', numero: 23,
      nombre: '23. CAPACITACIONES: IDIOMAS Y/O DIALECTOS', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Idioma o Dialecto (Reg.1)' },
        { num: 2, nombre: 'Lectura (%) (Reg.1)' },
        { num: 3, nombre: 'Escritura (%) (Reg.1)' },
        { num: 4, nombre: 'Conversación (%) (Reg.1)' },
        { num: 5, nombre: 'Idioma o Dialecto (Reg.2)' },
        { num: 6, nombre: 'Lectura (%) (Reg.2)' },
        { num: 7, nombre: 'Escritura (%) (Reg.2)' },
        { num: 8, nombre: 'Conversación (%) (Reg.2)' }
      ]
    },
    {
      clave: 'habilidades_aptitudes', numero: 24,
      nombre: '24. CAPACITACIONES: HABILIDADES Y APTITUDES', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Selección de Tipo (Reg.1)' },
        { num: 2, nombre: 'Especifique (Reg.1)' },
        { num: 3, nombre: 'Grado de Aptitud o Dominio (Reg.1)' },
        { num: 4, nombre: 'Selección de Tipo (Reg.2)' },
        { num: 5, nombre: 'Especifique (Reg.2)' },
        { num: 6, nombre: 'Grado de Aptitud o Dominio (Reg.2)' }
      ]
    },
    {
      clave: 'afiliacion_agrupaciones', numero: 25,
      nombre: '25. CAPACITACIONES: AFILIACIÓN A AGRUPACIONES', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Nombre de Agrupación (Reg.1)' },
        { num: 2, nombre: 'Tipo de Agrupación (Reg.1)' },
        { num: 3, nombre: 'Desde (Reg.1)' },
        { num: 4, nombre: 'Hasta (Reg.1)' },
        { num: 5, nombre: 'Nombre de Agrupación (Reg.2)' },
        { num: 6, nombre: 'Tipo de Agrupación (Reg.2)' },
        { num: 7, nombre: 'Desde (Reg.2)' },
        { num: 8, nombre: 'Hasta (Reg.2)' }
      ]
    },
    {
      clave: 'sanciones_estimulos', numero: 26,
      nombre: '26. SANCIONES / ESTÍMULOS', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Tipo (Reg.1)' },
        { num: 2, nombre: 'Determinación (Reg.1)' },
        { num: 3, nombre: 'Descripción (Reg.1)' },
        { num: 4, nombre: 'Situación (Reg.1)' },
        { num: 5, nombre: 'Inicio de la Inhabilitación (Reg.1)' },
        { num: 6, nombre: 'Término de la Inhabilitación (Reg.1)' },
        { num: 7, nombre: 'Dependencia u Organismo Emisor (Reg.1)' },
        { num: 8, nombre: 'Tipo (Reg.2)' },
        { num: 9, nombre: 'Determinación (Reg.2)' },
        { num: 10, nombre: 'Descripción (Reg.2)' },
        { num: 11, nombre: 'Situación (Reg.2)' },
        { num: 12, nombre: 'Inicio de la Inhabilitación (Reg.2)' },
        { num: 13, nombre: 'Término de la Inhabilitación (Reg.2)' },
        { num: 14, nombre: 'Dependencia u Organismo Emisor (Reg.2)' }
      ]
    },
    {
      clave: 'resoluciones_ministeriales', numero: 27,
      nombre: '27. SANCIONES/ESTÍMULOS: RESOLUCIONES MINISTERIALES Y/O JUDICIALES', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Institución Emisora' },
        { num: 2, nombre: 'Entidad Federativa' },
        { num: 3, nombre: 'Delito(s)' },
        { num: 4, nombre: 'Motivo' },
        { num: 5, nombre: 'No. de Expediente' },
        { num: 6, nombre: 'Agencia del M.P.' },
        { num: 7, nombre: 'Averiguación Previa' },
        { num: 8, nombre: 'Tipo de Fuero (Federal/Común)' },
        { num: 9, nombre: 'Estado de la Averiguación Previa' },
        { num: 10, nombre: 'Inicio de la Av. Previa' },
        { num: 11, nombre: 'Al Día (Av. Previa)' },
        { num: 12, nombre: 'Juzgado' },
        { num: 13, nombre: 'No. Proceso' },
        { num: 14, nombre: 'Estado Procesal' },
        { num: 15, nombre: 'Inicio del Proceso' },
        { num: 16, nombre: 'Al Día (Proceso Judicial)' }
      ]
    },
    {
      clave: 'estimulos_recibidos', numero: 28,
      nombre: '28. SANCIONES/ESTÍMULOS: ESTÍMULOS RECIBIDOS', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Tipo (Reg.1)' },
        { num: 2, nombre: 'Descripción (Reg.1)' },
        { num: 3, nombre: 'Dependencia que Otorga (Reg.1)' },
        { num: 4, nombre: 'Otorgado (Reg.1)' },
        { num: 5, nombre: 'Tipo (Reg.2)' },
        { num: 6, nombre: 'Descripción (Reg.2)' },
        { num: 7, nombre: 'Dependencia que Otorga (Reg.2)' },
        { num: 8, nombre: 'Otorgado (Reg.2)' }
      ]
    },
    {
      clave: 'cierre_firmas_sellos', numero: 29,
      nombre: '29. CIERRE DE EXPEDIENTE: FIRMAS Y SELLOS', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'Fecha de Llenado' },
        { num: 2, nombre: 'Sello de la Corporación' },
        { num: 3, nombre: 'Nombre del Responsable de la Corporación' },
        { num: 4, nombre: 'Firma del Responsable de la Corporación' },
        { num: 5, nombre: 'Nombre del Interesado' },
        { num: 6, nombre: 'Firma del Interesado' }
      ]
    },
    {
      clave: 'media_filiacion', numero: 30,
      nombre: '30. IDENTIFICACIÓN: MEDIA FILIACIÓN', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'Tipo de Sangre y Factor RH' },
        { num: 2, nombre: 'Usa Anteojos' },
        { num: 3, nombre: 'Estatura (cm)' },
        { num: 4, nombre: 'Peso (kg)' }
      ]
    },
    {
      clave: 'senas_particulares', numero: 31,
      nombre: '31. SEÑAS PARTICULARES', tiene_excepcion: true,
      campos: [
        { num: 1, nombre: 'Cicatrices' },
        { num: 2, nombre: 'Tatuajes' },
        { num: 3, nombre: 'Lunares' },
        { num: 4, nombre: 'Defectos Físicos' },
        { num: 5, nombre: 'Prótesis' },
        { num: 6, nombre: 'Discapacidad Física' }
      ]
    },
    {
      clave: 'ficha_fotografica', numero: 32,
      nombre: '32. FICHA FOTOGRÁFICA', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'CUIP' },
        { num: 2, nombre: 'Folio No.' },
        { num: 3, nombre: 'Dependencia' },
        { num: 4, nombre: 'Corporación' },
        { num: 5, nombre: 'Apellido Paterno' },
        { num: 6, nombre: 'Apellido Materno' },
        { num: 7, nombre: 'Nombre(s)' },
        { num: 8, nombre: 'Fecha de Nacimiento (Día/Mes/Año)' },
        { num: 9, nombre: 'Sexo (Masculino / Femenino)' },
        { num: 10, nombre: 'Fotografía de Perfil Izquierdo (Tamaño Filiación)' },
        { num: 11, nombre: 'Fotografía de Frente (Tamaño Filiación)' },
        { num: 12, nombre: 'Fotografía de Perfil Derecho (Tamaño Filiación)' },
        { num: 13, nombre: 'Firma del Interesado (Recuadro)' },
        { num: 14, nombre: 'Institución que Realiza el Estudio (ADN)' },
        { num: 15, nombre: 'Fecha de Aplicación ADN (Día/Mes/Año)' },
        { num: 16, nombre: 'Institución que Realiza el Estudio (Voz)' },
        { num: 17, nombre: 'Fecha de Aplicación Voz (Día/Mes/Año)' },
        { num: 18, nombre: 'Institución que Realiza el Estudio (Grafología)' },
        { num: 19, nombre: 'Fecha de Aplicación Grafología (Día/Mes/Año)' }
      ]
    },
    {
      clave: 'registro_decadactilar', numero: 33,
      nombre: '33. REGISTRO DECADACTILAR', tiene_excepcion: false,
      campos: [
        { num: 1, nombre: 'Nombre del Operador' },
        { num: 2, nombre: 'Firma del Operador' },
        { num: 3, nombre: 'Dependencia' },
        { num: 4, nombre: 'Corporación' },
        { num: 5, nombre: 'CUIP' },
        { num: 6, nombre: 'Apellido Paterno' },
        { num: 7, nombre: 'Apellido Materno' },
        { num: 8, nombre: 'Nombre(s)' },
        { num: 9, nombre: 'Fecha de Nacimiento (Día/Mes/Año)' },
        { num: 10, nombre: 'Edad (Años)' },
        { num: 11, nombre: 'Sexo (Masculino / Femenino)' },
        { num: 12, nombre: 'Pulgar (Mano Derecha)' },
        { num: 13, nombre: 'Índice (Mano Derecha)' },
        { num: 14, nombre: 'Medio (Mano Derecha)' },
        { num: 15, nombre: 'Anular (Mano Derecha)' },
        { num: 16, nombre: 'Meñique (Mano Derecha)' },
        { num: 17, nombre: 'Pulgar (Mano Izquierda)' },
        { num: 18, nombre: 'Índice (Mano Izquierda)' },
        { num: 19, nombre: 'Medio (Mano Izquierda)' },
        { num: 20, nombre: 'Anular (Mano Izquierda)' },
        { num: 21, nombre: 'Meñique (Mano Izquierda)' },
        { num: 22, nombre: 'Impresión Simultánea Cuatro Dedos Mano Izquierda' },
        { num: 23, nombre: 'Impresión Simultánea Cuatro Dedos Mano Derecha' },
        { num: 24, nombre: 'Pulgar Izquierdo' },
        { num: 25, nombre: 'Pulgar Derecho' },
        { num: 26, nombre: 'Código de Identificación Biométrica' },
        { num: 27, nombre: 'Palma de la Mano Derecha' },
        { num: 28, nombre: 'Canto Mano Derecha' },
        { num: 29, nombre: 'Canto Mano Izquierda' },
        { num: 30, nombre: 'Palma de la Mano Izquierda' }
      ]
    }
  ];


  static normalizarTexto(value = '') {
    return String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  static esSeccionEncabezadoRegistro(seccion = {}) {
    const clave = CuipService.normalizarTexto(seccion?.clave || '');
    const nombre = CuipService.normalizarTexto(seccion?.nombre || '');

    return (
      clave.includes('encabezado') ||
      clave.includes('registro') ||
      nombre.includes('encabezado') ||
      nombre.includes('registro')
    );
  }

  static esCampoCuipOpcional(seccion = {}, campo = {}) {
    const campoNum = Number(campo?.num);
    const campoNombre = CuipService.normalizarTexto(campo?.nombre || '');

    return (
      CuipService.esSeccionEncabezadoRegistro(seccion) &&
      (
        campoNum === 3 ||
        campoNum === 4 ||
        campoNombre === 'cuip' ||
        campoNombre.includes('folio')
      )
    );
  }

  normalizarTexto(value = '') {
    return CuipService.normalizarTexto(value);
  }

  esSeccionEncabezadoRegistro(seccion = {}) {
    return CuipService.esSeccionEncabezadoRegistro(seccion);
  }

  esCampoCuipOpcional(seccion = {}, campo = {}) {
    return CuipService.esCampoCuipOpcional(seccion, campo);
  }

  /**
   * Generar estructura inicial de validación CUIP (todas las secciones con campos sin validar)
   */
  static generarCuipInicial() {
    return CuipService.CUIP_SECCIONES.map(seccion => ({
      clave: seccion.clave,
      numero: seccion.numero,
      nombre: seccion.nombre,
      tiene_excepcion: seccion.tiene_excepcion,
      excepcion_activa: false,
      campos: seccion.campos.map(campo => ({
        num: campo.num,
        nombre: campo.nombre,
        validado: null
      }))
    }));
  }

  /**
   * Compatibilidad de instancia para servicios que consumen CuipService por default export.
   */
  generarCuipInicial() {
    return CuipService.generarCuipInicial();
  }


  /**
    * Parsear y migrar cuip_validacion: 
    * - Añade secciones/campos nuevos.
    * - Elimina secciones/campos obsoletos.
    * - Fuerza la actualización de los nombres de los campos si cambiaron de orden.
    */
  static parsarYMigrarCuip(raw) {
    let cuip = raw;
    if (!cuip) return CuipService.generarCuipInicial();
    if (typeof cuip === 'string') cuip = JSON.parse(cuip);

    // 1. ELIMINAR secciones obsoletas (ej. sección 3 antigua)
    const clavesDefinidas = new Set(CuipService.CUIP_SECCIONES.map(s => s.clave));
    cuip = cuip.filter(seccionGuardada => clavesDefinidas.has(seccionGuardada.clave));

    // 2. AGREGAR SECCIONES faltantes
    const clavesGuardadas = new Set(cuip.map(s => s.clave));
    const seccionesFaltantes = CuipService.CUIP_SECCIONES.filter(s => !clavesGuardadas.has(s.clave));

    if (seccionesFaltantes.length > 0) {
      const nuevas = seccionesFaltantes.map(seccion => ({
        clave: seccion.clave,
        numero: seccion.numero,
        nombre: seccion.nombre,
        tiene_excepcion: seccion.tiene_excepcion,
        excepcion_activa: false,
        campos: seccion.campos.map(campo => ({
          num: campo.num,
          nombre: campo.nombre,
          validado: null
        }))
      }));
      cuip = [...cuip, ...nuevas];
    }

    // 3. SINCRONIZAR CAMPOS dentro de cada sección
    cuip = cuip.map(seccionGuardada => {
      const seccionDefinida = CuipService.CUIP_SECCIONES.find(s => s.clave === seccionGuardada.clave);

      if (seccionDefinida) {
        const numerosCamposGuardados = new Set(seccionGuardada.campos.map(c => String(c.num)));
        const numerosCamposDefinidos = new Set(seccionDefinida.campos.map(c => String(c.num)));

        // A) Eliminar campos guardados que ya no existen en la definición
        seccionGuardada.campos = seccionGuardada.campos.filter(c => numerosCamposDefinidos.has(String(c.num)));

        // B) ACTUALIZAR NOMBRES: Si el número ya existía, forzamos que tenga el nombre correcto actual
        seccionGuardada.campos.forEach(campoGuardado => {
          const campoDefinido = seccionDefinida.campos.find(c => String(c.num) === String(campoGuardado.num));
          if (campoDefinido) {
            campoGuardado.nombre = campoDefinido.nombre;
          }
        });

        // C) Agregar campos nuevos que faltan en lo guardado
        const camposFaltantes = seccionDefinida.campos.filter(c => !numerosCamposGuardados.has(String(c.num)));

        if (camposFaltantes.length > 0) {
          const nuevosCampos = camposFaltantes.map(campo => ({
            num: campo.num,
            nombre: campo.nombre,
            validado: null
          }));
          seccionGuardada.campos = [...seccionGuardada.campos, ...nuevosCampos];
        }

        // D) Mantener actualizados los nombres y números de la sección
        seccionGuardada.numero = seccionDefinida.numero;
        seccionGuardada.nombre = seccionDefinida.nombre;

        // E) Ordenar los campos numéricamente
        seccionGuardada.campos.sort((a, b) => Number(a.num) - Number(b.num));
      }
      return seccionGuardada;
    });

    // 4. ORDENAR las secciones finales
    cuip.sort((a, b) => a.numero - b.numero);

    return cuip;
  }

  /**
   * Compatibilidad de instancia para invocaciones tipo CuipService.parsarYMigrarCuip(...)
   * cuando CuipService es la instancia exportada por defecto.
   */
  parsarYMigrarCuip(raw) {
    return CuipService.parsarYMigrarCuip(raw);
  }

  /**
   * Obtener personas pendientes de validación CUIP
   */
  async obtenerPendientesCuip(filtros = {}) {
    return await PersonaTramiteModel.findPendientesCuip(filtros);
  }

  /**
   * Obtener personas en proceso de validación CUIP
   */
  async obtenerEnProcesoCuip(filtros = {}) {
    return await PersonaTramiteModel.findEnProcesoCuip(filtros);
  }

  /**
   * Iniciar validación CUIP para una persona
   */
  async iniciarCuip(personaId, usuarioId) {
    const persona = await PersonaTramiteModel.findForCuip(personaId);
    if (!persona) throw new Error('Persona no encontrada');

    if (persona.fase_revision !== 'completado') {
      throw new Error('La persona debe completar la revisión de requisitos antes de iniciar CUIP');
    }

    // Idempotente: si ya está en proceso, retornar datos actuales sin error
    if (persona.fase_cuip !== 'pendiente') {
      return await PersonaTramiteModel.findForCuip(personaId);
    }

    const cuipInicial = CuipService.generarCuipInicial();

    await TramiteAltaModel.transaction(async (connection) => {
      await connection.query(
        `UPDATE personas_tramite_alta SET 
          fase_cuip = 'en_proceso',
          fecha_inicio_cuip = NOW(),
          cuip_revisado_por_id = ?,
          cuip_validacion = ?,
          cuip_excepciones = '[]',
          updated_at = NOW()
        WHERE id = ?`,
        [usuarioId, JSON.stringify(cuipInicial), personaId]
      );

      // Mover trámite a fase validacion_cuip si no está ahí
      if (!['validacion_cuip', 'finalizado'].includes(persona.tramite_fase)) {
        await connection.query(
          `UPDATE tramites_alta SET fase_actual = 'validacion_cuip', updated_at = NOW() WHERE id = ?`,
          [persona.tramite_alta_id]
        );

        await connection.query(
          `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
           VALUES (?, ?, ?, 'validacion_cuip', 'Inicio de validación CUIP')`,
          [persona.tramite_alta_id, usuarioId, persona.tramite_fase]
        );
      }
    });
    // Leer DESPUÉS del commit para obtener datos frescos
    return await PersonaTramiteModel.findForCuip(personaId);
  }

  /**
   * Obtener detalle de persona para validación CUIP
   */
  async obtenerDetalleCuip(personaId) {
    const persona = await PersonaTramiteModel.findForCuip(personaId);
    if (!persona) throw new Error('Persona no encontrada');

    // Parsear y migrar secciones (añade secciones nuevas si el JSON es de versión anterior)
    persona.cuip_validacion = CuipService.parsarYMigrarCuip(persona.cuip_validacion);
    if (persona.cuip_excepciones && typeof persona.cuip_excepciones === 'string') {
      persona.cuip_excepciones = JSON.parse(persona.cuip_excepciones);
    }
    if (!persona.cuip_excepciones) persona.cuip_excepciones = [];

    return persona;
  }

  /**
   * Validar/rechazar un campo específico del CUIP
   */
  async validarCampoCuip(personaId, usuarioId, seccionClave, campoNum, validado) {
    const persona = await PersonaTramiteModel.findForCuip(personaId);
    if (!persona) throw new Error('Persona no encontrada');

    if (persona.fase_cuip !== 'en_proceso') {
      throw new Error('La validación CUIP no está en proceso');
    }

    const cuip = CuipService.parsarYMigrarCuip(persona.cuip_validacion);

    const seccion = cuip.find(s => s.clave === seccionClave);
    if (!seccion) throw new Error(`Sección '${seccionClave}' no encontrada`);

    const campo = seccion.campos.find(c => c.num === campoNum);
    if (!campo) throw new Error(`Campo ${campoNum} no encontrado en sección '${seccionClave}'`);

    campo.validado = validado;

    await PersonaTramiteModel.update(personaId, {
      cuip_validacion: JSON.stringify(cuip),
      updated_at: new Date()
    });

    return cuip;
  }

  /**
   * Validar todos los campos de una sección
   */
  async validarSeccionCuip(personaId, usuarioId, seccionClave) {
    const persona = await PersonaTramiteModel.findForCuip(personaId);
    if (!persona) throw new Error('Persona no encontrada');
    if (persona.fase_cuip !== 'en_proceso') throw new Error('La validación CUIP no está en proceso');

    const cuip = CuipService.parsarYMigrarCuip(persona.cuip_validacion);

    const seccion = cuip.find(s => s.clave === seccionClave);
    if (!seccion) throw new Error(`Sección '${seccionClave}' no encontrada`);

    const camposObligatorios = seccion.campos.filter(
      (campo) => !CuipService.esCampoCuipOpcional(seccion, campo)
    );

    const todasValidadas =
      camposObligatorios.length > 0 &&
      camposObligatorios.every(c => c.validado === true);

    seccion.campos.forEach((campo) => {
      if (CuipService.esCampoCuipOpcional(seccion, campo)) {
        return;
      }

      campo.validado = todasValidadas ? null : true;
    });

    await PersonaTramiteModel.update(personaId, {
      cuip_validacion: JSON.stringify(cuip),
      updated_at: new Date()
    });

    return cuip;
  }

  /**
   * Marcar/desmarcar excepción NINGUNO para una sección
   */
  async marcarExcepcionCuip(personaId, usuarioId, seccionClave, activa) {
    const persona = await PersonaTramiteModel.findForCuip(personaId);
    if (!persona) throw new Error('Persona no encontrada');
    if (persona.fase_cuip !== 'en_proceso') throw new Error('La validación CUIP no está en proceso');

    const cuip = CuipService.parsarYMigrarCuip(persona.cuip_validacion);

    const seccion = cuip.find(s => s.clave === seccionClave);
    if (!seccion) throw new Error(`Sección '${seccionClave}' no encontrada`);
    if (!seccion.tiene_excepcion) throw new Error('Esta sección no permite la excepción "Ninguno"');

    let excepciones = persona.cuip_excepciones;
    if (typeof excepciones === 'string') excepciones = JSON.parse(excepciones);
    if (!excepciones) excepciones = [];

    seccion.excepcion_activa = activa;

    if (activa) {
      // Marcar todos los campos como validados (NINGUNO)
      seccion.campos.forEach(c => { c.validado = true; });
      if (!excepciones.includes(seccionClave)) excepciones.push(seccionClave);
    } else {
      // Resetear campos a sin revisar
      seccion.campos.forEach(c => { c.validado = null; });
      excepciones = excepciones.filter(e => e !== seccionClave);
    }

    await PersonaTramiteModel.update(personaId, {
      cuip_validacion: JSON.stringify(cuip),
      cuip_excepciones: JSON.stringify(excepciones),
      updated_at: new Date()
    });

    return { cuip_validacion: cuip, cuip_excepciones: excepciones };
  }

  /**
   * Validar todo el CUIP de golpe
   */
  async validarTodoCuip(personaId, usuarioId) {
    const persona = await PersonaTramiteModel.findForCuip(personaId);
    if (!persona) throw new Error('Persona no encontrada');
    if (persona.fase_cuip !== 'en_proceso') throw new Error('La validación CUIP no está en proceso');

    const cuip = CuipService.parsarYMigrarCuip(persona.cuip_validacion);

    const camposObligatorios = cuip.flatMap((seccion) =>
      seccion.campos.filter((campo) => !CuipService.esCampoCuipOpcional(seccion, campo))
    );

    const todosValidados =
      camposObligatorios.length > 0 &&
      camposObligatorios.every(c => c.validado === true);

    const excepciones = [];

    cuip.forEach((seccion) => {
      seccion.campos.forEach((campo) => {
        if (CuipService.esCampoCuipOpcional(seccion, campo)) {
          return;
        }

        campo.validado = todosValidados ? null : true;
      });

      if (!todosValidados && seccion.tiene_excepcion) {
        seccion.excepcion_activa = true;
        excepciones.push(seccion.clave);
      } else if (todosValidados) {
        seccion.excepcion_activa = false;
      }
    });

    const excepcionesFinales = todosValidados ? [] : excepciones;

    await PersonaTramiteModel.update(personaId, {
      cuip_validacion: JSON.stringify(cuip),
      cuip_excepciones: JSON.stringify(excepcionesFinales),
      updated_at: new Date()
    });

    return { cuip_validacion: cuip, cuip_excepciones: excepcionesFinales };
  }

  /**
   * Completar validación CUIP
   */
  async completarCuip(personaId, usuarioId) {
    const persona = await PersonaTramiteModel.findForCuip(personaId);
    if (!persona) throw new Error('Persona no encontrada');
    if (persona.fase_cuip !== 'en_proceso') throw new Error('La validación CUIP no está en proceso');

    const cuip = CuipService.parsarYMigrarCuip(persona.cuip_validacion);
    // Verificar que todas las secciones estén completas
    for (const seccion of cuip) {
      const sinRevisar = seccion.campos.filter((campo) => {
        if (CuipService.esCampoCuipOpcional(seccion, campo)) {
          return false;
        }

        return campo.validado === null || campo.validado === undefined;
      });

      if (sinRevisar.length > 0) {
        throw new Error(`La sección "${seccion.nombre}" tiene ${sinRevisar.length} campo(s) sin revisar`);
      }
    }

    await TramiteAltaModel.transaction(async (connection) => {
      await connection.query(
        `UPDATE personas_tramite_alta SET
          fase_cuip = 'completado',
          fecha_fin_cuip = NOW(),
          updated_at = NOW()
        WHERE id = ?`,
        [personaId]
      );

      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
         VALUES (?, ?, 'validacion_cuip', 'validacion_cuip', 'Validación CUIP completada exitosamente')`,
        [persona.tramite_alta_id, usuarioId]
      );
    });
    // Leer DESPUÉS del commit para obtener datos frescos
    return await PersonaTramiteModel.findForCuip(personaId);
  }

  /**
   * Rechazar en validación CUIP
   */
  async rechazarEnCuip(personaId, usuarioId, motivo) {
    const persona = await PersonaTramiteModel.findForCuip(personaId);
    if (!persona) throw new Error('Persona no encontrada');
    if (!motivo?.trim()) throw new Error('El motivo de rechazo es obligatorio');

    await TramiteAltaModel.transaction(async (connection) => {
      await connection.query(
        `UPDATE personas_tramite_alta SET
          fase_cuip = 'rechazado_cuip',
          rechazado = TRUE,
          motivo_rechazo = ?,
          fecha_fin_cuip = NOW(),
          updated_at = NOW()
        WHERE id = ?`,
        [motivo.trim(), personaId]
      );

      await connection.query(
        `INSERT INTO historial_tramites_alta (tramite_alta_id, usuario_id, fase_anterior, fase_nueva, comentario) 
         VALUES (?, ?, 'validacion_cuip', 'validacion_cuip', ?)`,
        [persona.tramite_alta_id, usuarioId, `Rechazado en validación CUIP: ${motivo.trim()}`]
      );
    });
    // Leer DESPUÉS del commit para obtener datos frescos
    return await PersonaTramiteModel.findForCuip(personaId);
  }
}

export default new CuipService();
