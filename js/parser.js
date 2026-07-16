// GEV muestra la página en distinto idioma según la sesión/cuenta (español o
// francés), así que las etiquetas se reconocen en ambos idiomas.
const RE_REPA = /(?:N[ºo°]|Réf\.?)\s*REPA\s+(\S+)/i;
const RE_PRECIO = /(?:Precio Neto|Prix net)\s*:\s*([\d.,]+)\s*€/i;
const RE_CANT = /^(\d+)\s*(?:CANT|Metro)\s+en stock(?:\s+Barcelona\s+(\d+)\s*(?:CANT|Metro))?/i;
const LINEAS_DESCARTABLES = new Set([
  'preview',
  'un artículo alternativo está disponible',
  'articulo no ubicado en tienda, consultar en mostrador',
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
