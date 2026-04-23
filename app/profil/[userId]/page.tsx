'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, Award, FileText, GraduationCap, ShieldAlert } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { RankBadge } from '@/components/RankBadge';
import { Avatar } from '@/components/Avatar';
import { PermissionGate } from '@/components/PermissionGate';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte, dateLongue } from '@/lib/utils';

export default function PageProfil() {
  const params = useParams();
  const userId = params.userId as string;
  const supabase = useSupabase();
  const { user: moi, hasRang } = useUser();
  const [profil, setProfil] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [historique, setHistorique] = useState<any[]>([]);
  const [sanctions, setSanctions] = useState<any[]>([]);
  const [stats, setStats] = useState({ rapports: 0, evals: 0, presences: 0 });

  async function charger() {
    const { data: u } = await supabase.from('users').select('*, ranks(nom)').eq('id', userId).maybeSingle();
    setProfil(u);

    const { data: bs } = await supabase
      .from('user_badges')
      .select('*, badge:badge_id(*)')
      .eq('user_id', userId)
      .eq('is_active', true);
    setBadges(bs || []);

    const { data: hist } = await supabase
      .from('rank_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setHistorique(hist || []);

    if (moi?.id === userId || hasRang(6)) {
      const { data: s } = await supabase
        .from('sanctions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setSanctions(s || []);
    }

    const [rap, ev, pr] = await Promise.all([
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('auteur_id', userId),
      supabase.from('evaluations').select('id', { count: 'exact', head: true }).eq('candidat_id', userId),
      supabase.from('training_results').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('present', true),
    ]);
    setStats({ rapports: rap.count || 0, evals: ev.count || 0, presences: pr.count || 0 });
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!profil) {
    return <LayoutApp><p className="text-texte-gris">Chargement...</p></LayoutApp>;
  }

  return (
    <LayoutApp>
      {/* En-tête profil */}
      <div className="carte mb-6">
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <Avatar src={profil.avatar_url} nom={profil.username} taille={120} />
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-2xl font-bold text-white mb-2">{profil.username}</h1>
            <div className="flex flex-wrap gap-2 items-center justify-center md:justify-start mb-3">
              <RankBadge rang={profil.rank_level} taille="lg" />
              <span className="text-xs text-texte-gris flex items-center gap-1">
                <Calendar size={14} />
                Membre depuis le {dateCourte(profil.date_entree)}
              </span>
            </div>
            <PermissionGate minRang={6}>
              {profil.id !== moi?.id && (
                <div className="flex gap-2 justify-center md:justify-start flex-wrap">
                  <a href={`/sanctions?user=${profil.id}`} className="bouton-rouge text-xs">Sanctionner</a>
                  <a href={`/badges?user=${profil.id}`} className="bouton-or text-xs">Attribuer badge</a>
                </div>
              )}
            </PermissionGate>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="carte text-center">
          <FileText className="mx-auto text-bleu-clair mb-2" size={24} />
          <p className="text-2xl font-bold text-white">{stats.rapports}</p>
          <p className="text-xs text-texte-gris">Rapports soumis</p>
        </div>
        <div className="carte text-center">
          <GraduationCap className="mx-auto text-or mb-2" size={24} />
          <p className="text-2xl font-bold text-white">{stats.presences}</p>
          <p className="text-xs text-texte-gris">Entraînements présents</p>
        </div>
        <div className="carte text-center">
          <Award className="mx-auto text-emerald-500 mb-2" size={24} />
          <p className="text-2xl font-bold text-white">{stats.evals}</p>
          <p className="text-xs text-texte-gris">Évaluations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Badges */}
        <div className="carte">
          <h2 className="titre-section">Badges obtenus</h2>
          {badges.length === 0 ? (
            <p className="text-texte-gris text-sm">Aucun badge</p>
          ) : (
            <ul className="space-y-2">
              {badges.map((b) => (
                <li key={b.id} className="flex items-center justify-between p-2 bg-fond-clair rounded">
                  <div>
                    <p className="text-white font-medium">{b.badge?.nom}</p>
                    <p className="text-xs text-texte-gris">{b.badge?.description}</p>
                  </div>
                  <span className="text-xs text-texte-gris">{dateCourte(b.attribue_le)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Historique rangs */}
        <div className="carte">
          <h2 className="titre-section">Historique des rangs</h2>
          {historique.length === 0 ? (
            <p className="text-texte-gris text-sm">Aucun changement</p>
          ) : (
            <ul className="space-y-2">
              {historique.map((h) => (
                <li key={h.id} className="p-2 bg-fond-clair rounded">
                  <div className="flex items-center gap-2 text-sm">
                    <RankBadge rang={h.ancien_rank} taille="sm" />
                    <span className="text-texte-gris">→</span>
                    <RankBadge rang={h.nouveau_rank} taille="sm" />
                  </div>
                  <p className="text-xs text-texte-gris mt-1">{dateLongue(h.created_at)}</p>
                  {h.raison && <p className="text-xs text-texte-gris italic">{h.raison}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Sanctions (visibles par l'intéressé ou rank >= 6) */}
        {(moi?.id === userId || hasRang(6)) && (
          <div className="carte lg:col-span-2">
            <h2 className="titre-section flex items-center gap-2">
              <ShieldAlert size={18} className="text-red-400" />
              Sanctions
            </h2>
            {sanctions.length === 0 ? (
              <p className="text-texte-gris text-sm">Aucune sanction</p>
            ) : (
              <ul className="space-y-2">
                {sanctions.map((s) => (
                  <li key={s.id} className="p-3 bg-red-900/10 border border-red-900/30 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-red-400 font-medium capitalize">{s.type}</span>
                      <span className="text-xs text-texte-gris">{dateCourte(s.created_at)}</span>
                    </div>
                    <p className="text-sm text-white">{s.raison}</p>
                    {s.duree_jours && (
                      <p className="text-xs text-texte-gris mt-1">Durée : {s.duree_jours} jours</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </LayoutApp>
  );
}
