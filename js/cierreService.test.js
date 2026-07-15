import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abrirOReanudarCierre,
  procesarBloque,
  guardarArticulos,
  finalizarCierre,
  compararCodigos,
  compararCierres,
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
    async getCierreByFecha(fecha) {
      return cierres.find((c) => c.fecha === fecha) || null;
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

test('abrirOReanudarCierre falla con mensaje claro si ya hay un cierre finalizado en esa fecha', async () => {
  const repo = crearRepoFalso();
  const cierre = await abrirOReanudarCierre(repo, '2026-07-09');
  await repo.finalizarCierre(cierre.id);

  await assert.rejects(
    () => abrirOReanudarCierre(repo, '2026-07-09'),
    /Ya existe un cierre finalizado para 2026-07-09/
  );
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

test('compararCodigos separa códigos exclusivos de cada lado y los comunes', () => {
  const { soloEnA, soloEnB, comunes } = compararCodigos(['A1', 'B2', 'C3'], ['B2', 'C3', 'D4']);
  assert.deepEqual(soloEnA, ['A1']);
  assert.deepEqual(soloEnB, ['D4']);
  assert.deepEqual(comunes, ['B2', 'C3']);
});

test('compararCierres compara los códigos de dos cierres cualesquiera, no solo consecutivos', async () => {
  const repo = crearRepoFalso();

  const cierre1 = await repo.crearCierre('2026-07-09');
  await repo.guardarLecturas(cierre1.id, [{ codigo: 'A1' }, { codigo: 'B2' }]);

  const cierre2 = await repo.crearCierre('2026-07-11');
  await repo.guardarLecturas(cierre2.id, [{ codigo: 'B2' }, { codigo: 'C3' }]);

  const { soloEnA, soloEnB, comunes } = await compararCierres(repo, cierre1.id, cierre2.id);
  assert.deepEqual(soloEnA, ['A1']);
  assert.deepEqual(soloEnB, ['C3']);
  assert.deepEqual(comunes, ['B2']);
});
