# Arquitectura en Capas - Guía de Implementación

## 📋 Resumen

El backend ha sido refactorizado siguiendo el patrón **Arquitectura en Capas** (Layered Architecture) para garantizar escalabilidad, mantenibilidad y robustez en un sistema gubernamental crítico.

## 🏗️ Arquitectura Implementada

```
┌──────────────────────────────────────────────────┐
│                   CLIENTE                        │
│              (Frontend React)                    │
└──────────────┬───────────────────────────────────┘
               │ HTTP Request
               ▼
┌──────────────────────────────────────────────────┐
│               CAPA DE RUTAS                      │
│         (Routes: tramitesAltaRoutes.js)          │
│     - Validación de entrada (express-validator)  │
│     - Middleware de autenticación                │
│     - Middleware de roles                        │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│            CAPA DE CONTROLADORES                 │
│        (Controllers: altaController.js)          │
│     - Manejo de req/res (HTTP)                   │
│     - Transformación de datos                    │
│     - Manejo de errores HTTP                     │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│            CAPA DE SERVICIOS                     │
│         (Services: TramiteService.js)            │
│     - Lógica de negocio                          │
│     - Validaciones complejas                     │
│     - Orquestación de operaciones                │
│     - Transacciones                              │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│             CAPA DE MODELOS                      │
│         (Models: TramiteModel.js)                │
│     - Acceso a base de datos                     │
│     - Queries SQL                                │
│     - CRUD genérico                              │
└──────────────┬───────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────┐
│              BASE DE DATOS                       │
│           (MySQL 9.5 - sacc5i_db)                │
└──────────────────────────────────────────────────┘
```

## ✅ Módulo Refactorizado: Catálogos

### Antes (Código monolítico en controller):
```javascript
// catalogosController.js - ANTES
export const getMunicipios = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [municipios] = await connection.query(
      'SELECT m.*, r.nombre as region_nombre FROM municipios m LEFT JOIN regiones r ON m.region_id = r.id ORDER BY m.nombre ASC'
    );
    res.json({ success: true, data: municipios });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
};
```

**Problemas:**
- ❌ SQL embebido en controller
- ❌ Manejo manual de conexiones
- ❌ Lógica de acceso a datos no reutilizable
- ❌ Difícil de testear
- ❌ Violación del principio de responsabilidad única

### Después (Arquitectura en capas):

**1. Model (src/models/MunicipioModel.js)**
```javascript
import BaseModel from './BaseModel.js';

class MunicipioModel extends BaseModel {
  constructor() {
    super('municipios');
  }

  async findAllWithRegion(filters = {}) {
    let query = `
      SELECT m.*, r.nombre as region_nombre 
      FROM municipios m 
      LEFT JOIN regiones r ON m.region_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.region_id) {
      query += ' AND m.region_id = ?';
      params.push(filters.region_id);
    }

    query += ' ORDER BY m.nombre ASC';
    return await this.query(query, params);
  }
}

export default new MunicipioModel();
```

**2. Service (src/services/CatalogoService.js)**
```javascript
import MunicipioModel from '../models/MunicipioModel.js';

class CatalogoService {
  async getMunicipios(filtros = {}) {
    const { region_id, buscar } = filtros;
    return await MunicipioModel.findAllWithRegion({ region_id, buscar });
  }

  async validarMunicipioEnRegion(municipioId, regionId) {
    return await MunicipioModel.belongsToRegion(municipioId, regionId);
  }
}

export default new CatalogoService();
```

**3. Controller (src/controllers/catalogosController.js)**
```javascript
import CatalogoService from '../services/CatalogoService.js';

export const getMunicipios = async (req, res) => {
  try {
    const { region_id, buscar } = req.query;
    const municipios = await CatalogoService.getMunicipios({ region_id, buscar });

    res.json({
      success: true,
      data: municipios
    });

  } catch (error) {
    console.error('Error al obtener municipios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener municipios',
      error: error.message
    });
  }
};
```

**Beneficios:**
- ✅ Código limpio y mantenible
- ✅ Separación clara de responsabilidades
- ✅ Fácil de testear (unit tests por capa)
- ✅ Reutilización de lógica
- ✅ Sin manejo manual de conexiones

## 🔧 Cómo Aplicar a Otros Módulos

### Ejemplo: Refactorizar altaController.js (2100+ líneas)

#### Paso 1: Crear el Model

```javascript
// src/models/TramiteAltaModel.js
import BaseModel from './BaseModel.js';

class TramiteAltaModel extends BaseModel {
  constructor() {
    super('tramites_alta');
  }

  /**
   * Obtener trámites del analista con información relacionada
   */
  async findByAnalistaWithDetails(analistaId, filters = {}) {
    let query = `
      SELECT 
        t.*,
        m.nombre as municipio_nombre,
        to.nombre as tipo_oficio_nombre,
        e.nombre as estatus_nombre
      FROM tramites_alta t
      LEFT JOIN municipios m ON t.municipio_id = m.id
      LEFT JOIN tipos_oficio to ON t.tipo_oficio_id = to.id
      LEFT JOIN estatus_solicitudes e ON t.estatus_id = e.id
      WHERE t.usuario_analista_c5_id = ?
    `;
    const params = [analistaId];

    if (filters.fase_actual) {
      query += ' AND t.fase_actual = ?';
      params.push(filters.fase_actual);
    }

    if (filters.municipio_id) {
      query += ' AND t.municipio_id = ?';
      params.push(filters.municipio_id);
    }

    query += ' ORDER BY t.created_at DESC';

    return await this.query(query, params);
  }

  /**
   * Verificar si existe trámite duplicado
   */
  async existsTramiteDuplicado(municipioId, fechaSolicitud) {
    return await this.exists({
      municipio_id: municipioId,
      fecha_solicitud: fechaSolicitud,
      estatus_id: 1 // Pendiente
    });
  }

  /**
   * Generar número de solicitud único
   */
  async generarNumeroSolicitud() {
    const año = new Date().getFullYear();
    const [lastSolicitud] = await this.query(
      `SELECT numero_solicitud FROM tramites_alta 
       WHERE numero_solicitud LIKE ? 
       ORDER BY id DESC LIMIT 1`,
      [`SACC5i-${año}-%`]
    );

    let nuevoNumero = 1;
    if (lastSolicitud.length > 0) {
      const match = lastSolicitud[0].numero_solicitud.match(/SACC5i-\d+-(\d+)/);
      if (match) nuevoNumero = parseInt(match[1]) + 1;
    }

    return `SACC5i-${año}-${String(nuevoNumero).padStart(4, '0')}`;
  }

  /**
   * Actualizar fase del trámite
   */
  async actualizarFase(tramiteId, nuevaFase, observaciones = null) {
    const updates = {
      fase_actual: nuevaFase,
      updated_at: new Date()
    };

    if (observaciones) {
      updates.observaciones = observaciones;
    }

    return await this.update(tramiteId, updates);
  }
}

export default new TramiteAltaModel();
```

#### Paso 2: Crear el Service

```javascript
// src/services/TramiteAltaService.js
import TramiteAltaModel from '../models/TramiteAltaModel.js';
import PersonaTramiteModel from '../models/PersonaTramiteModel.js';
import MunicipioModel from '../models/MunicipioModel.js';
import HistorialModel from '../models/HistorialModel.js';

class TramiteAltaService {
  /**
   * Crear nueva solicitud de alta
   */
  async crearSolicitud(usuarioId, regionId, datos) {
    // Validar que el municipio pertenezca a la región del analista
    const municipioValido = await MunicipioModel.belongsToRegion(
      datos.municipio_id, 
      regionId
    );

    if (!municipioValido) {
      throw new Error('El municipio no pertenece a tu región asignada');
    }

    // Verificar duplicados
    const existeDuplicado = await TramiteAltaModel.existsTramiteDuplicado(
      datos.municipio_id,
      datos.fecha_solicitud
    );

    if (existeDuplicado) {
      throw new Error('Ya existe una solicitud para este municipio en la misma fecha');
    }

    // Usar transacción para crear solicitud + historial
    return await TramiteAltaModel.transaction(async (connection) => {
      // Generar número de solicitud
      const numero_solicitud = await TramiteAltaModel.generarNumeroSolicitud();

      // Crear solicitud
      const solicitud = await TramiteAltaModel.create({
        numero_solicitud,
        usuario_analista_c5_id: usuarioId,
        ...datos,
        fase_actual: 'datos_solicitud',
        estatus_id: 1
      });

      // Crear entrada en historial
      await HistorialModel.create({
        tramite_id: solicitud.id,
        fase: 'datos_solicitud',
        usuario_id: usuarioId,
        accion: 'Solicitud creada',
        observaciones: 'Solicitud inicializada - Paso 1'
      });

      return solicitud;
    });
  }

  /**
   * Obtener solicitudes del analista
   */
  async obtenerSolicitudesAnalista(analistaId, filtros = {}) {
    return await TramiteAltaModel.findByAnalistaWithDetails(analistaId, filtros);
  }

  /**
   * Enviar solicitud a C3
   */
  async enviarSolicitudAC3(tramiteId, usuarioId) {
    // Obtener trámite
    const tramite = await TramiteAltaModel.findById(tramiteId);
    if (!tramite) {
      throw new Error('Trámite no encontrado');
    }

    // Validar que tenga personas agregadas
    const personas = await PersonaTramiteModel.findByTramite(tramiteId);
    if (personas.length === 0) {
      throw new Error('Debe agregar al menos una persona antes de enviar a C3');
    }

    // Actualizar fase con transacción
    return await TramiteAltaModel.transaction(async (connection) => {
      await TramiteAltaModel.actualizarFase(
        tramiteId,
        'pendiente_c3',
        'Solicitud enviada al Centro C3 para evaluación'
      );

      await HistorialModel.create({
        tramite_id: tramiteId,
        fase: 'pendiente_c3',
        usuario_id: usuarioId,
        accion: 'Enviado a C3',
        observaciones: `${personas.length} personas enviadas para evaluación C3`
      });

      return await TramiteAltaModel.findById(tramiteId);
    });
  }

  /**
   * Obtener estadísticas del dashboard
   */
  async obtenerEstadisticasAnalista(analistaId) {
    const [stats] = await TramiteAltaModel.query(
      `SELECT 
        COUNT(*) as total_tramites,
        COUNT(CASE WHEN fase_actual = 'datos_solicitud' THEN 1 END) as pendientes,
        COUNT(CASE WHEN fase_actual = 'pendiente_c3' THEN 1 END) as en_c3,
        COUNT(CASE WHEN fase_actual = 'completado' THEN 1 END) as completados
      FROM tramites_alta
      WHERE usuario_analista_c5_id = ?`,
      [analistaId]
    );

    return stats || {};
  }
}

export default new TramiteAltaService();
```

#### Paso 3: Refactorizar el Controller

```javascript
// src/controllers/altaController.js - REFACTORIZADO
import TramiteAltaService from '../services/TramiteAltaService.js';

/**
 * PASO 1: Crear nueva solicitud de ALTA
 */
export const crearNuevaSolicitud = async (req, res) => {
  try {
    const usuarioId = req.userId;
    const regionId = req.regionId;
    const datos = req.body;

    const solicitud = await TramiteAltaService.crearSolicitud(
      usuarioId,
      regionId,
      datos
    );

    res.status(201).json({
      success: true,
      message: 'Solicitud creada exitosamente',
      data: solicitud
    });

  } catch (error) {
    console.error('Error al crear solicitud:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear solicitud'
    });
  }
};

/**
 * Obtener mis solicitudes
 */
export const obtenerMisSolicitudes = async (req, res) => {
  try {
    const analistaId = req.userId;
    const filtros = {
      fase_actual: req.query.fase,
      municipio_id: req.query.municipio_id
    };

    const solicitudes = await TramiteAltaService.obtenerSolicitudesAnalista(
      analistaId,
      filtros
    );

    res.json({
      success: true,
      data: solicitudes,
      total: solicitudes.length
    });

  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener solicitudes'
    });
  }
};

/**
 * Enviar solicitud a C3
 */
export const enviarSolicitudAC3 = async (req, res) => {
  try {
    const { tramite_id } = req.body;
    const usuarioId = req.userId;

    const tramite = await TramiteAltaService.enviarSolicitudAC3(
      tramite_id,
      usuarioId
    );

    res.json({
      success: true,
      message: 'Solicitud enviada a C3 exitosamente',
      data: tramite
    });

  } catch (error) {
    console.error('Error al enviar solicitud a C3:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al enviar solicitud a C3'
    });
  }
};
```

## 📝 Checklist de Refactorización

Al refactorizar un módulo, seguir estos pasos:

### 1️⃣ Analizar el Controller Actual
- [ ] Identificar todas las operaciones de base de datos
- [ ] Identificar lógica de negocio compleja
- [ ] Identificar queries repetidos
- [ ] Listar todas las funciones exportadas

### 2️⃣ Crear el Model
- [ ] Extender BaseModel
- [ ] Implementar queries específicos de la entidad
- [ ] Agregar métodos de búsqueda personalizados
- [ ] Agregar validaciones de existencia
- [ ] Exportar como singleton

### 3️⃣ Crear el Service
- [ ] Importar models necesarios
- [ ] Implementar operaciones de negocio
- [ ] Usar transacciones para operaciones complejas
- [ ] Agregar validaciones de negocio
- [ ] Manejar errores con mensajes descriptivos
- [ ] Exportar como singleton

### 4️⃣ Refactorizar el Controller
- [ ] Importar el service
- [ ] Simplificar funciones (solo manejo HTTP)
- [ ] Extraer datos de req
- [ ] Llamar al service
- [ ] Retornar respuesta HTTP apropiada
- [ ] Manejo consistente de errores

### 5️⃣ Probar
- [ ] Servidor inicia sin errores
- [ ] Endpoints responden correctamente
- [ ] Mismo comportamiento que antes
- [ ] Errores se manejan apropiadamente

## 🎯 Beneficios de la Nueva Arquitectura

### Para el Proyecto Gubernamental

1. **Escalabilidad** ✅
   - Fácil agregar nuevas funcionalidades
   - Código modular y organizado
   - Preparado para crecer

2. **Mantenibilidad** ✅
   - Código limpio y legible
   - Fácil localizar y corregir bugs
   - Documentación clara

3. **Robustez** ✅
   - Transacciones para operaciones críticas
   - Manejo centralizado de errores
   - Validaciones en múltiples capas

4. **Testeable** ✅
   - Unit tests por capa
   - Mocks fáciles de implementar
   - CI/CD preparado

5. **Seguridad** ✅
   - SQL injection prevenido (prepared statements)
   - Validaciones de negocio centralizadas
   - Control de acceso por capa

## 🚀 Próximos Pasos

### Módulos Prioritarios a Refactorizar

1. **altaController.js** (2100+ líneas)
   - Crear TramiteAltaModel
   - Crear PersonaTramiteModel
   - Crear TramiteAltaService
   - Refactorizar controller en secciones

2. **adminController.js** (442 líneas)
   - Crear UsuarioModel
   - Crear AdminService
   - Refactorizar gestión de usuarios

3. **authController.js** (228 líneas)
   - Crear AuthService
   - Centralizar lógica de autenticación
   - Mejorar manejo de tokens

4. **dependenciaController.js** (266 líneas)
   - Reutilizar TramiteAltaService
   - Crear DependenciaService específico

## 📚 Recursos Adicionales

- **BaseModel**: Proporciona CRUD genérico, transacciones, paginación
- **Singleton Pattern**: Models y Services se exportan como instancias únicas
- **Async/Await**: Todo el código es asíncrono y moderno
- **Error Handling**: Try-catch consistente en todas las capas

---

## 💡 Ejemplo Completo: Flujo de una Request

```
1. Cliente hace POST /api/tramites/alta
   ↓
2. Route valida datos (express-validator)
   ↓
3. authMiddleware verifica token JWT
   ↓
4. roleMiddleware verifica rol de analista
   ↓
5. Controller extrae datos de req.body
   ↓
6. Service ejecuta lógica de negocio:
   - Valida municipio en región
   - Verifica duplicados
   - Genera número de solicitud
   ↓
7. Model ejecuta queries SQL (transacción):
   - INSERT en tramites_alta
   - INSERT en historial_tramites
   ↓
8. Model devuelve datos a Service
   ↓
9. Service devuelve resultado a Controller
   ↓
10. Controller formatea respuesta HTTP
    ↓
11. Cliente recibe JSON response
```

---

**Fecha de implementación:** 6 de febrero de 2026  
**Versión:** 1.0.0  
**Autor:** Sistema SACC5i - C5i Puebla
