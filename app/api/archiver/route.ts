import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { protegerRoute } from '@/lib/apiProtection';
import { LIMITES } from '@/lib/ratelimit';
import { verifUuid, verifTexte, verifEnum } from '@/lib/validation';

export const POST = protegerRoute(
  async (req: NextRequest, { session, ip }) => {
    const body = await req.json();
    const userId = verifUuid(body.userId, 'userId');
    const raison = verifEnum(body.raison, 'raison', ['demission', 'exclusion', 'inactivite', 'autre'] as const);
    const notes = verifTexte(body.notes, 'notes', { max: 2000, requis: false });

    // Pas archiver soi-même
    if (userId === session.user.id) {
      return NextResponse.json({ erreur: "impossible d'archiver soi-même" }, { status: 400 });
    }

    const admin = supabaseAdmin();

    const { data: u } = await admin.from('users').select('*').eq('id', userId).maybeSingle();
    if (!u) return NextResponse.json({ erreur: 'utilisateur introuvable' }, { status: 404 });

    // Pas archiver quelqu'un de rang >= au sien
    if (u.rank_level >= session.user.rank_level) {
      return NextResponse.json({ erreur: 'ne peut pas archiver un rang supérieur ou égal' }, { status: 403 });
    }

    if (!u.is_active) {
      return NextResponse.json({ erreur: 'déjà archivé' }, { status: 400 });
    }

    const { data: archive, error: errA } = await admin
      .from('archives')
      .insert({
        user_id: u.id,
        username_final: u.username,
        rank_final: u.rank_level,
        date_entree: u.date_entree,
        raison,
        notes: notes || null,
        archive_par: session.user.id,
      })
      .select()
      .single();

    if (errA) return NextResponse.json({ erreur: errA.message }, { status: 500 });

    // Copie historique
    const [rangs, badges, sanctions, rapports] = await Promise.all([
      admin.from('rank_history').select('*').eq('user_id', userId),
      admin.from('user_badges').select('*').eq('user_id', userId),
      admin.from('sanctions').select('*').eq('user_id', userId),
      admin.from('reports').select('*').eq('auteur_id', userId),
    ]);

    const records: any[] = [];
    (rangs.data || []).forEach((r) =>
      records.push({ archive_id: archive.id, type: 'rang_change', contenu: r, date_evenement: r.created_at })
    );
    (badges.data || []).forEach((b) =>
      records.push({ archive_id: archive.id, type: 'badge', contenu: b, date_evenement: b.attribue_le })
    );
    (sanctions.data || []).forEach((s) =>
      records.push({ archive_id: archive.id, type: 'sanction', contenu: s, date_evenement: s.created_at })
    );
    (rapports.data || []).forEach((r) =>
      records.push({ archive_id: archive.id, type: 'rapport', contenu: r, date_evenement: r.created_at })
    );

    if (records.length) await admin.from('archive_records').insert(records);

    await admin.from('users').update({ is_active: false, statut: 'hors_ligne' }).eq('id', userId);

    await admin.from('audit_logs').insert({
      acteur_id: session.user.id,
      action: 'archivage_membre',
      cible_user_id: userId,
      cible_type: 'user',
      cible_id: userId,
      avant: { is_active: true, rank_level: u.rank_level },
      apres: { raison, notes, is_active: false },
      ip,
    });

    return NextResponse.json({ ok: true, archiveId: archive.id });
  },
  { rangMin: 7, limite: LIMITES.sensible }
);
