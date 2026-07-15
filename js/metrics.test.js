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

test('calcula el vendido estimado exclusivo de Barcelona', () => {
  const lecturas = [
    { fecha: '2026-07-09', cantidadTotal: 100, cantidadBarcelona: 20 },
    { fecha: '2026-07-11', cantidadTotal: 70, cantidadBarcelona: 12 },
    { fecha: '2026-07-14', cantidadTotal: 150, cantidadBarcelona: 30 },
    { fecha: '2026-07-16', cantidadTotal: 120, cantidadBarcelona: 25 },
  ];
  const m = calcularMetricasCodigo(lecturas);
  // ventas Barcelona: 20->12 (8) y 30->25 (5); la reposición 12->30 no cuenta
  assert.equal(m.vendidoEstimadoBarcelona, 13);
  // reposición Barcelona: 12->30 (18); las ventas no cuentan
  assert.equal(m.repuestoEstimadoBarcelona, 18);
});

test('ignora el vendido estimado de Barcelona cuando falta el dato en alguna lectura', () => {
  const lecturas = [
    { fecha: '2026-07-09', cantidadTotal: 100, cantidadBarcelona: 20 },
    { fecha: '2026-07-11', cantidadTotal: 70 },
  ];
  const m = calcularMetricasCodigo(lecturas);
  assert.equal(m.vendidoEstimadoBarcelona, 0);
});

test('expone las fechas de los cierres en que aparece el artículo', () => {
  const lecturas = [
    { fecha: '2026-07-16', cantidadTotal: 120 },
    { fecha: '2026-07-09', cantidadTotal: 100 },
  ];
  const m = calcularMetricasCodigo(lecturas);
  assert.deepEqual(m.fechasLecturas, ['2026-07-09', '2026-07-16']);
});

test('expone el último stock de Barcelona conocido', () => {
  const lecturas = [
    { fecha: '2026-07-09', cantidadTotal: 100, cantidadBarcelona: 10 },
    { fecha: '2026-07-16', cantidadTotal: 120, cantidadBarcelona: 28 },
  ];
  const m = calcularMetricasCodigo(lecturas);
  assert.equal(m.stockBarcelona, 28);
});

test('devuelve null en stock de Barcelona cuando no hay lecturas', () => {
  const m = calcularMetricasCodigo([]);
  assert.equal(m.stockBarcelona, null);
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
