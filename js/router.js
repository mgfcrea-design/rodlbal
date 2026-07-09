const rutas = new Map();

let handlerHashchangeActual = null;

export function registrarRuta(hash, montar) {
  rutas.set(hash, montar);
}

export async function iniciarRouter(contenedor, obtenerContexto) {
  async function render() {
    const hash = location.hash || '#cargar-cierre';
    const montar = rutas.get(hash) || rutas.get('#cargar-cierre');
    contenedor.innerHTML = '';
    await montar(contenedor, obtenerContexto());
  }
  if (handlerHashchangeActual) {
    window.removeEventListener('hashchange', handlerHashchangeActual);
  }
  handlerHashchangeActual = render;
  window.addEventListener('hashchange', render);
  await render();
}
