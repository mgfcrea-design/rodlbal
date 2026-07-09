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
