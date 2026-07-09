import { getSupabaseClient } from './supabaseClient.js';

export async function iniciarSesion(email, password) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function cerrarSesion() {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
}

export async function sesionActual() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onCambioSesion(callback) {
  const supabase = getSupabaseClient();
  // Supabase dispara este evento no solo en login/logout sino también en
  // TOKEN_REFRESHED (~cada hora) e INITIAL_SESSION. Solo nos interesa
  // reaccionar cuando la *presencia* de sesión cambia (logueado <-> deslogueado);
  // de lo contrario un refresh de token remontaría toda la app y borraría
  // texto sin guardar en pantallas como "Cargar cierre".
  let haySesionPrevia = null;
  supabase.auth.onAuthStateChange((_evento, session) => {
    const haySesionAhora = Boolean(session);
    if (haySesionPrevia === haySesionAhora) return;
    haySesionPrevia = haySesionAhora;
    callback(session);
  });
}
