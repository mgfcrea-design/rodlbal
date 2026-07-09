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
