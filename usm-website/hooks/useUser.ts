'use client';

import { useSession } from 'next-auth/react';
import { aLeRang, aLaPermission, peutVoirCrash, peutVoirFormateurs } from '@/lib/permissions';

export function useUser() {
  const { data: session, status } = useSession();
  const user = session?.user;

  return {
    user,
    rang: user?.rank_level || 0,
    rangNom: user?.rank_nom || '',
    permissions: user?.permissions || [],
    badges: user?.badges || [],
    surnom: user?.surnom || null,
    estConnecte: status === 'authenticated' && !!user,
    estEnChargement: status === 'loading',
    estActif: user?.is_active ?? false,

    hasRang: (min: number) => aLeRang(user?.rank_level, min),
    hasPermission: (perm: string) => aLaPermission(user?.permissions, perm),
    hasBadge: (code: string) => user?.badges?.includes(code) ?? false,

    peutVoirCrash: () => peutVoirCrash(user?.rank_level, user?.badges),
    peutVoirFormateurs: () => peutVoirFormateurs(user?.rank_level, user?.badges),
  };
}
