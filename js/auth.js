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
  supabase.auth.onAuthStateChange((_evento, session) => callback(session));
}
