import { calcularRanking } from '../metrics.js';
import { aCSV } from '../csv.js';
import { urlFichaGev } from '../gevLink.js';

const COLUMNAS = [
  { key: 'codigo', label: 'Código' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'stockInicial', label: 'Stock inicial' },
  { key: 'stockActual', label: 'Stock actual' },
  { key: 'stockBarcelona', label: 'Stock Barcelona' },
  { key: 'vendidoEstimado', label: 'Vendido estimado' },
  { key: 'vendidoEstimadoBarcelona', label: 'Vendido estimado Barcelona' },
  { key: 'repuestoEstimado', label: 'Repuesto estimado' },
  { key: 'repuestoEstimadoBarcelona', label: 'Repuesto estimado Barcelona' },
  { key: 'diasMediosEntreVentas', label: 'Días medios entre ventas' },
  { key: 'nEventosReposicion', label: 'Nº reposiciones' },
  { key: 'diasMediosEntreReposiciones', label: 'Días medios entre reposiciones' },
  { key: 'nLecturas', label: 'Nº cierres con datos' },
  { key: 'fechasLecturas', label: 'Cierres en que aparece' },
];

// null/asc/desc: al pasar por "null" se vuelve al orden de introducción
// (el que devuelve calcularRanking, por vendido estimado descendente).
const ORDEN_SIGUIENTE = { null: 'asc', asc: 'desc', desc: null };
const FLECHA = { asc: ' ▲', desc: ' ▼' };

function diaMes(fecha) {
  const [, mes, dia] = fecha.split('-');
  return `${dia}-${mes}`;
}

function escapeHTML(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function montarRanking(contenedor, { repo }) {
  contenedor.innerHTML = `
    <h2>Ranking de más vendidos</h2>
    <input id="buscador" type="search" placeholder="Buscar por código o descripción" style="width:100%;margin-bottom:0.5rem;" />
    <button id="btn-csv">Exportar CSV</button>
    <table id="tabla-ranking"><thead></thead><tbody></tbody></table>
  `;

  let productos;
  try {
    productos = await repo.listarProductosConLecturas();
  } catch (error) {
    contenedor.innerHTML = `<p class="aviso aviso-desaparecido">Error al cargar el ranking: ${error.message}. Recarga la página para volver a intentarlo.</p>`;
    return;
  }

  const ranking = calcularRanking(productos);

  const thead = contenedor.querySelector('#tabla-ranking thead');
  let orden = { key: null, direccion: null };

  function pintarCabecera() {
    thead.innerHTML = `<tr><th>Nº</th>${COLUMNAS.map(
      (c) =>
        `<th data-key="${c.key}" style="cursor:pointer;user-select:none;">${c.label}${
          orden.key === c.key ? FLECHA[orden.direccion] : ''
        }</th>`
    ).join('')}</tr>`;
  }

  function filasVisibles() {
    const texto = contenedor.querySelector('#buscador').value.toLowerCase();
    const filtradas = ranking.filter(
      (fila) =>
        fila.codigo.toLowerCase().includes(texto) ||
        fila.descripcion.toLowerCase().includes(texto)
    );
    if (!orden.direccion) return filtradas;
    const signo = orden.direccion === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      const va = a[orden.key];
      const vb = b[orden.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return signo * (va - vb);
      return signo * String(va).localeCompare(String(vb));
    });
  }

  function celda(fila, c) {
    if (c.key === 'codigo') {
      const href = escapeHTML(urlFichaGev(fila.codigo));
      return `<td><a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHTML(fila.codigo)}</a></td>`;
    }
    if (c.key === 'fechasLecturas') {
      return `<td>${escapeHTML((fila.fechasLecturas ?? []).map(diaMes).join(', '))}</td>`;
    }
    return `<td>${escapeHTML(fila[c.key] ?? '')}</td>`;
  }

  function pintar() {
    const tbody = contenedor.querySelector('#tabla-ranking tbody');
    tbody.innerHTML = filasVisibles()
      .map((fila, i) => `<tr><td>${i + 1}</td>${COLUMNAS.map((c) => celda(fila, c)).join('')}</tr>`)
      .join('');
  }

  pintarCabecera();
  pintar();

  thead.addEventListener('click', (evento) => {
    const th = evento.target.closest('th[data-key]');
    if (!th) return;
    const key = th.dataset.key;
    orden = {
      key,
      direccion: orden.key === key ? ORDEN_SIGUIENTE[String(orden.direccion)] : 'asc',
    };
    if (!orden.direccion) orden = { key: null, direccion: null };
    pintarCabecera();
    pintar();
  });

  contenedor.querySelector('#buscador').addEventListener('input', () => {
    pintar();
  });

  contenedor.querySelector('#btn-csv').addEventListener('click', () => {
    const filasNumeradas = filasVisibles().map((fila, i) => ({
      ...fila,
      _numero: i + 1,
      fechasLecturas: (fila.fechasLecturas ?? []).map(diaMes).join(', '),
    }));
    const csv = aCSV(filasNumeradas, [{ key: '_numero', label: 'Nº' }, ...COLUMNAS]);
    descargarCSV(csv, `ranking-${new Date().toISOString().slice(0, 10)}.csv`);
  });
}

function descargarCSV(contenido, nombreArchivo) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
