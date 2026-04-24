'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function useSupabase(): SupabaseClient {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;

  return useMemo(() => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }, [token]);
}
