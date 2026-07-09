import { sesionActual, onCambioSesion, cerrarSesion } from './auth.js';
import { supabaseRepo } from './supabaseRepo.js';
import { registrarRuta, iniciarRouter } from './router.js';
import { montarLogin } from './screens/login.js';
import { montarCargarCierre } from './screens/cargarCierre.js';
import { montarRanking } from './screens/ranking.js';
import { montarFichaHistorica } from './screens/fichaHistorica.js';
import { montarListadoCierres } from './screens/listadoCierres.js';
import { montarComparadorEstacional } from './screens/comparadorEstacional.js';

const app = document.querySelector('#app');
const nav = document.querySelector('#nav');

registrarRuta('#cargar-cierre', montarCargarCierre);
registrarRuta('#ranking', montarRanking);
registrarRuta('#ficha-historica', montarFichaHistorica);
registrarRuta('#listado-cierres', montarListadoCierres);
registrarRuta('#comparador-estacional', montarComparadorEstacional);

document.querySelector('#btn-logout').addEventListener('click', () => cerrarSesion());

async function arrancar() {
  const sesion = await sesionActual();
  if (!sesion) {
    nav.hidden = true;
    await montarLogin(app);
    return;
  }
  nav.hidden = false;
  await iniciarRouter(app, () => ({ repo: supabaseRepo }));
}

onCambioSesion(() => arrancar());
arrancar();
