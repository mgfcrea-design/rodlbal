import { aCSV } from '../csv.js';

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
    enlace.download = `historico-completo-gev-${new Date().toISOString().slice(0, 10)}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  });

  await cargar();
}
