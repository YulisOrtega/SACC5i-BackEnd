# Municipios por Analista - SACC5i

## 🚨 IMPORTANTE: Diferencia entre ID y CLAVE

En la base de datos existen **DOS identificadores** para cada municipio:

- **`id`**: ID interno de la base de datos (1, 2, 3, 4...)
- **`clave`**: Clave oficial del municipio (1, 3, 5, 7, 9...)

⚠️ **Al crear un trámite, debes usar el `id` del municipio, NO la clave**

---

## 👤 Belén Rodríguez Marín (ID: 4)

**Región**: Izúcar (ID: 2)  
**Extensión**: 11020  
**Total municipios**: 52

| ID | Clave | Nombre del Municipio |
|----|-------|---------------------|
| 17 | 3 | Acatlán de Osorio |
| 18 | 5 | Acteopan |
| 19 | 7 | Ahuatlán |
| 20 | 9 | Ahuehuetitla |
| 21 | 11 | Albino Zertuche |
| 22 | 21 | Atzala |
| 23 | 22 | Atzitzihuacan |
| 24 | 24 | Axutla |
| 25 | 47 | Chiautla |
| 26 | 51 | Chietla |
| 27 | 52 | Chigmecatitlán |
| 28 | 55 | Chila |
| 29 | 56 | Chila de la Sal |
| 30 | 59 | Chinantla |
| 31 | 31 | Coatzingo |
| 32 | 32 | Cohetzala |
| 33 | 33 | Cohuecan |
| 34 | 42 | Cuayuca de Andrade |
| 35 | 62 | Epatlán |
| 36 | 66 | Guadalupe |
| 37 | 69 | Huaquechula |
| 38 | 70 | Huatlatlauca |
| 39 | 73 | Huehuetlan El Chico |
| 40 | 150 | Huehuetlan El Grande |
| 41 | 81 | Ixcamilpa de Guerrero |
| 42 | 85 | Izucar de Matamoros |
| 43 | 87 | Jolalpan |
| 44 | 95 | Magdalena Tlatlauquitepec |
| 45 | 112 | Petlalcingo |
| 46 | 113 | Piaxtla |
| 47 | 121 | San Diego La Mesa Tochimiltzingo |
| 48 | 127 | San Jeronimo Xayacatlan |
| 49 | 133 | San Martin Totoltepec |
| 50 | 135 | San Miguel Ixitlán |
| 51 | 139 | San Pablo Anicano |
| **52** | **141** | **San Pedro Yeloixtlahuaca** ⬅️ |
| 53 | 146 | Santa Catarina Tlaltempa |
| 54 | 155 | Tecomatlán |
| 55 | 157 | Tehuitzingo |
| 56 | 159 | Teopantlan |
| 57 | 160 | Teotlalco |
| 58 | 165 | Tepemaxalco |
| 59 | 166 | Tepeojuma |
| 60 | 168 | Tepexco |
| 61 | 176 | Tilapa |
| 62 | 185 | Tlapanalá |
| 63 | 190 | Totoltepec de Guerrero |
| 64 | 191 | Tulcingo |
| 65 | 196 | Xayacatlán De Bravo |
| 66 | 198 | Xicotlán |
| 67 | 201 | Xochiltepec |
| 68 | 206 | Zacapala |

---

## Ejemplo de Solicitud Correcta

Si deseas crear un trámite para **San Pedro Yeloixtlahuaca** (clave 141), debes usar:

```json
{
  "tipo_documento": "Oficio",
  "tipo_oficio_id": 1,
  "municipio_id": 52,  ← Usa el ID, no la clave
  "proceso_movimiento": "ALTA",
  "termino": "Normal",
  "dias_horas": "Dias",
  "fecha_sello_c5": "2026-01-20",
  "fecha_recibido_dt": "2026-01-20",
  "fecha_solicitud": "2026-01-20",
  "observaciones": "Trámite urgente"
}
```

## Script de Consulta

Para consultar municipios de cualquier región, usa:

```bash
node scripts/listar-municipios-region.js <region_id>
```

Ejemplo:
```bash
node scripts/listar-municipios-region.js 2  # Región Izúcar
```

---

## Todas las Regiones

| ID | Nombre | Total Municipios |
|----|--------|-----------------|
| 1 | Huejotzingo | 16 |
| 2 | Izúcar | 52 |
| 3 | Cuapiaxtla de Madero | 24 |
| 4 | Libres | 14 |
| 5 | Puebla | 10 |
| 6 | Tehuacán | 27 |
| 7 | Teziutlán | 29 |
| 8 | Zacatlán | 33 |
| 9 | Palmar de Bravo | 12 |
