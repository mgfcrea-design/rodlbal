import { calcularMetricasCodigo } from '../metrics.js';

function escapeHTML(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function montarComparadorEstacional(contenedor, { repo }) {
  contenedor.innerHTML = `
    <h2>Comparador estacional</h2>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;">
      <fieldset>
        <legend>Periodo A</legend>
        <input type="date" id="a-desde" /> a <input type="date" id="a-hasta" />
      </fieldset>
      <fieldset>
        <legend>Periodo B</legend>
        <input type="date" id="b-desde" /> a <input type="date" id="b-hasta" />
      </fieldset>
      <button id="btn-comparar" style="align-self:flex-end;">Comparar</button>
    </div>
    <div id="aviso-comparador"></div>
    <table id="tabla-comparador">
      <thead><tr><th>Código</th><th>Descripción</th><th>Vendido periodo A</th><th>Vendido periodo B</th><th>Diferencia</th></tr></thead>
      <tbody></tbody>
    </table>
  `;

  const avisoEl = contenedor.querySelector('#aviso-comparador');

  function mostrarAviso(mensaje) {
    avisoEl.innerHTML = `<p class="aviso aviso-desaparecido">${escapeHTML(mensaje)}</p>`;
  }

  function limpiarAviso() {
    avisoEl.innerHTML = '';
  }

  contenedor.querySelector('#btn-comparar').addEventListener('click', async () => {
    const aDesde = contenedor.querySelector('#a-desde').value;
    const aHasta = contenedor.querySelector('#a-hasta').value;
    const bDesde = contenedor.querySelector('#b-desde').value;
    const bHasta = contenedor.querySelector('#b-hasta').value;
    if (!aDesde || !aHasta || !bDesde || !bHasta) {
      alert('Rellena las cuatro fechas de ambos periodos.');
      return;
    }

    let productos;
    try {
      productos = await repo.listarProductosConLecturas();
    } catch (error) {
      mostrarAviso(`Error al cargar los productos: ${error.message}. Vuelve a intentarlo.`);
      return;
    }

    limpiarAviso();

    const filas = productos.map((p) => {
      const enRango = (desde, hasta) => p.lecturas.filter((l) => l.fecha >= desde && l.fecha <= hasta);
      const vendidoA = calcularMetricasCodigo(enRango(aDesde, aHasta)).vendidoEstimado;
      const vendidoB = calcularMetricasCodigo(enRango(bDesde, bHasta)).vendidoEstimado;
      return { codigo: p.codigo, descripcion: p.descripcion, vendidoA, vendidoB, diferencia: vendidoB - vendidoA };
    });

    filas.sort((x, y) => Math.abs(y.diferencia) - Math.abs(x.diferencia));

    contenedor.querySelector('#tabla-comparador tbody').innerHTML = filas
      .map(
        (f) =>
          `<tr><td>${escapeHTML(f.codigo)}</td><td>${escapeHTML(f.descripcion)}</td><td>${f.vendidoA}</td><td>${f.vendidoB}</td><td>${f.diferencia}</td></tr>`
      )
      .join('');
  });
}
