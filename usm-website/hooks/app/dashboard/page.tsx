'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, UserCheck, FileText, GraduationCap, ChevronRight } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { PermissionGate } from '@/components/PermissionGate';
import { Avatar } from '@/components/Avatar';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateRelative, dateTime } from '@/lib/utils';

type Stats = {
  membres: number;
  disponibles: number;
  rapportsEnAttente: number;
  entrainementsMois: number;
};

export default function PageDashboard() {
  const supabase = useSupabase();
  const { user } = useUser();
  const [stats, setStats] = useState<Stats>({ membres: 0, disponibles: 0, rapportsEnAttente: 0, entrainementsMois: 0 });
  const [activite, setActivite] = useState<any[]>([]);
  const [entrainements, setEntrainements] = useState<any[]>([]);
  const [mesRapports, setMesRapports] = useState<any[]>([]);

  async function charger() {
    // Stats
    const [membres, dispo, rapAtt, entMois] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('statut', 'disponible').eq('is_active', true),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('statut', 'submitted'),
      supabase.from('training_sessions').select('id', { count: 'exact', head: true }).gte('date_session', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);
    setStats({
      membres: membres.count || 0,
      disponibles: dispo.count || 0,
      rapportsEnAttente: rapAtt.count || 0,
      entrainementsMois: entMois.count || 0,
    });

    // Activité récente
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('*, acteur:acteur_id(username, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(15);
    setActivite(logs || []);

    // Prochains entraînements
    const { data: ents } = await supabase
      .from('training_sessions')
      .select('*')
      .gte('date_session', new Date().toISOString())
      .eq('statut', 'planifie')
      .is('deleted_at', null)
      .order('date_session', { ascending: true })
      .limit(3);
    setEntrainements(ents || []);

    // Mes rapports en cours
    if (user) {
      const { data: reps } = await supabase
        .from('reports')
        .select('*')
        .eq('auteur_id', user.id)
        .in('statut', ['draft', 'submitted'])
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => charger())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <LayoutApp>
      <h1 className="titre-page mb-6">Bonjour, {user?.username} 👋</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <CarteStat icone={Users} couleur="#3B82F6" titre="Membres actifs" valeur={stats.membres} />
        <CarteStat icone={UserCheck} couleur="#10B981" titre="Disponibles" valeur={stats.disponibles} />
        <CarteStat icone={FileText} couleur="#F97316" titre="Rapports en attente" valeur={stats.rapportsEnAttente} />
        <CarteStat icone={GraduationCap} couleur="#A855F7" titre="Entraînements ce mois" valeur={stats.entrainementsMois} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activité récente */}
        <div className="carte lg:col-span-2">
          <h2 className="titre-section">Activité récente</h2>
          {activite.length === 0 ? (
            <p className="text-texte-gris text-sm">Aucune activité</p>
          ) : (
            <ul className="space-y-3">
              {activite.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-2 hover:bg-fond-clair rounded">
                  <Avatar src={a.acteur?.avatar_url} nom={a.acteur?.username || '?'} taille={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      <span className="font-medium">{a.acteur?.username || 'Système'}</span>{' '}
                      <span className="text-texte-gris">{a.action}</span>
                    </p>
                    <p className="text-xs text-texte-gris">{dateRelative(a.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          {/* Prochains entraînements */}
          <div className="carte">
            <h2 className="titre-section">Prochains entraînements</h2>
            {entrainements.length === 0 ? (
              <p className="text-texte-gris text-sm">Aucun entraînement planifié</p>
            ) : (
              <ul className="space-y-2">
                {entrainements.map((e) => (
                  <li key={e.id}>
                    <Link href="/entrainement" className="block p-2 hover:bg-fond-clair rounded">
                      <p className="text-sm text-white font-medium">{e.titre}</p>
                      <p className="text-xs text-texte-gris">{dateTime(e.date_session)}</p>
                      {e.lieu && <p className="text-xs text-texte-gris">📍 {e.lieu}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Mes rapports */}
          <div className="carte">
            <h2 className="titre-section">Mes rapports en cours</h2>
            {mesRapports.length === 0 ? (
              <p className="text-texte-gris text-sm">Aucun rapport en cours</p>
            ) : (
              <ul className="space-y-2">
                {mesRapports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/rapports?id=${r.id}`} className="flex items-center justify-between p-2 hover:bg-fond-clair rounded">
                      <div>
                        <p className="text-sm text-white">{r.titre}</p>
                        <p className="text-xs text-texte-gris capitalize">{r.type} · {r.statut}</p>
                      </div>
                      <ChevronRight size={16} className="text-texte-gris" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Alertes rank>=6 */}
          <PermissionGate minRang={6}>
            <div className="carte border-or/30">
              <h2 className="titre-section text-or">⚠️ Alertes admin</h2>
              <p className="text-sm text-texte-gris">
                {stats.rapportsEnAttente} rapport(s) à valider
              </p>
              <Link href="/rapports" className="text-xs text-bleu-clair hover:underline">
                Voir les rapports →
              </Link>
            </div>
          </PermissionGate>
        </div>
      </div>
    </LayoutApp>
  );
}

function CarteStat({ icone: Icone, couleur, titre, valeur }: any) {
  return (
    <div className="carte">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded" style={{ backgroundColor: couleur + '20' }}>
          <Icone size={20} style={{ color: couleur }} />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{valeur}</p>
      <p className="text-xs text-texte-gris mt-1">{titre}</p>
    </div>
  );
}
