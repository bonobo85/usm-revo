'use client';

import { useSession } from 'next-auth/react';
import { aLeRang, aLaPermission } from '@/lib/permissions';

export function useUser() {
  const { data: session, status } = useSession();
  const user = session?.user;

  return {
    user,
    rang: user?.rank_level || 0,
    rangNom: user?.rank_nom || '',
    permissions: user?.permissions || [],
    estConnecte: status === 'authenticated' && !!user,
    estEnChargement: status === 'loading',
    estActif: user?.is_active ?? false,

    hasRang: (min: number) => aLeRang(user?.rank_level, min),
    hasPermission: (perm: string) => aLaPermission(user?.permissions, perm),
  };
}
