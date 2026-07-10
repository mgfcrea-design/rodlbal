import { urlFichaGev } from '../gevLink.js';

function escapeHTML(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function montarFichaHistorica(contenedor, { repo }) {
  contenedor.innerHTML = `
    <h2>Ficha histórica por código</h2>
    <input id="buscador" type="search" placeholder="Buscar código o descripción" style="width:100%;" />
    <ul id="resultados"></ul>
    <div id="detalle"></div>
  `;

  const buscadorEl = contenedor.querySelector('#buscador');
  const resultadosEl = contenedor.querySelector('#resultados');
  const detalleEl = contenedor.querySelector('#detalle');

  buscadorEl.addEventListener('input', async (evento) => {
    const texto = evento.target.value.trim();
    if (texto.length < 2) {
      resultadosEl.innerHTML = '';
      return;
    }

    let productos;
    try {
      productos = await repo.buscarProducto(texto);
    } catch (error) {
      resultadosEl.innerHTML = `<li class="aviso aviso-desaparecido">Error al buscar productos: ${escapeHTML(error.message)}. Vuelve a intentarlo.</li>`;
      return;
    }

    resultadosEl.innerHTML = productos
      .map(
        (p) =>
          `<li data-codigo="${escapeHTML(p.codigo)}" style="cursor:pointer;"><a href="${escapeHTML(urlFichaGev(p.codigo))}" target="_blank" rel="noopener noreferrer">${escapeHTML(p.codigo)}</a> — ${escapeHTML(p.descripcion)}</li>`
      )
      .join('');
  });

  resultadosEl.addEventListener('click', async (evento) => {
    const li = evento.target.closest('li[data-codigo]');
    if (!li) return;
    const codigo = li.dataset.codigo;

    let lecturas;
    try {
      lecturas = await repo.getLecturasProducto(codigo);
    } catch (error) {
      detalleEl.innerHTML = `<p class="aviso aviso-desaparecido">Error al cargar el histórico de ${escapeHTML(codigo)}: ${escapeHTML(error.message)}. Vuelve a intentarlo.</p>`;
      return;
    }

    pintarDetalle(codigo, lecturas);
  });

  function pintarDetalle(codigo, lecturas) {
    const filas = lecturas
      .map((l, i) => {
        const anterior = lecturas[i - 1];
        const delta = anterior ? l.cantidadTotal - anterior.cantidadTotal : 0;
        const clase = delta < 0 ? 'aviso-desaparecido' : delta > 0 ? 'aviso-nuevo' : '';
        return `<tr class="${clase}"><td>${l.fecha}</td><td>${l.cantidadTotal}</td><td>${l.cantidadBarcelona}</td><td>${l.precioNeto ?? ''}</td><td>${delta}</td></tr>`;
      })
      .join('');

    detalleEl.innerHTML = `
      <h3><a href="${escapeHTML(urlFichaGev(codigo))}" target="_blank" rel="noopener noreferrer">${escapeHTML(codigo)}</a></h3>
      ${dibujarGrafico(lecturas)}
      <table>
        <thead><tr><th>Fecha</th><th>Stock</th><th>Barcelona</th><th>Precio neto</th><th>Delta</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    `;
  }

  function dibujarGrafico(lecturas) {
    if (lecturas.length === 0) return '';
    const ancho = 600;
    const alto = 150;
    const max = Math.max(...lecturas.map((l) => l.cantidadTotal), 1);
    const paso = ancho / Math.max(lecturas.length - 1, 1);
    const puntos = lecturas
      .map((l, i) => `${i * paso},${alto - (l.cantidadTotal / max) * alto}`)
      .join(' ');
    return `<svg viewBox="0 0 ${ancho} ${alto}" width="100%" height="${alto}">
      <polyline points="${puntos}" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>`;
  }
}
