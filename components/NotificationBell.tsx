'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateRelative } from '@/lib/utils';
import type { Notification } from '@/types';

export function NotificationBell() {
  const supabase = useSupabase();
  const { user } = useUser();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);

  async function charger() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) {
      setNotifs(data as any);
      setNonLues(data.filter((n: any) => !n.read_at).length);
    }
  }

  useEffect(() => {
    charger();
    if (!user) return;
    const ch = supabase
      .channel('notifs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => charger()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function cliquerNotif(n: Notification) {
    if (!n.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
    }
    setOuvert(false);
    if (n.lien) router.push(n.lien);
    charger();
  }

  async function toutMarquerLu() {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    charger();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOuvert(!ouvert)}
        className="relative p-2 text-gray-300 hover:text-white hover:bg-fond-carte rounded-md transition-colors"
      >
        <Bell size={20} />
        {nonLues > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {nonLues > 9 ? '9+' : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOuvert(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-fond-carte border border-gris-bordure rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
            <div className="p-3 border-b border-gris-bordure flex items-center justify-between">
              <h3 className="font-semibold text-white">Notifications</h3>
              {nonLues > 0 && (
                <button onClick={toutMarquerLu} className="text-xs text-bleu-clair hover:underline">
                  Tout marquer lu
                </button>
              )}
            </div>
            {notifs.length === 0 ? (
              <p className="p-6 text-center text-texte-gris text-sm">Aucune notification</p>
            ) : (
              <ul>
                {notifs.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => cliquerNotif(n)}
                      className={`w-full text-left p-3 border-b border-gris-bordure hover:bg-fond-clair transition-colors ${
                        !n.read_at ? 'bg-bleu/5' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm font-medium text-white">{n.titre}</p>
                        {!n.read_at && <span className="w-2 h-2 rounded-full bg-bleu-clair shrink-0 mt-1.5" />}
                      </div>
                      {n.message && <p className="text-xs text-texte-gris mt-1">{n.message}</p>}
                      <p className="text-xs text-texte-gris mt-1">{dateRelative(n.created_at)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
