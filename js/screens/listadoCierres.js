import { aCSV } from '../csv.js';
import { compararCierres } from '../cierreService.js';

const COLUMNAS_EXPORT_COMPLETO = [
  { key: 'codigo', label: 'Código' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'cantidadTotal', label: 'Cantidad total' },
  { key: 'cantidadBarcelona', label: 'Cantidad Barcelona' },
  { key: 'precioNeto', label: 'Precio neto' },
];

function escapeHTML(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function montarListadoCierres(contenedor, { repo }) {
  contenedor.innerHTML = `
    <h2>Listado de cierres</h2>
    <button id="btn-export-completo">Exportar histórico completo (CSV)</button>
    <div id="aviso-listado"></div>
    <table id="tabla-cierres">
      <thead><tr><th>Fecha</th><th>Estado</th><th>Nº códigos</th><th></th></tr></thead>
      <tbody></tbody>
    </table>

    <h3>Comparar códigos entre dos cierres</h3>
    <p>Útil para detectar si GEV cambia el orden de resultados: si al comparar dos cierres cualesquiera aparecen muchos códigos "solo en A" o "solo en B" sin relación con roturas de stock reales, es que cada vez se está capturando una porción distinta del catálogo.</p>
    <div style="display:flex;gap:0.5rem;align-items:end;flex-wrap:wrap;">
      <label>Cierre A <select id="select-cierre-a"></select></label>
      <label>Cierre B <select id="select-cierre-b"></select></label>
      <button id="btn-comparar-cierres">Comparar</button>
    </div>
    <div id="resultado-comparacion"></div>
  `;

  const avisoEl = contenedor.querySelector('#aviso-listado');

  function mostrarAviso(mensaje) {
    avisoEl.innerHTML = `<p class="aviso aviso-desaparecido">${escapeHTML(mensaje)}</p>`;
  }

  function limpiarAviso() {
    avisoEl.innerHTML = '';
  }

  async function cargar() {
    let cierres;
    try {
      cierres = await repo.listarCierres();
    } catch (error) {
      mostrarAviso(`Error al cargar los cierres: ${error.message}. Vuelve a intentarlo.`);
      return;
    }

    limpiarAviso();
    contenedor.querySelector('#tabla-cierres tbody').innerHTML = cierres
      .map(
        (c) => `<tr>
          <td>${escapeHTML(c.fecha)}</td>
          <td>${escapeHTML(c.estado)}</td>
          <td>${escapeHTML(c.n_codigos)}</td>
          <td><button data-id="${escapeHTML(c.id)}" class="btn-eliminar">Eliminar</button></td>
        </tr>`
      )
      .join('');

    const opciones = cierres
      .map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.fecha)} (${escapeHTML(c.n_codigos)} códigos)</option>`)
      .join('');
    contenedor.querySelector('#select-cierre-a').innerHTML = opciones;
    contenedor.querySelector('#select-cierre-b').innerHTML = opciones;
  }

  contenedor.querySelector('#tabla-cierres tbody').addEventListener('click', async (evento) => {
    const boton = evento.target.closest('.btn-eliminar');
    if (!boton) return;
    if (!confirm('¿Eliminar este cierre y todas sus lecturas? Esta acción no se puede deshacer.')) return;
    try {
      await repo.eliminarCierre(Number(boton.dataset.id));
    } catch (error) {
      mostrarAviso(`Error al eliminar el cierre: ${error.message}. Vuelve a intentarlo.`);
      return;
    }
    await cargar();
  });

  contenedor.querySelector('#btn-comparar-cierres').addEventListener('click', async () => {
    const idA = Number(contenedor.querySelector('#select-cierre-a').value);
    const idB = Number(contenedor.querySelector('#select-cierre-b').value);
    const resultadoEl = contenedor.querySelector('#resultado-comparacion');

    if (!idA || !idB) {
      resultadoEl.innerHTML = '<p class="aviso aviso-desaparecido">Selecciona dos cierres.</p>';
      return;
    }
    if (idA === idB) {
      resultadoEl.innerHTML = '<p class="aviso aviso-desaparecido">Elige dos cierres distintos.</p>';
      return;
    }

    let comparacion;
    try {
      comparacion = await compararCierres(repo, idA, idB);
    } catch (error) {
      resultadoEl.innerHTML = `<p class="aviso aviso-desaparecido">Error al comparar: ${escapeHTML(error.message)}. Vuelve a intentarlo.</p>`;
      return;
    }

    const { soloEnA, soloEnB, comunes } = comparacion;
    const total = soloEnA.length + soloEnB.length + comunes.length;
    const churn = total > 0 ? Math.round(((soloEnA.length + soloEnB.length) / total) * 100) : 0;

    resultadoEl.innerHTML = `
      <p><strong>${comunes.length}</strong> códigos en común, <strong>${soloEnA.length}</strong> solo en A, <strong>${soloEnB.length}</strong> solo en B (${churn}% de churn).</p>
      <details><summary>Solo en A (${soloEnA.length})</summary>${escapeHTML(soloEnA.join(', '))}</details>
      <details><summary>Solo en B (${soloEnB.length})</summary>${escapeHTML(soloEnB.join(', '))}</details>
    `;
  });

  contenedor.querySelector('#btn-export-completo').addEventListener('click', async () => {
    let filas;
    try {
      filas = await repo.getTodasLasLecturas();
    } catch (error) {
      mostrarAviso(`Error al exportar el histórico completo: ${error.message}. Vuelve a intentarlo.`);
      return;
    }
    limpiarAviso();
    const csv = aCSV(filas, COLUMNAS_EXPORT_COMPLETO);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `historico-completo-${new Date().toISOString().slice(0, 10)}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  });

  await cargar();
}
