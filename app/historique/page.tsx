'use client';

import { useEffect, useState } from 'react';
import { LayoutApp } from '@/components/LayoutApp';
import { Avatar } from '@/components/Avatar';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateLongue } from '@/lib/utils';

export default function PageHistorique() {
  const supabase = useSupabase();
  const { user, hasRang } = useUser();
  const [logs, setLogs] = useState<any[]>([]);
  const [filtreAction, setFiltreAction] = useState('');

  async function charger() {
    if (!user) return;
    let q = supabase
      .from('audit_logs')
      .select('*, acteur:acteur_id(username, avatar_url), cible:cible_user_id(username)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!hasRang(6)) {
      q = q.or(`acteur_id.eq.${user.id},cible_user_id.eq.${user.id}`);
    }

    if (filtreAction) q = q.ilike('action', `%${filtreAction}%`);

    const { data } = await q;
    setLogs(data || []);
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('historique')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreAction, user?.id]);

  return (
    <LayoutApp>
      <h1 className="titre-page mb-4">Historique des actions</h1>

      <input
        value={filtreAction}
        onChange={(e) => setFiltreAction(e.target.value)}
        placeholder="Filtrer par action..."
        className="input mb-4 max-w-md"
      />

      <div className="carte p-0 overflow-x-auto">
        <table className="tableau">
          <thead>
            <tr><th>Acteur</th><th>Action</th><th>Cible</th><th>Date</th><th>IP</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="flex items-center gap-2">
                    {l.acteur && <Avatar src={l.acteur.avatar_url} nom={l.acteur.username} taille={24} />}
                    <span>{l.acteur?.username || 'Système'}</span>
                  </div>
                </td>
                <td className="font-mono text-xs">{l.action}</td>
                <td>{l.cible?.username || '-'}</td>
                <td className="text-xs text-texte-gris">{dateLongue(l.created_at)}</td>
                <td className="text-xs text-texte-gris font-mono">{l.ip || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="text-center text-texte-gris py-8">Aucun log</p>}
      </div>
    </LayoutApp>
  );
}
