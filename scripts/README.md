# Scripts de Utilidades

Esta carpeta contiene scripts de mantenimiento para el desarrollo.

## ⚠️ IMPORTANTE: Solo para desarrollo

Estos scripts **NO** deben ejecutarse en producción.

---

## 📋 Scripts disponibles

### `limpiar-tramites.js`

**Propósito:** Eliminar todos los trámites de prueba para empezar con datos limpios.

**Elimina:**
- ❌ Todos los trámites
- ❌ Todas las personas de trámites
- ❌ Todo el historial de trámites

**Preserva:**
- ✅ Usuarios (puedes seguir haciendo login)
- ✅ Catálogos (puestos, municipios, dependencias, etc.)

**Uso:**
```bash
npm run limpiar:tramites
```

El script pedirá confirmación antes de ejecutarse. Debes escribir "SI" para confirmar.

**Cuándo usar:**
- Cuando tienes muchos datos de prueba antiguos
- Antes de empezar un nuevo flujo de pruebas
- Cuando quieres verificar el sistema desde cero

**⚠️ Advertencia:**
Esta acción es **IRREVERSIBLE**. Los datos eliminados no se pueden recuperar.

---

### `limpiar-tramites-usuario.js`

**Propósito:** Eliminar solo los trámites de un usuario específico (analista C5), sin vaciar todo el sistema.

**Uso recomendado (simulación, no borra):**
```bash
npm run limpiar:tramites:usuario -- --nombre "Belen Rodriguez"
```

**Aplicar eliminación real:**
```bash
npm run limpiar:tramites:usuario -- --usuario belen.rodriguez --apply
```

**Opcional: también limpiar su dashboard de municipios:**
```bash
npm run limpiar:tramites:usuario -- --id 23 --apply --limpiar-dashboard
```

**Qué elimina (solo del usuario objetivo):**
- ❌ `tramites_alta`
- ❌ `personas_tramite_alta`
- ❌ `historial_tramites_alta`
- ❌ `citas_biometricas` / `finalizados` relacionados (si existen)

**Qué no elimina:**
- ✅ Usuarios
- ✅ Catálogos
- ✅ Trámites de otros usuarios

**Protecciones adicionales:**
1. Modo simulación por defecto
2. Bloqueo en producción
3. Confirmación manual con texto exacto antes de borrar

---

## 🔒 Protecciones de seguridad

Todos los scripts incluyen:
1. **Confirmación manual** antes de ejecutarse
2. **Bloqueo en producción** (si `NODE_ENV=production`)
3. **Resumen de cambios** antes y después

---

## 📝 Cómo agregar nuevos scripts

1. Crea el archivo en esta carpeta: `scripts/mi-script.js`
2. Agrega el comando en `package.json`:
   ```json
   "scripts": {
     "mi:comando": "node scripts/mi-script.js"
   }
   ```
3. Documenta el script en este README
4. Incluye protecciones de seguridad si modifica datos
