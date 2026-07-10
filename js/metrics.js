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
    stockBarcelona:
      ordenadas.length > 0 ? (ordenadas[ordenadas.length - 1].cantidadBarcelona ?? null) : null,
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
