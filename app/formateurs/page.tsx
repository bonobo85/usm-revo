'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { AccesRefuse } from '@/components/AccesRefuse';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte } from '@/lib/utils';

export default function PageFormateurs() {
  const supabase = useSupabase();
  const { user, hasRang } = useUser();
  const [onglet, setOnglet] = useState('questionnaires');
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [membres, setMembres] = useState<any[]>([]);

  const [modalQ, setModalQ] = useState(false);
  const [modalEval, setModalEval] = useState(false);

  const [titreQ, setTitreQ] = useState('');
  const [descQ, setDescQ] = useState('');
  const [questions, setQuestions] = useState<any[]>([{ type: 'text', question: '', options: [], bonne_reponse: '', points: 1 }]);

  const [candidatId, setCandidatId] = useState('');
  const [qId, setQId] = useState('');
  const [datePlan, setDatePlan] = useState('');

  async function charger() {
    const [q, e, m] = await Promise.all([
      supabase.from('questionnaires').select('*, createur:createur_id(username)').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('evaluations').select('*, candidat:candidat_id(username), formateur:formateur_id(username), questionnaire:questionnaire_id(titre)').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('users').select('id, username, rank_level').eq('is_active', true),
    ]);
    setQuestionnaires(q.data || []);
    setEvaluations(e.data || []);
    setMembres(m.data || []);
  }

  useEffect(() => { charger(); }, []); // eslint-disable-line

  async function creerQ() {
    if (!user || !titreQ) return;
    const { data: nouveau } = await supabase.from('questionnaires').insert({
      titre: titreQ, description: descQ, createur_id: user.id,
    }).select().single();
    if (!nouveau) return;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await supabase.from('questionnaire_questions').insert({
        questionnaire_id: nouveau.id,
        ordre: i,
        type: q.type,
        question: q.question,
        options: q.type === 'qcm' ? q.options.filter((o: string) => o) : null,
        bonne_reponse: q.bonne_reponse || null,
        points: q.points,
      });
    }
    setTitreQ(''); setDescQ(''); setQuestions([{ type: 'text', question: '', options: [], bonne_reponse: '', points: 1 }]);
    setModalQ(false);
    charger();
  }

  async function planifierEval() {
    if (!user || !candidatId || !qId) return;
    await supabase.from('evaluations').insert({
      candidat_id: candidatId,
      formateur_id: user.id,
      questionnaire_id: qId,
      date_planifiee: datePlan ? new Date(datePlan).toISOString() : null,
      statut: 'planifiee',
    });
    setCandidatId(''); setQId(''); setDatePlan('');
    setModalEval(false);
    charger();
  }

  function ajouterQuestion() {
    setQuestions([...questions, { type: 'text', question: '', options: [], bonne_reponse: '', points: 1 }]);
  }

  function modifQuestion(i: number, patch: any) {
    const next = [...questions];
    next[i] = { ...next[i], ...patch };
    setQuestions(next);
  }

  function retirerQuestion(i: number) {
    setQuestions(questions.filter((_, j) => j !== i));
  }

  if (!hasRang(4)) {
    return <LayoutApp><AccesRefuse message="Section réservée aux formateurs (rang ≥ 4)." /></LayoutApp>;
  }

  return (
    <LayoutApp>
      <h1 className="titre-page mb-4">Formateurs</h1>

      <Tabs
        onglets={[
          { id: 'questionnaires', label: 'Questionnaires' },
          { id: 'evaluations', label: 'Évaluations' },
          { id: 'resultats', label: 'Résultats' },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {onglet === 'questionnaires' && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => setModalQ(true)} className="bouton-bleu flex items-center gap-2">
              <Plus size={16} /> Nouveau questionnaire
            </button>
          </div>
          <div className="grid gap-3">
            {questionnaires.map((q) => (
              <div key={q.id} className="carte">
                <div className="flex justify-between">
                  <div>
                    <p className="text-white font-semibold">{q.titre}</p>
                    <p className="text-xs text-texte-gris">par {q.createur?.username}</p>
                    {q.description && <p className="text-sm text-gray-300 mt-2">{q.description}</p>}
                  </div>
                  <span className={`badge-statut ${q.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-300'}`}>
                    {q.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {onglet === 'evaluations' && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => setModalEval(true)} className="bouton-bleu flex items-center gap-2">
              <Plus size={16} /> Planifier évaluation
            </button>
          </div>
          <div className="grid gap-3">
            {evaluations.map((e) => (
              <div key={e.id} className="carte">
                <div className="flex justify-between">
                  <div>
                    <p className="text-white font-medium">{e.candidat?.username}</p>
                    <p className="text-xs text-texte-gris">
                      {e.questionnaire?.titre} · Formateur: {e.formateur?.username}
                    </p>
                    {e.date_planifiee && <p className="text-xs text-texte-gris mt-1">Prévue le {dateCourte(e.date_planifiee)}</p>}
                  </div>
                  <span className="badge-statut bg-bleu/20 text-bleu-clair capitalize">{e.statut}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {onglet === 'resultats' && (
        <div className="carte p-0">
          <table className="tableau">
            <thead><tr><th>Candidat</th><th>Questionnaire</th><th>Score</th><th>Statut</th><th>Date</th></tr></thead>
            <tbody>
              {evaluations.filter(e => e.date_passee).map((e) => (
                <tr key={e.id}>
                  <td>{e.candidat?.username}</td>
                  <td>{e.questionnaire?.titre}</td>
                  <td>{e.score_obtenu ?? '-'} / {e.score_total ?? '-'}</td>
                  <td><span className="badge-statut bg-fond-clair capitalize">{e.statut}</span></td>
                  <td>{e.date_passee ? dateCourte(e.date_passee) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal création questionnaire */}
      <Modal ouvert={modalQ} onFermer={() => setModalQ(false)} titre="Nouveau questionnaire" taille="xl">
        <div className="space-y-3">
          <div>
            <label className="label">Titre *</label>
            <input value={titreQ} onChange={(e) => setTitreQ(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={descQ} onChange={(e) => setDescQ(e.target.value)} className="input" rows={2} />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="label m-0">Questions</label>
              <button onClick={ajouterQuestion} className="text-xs text-bleu-clair hover:underline">+ Ajouter</button>
            </div>
            {questions.map((q, i) => (
              <div key={i} className="bg-fond-clair p-3 rounded space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-texte-gris">Question {i + 1}</span>
                  <button onClick={() => retirerQuestion(i)} className="text-red-400"><Trash2 size={14} /></button>
                </div>
                <select value={q.type} onChange={(e) => modifQuestion(i, { type: e.target.value, options: [] })} className="input">
                  <option value="text">Texte libre</option>
                  <option value="qcm">QCM</option>
                  <option value="boolean">Oui/Non</option>
                </select>
                <input value={q.question} onChange={(e) => modifQuestion(i, { question: e.target.value })} className="input" placeholder="Question..." />
                {q.type === 'qcm' && (
                  <div className="space-y-1">
                    {[0,1,2,3].map((idx) => (
                      <input
                        key={idx}
                        value={q.options[idx] || ''}
                        onChange={(e) => {
                          const opts = [...(q.options || [])];
                          opts[idx] = e.target.value;
                          modifQuestion(i, { options: opts });
                        }}
                        className="input"
                        placeholder={`Option ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
                <input value={q.bonne_reponse} onChange={(e) => modifQuestion(i, { bonne_reponse: e.target.value })} className="input" placeholder="Bonne réponse (optionnel)" />
              </div>
            ))}
          </div>

          <button onClick={creerQ} className="bouton-bleu w-full" disabled={!titreQ}>
            Créer
          </button>
        </div>
      </Modal>

      {/* Modal éval */}
      <Modal ouvert={modalEval} onFermer={() => setModalEval(false)} titre="Planifier une évaluation">
        <div className="space-y-3">
          <div>
            <label className="label">Candidat *</label>
            <select value={candidatId} onChange={(e) => setCandidatId(e.target.value)} className="input">
              <option value="">Sélectionner...</option>
              {membres.filter(m => m.id !== user?.id).map((m) => <option key={m.id} value={m.id}>{m.username}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Questionnaire *</label>
            <select value={qId} onChange={(e) => setQId(e.target.value)} className="input">
              <option value="">Sélectionner...</option>
              {questionnaires.filter(q => q.is_active).map((q) => <option key={q.id} value={q.id}>{q.titre}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date prévue</label>
            <input type="datetime-local" value={datePlan} onChange={(e) => setDatePlan(e.target.value)} className="input" />
          </div>
          <button onClick={planifierEval} className="bouton-bleu w-full" disabled={!candidatId || !qId}>
            Planifier
          </button>
        </div>
      </Modal>
    </LayoutApp>
  );
}
