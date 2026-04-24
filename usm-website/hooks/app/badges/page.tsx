'use client';

import { useEffect, useState } from 'react';
import { LayoutApp } from '@/components/LayoutApp';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { RankBadge } from '@/components/RankBadge';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte } from '@/lib/utils';

export default function PageBadges() {
  const supabase = useSupabase();
  const { user, hasRang } = useUser();
  const [membres, setMembres] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [attributions, setAttributions] = useState<any[]>([]);
  const [modal, setModal] = useState<{ membre: any; badge: any } | null>(null);
  const [raison, setRaison] = useState('');

  async function charger() {
    const [m, b, a] = await Promise.all([
      supabase.from('users').select('*').eq('is_active', true).order('rank_level', { ascending: false }),
      supabase.from('badges').select('*').is('deleted_at', null).order('id'),
      supabase.from('user_badges').select('*').eq('is_active', true).is('deleted_at', null),
    ]);
    setMembres(m.data || []);
    setBadges(b.data || []);
    setAttributions(a.data || []);
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aCeBadge(userId: string, badgeId: number) {
    return attributions.find((a) => a.user_id === userId && a.badge_id === badgeId);
  }

  async function attribuer() {
    if (!modal || !user) return;
    await supabase.from('user_badges').insert({
      user_id: modal.membre.id,
      badge_id: modal.badge.id,
      attribue_par: user.id,
      is_active: true,
    });
    setModal(null);
    setRaison('');
  }

  async function revoquer() {
    if (!modal || !user || !raison.trim()) return;
    const attr = aCeBadge(modal.membre.id, modal.badge.id);
    if (!attr) return;
    await supabase.from('user_badges').update({
      is_active: false,
      revoque_par: user.id,
      revoque_le: new Date().toISOString(),
      raison_revocation: raison,
    }).eq('id', attr.id);
    setModal(null);
    setRaison('');
  }

  return (
    <LayoutApp>
      <h1 className="titre-page mb-4">Badges</h1>

      <div className="carte p-0 overflow-x-auto">
        <table className="tableau min-w-max">
          <thead>
            <tr>
              <th className="sticky left-0 bg-fond-clair">Membre</th>
              <th>Rang</th>
              {badges.map((b) => (
                <th key={b.id} className="text-center text-xs" style={{ color: b.couleur }}>{b.nom}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {membres.map((m) => (
              <tr key={m.id}>
                <td className="sticky left-0 bg-fond-carte">
                  <div className="flex items-center gap-2">
                    <Avatar src={m.avatar_url} nom={m.username} taille={28} />
                    <span>{m.username}</span>
                  </div>
                </td>
                <td><RankBadge rang={m.rank_level} taille="sm" /></td>
                {badges.map((b) => {
                  const a = aCeBadge(m.id, b.id);
                  const cellule = (
                    <span
                      title={a ? `Attribué le ${dateCourte(a.attribue_le)}` : 'Non attribué'}
                      className="text-xl"
                    >
                      {a ? '✅' : '❌'}
                    </span>
                  );
                  return (
                    <td key={b.id} className="text-center">
                      {hasRang(6) ? (
                        <button onClick={() => setModal({ membre: m, badge: b })} className="hover:bg-fond-clair rounded p-1">
                          {cellule}
                        </button>
                      ) : cellule}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        ouvert={!!modal}
        onFermer={() => { setModal(null); setRaison(''); }}
        titre={modal ? `${modal.badge.nom} — ${modal.membre.username}` : ''}
      >
        {modal && (() => {
          const existe = aCeBadge(modal.membre.id, modal.badge.id);
          return (
            <div className="space-y-4">
              <p className="text-sm text-gray-300">{modal.badge.description}</p>
              {existe ? (
                <>
                  <p className="text-sm text-texte-gris">
                    Badge attribué le {dateCourte(existe.attribue_le)}
                  </p>
                  <div>
                    <label className="label">Raison de la révocation *</label>
                    <textarea value={raison} onChange={(e) => setRaison(e.target.value)} className="input" rows={3} />
                  </div>
                  <button onClick={revoquer} className="bouton-rouge w-full" disabled={!raison.trim()}>
                    Révoquer le badge
                  </button>
                </>
              ) : (
                <button onClick={attribuer} className="bouton-or w-full">
                  Attribuer ce badge
                </button>
              )}
            </div>
          );
        })()}
      </Modal>
    </LayoutApp>
  );
}
