# Monitor de Stock GEV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la aplicación HTML/JS de monitorización de stock de GEV-Online (parser de texto pegado, lógica de cierres, Supabase, 5 pantallas) y desplegarla en GitHub Pages.

**Architecture:** Sitio estático multi-archivo (sin bundler, sin framework) servido por GitHub Pages. La lógica de negocio pura (parser, métricas, CSV, flujo de cierres) vive en módulos ES independientes de Supabase y se prueba con `node:test`. El acceso a datos usa un "repo" con una interfaz fija; `supabaseRepo.js` la implementa contra Supabase real (verificado manualmente en navegador), y los tests de lógica de negocio usan un repo falso en memoria. Backend: proyecto Supabase nuevo (Postgres + Auth + RLS).

**Tech Stack:** HTML/CSS/JS vanilla (ES modules), `@supabase/supabase-js@2` vía CDN ESM (`esm.sh`), Node.js `node:test` + `node:assert/strict` para pruebas de lógica pura, GitHub Pages para hosting.

## Global Constraints

- Sin scraping/automatización de GEV-Online — solo copiar/pegar manual (spec §1, §10).
- Solo familia "resistencias" en esta fase; sin soporte multi-familia (spec §2, §10).
- Cero infraestructura de pago; nada de VPS propia (spec §2, §10).
- Login real de Supabase (email + contraseña) obligatorio antes de mostrar cualquier dato (spec §3, §9).
- RLS en las 3 tablas exige `auth.role() = 'authenticated'` (spec §5).
- El estado "en progreso" de un cierre se persiste en Supabase, nunca solo en el navegador (spec §6).
- Un código ausente en un cierre nunca se interpreta como stock = 0; se "congela" en su último valor conocido (spec §6, paso 5).
- El rango de páginas de cada cierre es responsabilidad manual del usuario; la app no lo registra (spec §10).
- Regex de parseo exactas (spec §4): `RE_REPA = /N[ºo°]\s*REPA\s+(\S+)/i`, `RE_PRECIO = /Precio Neto:\s*([\d.,]+)\s*€/i`, `RE_CANT = /^(\d+)\s*(?:CANT|Metro)\s+en stock(?:\s+Barcelona\s+(\d+)\s*(?:CANT|Metro))?/i`.
- Estados de disponibilidad ("en Stock", "1-2 días", "1-2 Semanas", "temp. no disponible", "ya no disponible") se ignoran siempre — solo importa la cantidad (spec §4, confirmado por el usuario).

---

## File Structure

```
monitoreo GEV/
├── index.html
├── css/styles.css
├── package.json
├── js/
│   ├── parser.js            (Task 2)
│   ├── parser.test.js       (Task 2)
│   ├── metrics.js           (Task 3)
│   ├── metrics.test.js      (Task 3)
│   ├── csv.js                (Task 4)
│   ├── csv.test.js           (Task 4)
│   ├── cierreService.js      (Task 5)
│   ├── cierreService.test.js (Task 5)
│   ├── supabaseClient.js     (Task 7)
│   ├── supabaseRepo.js       (Task 7)
│   ├── auth.js                (Task 7)
│   ├── router.js              (Task 12)
│   ├── app.js                  (Task 12)
│   └── screens/
│       ├── login.js           (Task 7)
│       ├── cargarCierre.js    (Task 8)
│       ├── ranking.js         (Task 9)
│       ├── fichaHistorica.js  (Task 10)
│       ├── listadoCierres.js  (Task 11)
│       └── comparadorEstacional.js (Task 11)
└── supabase/
    └── migrations/
        └── 0001_init.sql       (Task 6)
```

---

### Task 1: Scaffolding del proyecto

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `css/styles.css`
- Create: `js/sanity.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: comando `npm test` funcionando con `node --test js/*.test.js`; estructura HTML base con `<main id="app"></main>` y `<nav id="nav"></nav>` que usarán las pantallas futuras.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "monitor-stock-gev",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test js/*.test.js"
  }
}
```

- [ ] **Step 2: Crear `.gitignore`**

```
node_modules/
.DS_Store
```

- [ ] **Step 3: Crear test de humo `js/sanity.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('el entorno de pruebas funciona', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 4: Ejecutar y verificar**

Run: `npm test`
Expected: `# pass 1`, exit code 0.

- [ ] **Step 5: Crear `index.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Monitor de Stock GEV</title>
  <link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <nav id="nav" hidden>
    <a href="#cargar-cierre">Cargar cierre</a>
    <a href="#ranking">Ranking</a>
    <a href="#ficha-historica">Ficha histórica</a>
    <a href="#listado-cierres">Listado de cierres</a>
    <a href="#comparador-estacional">Comparador estacional</a>
    <button id="btn-logout">Salir</button>
  </nav>
  <main id="app"></main>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 6: Crear `css/styles.css`**

```css
:root {
  color-scheme: light dark;
  --gap: 0.75rem;
}
* { box-sizing: border-box; }
body { font-family: system-ui, sans-serif; margin: 0; padding: 0; }
#nav { display: flex; gap: var(--gap); padding: var(--gap); border-bottom: 1px solid #8884; flex-wrap: wrap; align-items: center; }
#nav a { text-decoration: none; padding: 0.4rem 0.6rem; border-radius: 6px; }
#nav a:hover { background: #8882; }
#app { padding: var(--gap); max-width: 1100px; margin: 0 auto; }
table { border-collapse: collapse; width: 100%; }
th, td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #8884; text-align: left; font-size: 0.9rem; }
.aviso { padding: 0.6rem; border-radius: 6px; margin: 0.5rem 0; }
.aviso-nuevo { background: #2a7d4630; }
.aviso-desaparecido { background: #b5433030; }
.aviso-duplicado { background: #d9a52630; }
button { cursor: pointer; }
</style>
```

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore index.html css/styles.css js/sanity.test.js
git commit -m "chore: scaffold project structure and test runner"
```

---

### Task 2: Parser de texto pegado (TDD)

**Files:**
- Create: `js/parser.js`
- Test: `js/parser.test.js`

**Interfaces:**
- Produces: `parseBloque(texto: string) => { articulos: Array<{codigo, descripcion, precioNeto, cantidadTotal, cantidadBarcelona}>, noReconocidos: number }`. `precioNeto` es `number|null`. Usado por Task 8 (`screens/cargarCierre.js`).

- [ ] **Step 1: Escribir el test con el bloque de validación completo del spec (6 artículos, todos los casos especiales)**

```js
// js/parser.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBloque } from './parser.js';

const BLOQUE_VALIDACION = `preview
Resistencia 1000 W 380 V L 445 mm
Nº REPA PT00003994
Precio lista: 167,26 €
Precio Neto: 150,53 €
en Stock
1640 CANT en stock Barcelona 14 CANT

1

Articulo no ubicado en tienda, consultar en mostrador
preview
Radiador cerámico 250 W 230 V L 245 mm H 35 mm An 60 mm cable cables perlizados
Un artículo alternativo está disponible
Nº REPA 415101
Precio lista: 65,24 €
Precio Neto: 32,62 €
en Stock
275 CANT en stock Barcelona 28 CANT

1

Articulo no ubicado en tienda, consultar en mostrador
preview
Registro de calefacción 2x1000W 230 V L 200 mm H 44 mm An 35 mm limitación de temperatura 90 °C
Un artículo alternativo está disponible
Nº REPA LF3355363
Precio lista: 13,00 €
Precio Neto: 13,00 €
en Stock
157 CANT en stock Barcelona 5 CANT

1

Articulo no ubicado en tienda, consultar en mostrador
preview
fondo calentador 1800W 230V espirales 1 ø 196mm termostato 128°C M5 distancia de sujeción 180mm
sustituido por 775550
Nº REPA 415760
temp. no disponible
89 CANT en stock
Articulo no ubicado en tienda, consultar en mostrador
preview
ELEMENT - 13.25, 725W, 220V, 0.55
Nº REPA PT00004066
ya no disponible
0 CANT en stock
Articulo no ubicado en tienda, consultar en mostrador
preview
cable de calentamiento 230V 1756Ohm/m 30W/m ø 7mm UE al metro
Nº REPA 416341
Precio lista: 3,50 €
Precio Neto: 3,50 €
en Stock
720 Metro en stock Barcelona 520 Metro

1

Articulo no ubicado en tienda, consultar en mostrador`;

test('parsea los 6 artículos del bloque de validación', () => {
  const { articulos, noReconocidos } = parseBloque(BLOQUE_VALIDACION);
  assert.equal(articulos.length, 6);
  assert.equal(noReconocidos, 0);
});

test('extrae correctamente el artículo con prefijo PT y precio normal', () => {
  const { articulos } = parseBloque(BLOQUE_VALIDACION);
  const a = articulos[0];
  assert.equal(a.codigo, 'PT00003994');
  assert.equal(a.descripcion, 'Resistencia 1000 W 380 V L 445 mm');
  assert.equal(a.precioNeto, 150.53);
  assert.equal(a.cantidadTotal, 1640);
  assert.equal(a.cantidadBarcelona, 14);
});

test('ignora la línea "Un artículo alternativo está disponible"', () => {
  const { articulos } = parseBloque(BLOQUE_VALIDACION);
  const a = articulos[1];
  assert.equal(a.codigo, '415101');
  assert.equal(a.descripcion, 'Radiador cerámico 250 W 230 V L 245 mm H 35 mm An 60 mm cable cables perlizados');
});

test('extrae correctamente el código con prefijo LF', () => {
  const { articulos } = parseBloque(BLOQUE_VALIDACION);
  assert.equal(articulos[2].codigo, 'LF3355363');
});

test('ignora "sustituido por X" y trata el precio como null cuando no hay Precio Neto', () => {
  const { articulos } = parseBloque(BLOQUE_VALIDACION);
  const a = articulos[3];
  assert.equal(a.codigo, '415760');
  assert.equal(a.descripcion, 'fondo calentador 1800W 230V espirales 1 ø 196mm termostato 128°C M5 distancia de sujeción 180mm');
  assert.equal(a.precioNeto, null);
  assert.equal(a.cantidadTotal, 89);
  assert.equal(a.cantidadBarcelona, 0);
});

test('reconoce cantidad 0 como artículo válido (no como no-reconocido)', () => {
  const { articulos } = parseBloque(BLOQUE_VALIDACION);
  const a = articulos[4];
  assert.equal(a.codigo, 'PT00004066');
  assert.equal(a.cantidadTotal, 0);
  assert.equal(a.precioNeto, null);
});

test('trata la unidad "Metro" igual que "CANT"', () => {
  const { articulos } = parseBloque(BLOQUE_VALIDACION);
  const a = articulos[5];
  assert.equal(a.codigo, '416341');
  assert.equal(a.cantidadTotal, 720);
  assert.equal(a.cantidadBarcelona, 520);
});

test('funciona aunque el primer bloque no empiece con la palabra "preview" (pegado a media página)', () => {
  const sinPreviewInicial = BLOQUE_VALIDACION.replace(/^preview\n/, '');
  const { articulos } = parseBloque(sinPreviewInicial);
  assert.equal(articulos.length, 6);
  assert.equal(articulos[0].codigo, 'PT00003994');
});

test('cuenta como no reconocido un bloque sin "Nº REPA" seguido de cantidad', () => {
  const textoRoto = `preview
Descripción huérfana sin código ni cantidad
Articulo no ubicado en tienda, consultar en mostrador`;
  const { articulos, noReconocidos } = parseBloque(textoRoto);
  assert.equal(articulos.length, 0);
  assert.equal(noReconocidos, 0);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL — `parser.js` no existe / `parseBloque is not a function`.

- [ ] **Step 3: Implementar `js/parser.js`**

```js
const RE_REPA = /N[ºo°]\s*REPA\s+(\S+)/i;
const RE_PRECIO = /Precio Neto:\s*([\d.,]+)\s*€/i;
const RE_CANT = /^(\d+)\s*(?:CANT|Metro)\s+en stock(?:\s+Barcelona\s+(\d+)\s*(?:CANT|Metro))?/i;
const LINEAS_DESCARTABLES = new Set([
  'preview',
  'un artículo alternativo está disponible',
]);
const VENTANA_BUSQUEDA = 20;

function esLineaDescriptiva(linea) {
  const limpia = linea.trim();
  if (limpia === '') return false;
  const minuscula = limpia.toLowerCase();
  if (LINEAS_DESCARTABLES.has(minuscula)) return false;
  if (minuscula.startsWith('sustituido por')) return false;
  return true;
}

function parsePrecio(texto) {
  return parseFloat(texto.replace(/\./g, '').replace(',', '.'));
}

export function parseBloque(texto) {
  const lineas = texto.split(/\r?\n/);
  const articulos = [];
  let noReconocidos = 0;

  for (let i = 0; i < lineas.length; i++) {
    const matchRepa = lineas[i].match(RE_REPA);
    if (!matchRepa) continue;
    const codigo = matchRepa[1];

    let descripcion = null;
    for (let j = i - 1; j >= 0 && j >= i - VENTANA_BUSQUEDA; j--) {
      if (esLineaDescriptiva(lineas[j])) {
        descripcion = lineas[j].trim();
        break;
      }
    }

    let precioNeto = null;
    let cantidadTotal = null;
    let cantidadBarcelona = 0;
    for (let k = i + 1; k < lineas.length && k < i + VENTANA_BUSQUEDA; k++) {
      if (RE_REPA.test(lineas[k])) break;
      if (precioNeto === null) {
        const matchPrecio = lineas[k].match(RE_PRECIO);
        if (matchPrecio) precioNeto = parsePrecio(matchPrecio[1]);
      }
      const matchCant = lineas[k].match(RE_CANT);
      if (matchCant) {
        cantidadTotal = parseInt(matchCant[1], 10);
        cantidadBarcelona = matchCant[2] ? parseInt(matchCant[2], 10) : 0;
        break;
      }
    }

    if (descripcion === null || cantidadTotal === null) {
      noReconocidos++;
      continue;
    }

    articulos.push({ codigo, descripcion, precioNeto, cantidadTotal, cantidadBarcelona });
  }

  return { articulos, noReconocidos };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: todos los tests de `parser.test.js` en PASS.

- [ ] **Step 5: Commit**

```bash
git add js/parser.js js/parser.test.js
git commit -m "feat: parser de bloques de texto pegado de GEV-Online"
```

---

### Task 3: Módulo de métricas (TDD)

**Files:**
- Create: `js/metrics.js`
- Test: `js/metrics.test.js`

**Interfaces:**
- Consumes: nada (módulo puro).
- Produces: `calcularMetricasCodigo(lecturas: Array<{fecha: string, cantidadTotal: number}>) => {vendidoEstimado, repuestoEstimado, nEventosVenta, nEventosReposicion, diasMediosEntreVentas, diasMediosEntreReposiciones, stockInicial, stockActual, nLecturas}`; `calcularRanking(productos: Array<{codigo, descripcion, lecturas}>) => Array<{codigo, descripcion, ...métricas}>` ordenado por `vendidoEstimado` descendente. Usado por Task 9 (`screens/ranking.js`) y Task 11 (`screens/comparadorEstacional.js`).

- [ ] **Step 1: Escribir el test con la secuencia de validación del spec (§8) y casos límite**

```js
// js/metrics.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularMetricasCodigo, calcularRanking } from './metrics.js';

test('calcula vendido y repuesto estimados según la secuencia de validación del spec', () => {
  const lecturas = [
    { fecha: '2026-07-09', cantidadTotal: 100 },
    { fecha: '2026-07-11', cantidadTotal: 70 },
    { fecha: '2026-07-14', cantidadTotal: 150 },
    { fecha: '2026-07-16', cantidadTotal: 120 },
  ];
  const m = calcularMetricasCodigo(lecturas);
  assert.equal(m.vendidoEstimado, 60);
  assert.equal(m.repuestoEstimado, 80);
  assert.equal(m.stockInicial, 100);
  assert.equal(m.stockActual, 120);
  assert.equal(m.nLecturas, 4);
});

test('cuenta eventos de venta y reposición por separado', () => {
  const lecturas = [
    { fecha: '2026-07-09', cantidadTotal: 100 },
    { fecha: '2026-07-11', cantidadTotal: 70 },
    { fecha: '2026-07-14', cantidadTotal: 150 },
    { fecha: '2026-07-16', cantidadTotal: 120 },
  ];
  const m = calcularMetricasCodigo(lecturas);
  assert.equal(m.nEventosVenta, 2);
  assert.equal(m.nEventosReposicion, 1);
});

test('calcula días medios entre eventos de venta', () => {
  const lecturas = [
    { fecha: '2026-07-01', cantidadTotal: 100 },
    { fecha: '2026-07-04', cantidadTotal: 90 },
    { fecha: '2026-07-10', cantidadTotal: 80 },
  ];
  const m = calcularMetricasCodigo(lecturas);
  assert.equal(m.nEventosVenta, 2);
  assert.equal(m.diasMediosEntreVentas, 6);
});

test('devuelve null en días medios cuando hay menos de 2 eventos del mismo tipo', () => {
  const lecturas = [
    { fecha: '2026-07-01', cantidadTotal: 100 },
    { fecha: '2026-07-04', cantidadTotal: 90 },
  ];
  const m = calcularMetricasCodigo(lecturas);
  assert.equal(m.nEventosVenta, 1);
  assert.equal(m.diasMediosEntreVentas, null);
  assert.equal(m.nEventosReposicion, 0);
  assert.equal(m.diasMediosEntreReposiciones, null);
});

test('ordena lecturas por fecha aunque lleguen desordenadas', () => {
  const lecturas = [
    { fecha: '2026-07-16', cantidadTotal: 120 },
    { fecha: '2026-07-09', cantidadTotal: 100 },
    { fecha: '2026-07-11', cantidadTotal: 70 },
  ];
  const m = calcularMetricasCodigo(lecturas);
  assert.equal(m.stockInicial, 100);
  assert.equal(m.stockActual, 120);
  assert.equal(m.vendidoEstimado, 30);
});

test('calcularRanking ordena productos por vendido estimado descendente', () => {
  const productos = [
    {
      codigo: 'A',
      descripcion: 'Poco vendido',
      lecturas: [
        { fecha: '2026-07-01', cantidadTotal: 100 },
        { fecha: '2026-07-08', cantidadTotal: 95 },
      ],
    },
    {
      codigo: 'B',
      descripcion: 'Muy vendido',
      lecturas: [
        { fecha: '2026-07-01', cantidadTotal: 500 },
        { fecha: '2026-07-08', cantidadTotal: 100 },
      ],
    },
  ];
  const ranking = calcularRanking(productos);
  assert.equal(ranking[0].codigo, 'B');
  assert.equal(ranking[0].vendidoEstimado, 400);
  assert.equal(ranking[1].codigo, 'A');
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL — `metrics.js` no existe.

- [ ] **Step 3: Implementar `js/metrics.js`**

```js
const MS_POR_DIA = 1000 * 60 * 60 * 24;

function diferenciaDias(fechaA, fechaB) {
  return Math.round((new Date(fechaB) - new Date(fechaA)) / MS_POR_DIA);
}

function diasMediosEntreFechas(fechas) {
  if (fechas.length < 2) return null;
  let total = 0;
  for (let i = 1; i < fechas.length; i++) {
    total += diferenciaDias(fechas[i - 1], fechas[i]);
  }
  return total / (fechas.length - 1);
}

export function calcularMetricasCodigo(lecturas) {
  const ordenadas = [...lecturas].sort((a, b) => a.fecha.localeCompare(b.fecha));

  let vendidoEstimado = 0;
  let repuestoEstimado = 0;
  const fechasVenta = [];
  const fechasReposicion = [];

  for (let i = 1; i < ordenadas.length; i++) {
    const delta = ordenadas[i].cantidadTotal - ordenadas[i - 1].cantidadTotal;
    if (delta < 0) {
      vendidoEstimado += -delta;
      fechasVenta.push(ordenadas[i].fecha);
    } else if (delta > 0) {
      repuestoEstimado += delta;
      fechasReposicion.push(ordenadas[i].fecha);
    }
  }

  return {
    vendidoEstimado,
    repuestoEstimado,
    nEventosVenta: fechasVenta.length,
    nEventosReposicion: fechasReposicion.length,
    diasMediosEntreVentas: diasMediosEntreFechas(fechasVenta),
    diasMediosEntreReposiciones: diasMediosEntreFechas(fechasReposicion),
    stockInicial: ordenadas.length > 0 ? ordenadas[0].cantidadTotal : null,
    stockActual: ordenadas.length > 0 ? ordenadas[ordenadas.length - 1].cantidadTotal : null,
    nLecturas: ordenadas.length,
  };
}

export function calcularRanking(productos) {
  return productos
    .map((p) => ({
      codigo: p.codigo,
      descripcion: p.descripcion,
      ...calcularMetricasCodigo(p.lecturas),
    }))
    .sort((a, b) => b.vendidoEstimado - a.vendidoEstimado);
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: todos los tests de `metrics.test.js` en PASS.

- [ ] **Step 5: Commit**

```bash
git add js/metrics.js js/metrics.test.js
git commit -m "feat: cálculo de métricas de ranking (venta, reposición, frecuencia)"
```

---

### Task 4: Exportación CSV (TDD)

**Files:**
- Create: `js/csv.js`
- Test: `js/csv.test.js`

**Interfaces:**
- Produces: `aCSV(filas: Array<object>, columnas: Array<{key: string, label: string}>) => string`. Usado por Task 9, 10 y 11.

- [ ] **Step 1: Escribir el test**

```js
// js/csv.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aCSV } from './csv.js';

test('genera cabecera y filas separadas por coma', () => {
  const filas = [{ codigo: 'A1', vendido: 10 }, { codigo: 'B2', vendido: 5 }];
  const columnas = [{ key: 'codigo', label: 'Código' }, { key: 'vendido', label: 'Vendido' }];
  const csv = aCSV(filas, columnas);
  assert.equal(csv, 'Código,Vendido\nA1,10\nB2,5');
});

test('escapa valores con comas envolviéndolos en comillas', () => {
  const filas = [{ desc: 'Resistencia 1000W, 230V' }];
  const columnas = [{ key: 'desc', label: 'Descripción' }];
  const csv = aCSV(filas, columnas);
  assert.equal(csv, 'Descripción\n"Resistencia 1000W, 230V"');
});

test('escapa comillas dobles duplicándolas', () => {
  const filas = [{ desc: 'Tubo de 12" diámetro' }];
  const columnas = [{ key: 'desc', label: 'Descripción' }];
  const csv = aCSV(filas, columnas);
  assert.equal(csv, 'Descripción\n"Tubo de 12"" diámetro"');
});

test('trata null/undefined como celda vacía', () => {
  const filas = [{ precio: null }, { precio: undefined }];
  const columnas = [{ key: 'precio', label: 'Precio' }];
  const csv = aCSV(filas, columnas);
  assert.equal(csv, 'Precio\n\n');
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL — `csv.js` no existe.

- [ ] **Step 3: Implementar `js/csv.js`**

```js
function escaparCelda(valor) {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  if (/[",\n]/.test(texto)) {
    return '"' + texto.replace(/"/g, '""') + '"';
  }
  return texto;
}

export function aCSV(filas, columnas) {
  const cabecera = columnas.map((c) => escaparCelda(c.label)).join(',');
  const lineas = filas.map((fila) => columnas.map((c) => escaparCelda(fila[c.key])).join(','));
  return [cabecera, ...lineas].join('\n');
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: todos los tests de `csv.test.js` en PASS.

- [ ] **Step 5: Commit**

```bash
git add js/csv.js js/csv.test.js
git commit -m "feat: exportación de tablas a CSV"
```

---

### Task 5: Lógica de negocio de cierres (TDD, repo en memoria)

**Files:**
- Create: `js/cierreService.js`
- Test: `js/cierreService.test.js`

**Interfaces:**
- Consumes: un objeto `repo` con los métodos: `getCierreEnProgreso()`, `crearCierre(fecha)`, `getCodigosGuardados(cierreId)`, `guardarLecturas(cierreId, articulos)`, `getCodigosDeCierre(cierreId)`, `getUltimoCierreFinalizado(antesDeCierreId)`, `finalizarCierre(cierreId)`. Esta es la interfaz que `js/supabaseRepo.js` (Task 7) deberá implementar contra Supabase real.
- Produces: `abrirOReanudarCierre(repo, fechaPorDefecto)`, `procesarBloque(repo, cierreId, articulos)`, `guardarArticulos(repo, cierreId, articulos, opciones)`, `finalizarCierre(repo, cierreId)`. Usado por Task 8 (`screens/cargarCierre.js`).

- [ ] **Step 1: Escribir el test con un repo falso en memoria**

```js
// js/cierreService.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abrirOReanudarCierre,
  procesarBloque,
  guardarArticulos,
  finalizarCierre,
} from './cierreService.js';

function crearRepoFalso() {
  const cierres = []; // {id, fecha, estado}
  const lecturas = []; // {cierreId, codigo, ...}
  let siguienteId = 1;

  return {
    async getCierreEnProgreso() {
      return cierres.find((c) => c.estado === 'en_progreso') || null;
    },
    async crearCierre(fecha) {
      const cierre = { id: siguienteId++, fecha, estado: 'en_progreso' };
      cierres.push(cierre);
      return cierre;
    },
    async getCodigosGuardados(cierreId) {
      return new Set(lecturas.filter((l) => l.cierreId === cierreId).map((l) => l.codigo));
    },
    async guardarLecturas(cierreId, articulos) {
      for (const a of articulos) {
        const existente = lecturas.find((l) => l.cierreId === cierreId && l.codigo === a.codigo);
        if (existente) Object.assign(existente, a);
        else lecturas.push({ cierreId, ...a });
      }
    },
    async getCodigosDeCierre(cierreId) {
      return lecturas.filter((l) => l.cierreId === cierreId).map((l) => l.codigo);
    },
    async getUltimoCierreFinalizado(antesDeCierreId) {
      const finalizados = cierres
        .filter((c) => c.estado === 'finalizado' && c.id < antesDeCierreId)
        .sort((a, b) => b.id - a.id);
      return finalizados[0] || null;
    },
    async finalizarCierre(cierreId) {
      const cierre = cierres.find((c) => c.id === cierreId);
      cierre.estado = 'finalizado';
    },
    // helpers de inspección para los tests
    _cierres: cierres,
    _lecturas: lecturas,
  };
}

test('abrirOReanudarCierre crea uno nuevo si no hay ninguno en progreso', async () => {
  const repo = crearRepoFalso();
  const cierre = await abrirOReanudarCierre(repo, '2026-07-09');
  assert.equal(cierre.fecha, '2026-07-09');
  assert.equal(cierre.estado, 'en_progreso');
});

test('abrirOReanudarCierre reanuda el existente en progreso en vez de crear otro', async () => {
  const repo = crearRepoFalso();
  const primero = await abrirOReanudarCierre(repo, '2026-07-09');
  const segundo = await abrirOReanudarCierre(repo, '2026-07-10');
  assert.equal(segundo.id, primero.id);
  assert.equal(repo._cierres.length, 1);
});

test('procesarBloque separa artículos nuevos de duplicados dentro del mismo cierre', async () => {
  const repo = crearRepoFalso();
  const cierre = await repo.crearCierre('2026-07-09');
  await repo.guardarLecturas(cierre.id, [{ codigo: 'A1', cantidadTotal: 10 }]);

  const { nuevos, duplicados } = await procesarBloque(repo, cierre.id, [
    { codigo: 'A1', cantidadTotal: 12 },
    { codigo: 'B2', cantidadTotal: 5 },
  ]);

  assert.equal(nuevos.length, 1);
  assert.equal(nuevos[0].codigo, 'B2');
  assert.equal(duplicados.length, 1);
  assert.equal(duplicados[0].codigo, 'A1');
});

test('guardarArticulos con sobrescribirDuplicados=false ignora los duplicados', async () => {
  const repo = crearRepoFalso();
  const cierre = await repo.crearCierre('2026-07-09');
  await repo.guardarLecturas(cierre.id, [{ codigo: 'A1', cantidadTotal: 10 }]);

  const guardados = await guardarArticulos(
    repo,
    cierre.id,
    [{ codigo: 'A1', cantidadTotal: 999 }, { codigo: 'B2', cantidadTotal: 5 }],
    { sobrescribirDuplicados: false }
  );

  assert.equal(guardados, 1);
  const a1 = repo._lecturas.find((l) => l.codigo === 'A1');
  assert.equal(a1.cantidadTotal, 10);
});

test('guardarArticulos con sobrescribirDuplicados=true actualiza el valor', async () => {
  const repo = crearRepoFalso();
  const cierre = await repo.crearCierre('2026-07-09');
  await repo.guardarLecturas(cierre.id, [{ codigo: 'A1', cantidadTotal: 10 }]);

  await guardarArticulos(repo, cierre.id, [{ codigo: 'A1', cantidadTotal: 999 }], {
    sobrescribirDuplicados: true,
  });

  const a1 = repo._lecturas.find((l) => l.codigo === 'A1');
  assert.equal(a1.cantidadTotal, 999);
});

test('finalizarCierre en el primer cierre no reporta nuevos ni desaparecidos', async () => {
  const repo = crearRepoFalso();
  const cierre = await repo.crearCierre('2026-07-09');
  await repo.guardarLecturas(cierre.id, [{ codigo: 'A1' }, { codigo: 'B2' }]);

  const { nuevos, desaparecidos } = await finalizarCierre(repo, cierre.id);

  assert.deepEqual(nuevos.sort(), ['A1', 'B2']);
  assert.deepEqual(desaparecidos, []);
  const actualizado = repo._cierres.find((c) => c.id === cierre.id);
  assert.equal(actualizado.estado, 'finalizado');
});

test('finalizarCierre detecta códigos nuevos y desaparecidos respecto al cierre anterior', async () => {
  const repo = crearRepoFalso();

  const cierre1 = await repo.crearCierre('2026-07-09');
  await repo.guardarLecturas(cierre1.id, [{ codigo: 'A1' }, { codigo: 'B2' }]);
  await finalizarCierre(repo, cierre1.id);

  const cierre2 = await repo.crearCierre('2026-07-11');
  await repo.guardarLecturas(cierre2.id, [{ codigo: 'A1' }, { codigo: 'C3' }]);
  const { nuevos, desaparecidos } = await finalizarCierre(repo, cierre2.id);

  assert.deepEqual(nuevos, ['C3']);
  assert.deepEqual(desaparecidos, ['B2']);
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test`
Expected: FAIL — `cierreService.js` no existe.

- [ ] **Step 3: Implementar `js/cierreService.js`**

```js
export async function abrirOReanudarCierre(repo, fechaPorDefecto) {
  const enProgreso = await repo.getCierreEnProgreso();
  if (enProgreso) return enProgreso;
  return repo.crearCierre(fechaPorDefecto);
}

export async function procesarBloque(repo, cierreId, articulos) {
  const codigosGuardados = await repo.getCodigosGuardados(cierreId);
  const nuevos = articulos.filter((a) => !codigosGuardados.has(a.codigo));
  const duplicados = articulos.filter((a) => codigosGuardados.has(a.codigo));
  return { nuevos, duplicados };
}

export async function guardarArticulos(repo, cierreId, articulos, { sobrescribirDuplicados }) {
  const aGuardar = sobrescribirDuplicados
    ? articulos
    : (await procesarBloque(repo, cierreId, articulos)).nuevos;
  await repo.guardarLecturas(cierreId, aGuardar);
  return aGuardar.length;
}

export async function finalizarCierre(repo, cierreId) {
  const codigosActuales = new Set(await repo.getCodigosDeCierre(cierreId));
  const anterior = await repo.getUltimoCierreFinalizado(cierreId);

  let nuevos = [...codigosActuales];
  let desaparecidos = [];

  if (anterior) {
    const codigosAnteriores = new Set(await repo.getCodigosDeCierre(anterior.id));
    nuevos = [...codigosActuales].filter((c) => !codigosAnteriores.has(c));
    desaparecidos = [...codigosAnteriores].filter((c) => !codigosActuales.has(c));
  }

  await repo.finalizarCierre(cierreId);

  return { nuevos, desaparecidos };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npm test`
Expected: todos los tests de `cierreService.test.js` en PASS.

- [ ] **Step 5: Commit**

```bash
git add js/cierreService.js js/cierreService.test.js
git commit -m "feat: lógica de negocio de apertura/guardado/cierre de cierres"
```

---

### Task 6: Proyecto Supabase, esquema y RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: proyecto Supabase nuevo con tablas `productos`, `cierres`, `lecturas_stock` (esquema exacto del spec §5), RLS activado, y email auth habilitado. Usado por Task 7 (`supabaseRepo.js`, `supabaseClient.js`).

- [ ] **Step 1: Crear el proyecto Supabase**

Usar la herramienta MCP de Supabase (`create_project`) preguntando primero la organización al usuario si hay más de una. Nombre sugerido: `monitor-stock-gev`. Región: la más cercana a Marruecos/España disponible (`eu-west-1` o `eu-west-3`). Confirmar el coste con `confirm_cost` antes de crear, tal como exige la herramienta.

- [ ] **Step 2: Crear `supabase/migrations/0001_init.sql`**

```sql
create table productos (
  codigo text primary key,
  descripcion text not null,
  primera_vez_visto date not null default current_date,
  ultima_vez_visto date not null default current_date
);

create table cierres (
  id bigint generated always as identity primary key,
  fecha date not null unique,
  estado text not null default 'en_progreso' check (estado in ('en_progreso','finalizado')),
  n_codigos integer not null default 0,
  created_at timestamptz not null default now(),
  finalizado_at timestamptz
);

create table lecturas_stock (
  id bigint generated always as identity primary key,
  cierre_id bigint not null references cierres(id) on delete cascade,
  codigo text not null references productos(codigo),
  cantidad_total integer not null,
  cantidad_barcelona integer not null default 0,
  precio_neto numeric(10,2),
  created_at timestamptz not null default now(),
  unique (cierre_id, codigo)
);

create index idx_lecturas_codigo on lecturas_stock (codigo);
create index idx_lecturas_cierre on lecturas_stock (cierre_id);

alter table productos enable row level security;
alter table cierres enable row level security;
alter table lecturas_stock enable row level security;

create policy "authenticated_all_productos" on productos
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_cierres" on cierres
  for all to authenticated using (true) with check (true);

create policy "authenticated_all_lecturas_stock" on lecturas_stock
  for all to authenticated using (true) with check (true);
```

- [ ] **Step 3: Aplicar la migración**

Usar la herramienta MCP `apply_migration` del proyecto recién creado, con el contenido de `0001_init.sql` y el nombre `init`.

- [ ] **Step 4: Verificar el esquema**

Usar `list_tables` sobre el proyecto y comprobar que aparecen `productos`, `cierres` y `lecturas_stock` con RLS habilitado (`rls_enabled: true`).

- [ ] **Step 5: Verificar advisors de seguridad**

Usar `get_advisors` (tipo `security`) y confirmar que no hay avisos de tablas sin RLS. Si aparece alguno, corregirlo antes de continuar.

- [ ] **Step 6: Crear el usuario de login**

Con `execute_sql` (o desde el panel de Supabase Auth), crear el único usuario autorizado usando el email que indique el usuario. Confirmar la contraseña con el usuario por chat antes de crearla — **no la generes tú mismo sin decírsela**, porque la necesitará para entrar en la app.

- [ ] **Step 7: Guardar la URL y clave pública del proyecto**

Usar `get_project_url` y `get_publishable_keys`; anotarlas para usarlas literalmente en `js/supabaseClient.js` (Task 7).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: esquema inicial de Supabase (productos, cierres, lecturas_stock) con RLS"
```

---

### Task 7: Cliente Supabase, autenticación y adaptador de repo

**Files:**
- Create: `js/supabaseClient.js`
- Create: `js/auth.js`
- Create: `js/supabaseRepo.js`
- Create: `js/screens/login.js`

**Interfaces:**
- Consumes: URL y clave pública del proyecto (Task 6); interfaz de repo definida en Task 5.
- Produces: `getSupabaseClient()`, `iniciarSesion(email, password)`, `cerrarSesion()`, `sesionActual()`, `onCambioSesion(callback)` (en `auth.js`); `supabaseRepo` implementando todos los métodos consumidos por `cierreService.js` más los de lectura para las pantallas (`listarCierres`, `eliminarCierre`, `listarProductosConLecturas`, `buscarProducto`, `getLecturasProducto`, `getTodasLasLecturas`); `montarLogin(contenedor)` en `screens/login.js`.

- [ ] **Step 1: Crear `js/supabaseClient.js`**

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'REEMPLAZAR_CON_LA_URL_DEL_PROYECTO';
const SUPABASE_ANON_KEY = 'REEMPLAZAR_CON_LA_CLAVE_PUBLICA';

let cliente = null;

export function getSupabaseClient() {
  if (!cliente) {
    cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return cliente;
}
```

Al ejecutar este paso, sustituir `SUPABASE_URL` y `SUPABASE_ANON_KEY` por los valores reales obtenidos en Task 6, Step 7.

- [ ] **Step 2: Crear `js/auth.js`**

```js
import { getSupabaseClient } from './supabaseClient.js';

export async function iniciarSesion(email, password) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function cerrarSesion() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
}

export async function sesionActual() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onCambioSesion(callback) {
  const supabase = getSupabaseClient();
  supabase.auth.onAuthStateChange((_evento, session) => callback(session));
}
```

- [ ] **Step 3: Crear `js/screens/login.js`**

```js
import { iniciarSesion } from '../auth.js';

export function montarLogin(contenedor) {
  contenedor.innerHTML = `
    <form id="form-login" style="max-width:320px;margin:4rem auto;display:flex;flex-direction:column;gap:0.75rem;">
      <h1>Monitor de Stock GEV</h1>
      <input type="email" id="login-email" placeholder="Email" required autocomplete="username" />
      <input type="password" id="login-password" placeholder="Contraseña" required autocomplete="current-password" />
      <button type="submit">Entrar</button>
      <p id="login-error" style="color:#c0392b;"></p>
    </form>
  `;

  const form = contenedor.querySelector('#form-login');
  const errorEl = contenedor.querySelector('#login-error');

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    errorEl.textContent = '';
    const email = contenedor.querySelector('#login-email').value;
    const password = contenedor.querySelector('#login-password').value;
    try {
      await iniciarSesion(email, password);
    } catch (error) {
      errorEl.textContent = 'Credenciales incorrectas o error de conexión.';
    }
  });
}
```

- [ ] **Step 4: Crear `js/supabaseRepo.js`**

```js
import { getSupabaseClient } from './supabaseClient.js';

const supabase = getSupabaseClient();

export const supabaseRepo = {
  async getCierreEnProgreso() {
    const { data, error } = await supabase
      .from('cierres')
      .select('id, fecha, n_codigos')
      .eq('estado', 'en_progreso')
      .maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, fecha: data.fecha, nCodigos: data.n_codigos } : null;
  },

  async crearCierre(fecha) {
    const { data, error } = await supabase
      .from('cierres')
      .insert({ fecha, estado: 'en_progreso' })
      .select('id, fecha')
      .single();
    if (error) throw error;
    return data;
  },

  async getCodigosGuardados(cierreId) {
    const { data, error } = await supabase
      .from('lecturas_stock')
      .select('codigo')
      .eq('cierre_id', cierreId);
    if (error) throw error;
    return new Set(data.map((fila) => fila.codigo));
  },

  async guardarLecturas(cierreId, articulos) {
    if (articulos.length === 0) return;

    await supabase.from('productos').upsert(
      articulos.map((a) => ({
        codigo: a.codigo,
        descripcion: a.descripcion,
        ultima_vez_visto: new Date().toISOString().slice(0, 10),
      })),
      { onConflict: 'codigo' }
    );

    const { error } = await supabase.from('lecturas_stock').upsert(
      articulos.map((a) => ({
        cierre_id: cierreId,
        codigo: a.codigo,
        cantidad_total: a.cantidadTotal,
        cantidad_barcelona: a.cantidadBarcelona,
        precio_neto: a.precioNeto,
      })),
      { onConflict: 'cierre_id,codigo' }
    );
    if (error) throw error;

    const { count } = await supabase
      .from('lecturas_stock')
      .select('id', { count: 'exact', head: true })
      .eq('cierre_id', cierreId);
    await supabase.from('cierres').update({ n_codigos: count }).eq('id', cierreId);
  },

  async getCodigosDeCierre(cierreId) {
    const { data, error } = await supabase
      .from('lecturas_stock')
      .select('codigo')
      .eq('cierre_id', cierreId);
    if (error) throw error;
    return data.map((fila) => fila.codigo);
  },

  async getUltimoCierreFinalizado(antesDeCierreId) {
    const { data: cierreActual, error: errorActual } = await supabase
      .from('cierres')
      .select('fecha')
      .eq('id', antesDeCierreId)
      .single();
    if (errorActual) throw errorActual;

    const { data, error } = await supabase
      .from('cierres')
      .select('id, fecha')
      .eq('estado', 'finalizado')
      .lt('fecha', cierreActual.fecha)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async finalizarCierre(cierreId) {
    const { error } = await supabase
      .from('cierres')
      .update({ estado: 'finalizado', finalizado_at: new Date().toISOString() })
      .eq('id', cierreId);
    if (error) throw error;
  },

  async listarCierres() {
    const { data, error } = await supabase
      .from('cierres')
      .select('id, fecha, estado, n_codigos')
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  },

  async eliminarCierre(cierreId) {
    const { error } = await supabase.from('cierres').delete().eq('id', cierreId);
    if (error) throw error;
  },

  async listarProductosConLecturas() {
    const { data: productos, error: errorProductos } = await supabase
      .from('productos')
      .select('codigo, descripcion');
    if (errorProductos) throw errorProductos;

    const { data: lecturas, error: errorLecturas } = await supabase
      .from('lecturas_stock')
      .select('codigo, cantidad_total, cierres(fecha)');
    if (errorLecturas) throw errorLecturas;

    const lecturasPorCodigo = new Map();
    for (const l of lecturas) {
      const lista = lecturasPorCodigo.get(l.codigo) || [];
      lista.push({ fecha: l.cierres.fecha, cantidadTotal: l.cantidad_total });
      lecturasPorCodigo.set(l.codigo, lista);
    }

    return productos.map((p) => ({
      codigo: p.codigo,
      descripcion: p.descripcion,
      lecturas: lecturasPorCodigo.get(p.codigo) || [],
    }));
  },

  async buscarProducto(query) {
    const { data, error } = await supabase
      .from('productos')
      .select('codigo, descripcion')
      .or(`codigo.ilike.%${query}%,descripcion.ilike.%${query}%`)
      .limit(20);
    if (error) throw error;
    return data;
  },

  async getLecturasProducto(codigo) {
    const { data, error } = await supabase
      .from('lecturas_stock')
      .select('cantidad_total, cantidad_barcelona, precio_neto, cierres(fecha)')
      .eq('codigo', codigo);
    if (error) throw error;
    return data
      .map((l) => ({
        fecha: l.cierres.fecha,
        cantidadTotal: l.cantidad_total,
        cantidadBarcelona: l.cantidad_barcelona,
        precioNeto: l.precio_neto,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  },

  async getTodasLasLecturas() {
    const { data, error } = await supabase
      .from('lecturas_stock')
      .select('codigo, cantidad_total, cantidad_barcelona, precio_neto, productos(descripcion), cierres(fecha)')
      .order('codigo');
    if (error) throw error;
    return data.map((l) => ({
      codigo: l.codigo,
      descripcion: l.productos.descripcion,
      fecha: l.cierres.fecha,
      cantidadTotal: l.cantidad_total,
      cantidadBarcelona: l.cantidad_barcelona,
      precioNeto: l.precio_neto,
    }));
  },
};
```

- [ ] **Step 5: Verificación manual en navegador**

No es posible probar este módulo con `node:test` porque depende de una base de datos real. Verificación con `preview_start` (Task 12, cuando exista `app.js` y el flujo de login funcione end-to-end): entrar con el usuario creado en Task 6 Step 6 y comprobar en `preview_network` que las llamadas a Supabase devuelven 200/201, no 401/403 (lo que confirmaría que RLS y la sesión funcionan juntos).

- [ ] **Step 6: Commit**

```bash
git add js/supabaseClient.js js/auth.js js/supabaseRepo.js js/screens/login.js
git commit -m "feat: cliente Supabase, autenticación y adaptador de repositorio"
```

---

### Task 8: Pantalla "Cargar cierre"

**Files:**
- Create: `js/screens/cargarCierre.js`

**Interfaces:**
- Consumes: `parseBloque` (Task 2), `abrirOReanudarCierre`/`guardarArticulos`/`finalizarCierre` (Task 5), `supabaseRepo` (Task 7).
- Produces: `montarCargarCierre(contenedor, { repo })`. Registrado en el router en Task 12.

- [ ] **Step 1: Implementar `js/screens/cargarCierre.js`**

```js
import { parseBloque } from '../parser.js';
import {
  abrirOReanudarCierre,
  procesarBloque,
  guardarArticulos,
  finalizarCierre,
} from '../cierreService.js';

export async function montarCargarCierre(contenedor, { repo }) {
  const hoy = new Date().toISOString().slice(0, 10);
  let cierre = await abrirOReanudarCierre(repo, hoy);

  contenedor.innerHTML = `
    <h2>Cargar cierre — ${cierre.fecha}</h2>
    <p id="contador">Códigos guardados en este cierre: cargando…</p>
    <textarea id="texto-pegado" rows="12" style="width:100%;" placeholder="Pega aquí el texto de una página de GEV-Online"></textarea>
    <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
      <button id="btn-anadir">Añadir bloque</button>
      <button id="btn-finalizar">Finalizar cierre</button>
    </div>
    <div id="avisos"></div>
  `;

  const contadorEl = contenedor.querySelector('#contador');
  const avisosEl = contenedor.querySelector('#avisos');
  const textareaEl = contenedor.querySelector('#texto-pegado');

  async function actualizarContador() {
    const codigos = await repo.getCodigosDeCierre(cierre.id);
    contadorEl.textContent = `Códigos guardados en este cierre: ${codigos.length}`;
  }

  function mostrarAviso(texto, clase) {
    const div = document.createElement('div');
    div.className = `aviso ${clase}`;
    div.textContent = texto;
    avisosEl.prepend(div);
  }

  contenedor.querySelector('#btn-anadir').addEventListener('click', async () => {
    const { articulos, noReconocidos } = parseBloque(textareaEl.value);
    if (articulos.length === 0) {
      mostrarAviso('No se ha reconocido ningún artículo en el texto pegado.', 'aviso-desaparecido');
      return;
    }

    const { duplicados } = await procesarBloque(repo, cierre.id, articulos);
    let sobrescribir = true;
    if (duplicados.length > 0) {
      sobrescribir = confirm(
        `${duplicados.length} código(s) ya estaban en este cierre: ${duplicados
          .map((d) => d.codigo)
          .join(', ')}.\n¿Sobrescribir con los valores nuevos? Cancelar = ignorar duplicados.`
      );
    }

    const guardados = await guardarArticulos(repo, cierre.id, articulos, {
      sobrescribirDuplicados: sobrescribir,
    });

    mostrarAviso(
      `Bloque procesado: ${guardados} código(s) guardados, ${noReconocidos} línea(s) no reconocidas.`,
      'aviso-nuevo'
    );
    textareaEl.value = '';
    await actualizarContador();
  });

  contenedor.querySelector('#btn-finalizar').addEventListener('click', async () => {
    if (!confirm(`¿Finalizar el cierre del ${cierre.fecha}? No podrás añadir más bloques después.`)) return;

    const { nuevos, desaparecidos } = await finalizarCierre(repo, cierre.id);

    avisosEl.innerHTML = '';
    if (nuevos.length > 0) {
      mostrarAviso(`Códigos nuevos respecto al cierre anterior: ${nuevos.join(', ')}`, 'aviso-nuevo');
    }
    if (desaparecidos.length > 0) {
      mostrarAviso(
        `Códigos que NO aparecieron en este cierre (se mantiene su último valor conocido): ${desaparecidos.join(', ')}`,
        'aviso-desaparecido'
      );
    }
    mostrarAviso('Cierre finalizado correctamente.', 'aviso-nuevo');
  });

  await actualizarContador();
}
```

- [ ] **Step 2: Verificación manual en navegador**

Diferida a Task 12 (cuando `app.js` y el router monten esta pantalla). Se verificará: pegar el bloque de validación del spec, comprobar que el contador sube a 6, pegarlo de nuevo y comprobar el aviso de duplicados, y finalizar el cierre comprobando el aviso de nuevos/desaparecidos.

- [ ] **Step 3: Commit**

```bash
git add js/screens/cargarCierre.js
git commit -m "feat: pantalla de carga de cierre con detección de duplicados"
```

---

### Task 9: Pantalla "Ranking de más vendidos"

**Files:**
- Create: `js/screens/ranking.js`

**Interfaces:**
- Consumes: `calcularRanking` (Task 3), `aCSV` (Task 4), `supabaseRepo.listarProductosConLecturas` (Task 7).
- Produces: `montarRanking(contenedor, { repo })`.

- [ ] **Step 1: Implementar `js/screens/ranking.js`**

```js
import { calcularRanking } from '../metrics.js';
import { aCSV } from '../csv.js';

const COLUMNAS = [
  { key: 'codigo', label: 'Código' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'stockInicial', label: 'Stock inicial' },
  { key: 'stockActual', label: 'Stock actual' },
  { key: 'vendidoEstimado', label: 'Vendido estimado' },
  { key: 'repuestoEstimado', label: 'Repuesto estimado' },
  { key: 'nEventosVenta', label: 'Nº ventas' },
  { key: 'diasMediosEntreVentas', label: 'Días medios entre ventas' },
  { key: 'nEventosReposicion', label: 'Nº reposiciones' },
  { key: 'diasMediosEntreReposiciones', label: 'Días medios entre reposiciones' },
  { key: 'nLecturas', label: 'Nº cierres con datos' },
];

export async function montarRanking(contenedor, { repo }) {
  contenedor.innerHTML = `
    <h2>Ranking de más vendidos</h2>
    <input id="buscador" type="search" placeholder="Buscar por código o descripción" style="width:100%;margin-bottom:0.5rem;" />
    <button id="btn-csv">Exportar CSV</button>
    <table id="tabla-ranking"><thead></thead><tbody></tbody></table>
  `;

  const productos = await repo.listarProductosConLecturas();
  const ranking = calcularRanking(productos);

  const thead = contenedor.querySelector('#tabla-ranking thead');
  thead.innerHTML = `<tr>${COLUMNAS.map((c) => `<th>${c.label}</th>`).join('')}</tr>`;

  function pintar(filas) {
    const tbody = contenedor.querySelector('#tabla-ranking tbody');
    tbody.innerHTML = filas
      .map(
        (fila) =>
          `<tr>${COLUMNAS.map((c) => `<td>${fila[c.key] ?? ''}</td>`).join('')}</tr>`
      )
      .join('');
  }

  pintar(ranking);

  contenedor.querySelector('#buscador').addEventListener('input', (evento) => {
    const texto = evento.target.value.toLowerCase();
    pintar(
      ranking.filter(
        (fila) =>
          fila.codigo.toLowerCase().includes(texto) ||
          fila.descripcion.toLowerCase().includes(texto)
      )
    );
  });

  contenedor.querySelector('#btn-csv').addEventListener('click', () => {
    const csv = aCSV(ranking, COLUMNAS);
    descargarCSV(csv, `ranking-gev-${new Date().toISOString().slice(0, 10)}.csv`);
  });
}

function descargarCSV(contenido, nombreArchivo) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/screens/ranking.js
git commit -m "feat: pantalla de ranking de más vendidos con export CSV"
```

---

### Task 10: Pantalla "Ficha histórica por código"

**Files:**
- Create: `js/screens/fichaHistorica.js`

**Interfaces:**
- Consumes: `supabaseRepo.buscarProducto`, `supabaseRepo.getLecturasProducto` (Task 7).
- Produces: `montarFichaHistorica(contenedor, { repo })`.

- [ ] **Step 1: Implementar `js/screens/fichaHistorica.js`**

```js
export async function montarFichaHistorica(contenedor, { repo }) {
  contenedor.innerHTML = `
    <h2>Ficha histórica por código</h2>
    <input id="buscador" type="search" placeholder="Buscar código o descripción" style="width:100%;" />
    <ul id="resultados"></ul>
    <div id="detalle"></div>
  `;

  const buscadorEl = contenedor.querySelector('#buscador');
  const resultadosEl = contenedor.querySelector('#resultados');
  const detalleEl = contenedor.querySelector('#detalle');

  buscadorEl.addEventListener('input', async (evento) => {
    const texto = evento.target.value.trim();
    if (texto.length < 2) {
      resultadosEl.innerHTML = '';
      return;
    }
    const productos = await repo.buscarProducto(texto);
    resultadosEl.innerHTML = productos
      .map((p) => `<li data-codigo="${p.codigo}" style="cursor:pointer;">${p.codigo} — ${p.descripcion}</li>`)
      .join('');
  });

  resultadosEl.addEventListener('click', async (evento) => {
    const li = evento.target.closest('li[data-codigo]');
    if (!li) return;
    const codigo = li.dataset.codigo;
    const lecturas = await repo.getLecturasProducto(codigo);
    pintarDetalle(codigo, lecturas);
  });

  function pintarDetalle(codigo, lecturas) {
    const filas = lecturas
      .map((l, i) => {
        const anterior = lecturas[i - 1];
        const delta = anterior ? l.cantidadTotal - anterior.cantidadTotal : 0;
        const clase = delta < 0 ? 'aviso-desaparecido' : delta > 0 ? 'aviso-nuevo' : '';
        return `<tr class="${clase}"><td>${l.fecha}</td><td>${l.cantidadTotal}</td><td>${l.cantidadBarcelona}</td><td>${l.precioNeto ?? ''}</td><td>${delta}</td></tr>`;
      })
      .join('');

    detalleEl.innerHTML = `
      <h3>${codigo}</h3>
      ${dibujarGrafico(lecturas)}
      <table>
        <thead><tr><th>Fecha</th><th>Stock</th><th>Barcelona</th><th>Precio neto</th><th>Delta</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    `;
  }

  function dibujarGrafico(lecturas) {
    if (lecturas.length === 0) return '';
    const ancho = 600;
    const alto = 150;
    const max = Math.max(...lecturas.map((l) => l.cantidadTotal), 1);
    const paso = ancho / Math.max(lecturas.length - 1, 1);
    const puntos = lecturas
      .map((l, i) => `${i * paso},${alto - (l.cantidadTotal / max) * alto}`)
      .join(' ');
    return `<svg viewBox="0 0 ${ancho} ${alto}" width="100%" height="${alto}">
      <polyline points="${puntos}" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/screens/fichaHistorica.js
git commit -m "feat: pantalla de ficha histórica por código con gráfico simple"
```

---

### Task 11: Pantallas "Listado de cierres" y "Comparador estacional"

**Files:**
- Create: `js/screens/listadoCierres.js`
- Create: `js/screens/comparadorEstacional.js`

**Interfaces:**
- Consumes: `supabaseRepo.listarCierres`, `supabaseRepo.eliminarCierre`, `supabaseRepo.getTodasLasLecturas` (Task 7); `aCSV` (Task 4); `calcularMetricasCodigo` (Task 3).
- Produces: `montarListadoCierres(contenedor, { repo })`, `montarComparadorEstacional(contenedor, { repo })`.

- [ ] **Step 1: Implementar `js/screens/listadoCierres.js`**

```js
import { aCSV } from '../csv.js';

const COLUMNAS_EXPORT_COMPLETO = [
  { key: 'codigo', label: 'Código' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'cantidadTotal', label: 'Cantidad total' },
  { key: 'cantidadBarcelona', label: 'Cantidad Barcelona' },
  { key: 'precioNeto', label: 'Precio neto' },
];

export async function montarListadoCierres(contenedor, { repo }) {
  contenedor.innerHTML = `
    <h2>Listado de cierres</h2>
    <button id="btn-export-completo">Exportar histórico completo (CSV)</button>
    <table id="tabla-cierres">
      <thead><tr><th>Fecha</th><th>Estado</th><th>Nº códigos</th><th></th></tr></thead>
      <tbody></tbody>
    </table>
  `;

  async function cargar() {
    const cierres = await repo.listarCierres();
    contenedor.querySelector('#tabla-cierres tbody').innerHTML = cierres
      .map(
        (c) => `<tr>
          <td>${c.fecha}</td>
          <td>${c.estado}</td>
          <td>${c.n_codigos}</td>
          <td><button data-id="${c.id}" class="btn-eliminar">Eliminar</button></td>
        </tr>`
      )
      .join('');
  }

  contenedor.querySelector('#tabla-cierres tbody').addEventListener('click', async (evento) => {
    const boton = evento.target.closest('.btn-eliminar');
    if (!boton) return;
    if (!confirm('¿Eliminar este cierre y todas sus lecturas? Esta acción no se puede deshacer.')) return;
    await repo.eliminarCierre(Number(boton.dataset.id));
    await cargar();
  });

  contenedor.querySelector('#btn-export-completo').addEventListener('click', async () => {
    const filas = await repo.getTodasLasLecturas();
    const csv = aCSV(filas, COLUMNAS_EXPORT_COMPLETO);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `historico-completo-gev-${new Date().toISOString().slice(0, 10)}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  });

  await cargar();
}
```

- [ ] **Step 2: Implementar `js/screens/comparadorEstacional.js`**

```js
import { calcularMetricasCodigo } from '../metrics.js';

export async function montarComparadorEstacional(contenedor, { repo }) {
  contenedor.innerHTML = `
    <h2>Comparador estacional</h2>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;">
      <fieldset>
        <legend>Periodo A</legend>
        <input type="date" id="a-desde" /> a <input type="date" id="a-hasta" />
      </fieldset>
      <fieldset>
        <legend>Periodo B</legend>
        <input type="date" id="b-desde" /> a <input type="date" id="b-hasta" />
      </fieldset>
      <button id="btn-comparar" style="align-self:flex-end;">Comparar</button>
    </div>
    <table id="tabla-comparador">
      <thead><tr><th>Código</th><th>Descripción</th><th>Vendido periodo A</th><th>Vendido periodo B</th><th>Diferencia</th></tr></thead>
      <tbody></tbody>
    </table>
  `;

  contenedor.querySelector('#btn-comparar').addEventListener('click', async () => {
    const aDesde = contenedor.querySelector('#a-desde').value;
    const aHasta = contenedor.querySelector('#a-hasta').value;
    const bDesde = contenedor.querySelector('#b-desde').value;
    const bHasta = contenedor.querySelector('#b-hasta').value;
    if (!aDesde || !aHasta || !bDesde || !bHasta) {
      alert('Rellena las cuatro fechas de ambos periodos.');
      return;
    }

    const productos = await repo.listarProductosConLecturas();

    const filas = productos.map((p) => {
      const enRango = (desde, hasta) => p.lecturas.filter((l) => l.fecha >= desde && l.fecha <= hasta);
      const vendidoA = calcularMetricasCodigo(enRango(aDesde, aHasta)).vendidoEstimado;
      const vendidoB = calcularMetricasCodigo(enRango(bDesde, bHasta)).vendidoEstimado;
      return { codigo: p.codigo, descripcion: p.descripcion, vendidoA, vendidoB, diferencia: vendidoB - vendidoA };
    });

    filas.sort((x, y) => Math.abs(y.diferencia) - Math.abs(x.diferencia));

    contenedor.querySelector('#tabla-comparador tbody').innerHTML = filas
      .map(
        (f) =>
          `<tr><td>${f.codigo}</td><td>${f.descripcion}</td><td>${f.vendidoA}</td><td>${f.vendidoB}</td><td>${f.diferencia}</td></tr>`
      )
      .join('');
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add js/screens/listadoCierres.js js/screens/comparadorEstacional.js
git commit -m "feat: pantallas de listado de cierres y comparador estacional"
```

---

### Task 12: App shell, router y verificación end-to-end en navegador

**Files:**
- Create: `js/router.js`
- Create: `js/app.js`
- Modify: `js/supabaseClient.js` (confirmar credenciales reales ya sustituidas en Task 7)

**Interfaces:**
- Consumes: todas las pantallas (Tasks 7–11), `supabaseRepo` (Task 7), `auth.js` (Task 7).
- Produces: aplicación completa navegable.

- [ ] **Step 1: Implementar `js/router.js`**

```js
const rutas = new Map();

export function registrarRuta(hash, montar) {
  rutas.set(hash, montar);
}

export async function iniciarRouter(contenedor, obtenerContexto) {
  async function render() {
    const hash = location.hash || '#cargar-cierre';
    const montar = rutas.get(hash) || rutas.get('#cargar-cierre');
    contenedor.innerHTML = '';
    await montar(contenedor, obtenerContexto());
  }
  window.addEventListener('hashchange', render);
  await render();
}
```

- [ ] **Step 2: Implementar `js/app.js`**

```js
import { sesionActual, onCambioSesion, cerrarSesion } from './auth.js';
import { supabaseRepo } from './supabaseRepo.js';
import { registrarRuta, iniciarRouter } from './router.js';
import { montarLogin } from './screens/login.js';
import { montarCargarCierre } from './screens/cargarCierre.js';
import { montarRanking } from './screens/ranking.js';
import { montarFichaHistorica } from './screens/fichaHistorica.js';
import { montarListadoCierres } from './screens/listadoCierres.js';
import { montarComparadorEstacional } from './screens/comparadorEstacional.js';

const app = document.querySelector('#app');
const nav = document.querySelector('#nav');

registrarRuta('#cargar-cierre', montarCargarCierre);
registrarRuta('#ranking', montarRanking);
registrarRuta('#ficha-historica', montarFichaHistorica);
registrarRuta('#listado-cierres', montarListadoCierres);
registrarRuta('#comparador-estacional', montarComparadorEstacional);

document.querySelector('#btn-logout').addEventListener('click', () => cerrarSesion());

async function arrancar() {
  const sesion = await sesionActual();
  if (!sesion) {
    nav.hidden = true;
    await montarLogin(app);
    return;
  }
  nav.hidden = false;
  await iniciarRouter(app, () => ({ repo: supabaseRepo }));
}

onCambioSesion(() => arrancar());
arrancar();
```

- [ ] **Step 3: Verificación manual completa en navegador**

Usar `preview_start` (servidor estático simple, p. ej. configurando `.claude/launch.json` con `npx http-server . -p 8080`). Con `preview_screenshot`/`preview_snapshot`/`preview_console_logs`/`preview_network`:
1. Abrir la app sin sesión → debe mostrar el formulario de login y `#nav` oculto.
2. Entrar con el usuario creado en Task 6 → debe mostrarse `#nav` y la pantalla "Cargar cierre".
3. Pegar el bloque de validación del spec (6 artículos) → comprobar que el contador sube a 6 y no hay errores en `preview_console_logs`.
4. Ir a "Ranking" → comprobar que aparecen los 6 códigos en la tabla.
5. Ir a "Ficha histórica", buscar uno de los códigos → comprobar que aparece su única lectura.
6. Ir a "Listado de cierres" → comprobar que aparece el cierre en progreso.
7. Pulsar "Salir" → comprobar que vuelve a la pantalla de login.

Si algo falla, diagnosticar con `preview_network` (¿401/403 por RLS? ¿404 por URL de Supabase mal copiada?) y corregir antes de continuar.

- [ ] **Step 4: Commit**

```bash
git add js/router.js js/app.js
git commit -m "feat: app shell, router y flujo de autenticación completo"
```

---

### Task 13: Despliegue en GitHub Pages

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: repositorio en GitHub bajo la cuenta `mgfcrea-design`, sitio publicado en `https://mgfcrea-design.github.io/<nombre-repo>/`.

- [ ] **Step 1: Crear `README.md`**

```markdown
# Monitor de Stock GEV

Aplicación interna para monitorizar el stock público de GEV-Online (familia de resistencias) y estimar rotación de códigos mediante cierres periódicos pegados manualmente.

## Uso
1. Entrar con las credenciales del único usuario autorizado (Supabase Auth).
2. Pegar bloques de texto de páginas de GEV-Online en "Cargar cierre".
3. Finalizar el cierre cuando se haya llegado a la página de corte acordada.
4. Consultar "Ranking", "Ficha histórica", "Listado de cierres" y "Comparador estacional".

## Desarrollo
`npm test` ejecuta las pruebas de lógica pura (parser, métricas, CSV, servicio de cierres).
```

- [ ] **Step 2: Crear el repositorio en GitHub**

Pedir confirmación explícita al usuario antes de crear el repositorio (acción visible/pública) y antes de hacer push, según las reglas de esta sesión. Nombre sugerido: `monitor-stock-gev`, público (necesario para GitHub Pages gratuito), bajo la cuenta `mgfcrea-design` vista en la captura de pantalla.

```bash
git remote add origin https://github.com/mgfcrea-design/monitor-stock-gev.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Activar GitHub Pages**

En la configuración del repositorio (Settings → Pages), configurar "Deploy from a branch", rama `main`, carpeta `/ (root)`. Confirmar con el usuario antes de tocar esta configuración si se hace vía navegador con `claude-in-chrome`, ya que es un cambio de configuración de una cuenta de terceros.

- [ ] **Step 4: Verificar el sitio publicado**

Esperar unos minutos, luego abrir `https://mgfcrea-design.github.io/monitor-stock-gev/` y repetir la verificación del Task 12 Step 3 (login, pegar bloque, ranking, etc.) contra el sitio real.

- [ ] **Step 5: Commit y push final**

```bash
git add README.md
git commit -m "docs: instrucciones de uso y despliegue"
git push
```
