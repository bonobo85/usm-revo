'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Calendar as CalIcon, BarChart3, MapPin, Users, Target } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { PermissionGate } from '@/components/PermissionGate';
import { Avatar } from '@/components/Avatar';
import { BadgeTag } from '@/components/BadgeTag';
import { DateTimePicker } from '@/components/DateTimePicker';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateTime } from '@/lib/utils';
import { NOMS_RANGS } from '@/lib/permissions';

type Session = {
  id: string;
  titre: string;
  description: string | null;
  plan: string | null;
  date_session: string;
  lieu: string | null;
  rank_min: number;
  capacite_max: number | null;
  inscriptions_ouvertes: boolean;
  badge_cible_id: number | null;
  createur?: { username: string; avatar_url: string | null };
  badge_cible?: { code: string; nom: string; couleur: string } | null;
};

export default function PageEntrainement() {
  const supabase = useSupabase();
  const { user } = useUser();
  const [onglet, setOnglet] = useState('planning');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [inscritsCnt, setInscritsCnt] = useState<Record<string, number>>({});
  const [mesInscriptions, setMesInscriptions] = useState<Set<string>>(new Set());
  const [badges, setBadges] = useState<any[]>([]);
  const [modalCreer, setModalCreer] = useState(false);

  // Form
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [plan, setPlan] = useState('');
  const [dateSession, setDateSession] = useState('');
  const [lieu, setLieu] = useState('');
  const [rangMin, setRangMin] = useState(1);
  const [capacite, setCapacite] = useState<string>('');
  const [badgeCible, setBadgeCible] = useState<string>('');

  async function charger() {
    const { data } = await supabase
      .from('training_sessions')
      .select('*, createur:createur_id(username, avatar_url), badge_cible:badge_cible_id(code, nom, couleur)')
      .is('deleted_at', null)
      .order('date_session', { ascending: false });
    setSessions(data || []);

    if (data && data.length > 0) {
      const ids = data.map((s) => s.id);
      const { data: regs } = await supabase
        .from('training_registrations')
        .select('session_id, user_id, annule')
        .in('session_id', ids);
      const cnt: Record<string, number> = {};
      const mine = new Set<string>();
      for (const r of regs || []) {
        if (r.annule) continue;
        cnt[r.session_id] = (cnt[r.session_id] || 0) + 1;
        if (user && r.user_id === user.id) mine.add(r.session_id);
      }
      setInscritsCnt(cnt);
      setMesInscriptions(mine);
    }
  }

  async function chargerBadges() {
    const { data } = await supabase.from('badges').select('id, code, nom').is('deleted_at', null);
    setBadges(data || []);
  }

  useEffect(() => {
    charger();
    chargerBadges();
    const ch = supabase
      .channel('ent')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_sessions' }, () => charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_registrations' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function inscrire(sessionId: string) {
    if (!user) return;
    if (mesInscriptions.has(sessionId)) {
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
    charger();
  }

  async function creerSession() {
    if (!titre || !dateSession || !user) return;
    await supabase.from('training_sessions').insert({
      titre,
      description: description || null,
      plan: plan || null,
      date_session: dateSession,
      lieu: lieu || null,
      rank_min: rangMin,
      capacite_max: capacite ? Number(capacite) : null,
      badge_cible_id: badgeCible ? Number(badgeCible) : null,
      createur_id: user.id,
      inscriptions_ouvertes: true,
    });
    setTitre(''); setDescription(''); setPlan(''); setDateSession('');
    setLieu(''); setRangMin(1); setCapacite(''); setBadgeCible('');
    setModalCreer(false);
  }

  const planning = sessions.filter((s) => new Date(s.date_session) >= new Date()).reverse();
  const passees = sessions.filter((s) => new Date(s.date_session) < new Date());

  return (
    <LayoutApp>
      <div className="flex items-center justify-between mb-4">
        <h1 className="titre-page">Entraînement</h1>
        <PermissionGate minRang={4}>
          <button onClick={() => setModalCreer(true)} className="bouton-bleu flex items-center gap-2">
            <Plus size={16} /> Créer une session
          </button>
        </PermissionGate>
      </div>

      <Tabs
        onglets={[
          { id: 'planning', label: 'Planning', icone: CalIcon },
          { id: 'passees', label: 'Sessions passées', icone: BarChart3 },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {onglet === 'planning' && (
        <div className="grid gap-3">
          {planning.length === 0 ? (
            <p className="text-texte-gris text-center py-8">Aucune session planifiée</p>
          ) : (
            planning.map((s) => (
              <CarteSession
                key={s.id}
                s={s}
                inscrits={inscritsCnt[s.id] || 0}
                inscrit={mesInscriptions.has(s.id)}
                onToggle={() => inscrire(s.id)}
              />
            ))
          )}
        </div>
      )}

      {onglet === 'passees' && (
        <div className="grid gap-3">
          {passees.length === 0 ? (
            <p className="text-texte-gris text-center py-8">Aucune session passée</p>
          ) : (
            passees.map((s) => (
              <CarteSession key={s.id} s={s} inscrits={inscritsCnt[s.id] || 0} inscrit={false} />
            ))
          )}
        </div>
      )}

      {/* Modal création */}
      <Modal ouvert={modalCreer} onFermer={() => setModalCreer(false)} titre="Nouvelle session" taille="lg">
        <div className="space-y-3">
          <div>
            <label className="label">Titre *</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} />
          </div>
          <div>
            <label className="label">Plan de la session</label>
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="input"
              rows={5}
              placeholder="• Échauffement&#10;• Exercice 1...&#10;• Mise en situation&#10;• Débrief"
            />
          </div>
          <div>
            <label className="label">Date et heure *</label>
            <DateTimePicker value={dateSession} onChange={setDateSession} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Lieu</label>
              <input value={lieu} onChange={(e) => setLieu(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Capacité max</label>
              <input
                type="number"
                min={1}
                value={capacite}
                onChange={(e) => setCapacite(e.target.value)}
                className="input"
                placeholder="Illimitée"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rang minimum</label>
              <select value={rangMin} onChange={(e) => setRangMin(Number(e.target.value))} className="input">
                {Object.entries(NOMS_RANGS).reverse().map(([lvl, nom]) => (
                  <option key={lvl} value={lvl}>{nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Badge cible (optionnel)</label>
              <select value={badgeCible} onChange={(e) => setBadgeCible(e.target.value)} className="input">
                <option value="">Aucun</option>
                {badges.map((b) => (
                  <option key={b.id} value={b.id}>{b.nom}</option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={creerSession} className="bouton-bleu w-full" disabled={!titre || !dateSession}>
            Créer la session
          </button>
        </div>
      </Modal>
    </LayoutApp>
  );
}

function CarteSession({
  s,
  inscrits,
  inscrit,
  onToggle,
}: {
  s: Session;
  inscrits: number;
  inscrit: boolean;
  onToggle?: () => void;
}) {
  const futur = new Date(s.date_session) >= new Date();
  const plein = s.capacite_max && inscrits >= s.capacite_max && !inscrit;

  return (
    <div className="carte hover:border-or/40 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link href={`/entrainement/${s.id}`} className="block">
            <h3 className="text-white font-semibold hover:text-or transition-colors">{s.titre}</h3>
          </Link>
          <p className="text-xs text-texte-gris mt-1 flex items-center gap-1">
            <CalIcon size={12} /> {dateTime(s.date_session)}
          </p>
          {s.lieu && (
            <p className="text-xs text-texte-gris flex items-center gap-1">
              <MapPin size={12} /> {s.lieu}
            </p>
          )}
          {s.description && <p className="text-sm text-gray-300 mt-2 line-clamp-2">{s.description}</p>}

          <div className="flex flex-wrap gap-2 mt-3 items-center">
            <span className="text-[10px] uppercase tracking-wider text-texte-gris bg-fond-clair px-2 py-0.5 rounded">
              Rang min : {NOMS_RANGS[s.rank_min]}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-texte-gris bg-fond-clair px-2 py-0.5 rounded flex items-center gap-1">
              <Users size={10} /> {inscrits}{s.capacite_max ? ` / ${s.capacite_max}` : ''}
            </span>
            {s.badge_cible && (
              <div className="flex items-center gap-1">
                <Target size={12} className="text-texte-gris" />
                <BadgeTag badge={s.badge_cible} taille="xs" />
              </div>
            )}
          </div>
        </div>

        {futur && onToggle && (
          <div className="flex flex-col gap-1 items-end">
            <button
              onClick={onToggle}
              disabled={!!plein}
              className={inscrit ? 'bouton-rouge text-xs px-3 py-1.5' : 'bouton-vert text-xs px-3 py-1.5'}
            >
              {inscrit ? 'Annuler inscription' : plein ? 'Complet' : "S'inscrire"}
            </button>
            <Link href={`/entrainement/${s.id}`} className="text-xs text-bleu-clair hover:underline">
              Détails →
            </Link>
          </div>
        )}
        {!futur && (
          <Link href={`/entrainement/${s.id}`} className="text-xs text-bleu-clair hover:underline">
            Détails →
          </Link>
        )}
      </div>
    </div>
  );
}
