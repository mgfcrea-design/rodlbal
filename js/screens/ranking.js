import { calcularRanking } from '../metrics.js';
import { aCSV } from '../csv.js';

const COLUMNAS = [
  { key: 'codigo', label: 'Código' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'stockInicial', label: 'Stock inicial' },
  { key: 'stockActual', label: 'Stock actual' },
  { key: 'vendidoEstimado', label: 'Vendido estimado' },
  { key: 'repuestoEstimado', label: 'Repuesto estimado' },
  { key: 'nEventosVenta', label: 'Nº ventas' },
  { key: 'diasMediosEntreVentas', label: 'Días medios entre ventas' },
  { key: 'nEventosReposicion', label: 'Nº reposiciones' },
  { key: 'diasMediosEntreReposiciones', label: 'Días medios entre reposiciones' },
  { key: 'nLecturas', label: 'Nº cierres con datos' },
];

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
  thead.innerHTML = `<tr>${COLUMNAS.map((c) => `<th>${c.label}</th>`).join('')}</tr>`;

  function pintar(filas) {
    const tbody = contenedor.querySelector('#tabla-ranking tbody');
    tbody.innerHTML = filas
      .map(
        (fila) =>
          `<tr>${COLUMNAS.map((c) => `<td>${fila[c.key] ?? ''}</td>`).join('')}</tr>`
      )
      .join('');
  }

  pintar(ranking);

  contenedor.querySelector('#buscador').addEventListener('input', (evento) => {
    const texto = evento.target.value.toLowerCase();
    pintar(
      ranking.filter(
        (fila) =>
          fila.codigo.toLowerCase().includes(texto) ||
          fila.descripcion.toLowerCase().includes(texto)
      )
    );
  });

  contenedor.querySelector('#btn-csv').addEventListener('click', () => {
    const csv = aCSV(ranking, COLUMNAS);
    descargarCSV(csv, `ranking-gev-${new Date().toISOString().slice(0, 10)}.csv`);
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
