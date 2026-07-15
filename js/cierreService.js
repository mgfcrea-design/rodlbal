export async function abrirOReanudarCierre(repo, fechaPorDefecto) {
  const enProgreso = await repo.getCierreEnProgreso();
  if (enProgreso) return enProgreso;

  const existente = await repo.getCierreByFecha(fechaPorDefecto);
  if (existente) {
    throw new Error(
      `Ya existe un cierre finalizado para ${fechaPorDefecto}. No se puede abrir otro el mismo día.`
    );
  }

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

export function compararCodigos(codigosA, codigosB) {
  const setA = new Set(codigosA);
  const setB = new Set(codigosB);
  return {
    soloEnB: [...setB].filter((c) => !setA.has(c)),
    soloEnA: [...setA].filter((c) => !setB.has(c)),
    comunes: [...setA].filter((c) => setB.has(c)),
  };
}

export async function compararCierres(repo, cierreIdA, cierreIdB) {
  const [codigosA, codigosB] = await Promise.all([
    repo.getCodigosDeCierre(cierreIdA),
    repo.getCodigosDeCierre(cierreIdB),
  ]);
  return compararCodigos(codigosA, codigosB);
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
