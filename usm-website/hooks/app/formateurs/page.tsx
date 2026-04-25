'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, ClipboardList, ListChecks, Award, Trash2, Calendar, MapPin, User as UserIcon } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { AccesRefuse } from '@/components/AccesRefuse';
import { DateTimePicker } from '@/components/DateTimePicker';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte, dateTime } from '@/lib/utils';
import {
  NOMS_RANGS, couleurRang, peutVoirFormateurs, estColeadMin,
} from '@/lib/permissions';

type Recrutement = {
  id: string;
  candidat_nom: string;
  candidat_discord: string | null;
  candidat_user_id: string | null;
  formateur_id: string | null;
  assistants: string[] | null;
  date_rc: string | null;
  lieu: string | null;
  statut: 'planifie' | 'en_cours' | 'termine' | 'annule';
  notes: string | null;
  formateur?: { id: string; username: string; surnom: string | null; avatar_url: string | null; rank_level: number };
};

type RcResultat = {
  id: string;
  candidat_nom: string;
  date_rc: string;
  formateur_id: string | null;
  tir_note: number | null;
  conduite_note: number | null;
  procedure_note: number | null;
  comportement_note: number | null;
  note_globale: number | null;
  points_forts: string | null;
  points_faibles: string | null;
  observations: string | null;
  resultat: 'admis' | 'refuse' | 'a_repasser' | null;
  formateur?: { username: string; surnom: string | null; avatar_url: string | null };
};

type Attestation = {
  id: string;
  numero: string | null;
  beneficiaire_id: string;
  type: string;
  objet: string;
  description: string | null;
  valide_du: string | null;
  valide_jusqu: string | null;
  emetteur_id: string;
  signature: string | null;
  created_at: string;
  beneficiaire?: { id: string; username: string; surnom: string | null; avatar_url: string | null; rank_level: number };
  emetteur?: { username: string; surnom: string | null };
};

type Membre = { id: string; username: string; surnom: string | null; avatar_url: string | null; rank_level: number };

const STATUT_LABELS: Record<string, { label: string; classe: string }> = {
  planifie: { label: 'Planifié', classe: 'bg-blue-500/20 text-blue-300' },
  en_cours: { label: 'En cours', classe: 'bg-amber-500/20 text-amber-300' },
  termine: { label: 'Terminé', classe: 'bg-emerald-500/20 text-emerald-300' },
  annule: { label: 'Annulé', classe: 'bg-red-500/20 text-red-300' },
};

const RESULTAT_LABELS: Record<string, { label: string; classe: string }> = {
  admis: { label: 'Admis', classe: 'bg-emerald-500/20 text-emerald-300' },
  refuse: { label: 'Refusé', classe: 'bg-red-500/20 text-red-300' },
  a_repasser: { label: 'À repasser', classe: 'bg-amber-500/20 text-amber-300' },
};

export default function PageFormateurs() {
  const supabase = useSupabase();
  const { user, rang } = useUser();
  const peutAcces = peutVoirFormateurs(rang, []);
  const peutAttester = estColeadMin(rang);

  const [onglet, setOnglet] = useState<'a_faire' | 'resultats' | 'attestations'>('a_faire');
  const [recrutements, setRecrutements] = useState<Recrutement[]>([]);
  const [resultats, setResultats] = useState<RcResultat[]>([]);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [membres, setMembres] = useState<Membre[]>([]);

  // Modals
  const [modalRC, setModalRC] = useState<Recrutement | null>(null);
  const [modalCreerRC, setModalCreerRC] = useState(false);
  const [modalSaisirResultat, setModalSaisirResultat] = useState<Recrutement | null>(null);
  const [modalDetailResultat, setModalDetailResultat] = useState<RcResultat | null>(null);
  const [modalAttestation, setModalAttestation] = useState(false);

  // Form RC
  const [formRC, setFormRC] = useState({ candidat_nom: '', candidat_discord: '', date_rc: '', lieu: '', notes: '' });
  // Form résultat
  const [formRes, setFormRes] = useState({
    tir: '', conduite: '', procedure: '', comportement: '',
    points_forts: '', points_faibles: '', observations: '', resultat: 'admis' as 'admis' | 'refuse' | 'a_repasser',
  });
  // Form attestation
  const [formAtt, setFormAtt] = useState({
    beneficiaire_id: '', type: 'formation', objet: '', description: '',
    valide_du: '', valide_jusqu: '', signature: '',
  });

  async function charger() {
    const [r, res, att, m] = await Promise.all([
      supabase
        .from('recrutements')
        .select('*, formateur:formateur_id(id, username, surnom, avatar_url, rank_level)')
        .is('deleted_at', null)
        .order('date_rc', { ascending: true }),
      supabase
        .from('rc_resultats')
        .select('*, formateur:formateur_id(username, surnom, avatar_url)')
        .is('deleted_at', null)
        .order('date_rc', { ascending: false }),
      supabase
        .from('attestations')
        .select('*, beneficiaire:beneficiaire_id(id, username, surnom, avatar_url, rank_level), emetteur:emetteur_id(username, surnom)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('users')
        .select('id, username, surnom, avatar_url, rank_level')
        .eq('is_active', true)
        .is('deleted_at', null),
    ]);
    setRecrutements(r.data || []);
    setResultats(res.data || []);
    setAttestations(att.data || []);
    setMembres(m.data || []);
  }

  useEffect(() => {
    if (!peutAcces) return;
    charger();
    const ch = supabase
      .channel('formateurs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recrutements' }, () => charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rc_resultats' }, () => charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attestations' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peutAcces]);

  if (!peutAcces) {
    return <LayoutApp><AccesRefuse message="Section réservée aux formateurs et co-leaders+." /></LayoutApp>;
  }

  // === Actions ===
  async function creerRC() {
    if (!user || !formRC.candidat_nom) return;
    await supabase.from('recrutements').insert({
      candidat_nom: formRC.candidat_nom,
      candidat_discord: formRC.candidat_discord || null,
      formateur_id: user.id,
      date_rc: formRC.date_rc || null,
      lieu: formRC.lieu || null,
      notes: formRC.notes || null,
      statut: 'planifie',
      createur_id: user.id,
    });
    setFormRC({ candidat_nom: '', candidat_discord: '', date_rc: '', lieu: '', notes: '' });
    setModalCreerRC(false);
  }

  async function changerStatut(rc: Recrutement, statut: Recrutement['statut']) {
    await supabase.from('recrutements').update({ statut }).eq('id', rc.id);
  }

  async function reprendreRC(rc: Recrutement) {
    if (!user) return;
    await supabase.from('recrutements').update({ formateur_id: user.id }).eq('id', rc.id);
  }

  async function saisirResultat() {
    if (!user || !modalSaisirResultat) return;
    const rc = modalSaisirResultat;
    const notes = [formRes.tir, formRes.conduite, formRes.procedure, formRes.comportement]
      .map((n) => Number(n))
      .filter((n) => !isNaN(n) && n > 0);
    const moyenne = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : null;

    await supabase.from('rc_resultats').insert({
      recrutement_id: rc.id,
      candidat_nom: rc.candidat_nom,
      date_rc: rc.date_rc || new Date().toISOString(),
      formateur_id: rc.formateur_id || user.id,
      assistants: rc.assistants || [],
      tir_note: formRes.tir ? Number(formRes.tir) : null,
      conduite_note: formRes.conduite ? Number(formRes.conduite) : null,
      procedure_note: formRes.procedure ? Number(formRes.procedure) : null,
      comportement_note: formRes.comportement ? Number(formRes.comportement) : null,
      note_globale: moyenne,
      points_forts: formRes.points_forts || null,
      points_faibles: formRes.points_faibles || null,
      observations: formRes.observations || null,
      resultat: formRes.resultat,
      redacteur_id: user.id,
    });
    await supabase.from('recrutements').update({ statut: 'termine' }).eq('id', rc.id);
    setFormRes({
      tir: '', conduite: '', procedure: '', comportement: '',
      points_forts: '', points_faibles: '', observations: '', resultat: 'admis',
    });
    setModalSaisirResultat(null);
    setOnglet('resultats');
  }

  async function creerAttestation() {
    if (!user || !formAtt.beneficiaire_id || !formAtt.objet) return;
    await supabase.from('attestations').insert({
      beneficiaire_id: formAtt.beneficiaire_id,
      type: formAtt.type,
      objet: formAtt.objet,
      description: formAtt.description || null,
      valide_du: formAtt.valide_du || null,
      valide_jusqu: formAtt.valide_jusqu || null,
      emetteur_id: user.id,
      signature: formAtt.signature || null,
    });
    setFormAtt({ beneficiaire_id: '', type: 'formation', objet: '', description: '', valide_du: '', valide_jusqu: '', signature: '' });
    setModalAttestation(false);
  }

  // === Filtrage ===
  const aFaire = recrutements.filter((r) => r.statut === 'planifie' || r.statut === 'en_cours');

  return (
    <LayoutApp>
      <h1 className="titre-page mb-4">Formateurs</h1>

      <Tabs
        onglets={[
          { id: 'a_faire', label: `RC à faire (${aFaire.length})`, icone: ClipboardList },
          { id: 'resultats', label: `Résultats RC (${resultats.length})`, icone: ListChecks },
          { id: 'attestations', label: `Attestations (${attestations.length})`, icone: Award },
        ]}
        actif={onglet}
        onChange={(id) => setOnglet(id as any)}
      />

      {/* === RC À FAIRE === */}
      {onglet === 'a_faire' && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => setModalCreerRC(true)} className="bouton-bleu flex items-center gap-2">
              <Plus size={16} /> Nouveau RC
            </button>
          </div>
          {aFaire.length === 0 ? (
            <p className="text-texte-gris text-center py-8">Aucun RC en attente.</p>
          ) : (
            <div className="space-y-2">
              {aFaire.map((rc) => (
                <div key={rc.id} className="carte !p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold">{rc.candidat_nom}</p>
                      {rc.candidat_discord && (
                        <p className="text-xs text-texte-gris">@{rc.candidat_discord}</p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-texte-gris">
                        {rc.date_rc && <span className="flex items-center gap-1"><Calendar size={11} /> {dateTime(rc.date_rc)}</span>}
                        {rc.lieu && <span className="flex items-center gap-1"><MapPin size={11} /> {rc.lieu}</span>}
                        {rc.formateur && (
                          <span className="flex items-center gap-1">
                            <UserIcon size={11} /> {rc.formateur.surnom || rc.formateur.username}
                          </span>
                        )}
                      </div>
                      {rc.notes && <p className="text-sm text-gray-300 mt-2">{rc.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${STATUT_LABELS[rc.statut].classe}`}>
                        {STATUT_LABELS[rc.statut].label}
                      </span>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {rc.statut === 'planifie' && (
                          <button onClick={() => changerStatut(rc, 'en_cours')} className="bouton-bleu text-xs px-2 py-1">Démarrer</button>
                        )}
                        {!rc.formateur_id && (
                          <button onClick={() => reprendreRC(rc)} className="bouton-gris text-xs px-2 py-1">Prendre</button>
                        )}
                        <button onClick={() => setModalSaisirResultat(rc)} className="bouton-or text-xs px-2 py-1">Saisir résultat</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* === RÉSULTATS RC === */}
      {onglet === 'resultats' && (
        <>
          {resultats.length === 0 ? (
            <p className="text-texte-gris text-center py-8">Aucun résultat enregistré.</p>
          ) : (
            <div className="space-y-2">
              {resultats.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setModalDetailResultat(r)}
                  className="carte !p-3 block w-full text-left hover:border-or/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold">{r.candidat_nom}</p>
                      <p className="text-xs text-texte-gris">
                        {dateCourte(r.date_rc)}
                        {r.formateur && ` · ${r.formateur.surnom || r.formateur.username}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.note_globale != null && (
                        <span className="text-2xl font-bold text-or">{r.note_globale}<span className="text-xs text-texte-gris">/20</span></span>
                      )}
                      {r.resultat && (
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${RESULTAT_LABELS[r.resultat].classe}`}>
                          {RESULTAT_LABELS[r.resultat].label}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* === ATTESTATIONS === */}
      {onglet === 'attestations' && (
        <>
          {peutAttester && (
            <div className="flex justify-end mb-3">
              <button onClick={() => setModalAttestation(true)} className="bouton-bleu flex items-center gap-2">
                <Plus size={16} /> Nouvelle attestation
              </button>
            </div>
          )}
          {attestations.length === 0 ? (
            <p className="text-texte-gris text-center py-8">Aucune attestation émise.</p>
          ) : (
            <div className="space-y-2">
              {attestations.map((a) => (
                <div key={a.id} className="carte !p-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {a.beneficiaire && (
                      <Avatar src={a.beneficiaire.avatar_url} nom={a.beneficiaire.username} taille={40} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold">{a.objet}</p>
                        {a.numero && <span className="text-[10px] text-or font-mono">{a.numero}</span>}
                      </div>
                      <p className="text-xs text-texte-gris">
                        {a.beneficiaire && (a.beneficiaire.surnom || a.beneficiaire.username)}
                        {' · '}
                        <span className="capitalize">{a.type}</span>
                        {' · '}émise le {dateCourte(a.created_at)}
                      </p>
                      {(a.valide_du || a.valide_jusqu) && (
                        <p className="text-xs text-texte-gris">
                          Valide
                          {a.valide_du && ` du ${dateCourte(a.valide_du)}`}
                          {a.valide_jusqu && ` au ${dateCourte(a.valide_jusqu)}`}
                        </p>
                      )}
                      {a.description && <p className="text-sm text-gray-300 mt-1">{a.description}</p>}
                      {a.signature && (
                        <p className="text-xs text-or italic mt-2">— {a.signature}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal créer RC */}
      <Modal ouvert={modalCreerRC} onFermer={() => setModalCreerRC(false)} titre="Nouveau RC" taille="md">
        <div className="space-y-3">
          <div>
            <label className="label">Nom du candidat *</label>
            <input value={formRC.candidat_nom} onChange={(e) => setFormRC({ ...formRC, candidat_nom: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Discord</label>
            <input value={formRC.candidat_discord} onChange={(e) => setFormRC({ ...formRC, candidat_discord: e.target.value })} className="input" placeholder="pseudo#0000" />
          </div>
          <div>
            <label className="label">Date du RC</label>
            <DateTimePicker value={formRC.date_rc} onChange={(v) => setFormRC({ ...formRC, date_rc: v })} />
          </div>
          <div>
            <label className="label">Lieu</label>
            <input value={formRC.lieu} onChange={(e) => setFormRC({ ...formRC, lieu: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={formRC.notes} onChange={(e) => setFormRC({ ...formRC, notes: e.target.value })} className="input" rows={3} />
          </div>
          <button onClick={creerRC} className="bouton-bleu w-full" disabled={!formRC.candidat_nom}>Créer</button>
        </div>
      </Modal>

      {/* Modal saisir résultat */}
      <Modal
        ouvert={!!modalSaisirResultat}
        onFermer={() => setModalSaisirResultat(null)}
        titre={modalSaisirResultat ? `Résultat — ${modalSaisirResultat.candidat_nom}` : ''}
        taille="lg"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'tir', label: 'Tir' },
              { key: 'conduite', label: 'Conduite' },
              { key: 'procedure', label: 'Procédure' },
              { key: 'comportement', label: 'Comportement' },
            ].map((champ) => (
              <div key={champ.key}>
                <label className="label">{champ.label} (/20)</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={(formRes as any)[champ.key]}
                  onChange={(e) => setFormRes({ ...formRes, [champ.key]: e.target.value } as any)}
                  className="input"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="label">Points forts</label>
            <textarea value={formRes.points_forts} onChange={(e) => setFormRes({ ...formRes, points_forts: e.target.value })} className="input" rows={2} />
          </div>
          <div>
            <label className="label">Points faibles</label>
            <textarea value={formRes.points_faibles} onChange={(e) => setFormRes({ ...formRes, points_faibles: e.target.value })} className="input" rows={2} />
          </div>
          <div>
            <label className="label">Observations</label>
            <textarea value={formRes.observations} onChange={(e) => setFormRes({ ...formRes, observations: e.target.value })} className="input" rows={2} />
          </div>
          <div>
            <label className="label">Résultat *</label>
            <div className="flex gap-2 flex-wrap">
              {(['admis', 'a_repasser', 'refuse'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFormRes({ ...formRes, resultat: r })}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    formRes.resultat === r ? RESULTAT_LABELS[r].classe : 'bg-fond-clair text-texte-gris hover:text-white'
                  }`}
                >
                  {RESULTAT_LABELS[r].label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={saisirResultat} className="bouton-or w-full">Enregistrer le résultat</button>
        </div>
      </Modal>

      {/* Modal détail résultat */}
      <Modal
        ouvert={!!modalDetailResultat}
        onFermer={() => setModalDetailResultat(null)}
        titre={modalDetailResultat?.candidat_nom}
        taille="lg"
      >
        {modalDetailResultat && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-texte-gris">Passé le {dateCourte(modalDetailResultat.date_rc)}</p>
                {modalDetailResultat.formateur && (
                  <p className="text-xs text-texte-gris">Formateur : {modalDetailResultat.formateur.surnom || modalDetailResultat.formateur.username}</p>
                )}
              </div>
              {modalDetailResultat.resultat && (
                <span className={`text-xs uppercase tracking-wider px-3 py-1 rounded font-semibold ${RESULTAT_LABELS[modalDetailResultat.resultat].classe}`}>
                  {RESULTAT_LABELS[modalDetailResultat.resultat].label}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Tir', val: modalDetailResultat.tir_note },
                { label: 'Conduite', val: modalDetailResultat.conduite_note },
                { label: 'Procédure', val: modalDetailResultat.procedure_note },
                { label: 'Comportement', val: modalDetailResultat.comportement_note },
              ].map((c) => (
                <div key={c.label} className="bg-fond-clair p-3 rounded text-center">
                  <p className="text-2xl font-bold text-white">{c.val ?? '—'}<span className="text-xs text-texte-gris">/20</span></p>
                  <p className="text-[10px] uppercase tracking-wider text-texte-gris mt-1">{c.label}</p>
                </div>
              ))}
            </div>
            {modalDetailResultat.note_globale != null && (
              <div className="bg-or/10 border border-or/30 p-3 rounded text-center">
                <p className="text-3xl font-bold text-or">{modalDetailResultat.note_globale}/20</p>
                <p className="text-[10px] uppercase tracking-wider text-or/80 mt-1">Note globale</p>
              </div>
            )}
            {modalDetailResultat.points_forts && (
              <Section titre="Points forts">{modalDetailResultat.points_forts}</Section>
            )}
            {modalDetailResultat.points_faibles && (
              <Section titre="Points faibles">{modalDetailResultat.points_faibles}</Section>
            )}
            {modalDetailResultat.observations && (
              <Section titre="Observations">{modalDetailResultat.observations}</Section>
            )}
          </div>
        )}
      </Modal>

      {/* Modal créer attestation */}
      <Modal ouvert={modalAttestation} onFermer={() => setModalAttestation(false)} titre="Nouvelle attestation" taille="md">
        <div className="space-y-3">
          <div>
            <label className="label">Bénéficiaire *</label>
            <select
              value={formAtt.beneficiaire_id}
              onChange={(e) => setFormAtt({ ...formAtt, beneficiaire_id: e.target.value })}
              className="input"
            >
              <option value="">Sélectionner un membre…</option>
              {membres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.surnom || m.username} — {NOMS_RANGS[m.rank_level]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Type *</label>
            <select value={formAtt.type} onChange={(e) => setFormAtt({ ...formAtt, type: e.target.value })} className="input">
              <option value="formation">Formation</option>
              <option value="competence">Compétence</option>
              <option value="autorisation">Autorisation</option>
              <option value="distinction">Distinction</option>
            </select>
          </div>
          <div>
            <label className="label">Objet *</label>
            <input value={formAtt.objet} onChange={(e) => setFormAtt({ ...formAtt, objet: e.target.value })} className="input" placeholder="Ex : Formation tireur d'élite" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={formAtt.description} onChange={(e) => setFormAtt({ ...formAtt, description: e.target.value })} className="input" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valide du</label>
              <input type="date" value={formAtt.valide_du} onChange={(e) => setFormAtt({ ...formAtt, valide_du: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Valide jusqu'au</label>
              <input type="date" value={formAtt.valide_jusqu} onChange={(e) => setFormAtt({ ...formAtt, valide_jusqu: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Signature (nom affiché)</label>
            <input value={formAtt.signature} onChange={(e) => setFormAtt({ ...formAtt, signature: e.target.value })} className="input" placeholder="Ex : Co-Leader Smith" />
          </div>
          <button onClick={creerAttestation} className="bouton-or w-full" disabled={!formAtt.beneficiaire_id || !formAtt.objet}>
            Émettre l'attestation
          </button>
        </div>
      </Modal>
    </LayoutApp>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-texte-gris mb-1">{titre}</h3>
      <p className="text-sm text-gray-200 whitespace-pre-wrap bg-fond-clair p-3 rounded">{children}</p>
    </div>
  );
}
