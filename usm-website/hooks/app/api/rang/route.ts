import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { protegerRoute } from '@/lib/apiProtection';
import { LIMITES } from '@/lib/ratelimit';
import { verifUuid, verifEntier, verifTexte } from '@/lib/validation';
import { notifPromotion } from '@/lib/discord';
import { NOMS_RANGS } from '@/lib/permissions';

export const POST = protegerRoute(
  async (req: NextRequest, { session, ip }) => {
    const body = await req.json();
    const userId = verifUuid(body.userId, 'userId');
    const nouveauRang = verifEntier(body.nouveauRang, 'nouveauRang', { min: 1, max: 9 });
    const raison = verifTexte(body.raison, 'raison', { min: 3, max: 500 });

    // Pas soi-même
    if (userId === session.user.id) {
      return NextResponse.json({ erreur: 'impossible de modifier son propre rang' }, { status: 400 });
    }

    // Anti-escalade : le nouveau rang doit être < au rang de l'acteur
    if (nouveauRang >= session.user.rank_level) {
      return NextResponse.json(
        { erreur: 'impossible d\'attribuer un rang supérieur ou égal au vôtre' },
        { status: 403 }
      );
    }

    const admin = supabaseAdmin();
    const { data: u } = await admin.from('users').select('*').eq('id', userId).maybeSingle();
    if (!u) return NextResponse.json({ erreur: 'utilisateur introuvable' }, { status: 404 });
    if (!u.is_active) return NextResponse.json({ erreur: 'compte désactivé' }, { status: 400 });

    // Anti-escalade : ne peut modifier que quelqu'un de rang strictement inférieur au sien
    if (u.rank_level >= session.user.rank_level) {
      return NextResponse.json(
        { erreur: 'ne peut modifier que les rangs strictement inférieurs au vôtre' },
        { status: 403 }
      );
    }

    if (u.rank_level === nouveauRang) {
      return NextResponse.json({ erreur: 'rang inchangé' }, { status: 400 });
    }

    const ancienRang = u.rank_level;

    // Update
    const { error } = await admin.from('users').update({ rank_level: nouveauRang }).eq('id', userId);
    if (error) return NextResponse.json({ erreur: error.message }, { status: 500 });

    // Historique
    await admin.from('rank_history').insert({
      user_id: userId,
      ancien_rank: ancienRang,
      nouveau_rank: nouveauRang,
      raison,
      modifie_par: session.user.id,
    });

    // Audit
    await admin.from('audit_logs').insert({
      acteur_id: session.user.id,
      action: nouveauRang > ancienRang ? 'promotion' : 'retrogradation',
      cible_user_id: userId,
      cible_type: 'user',
      cible_id: userId,
      avant: { rank_level: ancienRang },
      apres: { rank_level: nouveauRang, raison },
      ip,
    });

    // Webhook Discord
    await notifPromotion(
      { username: u.username, avatar_url: u.avatar_url },
      ancienRang,
      nouveauRang,
      NOMS_RANGS
    );

    return NextResponse.json({ ok: true });
  },
  { rangMin: 7, limite: LIMITES.sensible }
);
