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
