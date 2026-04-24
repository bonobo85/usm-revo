'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { BadgeTag } from '@/components/BadgeTag';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { NOMS_RANGS, couleurRang, ORDRE_BADGES, estOpSecondMin } from '@/lib/permissions';
import { dateCourte } from '@/lib/utils';

type Badge = { id: number; code: string; nom: string; couleur: string; description: string | null };
type Attribution = {
  id: string;
  user_id: string;
  badge_id: number;
  attribue_le: string;
  attribue_par: string | null;
  raison?: string | null;
};
type Membre = {
  id: string;
  username: string;
  surnom: string | null;
  avatar_url: string | null;
  rank_level: number;
  is_active: boolean;
};

type TriKey = 'rang_desc' | 'rang_asc' | 'surnom';

export default function PageBadges() {
  const supabase = useSupabase();
  const { user, rang } = useUser();
  const peutGerer = estOpSecondMin(rang);

  const [membres, setMembres] = useState<Membre[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [attributions, setAttributions] = useState<Attribution[]>([]);

  const [recherche, setRecherche] = useState('');
  const [filtreBadge, setFiltreBadge] = useState<string>('');
  const [tri, setTri] = useState<TriKey>('rang_desc');
  const [filtresOuverts, setFiltresOuverts] = useState(false);

  const [modalAjout, setModalAjout] = useState<Membre | null>(null);
  const [modalRevoque, setModalRevoque] = useState<{ membre: Membre; badge: Badge; attr: Attribution } | null>(null);
  const [raison, setRaison] = useState('');

  async function charger() {
    const [m, b, a] = await Promise.all([
      supabase
        .from('users')
        .select('id, username, surnom, avatar_url, rank_level, is_active')
        .eq('is_active', true)
        .is('deleted_at', null),
      supabase.from('badges').select('*').is('deleted_at', null),
      supabase.from('user_badges').select('*').eq('is_active', true).is('deleted_at', null),
    ]);
    setMembres(m.data || []);
    setBadges((b.data || []).sort((x: Badge, y: Badge) => (ORDRE_BADGES[x.code] || 99) - (ORDRE_BADGES[y.code] || 99)));
    setAttributions(a.data || []);
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('badges-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges' }, () => charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function badgesDe(userId: string): { badge: Badge; attr: Attribution }[] {
    return attributions
      .filter((a) => a.user_id === userId)
      .map((a) => ({ attr: a, badge: badges.find((b) => b.id === a.badge_id)! }))
      .filter((x) => !!x.badge)
      .sort((a, b) => (ORDRE_BADGES[a.badge.code] || 99) - (ORDRE_BADGES[b.badge.code] || 99));
  }

  const liste = useMemo(() => {
    const rq = recherche.trim().toLowerCase();
    let res = membres.filter((m) => {
      if (rq) {
        const nom = (m.surnom || m.username).toLowerCase();
        const grade = (NOMS_RANGS[m.rank_level] || '').toLowerCase();
        if (!nom.includes(rq) && !m.username.toLowerCase().includes(rq) && !grade.includes(rq)) return false;
      }
      if (filtreBadge) {
        const codes = badgesDe(m.id).map((x) => x.badge.code);
        if (!codes.includes(filtreBadge)) return false;
      }
      return true;
    });
    res.sort((a, b) => {
      switch (tri) {
        case 'rang_asc': return a.rank_level - b.rank_level;
        case 'surnom': return (a.surnom || a.username).localeCompare(b.surnom || b.username);
        case 'rang_desc':
        default: return b.rank_level - a.rank_level;
      }
    });
    return res;
  }, [membres, attributions, badges, recherche, filtreBadge, tri]);

  async function attribuer(membre: Membre, badge: Badge) {
    if (!user) return;
    await supabase.from('user_badges').insert({
      user_id: membre.id,
      badge_id: badge.id,
      attribue_par: user.id,
      is_active: true,
    });
    setModalAjout(null);
  }

  async function revoquer() {
    if (!modalRevoque || !user || !raison.trim()) return;
    await supabase.from('user_badges').update({
      is_active: false,
      revoque_par: user.id,
      revoque_le: new Date().toISOString(),
      raison_revocation: raison,
    }).eq('id', modalRevoque.attr.id);
    setModalRevoque(null);
    setRaison('');
  }

  const stats = {
    total: membres.length,
    avecBadge: new Set(attributions.map((a) => a.user_id)).size,
    badges: badges.length,
  };

  return (
    <LayoutApp>
      <h1 className="titre-page mb-4">Badges</h1>

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
              value={filtreBadge}
              onChange={(e) => setFiltreBadge(e.target.value)}
              className="input pr-8 appearance-none min-w-48"
            >
              <option value="">Tous les badges</option>
              {badges.map((b) => (
                <option key={b.id} value={b.code}>{b.nom}</option>
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
          <p className="text-[10px] uppercase tracking-wider text-texte-gris mt-1">Membres</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-or">{stats.avecBadge}</p>
          <p className="text-[10px] uppercase tracking-wider text-texte-gris mt-1">Avec badge</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-white">{stats.badges}</p>
          <p className="text-[10px] uppercase tracking-wider text-texte-gris mt-1">Badges disponibles</p>
        </div>
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {liste.map((m) => {
          const mesBadges = badgesDe(m.id);
          const couleur = couleurRang(m.rank_level);
          return (
            <div
              key={m.id}
              className="carte !p-3"
              style={{ borderLeftWidth: 3, borderLeftColor: couleur }}
            >
              <div className="flex items-center gap-4 flex-wrap">
                <Avatar src={m.avatar_url} nom={m.username} taille={48} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{m.surnom || m.username}</p>
                  <p className="text-xs" style={{ color: couleur }}>{NOMS_RANGS[m.rank_level]}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {mesBadges.length === 0 && (
                    <span className="text-xs text-texte-gris italic">Aucun badge</span>
                  )}
                  {mesBadges.map(({ badge, attr }) => (
                    <button
                      key={attr.id}
                      onClick={() => peutGerer && setModalRevoque({ membre: m, badge, attr })}
                      disabled={!peutGerer}
                      title={`Attribué le ${dateCourte(attr.attribue_le)}`}
                      className={peutGerer ? 'group relative cursor-pointer' : 'cursor-default'}
                    >
                      <BadgeTag badge={badge} taille="sm" />
                      {peutGerer && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X size={10} />
                        </span>
                      )}
                    </button>
                  ))}
                  {peutGerer && (
                    <button
                      onClick={() => setModalAjout(m)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border border-dashed border-gris-bordure text-texte-gris hover:text-white hover:border-white/40 transition-colors"
                    >
                      <Plus size={12} /> Ajouter
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {liste.length === 0 && (
          <p className="text-center text-texte-gris py-12">Aucun membre trouvé</p>
        )}
      </div>

      {/* Modal ajout */}
      <Modal
        ouvert={!!modalAjout}
        onFermer={() => setModalAjout(null)}
        titre={modalAjout ? `Attribuer un badge — ${modalAjout.surnom || modalAjout.username}` : ''}
      >
        {modalAjout && (() => {
          const dejaAttr = badgesDe(modalAjout.id).map((x) => x.badge.code);
          const dispo = badges.filter((b) => !dejaAttr.includes(b.code));
          return (
            <div className="space-y-3">
              {dispo.length === 0 && (
                <p className="text-sm text-texte-gris">Tous les badges sont déjà attribués.</p>
              )}
              {dispo.map((b) => (
                <button
                  key={b.id}
                  onClick={() => attribuer(modalAjout, b)}
                  className="w-full flex items-center gap-3 p-3 rounded border border-gris-bordure hover:border-white/30 hover:bg-fond-clair transition-colors text-left"
                >
                  <BadgeTag badge={b} taille="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{b.nom}</p>
                    {b.description && (
                      <p className="text-xs text-texte-gris truncate">{b.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          );
        })()}
      </Modal>

      {/* Modal révocation */}
      <Modal
        ouvert={!!modalRevoque}
        onFermer={() => { setModalRevoque(null); setRaison(''); }}
        titre={modalRevoque ? `Révoquer ${modalRevoque.badge.nom}` : ''}
      >
        {modalRevoque && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-fond-clair rounded">
              <Avatar src={modalRevoque.membre.avatar_url} nom={modalRevoque.membre.username} taille={36} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{modalRevoque.membre.surnom || modalRevoque.membre.username}</p>
                <p className="text-xs text-texte-gris">
                  Badge attribué le {dateCourte(modalRevoque.attr.attribue_le)}
                </p>
              </div>
              <BadgeTag badge={modalRevoque.badge} taille="sm" />
            </div>
            <div>
              <label className="label">Raison de la révocation *</label>
              <textarea
                value={raison}
                onChange={(e) => setRaison(e.target.value)}
                className="input"
                rows={3}
                placeholder="Expliquez pourquoi ce badge est retiré..."
              />
            </div>
            <button
              onClick={revoquer}
              className="bouton-rouge w-full"
              disabled={!raison.trim()}
            >
              Révoquer le badge
            </button>
          </div>
        )}
      </Modal>
    </LayoutApp>
  );
}
