'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Users, Network, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Avatar } from '@/components/Avatar';
import { BadgesRow } from '@/components/BadgeTag';
import { useSupabase } from '@/hooks/useSupabase';
import { NOMS_RANGS, couleurRang } from '@/lib/permissions';

type Membre = {
  id: string;
  username: string;
  surnom: string | null;
  avatar_url: string | null;
  rank_level: number;
  statut: string;
  is_active: boolean;
  badges?: { code: string; nom: string; couleur: string }[];
};

const COULEURS_STATUT: Record<string, { dot: string; label: string }> = {
  disponible: { dot: 'bg-emerald-500', label: 'ACTIF' },
  occupe: { dot: 'bg-amber-500', label: 'OCCUPÉ' },
  absent: { dot: 'bg-red-500', label: 'ABSENT' },
  hors_ligne: { dot: 'bg-gray-500', label: 'HORS LIGNE' },
};

type TriKey = 'rang_desc' | 'rang_asc' | 'surnom' | 'recent';

export default function PagePersonnel() {
  const supabase = useSupabase();
  const [onglet, setOnglet] = useState('liste');
  const [membres, setMembres] = useState<Membre[]>([]);
  const [recherche, setRecherche] = useState('');
  const [filtreRang, setFiltreRang] = useState<number | null>(null);
  const [tri, setTri] = useState<TriKey>('rang_desc');
  const [filtresOuverts, setFiltresOuverts] = useState(false);

  async function charger() {
    const { data: users } = await supabase
      .from('users')
      .select('id, username, surnom, avatar_url, rank_level, statut, is_active')
      .eq('is_active', true)
      .is('deleted_at', null);
    if (!users) { setMembres([]); return; }

    const { data: ubs } = await supabase
      .from('user_badges')
      .select('user_id, badges(code, nom, couleur)')
      .eq('is_active', true)
      .is('deleted_at', null)
      .in('user_id', users.map((u) => u.id));

    const byUser = new Map<string, any[]>();
    for (const row of (ubs || []) as any[]) {
      if (!row.badges) continue;
      const arr = byUser.get(row.user_id) || [];
      arr.push(row.badges);
      byUser.set(row.user_id, arr);
    }

    setMembres(users.map((u) => ({ ...u, badges: byUser.get(u.id) || [] })));
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('personnel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtres = useMemo(() => {
    const rq = recherche.trim().toLowerCase();
    let res = membres.filter((m) => {
      if (filtreRang && m.rank_level !== filtreRang) return false;
      if (!rq) return true;
      const surnom = (m.surnom || '').toLowerCase();
      const username = m.username.toLowerCase();
      const gradeNom = (NOMS_RANGS[m.rank_level] || '').toLowerCase();
      return surnom.includes(rq) || username.includes(rq) || gradeNom.includes(rq);
    });
    res.sort((a, b) => {
      switch (tri) {
        case 'rang_asc': return a.rank_level - b.rank_level;
        case 'surnom': return (a.surnom || a.username).localeCompare(b.surnom || b.username);
        case 'recent': return 0; // placeholder si besoin
        case 'rang_desc':
        default: return b.rank_level - a.rank_level;
      }
    });
    return res;
  }, [membres, recherche, filtreRang, tri]);

  const stats = {
    total: membres.length,
    actifs: membres.filter((m) => m.statut === 'disponible').length,
    grades: new Set(membres.map((m) => m.rank_level)).size,
  };

  return (
    <LayoutApp>
      <h1 className="titre-page mb-4">Personnel de l'unité</h1>

      <Tabs
        onglets={[
          { id: 'liste', label: 'Liste des membres', icone: Users },
          { id: 'organigramme', label: 'Organigramme', icone: Network },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {onglet === 'liste' && (
        <>
          {/* Search + filtres */}
          <div className="carte mb-4 !p-3">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-texte-gris" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par surnom ou grade..."
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  className="input pl-10"
                />
              </div>
              <div className="relative">
                <select
                  value={filtreRang || ''}
                  onChange={(e) => setFiltreRang(e.target.value ? Number(e.target.value) : null)}
                  className="input pr-8 appearance-none min-w-48"
                >
                  <option value="">Tous les grades</option>
                  {Object.entries(NOMS_RANGS).reverse().map(([lvl, nom]) => (
                    <option key={lvl} value={lvl}>{nom}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-texte-gris pointer-events-none" />
              </div>
              <button
                onClick={() => setFiltresOuverts((v) => !v)}
                className="input flex items-center gap-2 !w-auto px-3"
                type="button"
              >
                <SlidersHorizontal size={16} /> Trier
              </button>
            </div>
            {filtresOuverts && (
              <div className="mt-3 pt-3 border-t border-gris-bordure flex gap-2 flex-wrap">
                {[
                  { key: 'rang_desc', label: 'Grade élevé → bas' },
                  { key: 'rang_asc', label: 'Grade bas → élevé' },
                  { key: 'surnom', label: 'Surnom (A-Z)' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTri(opt.key as TriKey)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      tri === opt.key
                        ? 'bg-bleu text-white'
                        : 'bg-fond-clair text-texte-gris hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="carte mb-4 grid grid-cols-3 gap-4 text-center py-4">
            <div>
              <p className="text-3xl font-bold text-white">{stats.total}</p>
              <p className="text-[10px] uppercase tracking-wider text-texte-gris mt-1">Membres total</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-emerald-400">{stats.actifs}</p>
              <p className="text-[10px] uppercase tracking-wider text-texte-gris mt-1">Disponibles</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{stats.grades}</p>
              <p className="text-[10px] uppercase tracking-wider text-texte-gris mt-1">Grades représentés</p>
            </div>
          </div>

          {/* Liste membres */}
          <div className="space-y-2">
            {filtres.map((m) => (
              <MembreRow key={m.id} m={m} />
            ))}
            {filtres.length === 0 && (
              <p className="text-center text-texte-gris py-12">Aucun membre trouvé</p>
            )}
          </div>
        </>
      )}

      {onglet === 'organigramme' && (
        <div className="space-y-4">
          {Object.entries(NOMS_RANGS)
            .map(([lvl, nom]) => ({ level: Number(lvl), nom, liste: membres.filter((m) => m.rank_level === Number(lvl)) }))
            .filter((g) => g.liste.length > 0)
            .sort((a, b) => b.level - a.level)
            .map((g) => (
              <div key={g.level} className="carte" style={{ borderLeftWidth: 4, borderLeftColor: couleurRang(g.level) }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold" style={{ color: couleurRang(g.level) }}>{g.nom}</h2>
                  <span className="text-sm text-texte-gris">{g.liste.length} membre(s)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {g.liste.map((m) => (
                    <Link key={m.id} href={`/profil/${m.id}`} className="flex flex-col items-center p-2 hover:bg-fond-clair rounded transition-colors">
                      <div className="relative">
                        <Avatar src={m.avatar_url} nom={m.username} taille={56} />
                        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-fond-carte ${COULEURS_STATUT[m.statut]?.dot || 'bg-gray-500'}`} />
                      </div>
                      <p className="text-xs text-white mt-2 text-center truncate w-full font-medium">
                        {m.surnom || m.username}
                      </p>
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

function MembreRow({ m }: { m: Membre }) {
  const statut = COULEURS_STATUT[m.statut] || COULEURS_STATUT.hors_ligne;
  const couleur = couleurRang(m.rank_level);

  return (
    <Link
      href={`/profil/${m.id}`}
      className="carte block !p-3 transition-colors hover:border-white/20"
      style={{ borderLeftWidth: 3, borderLeftColor: couleur }}
    >
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar src={m.avatar_url} nom={m.username} taille={56} />
          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-fond-carte ${statut.dot}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-white font-semibold truncate">{m.surnom || m.username}</p>
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
              style={{ backgroundColor: statut.dot.includes('emerald') ? 'rgb(16 185 129 / 0.15)' : 'rgb(100 116 139 / 0.15)', color: statut.dot.includes('emerald') ? '#34d399' : '#94a3b8' }}
            >
              {statut.label}
            </span>
          </div>
          <p className="text-sm text-texte-gris mb-2">
            <span style={{ color: couleur }}>{NOMS_RANGS[m.rank_level]}</span>
          </p>
          {m.badges && m.badges.length > 0 && (
            <BadgesRow badges={m.badges} taille="xs" />
          )}
        </div>
      </div>
    </Link>
  );
}
