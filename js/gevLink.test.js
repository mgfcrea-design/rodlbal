import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlFichaGev } from './gevLink.js';

test('genera la URL pública de la ficha de un artículo en GEV a partir de su código', () => {
  assert.equal(
    urlFichaGev('415021'),
    'https://www.gev-online.com/es/webshop/product/415021'
  );
});

test('codifica el código si contiene caracteres especiales', () => {
  assert.equal(
    urlFichaGev('AB/12'),
    'https://www.gev-online.com/es/webshop/product/AB%2F12'
  );
});
