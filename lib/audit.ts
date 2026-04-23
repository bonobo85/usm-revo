import { supabaseAdmin } from './supabase';

export type InfoAudit = {
  acteur_id: string;
  action: string;
  cible_type?: string;
  cible_id?: string;
  cible_user_id?: string;
  avant?: any;
  apres?: any;
  ip?: string;
  user_agent?: string;
};

export async function logAction(info: InfoAudit) {
  try {
    const admin = supabaseAdmin();
    await admin.from('audit_logs').insert(info);
  } catch (e) {
    console.error('Erreur logAction:', e);
  }
}
