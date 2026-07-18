import { aCSV } from '../csv.js';
import { compararCierres, filtrarLecturasPorTexto, encontrarProductosHuerfanos } from '../cierreService.js';

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

    <h3>Eliminar códigos de un cierre</h3>
    <p>Para quitar artículos que se colaron por error (p. ej. accesorios en vez de resistencias). Solo borra la lectura de ese cierre — el código sigue existiendo en los demás.</p>
    <div style="display:flex;gap:0.5rem;align-items:end;flex-wrap:wrap;">
      <label>Cierre <select id="select-cierre-limpiar"></select></label>
      <input id="filtro-limpiar" type="search" placeholder="Filtrar por código o descripción" style="min-width:220px;" />
    </div>
    <div id="resultado-limpiar"></div>

    <h3>Productos huérfanos</h3>
    <p>Códigos que quedaron en el catálogo sin ninguna lectura en ningún cierre (p. ej. tras eliminarlos de todos los cierres en que aparecían). No salen en el ranking pero siguen ocupando la base de datos.</p>
    <button id="btn-buscar-huerfanos">Buscar huérfanos</button>
    <div id="resultado-huerfanos"></div>
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
    contenedor.querySelector('#select-cierre-limpiar').innerHTML = opciones;
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

  let lecturasCierreActual = [];
  const seleccionados = new Set();

  function pintarLimpiar() {
    const resultadoEl = contenedor.querySelector('#resultado-limpiar');
    if (lecturasCierreActual.length === 0) {
      resultadoEl.innerHTML = '';
      return;
    }

    const texto = contenedor.querySelector('#filtro-limpiar').value;
    const visibles = filtrarLecturasPorTexto(lecturasCierreActual, texto);

    resultadoEl.innerHTML = `
      <p>
        <label><input type="checkbox" id="check-todos-limpiar" /> Seleccionar los ${visibles.length} visibles</label>
        · <strong>${seleccionados.size}</strong> seleccionados
        <button id="btn-eliminar-seleccionados" ${seleccionados.size === 0 ? 'disabled' : ''}>Eliminar seleccionados</button>
      </p>
      <ul style="max-height:300px;overflow:auto;list-style:none;padding:0;">
        ${visibles
          .map(
            (l) => `<li>
              <label>
                <input type="checkbox" class="check-lectura" data-codigo="${escapeHTML(l.codigo)}" ${seleccionados.has(l.codigo) ? 'checked' : ''} />
                ${escapeHTML(l.codigo)} — ${escapeHTML(l.descripcion)}
              </label>
            </li>`
          )
          .join('')}
      </ul>
    `;
  }

  contenedor.querySelector('#select-cierre-limpiar').addEventListener('change', async (evento) => {
    const id = Number(evento.target.value);
    seleccionados.clear();
    lecturasCierreActual = [];
    const resultadoEl = contenedor.querySelector('#resultado-limpiar');
    if (!id) {
      pintarLimpiar();
      return;
    }
    resultadoEl.innerHTML = '<p>Cargando…</p>';
    try {
      lecturasCierreActual = await repo.getLecturasConDescripcion(id);
    } catch (error) {
      resultadoEl.innerHTML = `<p class="aviso aviso-desaparecido">Error al cargar los códigos: ${escapeHTML(error.message)}. Vuelve a intentarlo.</p>`;
      return;
    }
    pintarLimpiar();
  });

  contenedor.querySelector('#filtro-limpiar').addEventListener('input', () => pintarLimpiar());

  contenedor.querySelector('#resultado-limpiar').addEventListener('change', (evento) => {
    if (evento.target.id === 'check-todos-limpiar') {
      const texto = contenedor.querySelector('#filtro-limpiar').value;
      const visibles = filtrarLecturasPorTexto(lecturasCierreActual, texto);
      if (evento.target.checked) visibles.forEach((l) => seleccionados.add(l.codigo));
      else visibles.forEach((l) => seleccionados.delete(l.codigo));
      pintarLimpiar();
      return;
    }
    if (evento.target.classList.contains('check-lectura')) {
      const codigo = evento.target.dataset.codigo;
      if (evento.target.checked) seleccionados.add(codigo);
      else seleccionados.delete(codigo);
      pintarLimpiar();
    }
  });

  contenedor.querySelector('#resultado-limpiar').addEventListener('click', async (evento) => {
    if (evento.target.id !== 'btn-eliminar-seleccionados') return;
    const cierreId = Number(contenedor.querySelector('#select-cierre-limpiar').value);
    const codigos = [...seleccionados];
    if (!confirm(`¿Eliminar ${codigos.length} código(s) de este cierre? Esta acción no se puede deshacer.`)) return;

    try {
      await repo.eliminarLecturasDeCierre(cierreId, codigos);
    } catch (error) {
      contenedor.querySelector('#resultado-limpiar').insertAdjacentHTML(
        'afterbegin',
        `<p class="aviso aviso-desaparecido">Error al eliminar: ${escapeHTML(error.message)}. Vuelve a intentarlo.</p>`
      );
      return;
    }

    seleccionados.clear();
    lecturasCierreActual = lecturasCierreActual.filter((l) => !codigos.includes(l.codigo));
    await cargar();
    contenedor.querySelector('#select-cierre-limpiar').value = String(cierreId);
    pintarLimpiar();
  });

  contenedor.querySelector('#btn-buscar-huerfanos').addEventListener('click', async () => {
    const resultadoEl = contenedor.querySelector('#resultado-huerfanos');
    resultadoEl.innerHTML = '<p>Buscando…</p>';

    let huerfanos;
    try {
      huerfanos = await encontrarProductosHuerfanos(repo);
    } catch (error) {
      resultadoEl.innerHTML = `<p class="aviso aviso-desaparecido">Error al buscar huérfanos: ${escapeHTML(error.message)}. Vuelve a intentarlo.</p>`;
      return;
    }

    if (huerfanos.length === 0) {
      resultadoEl.innerHTML = '<p>No hay productos huérfanos.</p>';
      return;
    }

    resultadoEl.innerHTML = `
      <p><strong>${huerfanos.length}</strong> producto(s) sin ninguna lectura. <button id="btn-eliminar-huerfanos">Eliminar todos</button></p>
      <details><summary>Ver códigos</summary>${escapeHTML(huerfanos.join(', '))}</details>
    `;

    resultadoEl.querySelector('#btn-eliminar-huerfanos').addEventListener('click', async () => {
      if (
        !confirm(
          `¿Eliminar definitivamente ${huerfanos.length} producto(s) huérfano(s) de la base de datos? Esta acción no se puede deshacer.`
        )
      ) {
        return;
      }
      try {
        await repo.eliminarProductos(huerfanos);
      } catch (error) {
        resultadoEl.innerHTML = `<p class="aviso aviso-desaparecido">Error al eliminar: ${escapeHTML(error.message)}. Vuelve a intentarlo.</p>`;
        return;
      }
      resultadoEl.innerHTML = `<p class="aviso aviso-nuevo">${huerfanos.length} producto(s) eliminado(s).</p>`;
    });
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
