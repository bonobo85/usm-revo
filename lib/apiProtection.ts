import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { verifierLimite, getIp, LIMITES, Limite } from './ratelimit';
import { ErreurValidation } from './validation';

export type ContexteAuth = {
  session: Awaited<ReturnType<typeof getServerSession>> & { user: any };
  ip: string;
};

type OptionsProtection = {
  rangMin?: number;
  permission?: string;
  limite?: Limite;
  cleRateLimit?: string; // si non fourni, utilise l'IP + user_id
};

/**
 * Wrap une route API avec :
 * - Vérification auth
 * - Vérification rang minimum
 * - Vérification permission spéciale
 * - Rate limiting
 * - Compte actif
 * - Gestion d'erreurs centralisée
 */
export function protegerRoute(
  handler: (req: NextRequest, ctx: ContexteAuth) => Promise<NextResponse>,
  opts: OptionsProtection = {}
) {
  return async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user) {
        return NextResponse.json({ erreur: 'non connecté' }, { status: 401 });
      }

      if (!session.user.is_active) {
        return NextResponse.json({ erreur: 'compte désactivé' }, { status: 403 });
      }

      if (opts.rangMin && session.user.rank_level < opts.rangMin) {
        return NextResponse.json({ erreur: 'rang insuffisant' }, { status: 403 });
      }

      if (opts.permission && !session.user.permissions?.includes(opts.permission)) {
        return NextResponse.json({ erreur: 'permission manquante' }, { status: 403 });
      }

      const ip = getIp(req.headers);
      const cleRL = opts.cleRateLimit || `${session.user.id}:${req.nextUrl.pathname}`;
      const rl = verifierLimite(cleRL, opts.limite || LIMITES.standard);

      if (!rl.ok) {
        return NextResponse.json(
          { erreur: 'trop de requêtes, réessaie plus tard' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Remaining': '0',
              'Retry-After': String(Math.ceil(rl.resetDans / 1000)),
            },
          }
        );
      }

      return await handler(req, { session: session as any, ip });
    } catch (e: any) {
      if (e instanceof ErreurValidation) {
        return NextResponse.json({ erreur: e.message }, { status: 400 });
      }
      console.error('Erreur API:', e);
      return NextResponse.json({ erreur: 'erreur serveur' }, { status: 500 });
    }
  };
}
