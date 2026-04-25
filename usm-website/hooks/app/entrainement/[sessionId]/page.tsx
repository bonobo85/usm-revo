'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar as CalIcon, MapPin, Users, Target, ClipboardList,
  Check, X, Clock, AlertCircle,
} from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Avatar } from '@/components/Avatar';
import { BadgeTag } from '@/components/BadgeTag';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateTime } from '@/lib/utils';
import { NOMS_RANGS, couleurRang, estOpSecondMin } from '@/lib/permissions';

type Inscription = {
  id: string;
  user_id: string;
  inscrit_le: string;
  annule: boolean;
  user?: { id: string; username: string; surnom: string | null; avatar_url: string | null; rank_level: number };
};

type Attendance = {
  id?: string;
  session_id: string;
  user_id: string;
  statut: 'present' | 'absent' | 'retard' | 'excuse';
  badge_obtenu: boolean;
  commentaire: string | null;
};

const STATUTS = [
  { key: 'present', label: 'Présent', icone: Check, classe: 'bg-emerald-700 text-white', dot: 'bg-emerald-500' },
  { key: 'retard', label: 'Retard', icone: Clock, classe: 'bg-amber-700 text-white', dot: 'bg-amber-500' },
  { key: 'excuse', label: 'Excusé', icone: AlertCircle, classe: 'bg-blue-700 text-white', dot: 'bg-blue-500' },
  { key: 'absent', label: 'Absent', icone: X, classe: 'bg-red-700 text-white', dot: 'bg-red-500' },
] as const;

export default function PageDetailEntrainement() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;
  const supabase = useSupabase();
  const { user, rang } = useUser();
  const peutPointer = estOpSecondMin(rang);

  const [session, setSession] = useState<any>(null);
  const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});

  async function charger() {
    const { data: s } = await supabase
      .from('training_sessions')
      .select('*, createur:createur_id(username, avatar_url), badge_cible:badge_cible_id(id, code, nom, couleur, description)')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .maybeSingle();
    setSession(s);

    const { data: regs } = await supabase
      .from('training_registrations')
      .select('*, user:user_id(id, username, surnom, avatar_url, rank_level)')
      .eq('session_id', sessionId)
      .eq('annule', false)
      .order('inscrit_le');
    setInscriptions(regs || []);

    const { data: att } = await supabase
      .from('training_attendance')
      .select('*')
      .eq('session_id', sessionId);
    const map: Record<string, Attendance> = {};
    for (const a of att || []) map[a.user_id] = a;
    setAttendance(map);
  }

  useEffect(() => {
    if (!sessionId) return;
    charger();
    const ch = supabase
      .channel(`ent-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_registrations', filter: `session_id=eq.${sessionId}` }, () => charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_attendance', filter: `session_id=eq.${sessionId}` }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function pointer(userId: string, statut: Attendance['statut']) {
    if (!user || !peutPointer) return;
    await supabase.from('training_attendance').upsert(
      {
        session_id: sessionId,
        user_id: userId,
        statut,
        pointe_par: user.id,
        pointe_le: new Date().toISOString(),
      },
      { onConflict: 'session_id,user_id' }
    );
  }

  async function toggleBadge(userId: string) {
    if (!user || !peutPointer || !session?.badge_cible_id) return;
    const cur = attendance[userId];
    const nouveau = !(cur?.badge_obtenu);
    await supabase.from('training_attendance').upsert(
      {
        session_id: sessionId,
        user_id: userId,
        statut: cur?.statut || 'present',
        badge_obtenu: nouveau,
        pointe_par: user.id,
        pointe_le: new Date().toISOString(),
      },
      { onConflict: 'session_id,user_id' }
    );
    // Si on accorde le badge → l'attribuer à l'utilisateur
    if (nouveau && session.badge_cible_id) {
      await supabase.from('user_badges').upsert(
        {
          user_id: userId,
          badge_id: session.badge_cible_id,
          attribue_par: user.id,
          is_active: true,
          raison: `Obtenu lors de la session "${session.titre}"`,
        },
        { onConflict: 'user_id,badge_id' }
      );
    }
  }

  async function inscrireMoi() {
    if (!user) return;
    const dejaInscrit = inscriptions.some((i) => i.user_id === user.id);
    if (dejaInscrit) {
      await supabase
        .from('training_registrations')
        .update({ annule: true })
        .eq('session_id', sessionId)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('training_registrations')
        .upsert({ session_id: sessionId, user_id: user.id, annule: false }, { onConflict: 'session_id,user_id' });
    }
  }

  if (!session) {
    return (
      <LayoutApp>
        <Link href="/entrainement" className="text-bleu-clair hover:underline text-sm flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Retour
        </Link>
        <p className="text-texte-gris">Session introuvable.</p>
      </LayoutApp>
    );
  }

  const futur = new Date(session.date_session) >= new Date();
  const inscritMoi = !!user && inscriptions.some((i) => i.user_id === user.id);
  const plein = session.capacite_max && inscriptions.length >= session.capacite_max && !inscritMoi;

  return (
    <LayoutApp>
      <Link href="/entrainement" className="text-bleu-clair hover:underline text-sm flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Retour au planning
      </Link>

      {/* Header */}
      <div className="carte mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="titre-page mb-2">{session.titre}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-texte-gris">
              <span className="flex items-center gap-1"><CalIcon size={14} /> {dateTime(session.date_session)}</span>
              {session.lieu && <span className="flex items-center gap-1"><MapPin size={14} /> {session.lieu}</span>}
              <span className="flex items-center gap-1">
                <Users size={14} /> {inscriptions.length}
                {session.capacite_max ? ` / ${session.capacite_max}` : ''} inscrit(s)
              </span>
              <span>Rang min : {NOMS_RANGS[session.rank_min]}</span>
            </div>
            {session.description && (
              <p className="text-gray-300 mt-3">{session.description}</p>
            )}
            {session.badge_cible && (
              <div className="mt-3 flex items-center gap-2">
                <Target size={14} className="text-or" />
                <span className="text-xs text-texte-gris uppercase tracking-wider">Badge cible :</span>
                <BadgeTag badge={session.badge_cible} taille="sm" />
              </div>
            )}
          </div>

          {futur && user && (
            <button
              onClick={inscrireMoi}
              disabled={!!plein}
              className={inscritMoi ? 'bouton-rouge' : 'bouton-vert'}
            >
              {inscritMoi ? "Annuler mon inscription" : plein ? 'Complet' : "M'inscrire"}
            </button>
          )}
        </div>
      </div>

      {/* Plan de la session */}
      {session.plan && (
        <div className="carte mb-4">
          <h2 className="titre-section flex items-center gap-2">
            <ClipboardList size={16} /> Plan de la session
          </h2>
          <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans mt-2">{session.plan}</pre>
        </div>
      )}

      {/* Liste des inscrits + pointage */}
      <div className="carte">
        <div className="flex items-center justify-between mb-3">
          <h2 className="titre-section">Inscrits ({inscriptions.length})</h2>
          {peutPointer && !futur && (
            <span className="text-xs text-texte-gris">Pointez la présence ci-dessous</span>
          )}
        </div>

        {inscriptions.length === 0 ? (
          <p className="text-sm text-texte-gris">Aucun inscrit pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {inscriptions.map((i) => {
              const u = i.user!;
              const att = attendance[u.id];
              const couleur = couleurRang(u.rank_level);
              const statutCourant = att?.statut;
              return (
                <div
                  key={i.id}
                  className="flex items-center gap-3 p-2 bg-fond-clair rounded-md border-l-2"
                  style={{ borderLeftColor: couleur }}
                >
                  <Avatar src={u.avatar_url} nom={u.username} taille={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{u.surnom || u.username}</p>
                    <p className="text-xs" style={{ color: couleur }}>{NOMS_RANGS[u.rank_level]}</p>
                  </div>

                  {/* Indicateur statut côté membre simple */}
                  {!peutPointer && statutCourant && (
                    <span className="text-xs flex items-center gap-1 text-texte-gris">
                      <span className={`w-2 h-2 rounded-full ${STATUTS.find(s => s.key === statutCourant)?.dot}`} />
                      {STATUTS.find((s) => s.key === statutCourant)?.label}
                    </span>
                  )}

                  {/* Boutons pointage HG */}
                  {peutPointer && (
                    <div className="flex flex-wrap gap-1">
                      {STATUTS.map((s) => {
                        const Icone = s.icone;
                        const actif = statutCourant === s.key;
                        return (
                          <button
                            key={s.key}
                            onClick={() => pointer(u.id, s.key)}
                            title={s.label}
                            className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
                              actif
                                ? s.classe
                                : 'bg-fond-carte text-texte-gris hover:text-white border border-gris-bordure'
                            }`}
                          >
                            <Icone size={14} />
                          </button>
                        );
                      })}
                      {session.badge_cible_id && (
                        <button
                          onClick={() => toggleBadge(u.id)}
                          title={att?.badge_obtenu ? 'Retirer le badge' : 'Accorder le badge'}
                          className={`px-2 h-7 rounded text-[10px] font-bold uppercase transition-all ${
                            att?.badge_obtenu
                              ? 'bg-or text-fond'
                              : 'bg-fond-carte text-texte-gris hover:text-or border border-gris-bordure'
                          }`}
                        >
                          🏅
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </LayoutApp>
  );
}
