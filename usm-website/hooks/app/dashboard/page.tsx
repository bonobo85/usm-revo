'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ClipboardList, FileText, GraduationCap, ChevronRight, Megaphone, TrendingUp } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Avatar } from '@/components/Avatar';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateRelative, dateTime } from '@/lib/utils';
import { NOMS_RANGS } from '@/lib/permissions';

type Stats = {
  membresTotal: number;
  rcAFaire: number;
  rapportsSemaine: number;
  entrainementsSemaine: number;
};

export default function PageDashboard() {
  const supabase = useSupabase();
  const { user } = useUser();
  const [stats, setStats] = useState<Stats>({ membresTotal: 0, rcAFaire: 0, rapportsSemaine: 0, entrainementsSemaine: 0 });
  const [annonces, setAnnonces] = useState<any[]>([]);
  const [entrainements, setEntrainements] = useState<any[]>([]);
  const [mesRapports, setMesRapports] = useState<any[]>([]);

  async function charger() {
    const il7j = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dans7j = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [mTotal, rc, rapSem, entSem] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('recrutements').select('id', { count: 'exact', head: true }).in('statut', ['planifie', 'en_cours']).is('deleted_at', null),
      supabase.from('reports').select('id', { count: 'exact', head: true }).gte('created_at', il7j).is('deleted_at', null),
      supabase.from('training_sessions').select('id', { count: 'exact', head: true }).gte('date_session', new Date().toISOString()).lte('date_session', dans7j).is('deleted_at', null),
    ]);
    setStats({
      membresTotal: mTotal.count || 0,
      rcAFaire: rc.count || 0,
      rapportsSemaine: rapSem.count || 0,
      entrainementsSemaine: entSem.count || 0,
    });

    // Annonces (communiques + promotions) — remplace l'activite recente
    const { data: ann } = await supabase
      .from('announcements')
      .select('*, auteur:auteur_id(username, surnom, avatar_url), cible:cible_user_id(username, surnom, avatar_url)')
      .is('deleted_at', null)
      .order('epingle', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(15);
    setAnnonces(ann || []);

    const { data: ents } = await supabase
      .from('training_sessions')
      .select('*')
      .gte('date_session', new Date().toISOString())
      .eq('statut', 'planifie')
      .is('deleted_at', null)
      .order('date_session', { ascending: true })
      .limit(3);
    setEntrainements(ents || []);

    if (user) {
      const { data: reps } = await supabase
        .from('reports')
        .select('*')
        .eq('auteur_id', user.id)
        .eq('publie', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);
      setMesRapports(reps || []);
    }
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const prenom = user?.surnom || user?.username;

  return (
    <LayoutApp>
      <h1 className="titre-page mb-6">Bonjour, {prenom} 👋</h1>

      {/* Stats cliquables */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <CarteStatLink
          href="/personnel"
          icone={Users}
          couleur="#3B82F6"
          titre="Membres total"
          tooltip="Tous les membres actifs de l'unité — clique pour voir la liste"
          valeur={stats.membresTotal}
        />
        <CarteStatLink
          href="/formateurs"
          icone={ClipboardList}
          couleur="#10B981"
          titre="RC à faire"
          tooltip="Recrutements planifiés ou en cours — clique pour la liste"
          valeur={stats.rcAFaire}
        />
        <CarteStatLink
          href="/rapports"
          icone={FileText}
          couleur="#F97316"
          titre="Rapports (7 j)"
          tooltip="Rapports rédigés ces 7 derniers jours"
          valeur={stats.rapportsSemaine}
        />
        <CarteStatLink
          href="/entrainement"
          icone={GraduationCap}
          couleur="#A855F7"
          titre="Entraînements (7 j)"
          tooltip="Entraînements planifiés dans les 7 prochains jours"
          valeur={stats.entrainementsSemaine}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Annonces (communiques + promotions) */}
        <div className="carte lg:col-span-2">
          <h2 className="titre-section flex items-center gap-2">
            <Megaphone size={18} /> Annonces
          </h2>
          {annonces.length === 0 ? (
            <p className="text-texte-gris text-sm">Aucune annonce récente</p>
          ) : (
            <ul className="space-y-3">
              {annonces.map((a) => (
                <li key={a.id} className={`flex items-start gap-3 p-3 rounded border ${a.epingle ? 'border-or/40 bg-or/5' : 'border-transparent hover:bg-fond-clair'}`}>
                  <div className={`p-2 rounded shrink-0 ${a.type === 'promotion' ? 'bg-emerald-500/15 text-emerald-400' : a.type === 'communique' ? 'bg-blue-500/15 text-blue-400' : 'bg-gray-500/15 text-gray-400'}`}>
                    {a.type === 'promotion' ? <TrendingUp size={16} /> : <Megaphone size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{a.titre}</p>
                      {a.epingle && <span className="text-[10px] uppercase text-or font-semibold">Épinglé</span>}
                    </div>
                    {a.type === 'promotion' && a.metadata ? (
                      <p className="text-xs text-texte-gris">
                        {(a.cible?.surnom || a.cible?.username) || 'Membre'} :{' '}
                        {NOMS_RANGS[a.metadata.ancien_rang] || '?'} → <span className="text-white">{NOMS_RANGS[a.metadata.nouveau_rang] || '?'}</span>
                      </p>
                    ) : (
                      a.contenu && <p className="text-xs text-texte-gris line-clamp-2 whitespace-pre-wrap">{a.contenu}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {a.auteur && <Avatar src={a.auteur.avatar_url} nom={a.auteur.username} taille={16} />}
                      <p className="text-[11px] text-texte-gris">
                        {a.auteur && (a.auteur.surnom || a.auteur.username)} · {dateRelative(a.created_at)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="carte">
            <h2 className="titre-section">Prochains entraînements</h2>
            {entrainements.length === 0 ? (
              <p className="text-texte-gris text-sm">Aucun entraînement planifié</p>
            ) : (
              <ul className="space-y-2">
                {entrainements.map((e) => (
                  <li key={e.id}>
                    <Link href={`/entrainement/${e.id}`} className="block p-2 hover:bg-fond-clair rounded">
                      <p className="text-sm text-white font-medium">{e.titre}</p>
                      <p className="text-xs text-texte-gris">{dateTime(e.date_session)}</p>
                      {e.lieu && <p className="text-xs text-texte-gris">📍 {e.lieu}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="carte">
            <h2 className="titre-section">Mes rapports (brouillon)</h2>
            {mesRapports.length === 0 ? (
              <p className="text-texte-gris text-sm">Aucun brouillon</p>
            ) : (
              <ul className="space-y-2">
                {mesRapports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/rapports/${r.id}`} className="flex items-center justify-between p-2 hover:bg-fond-clair rounded">
                      <div>
                        <p className="text-sm text-white">{r.titre}</p>
                        <p className="text-xs text-texte-gris capitalize">{r.type}</p>
                      </div>
                      <ChevronRight size={16} className="text-texte-gris" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </LayoutApp>
  );
}

function CarteStatLink({
  href,
  icone: Icone,
  couleur,
  titre,
  valeur,
  tooltip,
}: {
  href: string;
  icone: any;
  couleur: string;
  titre: string;
  valeur: number;
  tooltip: string;
}) {
  return (
    <Link
      href={href}
      title={tooltip}
      className="carte group relative block transition-all hover:border-white/20 hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded" style={{ backgroundColor: couleur + '20' }}>
          <Icone size={20} style={{ color: couleur }} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{valeur}</p>
      <p className="text-xs text-texte-gris mt-1">{titre}</p>
      <ChevronRight
        size={16}
        className="absolute top-3 right-3 text-texte-gris opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </Link>
  );
}
