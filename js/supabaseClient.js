import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://wsmucckfeoyxvbnqeqjx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dZtU3WftKlQ66wouTfkjSw_sz2jlyxr';

let cliente = null;

export function getSupabaseClient() {
  if (!cliente) {
    cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return cliente;
}
