'use client';

import { useSession } from 'next-auth/react';
import { aLeRang, aLaPermission, peutVoirCrash, peutVoirFormateurs } from '@/lib/permissions';

export function useUser() {
  const { data: session, status } = useSession();
  const user = session?.user as any;

  const badges: string[] = user?.badges || [];
  const surnom: string | null = user?.surnom || null;

  return {
    user,
    rang: user?.rank_level || 0,
    rangNom: user?.rank_nom || '',
    permissions: (user?.permissions as string[]) || [],
    badges,
    surnom,
    estConnecte: status === 'authenticated' && !!user,
    estEnChargement: status === 'loading',
    estActif: user?.is_active ?? false,

    hasRang: (min: number) => aLeRang(user?.rank_level, min),
    hasPermission: (perm: string) => aLaPermission(user?.permissions, perm),
    hasBadge: (code: string) => badges.includes(code),

    peutVoirCrash: () => peutVoirCrash(user?.rank_level, badges),
    peutVoirFormateurs: () => peutVoirFormateurs(user?.rank_level, badges),
  };
}
