import { parseBloque } from '../parser.js';
import {
  abrirOReanudarCierre,
  procesarBloque,
  guardarArticulos,
  finalizarCierre,
} from '../cierreService.js';

export async function montarCargarCierre(contenedor, { repo }) {
  const hoy = new Date().toISOString().slice(0, 10);
  let cierre = await abrirOReanudarCierre(repo, hoy);

  contenedor.innerHTML = `
    <h2>Cargar cierre — ${cierre.fecha}</h2>
    <p id="contador">Códigos guardados en este cierre: cargando…</p>
    <textarea id="texto-pegado" rows="12" style="width:100%;" placeholder="Pega aquí el texto de una página de GEV-Online"></textarea>
    <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
      <button id="btn-anadir">Añadir bloque</button>
      <button id="btn-finalizar">Finalizar cierre</button>
    </div>
    <div id="avisos"></div>
  `;

  const contadorEl = contenedor.querySelector('#contador');
  const avisosEl = contenedor.querySelector('#avisos');
  const textareaEl = contenedor.querySelector('#texto-pegado');

  async function actualizarContador() {
    const codigos = await repo.getCodigosDeCierre(cierre.id);
    contadorEl.textContent = `Códigos guardados en este cierre: ${codigos.length}`;
  }

  function mostrarAviso(texto, clase) {
    const div = document.createElement('div');
    div.className = `aviso ${clase}`;
    div.textContent = texto;
    avisosEl.prepend(div);
  }

  contenedor.querySelector('#btn-anadir').addEventListener('click', async () => {
    const { articulos, noReconocidos } = parseBloque(textareaEl.value);
    if (articulos.length === 0) {
      mostrarAviso('No se ha reconocido ningún artículo en el texto pegado.', 'aviso-desaparecido');
      return;
    }

    const { duplicados } = await procesarBloque(repo, cierre.id, articulos);
    let sobrescribir = true;
    if (duplicados.length > 0) {
      sobrescribir = confirm(
        `${duplicados.length} código(s) ya estaban en este cierre: ${duplicados
          .map((d) => d.codigo)
          .join(', ')}.\n¿Sobrescribir con los valores nuevos? Cancelar = ignorar duplicados.`
      );
    }

    const guardados = await guardarArticulos(repo, cierre.id, articulos, {
      sobrescribirDuplicados: sobrescribir,
    });

    mostrarAviso(
      `Bloque procesado: ${guardados} código(s) guardados, ${noReconocidos} línea(s) no reconocidas.`,
      'aviso-nuevo'
    );
    textareaEl.value = '';
    await actualizarContador();
  });

  contenedor.querySelector('#btn-finalizar').addEventListener('click', async () => {
    if (!confirm(`¿Finalizar el cierre del ${cierre.fecha}? No podrás añadir más bloques después.`)) return;

    const { nuevos, desaparecidos } = await finalizarCierre(repo, cierre.id);

    avisosEl.innerHTML = '';
    if (nuevos.length > 0) {
      mostrarAviso(`Códigos nuevos respecto al cierre anterior: ${nuevos.join(', ')}`, 'aviso-nuevo');
    }
    if (desaparecidos.length > 0) {
      mostrarAviso(
        `Códigos que NO aparecieron en este cierre (se mantiene su último valor conocido): ${desaparecidos.join(', ')}`,
        'aviso-desaparecido'
      );
    }
    mostrarAviso('Cierre finalizado correctamente.', 'aviso-nuevo');
  });

  await actualizarContador();
}
