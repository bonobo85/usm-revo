'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Users, Radio, Network } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { RankBadge } from '@/components/RankBadge';
import { Avatar } from '@/components/Avatar';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { NOMS_RANGS, couleurRang } from '@/lib/permissions';

const COULEURS_STATUT: Record<string, string> = {
  disponible: '🟢',
  occupe: '🟡',
  absent: '🔴',
  hors_ligne: '⚫',
};

export default function PagePersonnel() {
  const supabase = useSupabase();
  const { user, hasRang } = useUser();
  const [onglet, setOnglet] = useState('annuaire');
  const [membres, setMembres] = useState<any[]>([]);
  const [recherche, setRecherche] = useState('');
  const [filtreRang, setFiltreRang] = useState<number | null>(null);

  async function charger() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('rank_level', { ascending: false });
    setMembres(data || []);
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('personnel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changerStatut(userId: string, nouveauStatut: string) {
    await supabase.from('users').update({ statut: nouveauStatut }).eq('id', userId);
    charger();
  }

  const filtres = membres.filter((m) => {
    if (recherche && !m.username.toLowerCase().includes(recherche.toLowerCase())) return false;
    if (filtreRang && m.rank_level !== filtreRang) return false;
    return true;
  });

  return (
    <LayoutApp>
      <h1 className="titre-page mb-4">Personnel de l'unité</h1>

      <Tabs
        onglets={[
          { id: 'annuaire', label: 'Annuaire', icone: Users },
          { id: 'statut', label: 'Statut équipe', icone: Radio },
          { id: 'organigramme', label: 'Organigramme', icone: Network },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {/* Onglet Annuaire */}
      {onglet === 'annuaire' && (
        <>
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-texte-gris" size={18} />
              <input
                type="text"
                placeholder="Rechercher un membre..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="input pl-10"
              />
            </div>
            <select
              value={filtreRang || ''}
              onChange={(e) => setFiltreRang(e.target.value ? Number(e.target.value) : null)}
              className="input max-w-xs"
            >
              <option value="">Tous les rangs</option>
              {Object.entries(NOMS_RANGS).reverse().map(([lvl, nom]) => (
                <option key={lvl} value={lvl}>{nom}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtres.map((m) => (
              <Link key={m.id} href={`/profil/${m.id}`} className="carte-hover text-center">
                <div className="relative inline-block mb-3">
                  <Avatar src={m.avatar_url} nom={m.username} taille={72} />
                  <span className="absolute bottom-0 right-0 text-lg">{COULEURS_STATUT[m.statut]}</span>
                </div>
                <p className="text-sm text-white font-medium truncate">{m.username}</p>
                <div className="mt-2">
                  <RankBadge rang={m.rank_level} taille="sm" />
                </div>
              </Link>
            ))}
          </div>
          {filtres.length === 0 && (
            <p className="text-center text-texte-gris py-12">Aucun membre trouvé</p>
          )}
        </>
      )}

      {/* Onglet Statut */}
      {onglet === 'statut' && (
        <div className="carte p-0">
          <table className="tableau">
            <thead>
              <tr>
                <th>Membre</th>
                <th>Rang</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/profil/${m.id}`} className="flex items-center gap-2 hover:text-bleu-clair">
                      <Avatar src={m.avatar_url} nom={m.username} taille={32} />
                      <span>{m.username}</span>
                    </Link>
                  </td>
                  <td><RankBadge rang={m.rank_level} taille="sm" /></td>
                  <td>
                    {(m.id === user?.id || hasRang(6)) ? (
                      <select
                        value={m.statut}
                        onChange={(e) => changerStatut(m.id, e.target.value)}
                        className="input py-1 text-xs w-auto"
                      >
                        <option value="disponible">🟢 Disponible</option>
                        <option value="occupe">🟡 Occupé</option>
                        <option value="absent">🔴 Absent</option>
                        <option value="hors_ligne">⚫ Hors ligne</option>
                      </select>
                    ) : (
                      <span>{COULEURS_STATUT[m.statut]} {m.statut}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Onglet Organigramme */}
      {onglet === 'organigramme' && (
        <div className="space-y-6">
          {Object.entries(NOMS_RANGS)
            .map(([lvl, nom]) => ({ level: Number(lvl), nom, membres: membres.filter((m) => m.rank_level === Number(lvl)) }))
            .filter((g) => g.membres.length > 0)
            .sort((a, b) => b.level - a.level)
            .map((g) => (
              <div key={g.level} className="carte" style={{ borderLeftWidth: 4, borderLeftColor: couleurRang(g.level) }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold" style={{ color: couleurRang(g.level) }}>{g.nom}</h2>
                  <span className="text-sm text-texte-gris">{g.membres.length} membre(s)</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {g.membres.map((m) => (
                    <Link key={m.id} href={`/profil/${m.id}`} className="flex flex-col items-center p-2 hover:bg-fond-clair rounded">
                      <Avatar src={m.avatar_url} nom={m.username} taille={48} />
                      <p className="text-xs text-white mt-2 text-center truncate w-full">{m.username}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </LayoutApp>
  );
}
