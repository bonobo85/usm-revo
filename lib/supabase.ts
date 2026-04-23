import { createClient } from '@supabase/supabase-js';

const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const cleAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client navigateur (respecte RLS)
export const supabase = createClient(urlSupabase, cleAnon);

// Client serveur avec token utilisateur (pour les API routes)
export function supabaseAvecToken(accessToken: string) {
  return createClient(urlSupabase, cleAnon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// Client admin (ignore RLS) - UNIQUEMENT côté serveur
export function supabaseAdmin() {
  if (!cleService) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante');
  return createClient(urlSupabase, cleService, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
