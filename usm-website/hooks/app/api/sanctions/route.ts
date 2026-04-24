import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { protegerRoute } from '@/lib/apiProtection';
import { LIMITES } from '@/lib/ratelimit';
import { verifUuid, verifEnum, verifTexte, verifEntier } from '@/lib/validation';
import { notifSanctionGrave } from '@/lib/discord';

export const POST = protegerRoute(
  async (req: NextRequest, { session, ip }) => {
    const body = await req.json();
    const userId = verifUuid(body.userId, 'userId');
    const type = verifEnum(body.type, 'type', ['avertissement', 'blame', 'suspension'] as const);
    const raison = verifTexte(body.raison, 'raison', { min: 5, max: 2000 });
    const dureeJours =
      type === 'suspension'
        ? verifEntier(body.dureeJours, 'dureeJours', { min: 1, max: 365 })
        : null;

    // Pas soi-même
    if (userId === session.user.id) {
      return NextResponse.json({ erreur: 'impossible de se sanctionner soi-même' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: u } = await admin
      .from('users')
      .select('id, username, avatar_url, rank_level, is_active')
      .eq('id', userId)
      .maybeSingle();
    if (!u) return NextResponse.json({ erreur: 'utilisateur introuvable' }, { status: 404 });
    if (!u.is_active) return NextResponse.json({ erreur: 'compte inactif' }, { status: 400 });

    // Ne peut sanctionner qu'un rang inférieur ou égal au sien -1 (pas de sanction sur pair ou supérieur)
    if (u.rank_level >= session.user.rank_level) {
      return NextResponse.json(
        { erreur: 'ne peut sanctionner que des rangs inférieurs' },
        { status: 403 }
      );
    }

    const dateFin = dureeJours ? new Date(Date.now() + dureeJours * 86400000).toISOString() : null;

    const { data, error } = await admin
      .from('sanctions')
      .insert({
        user_id: userId,
        type,
        raison,
        duree_jours: dureeJours,
        date_fin: dateFin,
        createur_id: session.user.id,
        is_active: true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

    await admin.from('audit_logs').insert({
      acteur_id: session.user.id,
      action: 'creation_sanction',
      cible_user_id: userId,
      cible_type: 'sanction',
      cible_id: data.id,
      apres: { type, raison, dureeJours },
      ip,
    });

    // Webhook pour blâme ou suspension
    if (type !== 'avertissement') {
      await notifSanctionGrave(
        { type, raison, duree_jours: dureeJours },
        { username: u.username, avatar_url: u.avatar_url }
      );
    }

    return NextResponse.json({ ok: true, id: data.id });
  },
  { rangMin: 6, limite: LIMITES.creation }
);
