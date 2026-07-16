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

test('reconoce el bloque cuando GEV muestra la página en francés (Réf. REPA / Prix net)', () => {
  const bloqueFrances = `Articulo no ubicado en tienda, consultar en mostrador
preview
Résistance 4500W 230V L 358mm L1 36mm L2 72mm L3 250mm H1 28mm H2 30mm bride à 3 trous
Réf. REPA 416267
Prix catalogue REPA: 225,46 €
Remise: 50% Prix net : 112,73 €
 disponible tout de suite
42 CANT en stock Barcelona 15 CANT`;
  const { articulos, noReconocidos } = parseBloque(bloqueFrances);
  assert.equal(noReconocidos, 0);
  assert.equal(articulos.length, 1);
  const a = articulos[0];
  assert.equal(a.codigo, '416267');
  assert.equal(a.descripcion, 'Résistance 4500W 230V L 358mm L1 36mm L2 72mm L3 250mm H1 28mm H2 30mm bride à 3 trous');
  assert.equal(a.precioNeto, 112.73);
  assert.equal(a.cantidadTotal, 42);
  assert.equal(a.cantidadBarcelona, 15);
});

test('ignora bloques sin línea de código Nº REPA', () => {
  const textoRoto = `preview
Descripción huérfana sin código ni cantidad
Articulo no ubicado en tienda, consultar en mostrador`;
  const { articulos, noReconocidos } = parseBloque(textoRoto);
  assert.equal(articulos.length, 0);
  assert.equal(noReconocidos, 0);
});

test('cuenta como no reconocido un bloque con Nº REPA pero sin línea de cantidad', () => {
  const textoRoto = `preview
Resistencia 1000 W 380 V L 445 mm
Nº REPA PT00003994
Precio lista: 167,26 €
Precio Neto: 150,53 €
en Stock
Articulo no ubicado en tienda, consultar en mostrador`;
  const { articulos, noReconocidos } = parseBloque(textoRoto);
  assert.equal(articulos.length, 0);
  assert.equal(noReconocidos, 1);
});

test('cuenta como no reconocido un bloque con Nº REPA pero sin descripción válida antes', () => {
  const textoRoto = `preview
Nº REPA PT00003994
1000 CANT en stock
Articulo no ubicado en tienda, consultar en mostrador`;
  const { articulos, noReconocidos } = parseBloque(textoRoto);
  assert.equal(articulos.length, 0);
  assert.equal(noReconocidos, 1);
});
