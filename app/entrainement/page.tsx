'use client';

import { useEffect, useState } from 'react';
import { Plus, Calendar as CalIcon, BarChart3 } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { PermissionGate } from '@/components/PermissionGate';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateTime, dateCourte } from '@/lib/utils';
import { NOMS_RANGS } from '@/lib/permissions';

export default function PageEntrainement() {
  const supabase = useSupabase();
  const { user, hasRang } = useUser();
  const [onglet, setOnglet] = useState('planning');
  const [sessions, setSessions] = useState<any[]>([]);
  const [modalCreer, setModalCreer] = useState(false);
  const [modalDetails, setModalDetails] = useState<any>(null);
  const [inscrits, setInscrits] = useState<any[]>([]);

  // Form
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [dateSession, setDateSession] = useState('');
  const [lieu, setLieu] = useState('');
  const [rangMin, setRangMin] = useState(1);

  async function charger() {
    const { data } = await supabase
      .from('training_sessions')
      .select('*, createur:createur_id(username, avatar_url)')
      .is('deleted_at', null)
      .order('date_session', { ascending: false });
    setSessions(data || []);
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('ent')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_sessions' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ouvrirDetails(s: any) {
    setModalDetails(s);
    const { data } = await supabase
      .from('training_results')
      .select('*, user:user_id(username, avatar_url, rank_level)')
      .eq('session_id', s.id);
    setInscrits(data || []);
  }

  async function marquerParticipation(sessionId: string, present: boolean) {
    if (!user) return;
    await supabase.from('training_results').upsert(
      { session_id: sessionId, user_id: user.id, present },
      { onConflict: 'session_id,user_id' }
    );
    if (modalDetails) ouvrirDetails(modalDetails);
  }

  async function creerSession() {
    if (!titre || !dateSession || !user) return;
    await supabase.from('training_sessions').insert({
      titre,
      description,
      date_session: new Date(dateSession).toISOString(),
      lieu,
      rank_min: rangMin,
      createur_id: user.id,
    });
    setTitre(''); setDescription(''); setDateSession(''); setLieu(''); setRangMin(1);
    setModalCreer(false);
  }

  const planning = sessions.filter((s) => new Date(s.date_session) >= new Date());
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
          { id: 'resultats', label: 'Résultats', icone: BarChart3 },
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
              <button key={s.id} onClick={() => ouvrirDetails(s)} className="carte-hover text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-semibold">{s.titre}</h3>
                    <p className="text-xs text-texte-gris mt-1">{dateTime(s.date_session)}</p>
                    {s.lieu && <p className="text-xs text-texte-gris">📍 {s.lieu}</p>}
                    {s.description && <p className="text-sm text-gray-300 mt-2">{s.description}</p>}
                  </div>
                  <span className="text-xs text-texte-gris">Rang min: {NOMS_RANGS[s.rank_min]}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {onglet === 'resultats' && (
        <div className="carte p-0">
          <table className="tableau">
            <thead>
              <tr><th>Session</th><th>Date</th><th>Lieu</th><th>Créateur</th></tr>
            </thead>
            <tbody>
              {passees.map((s) => (
                <tr key={s.id} className="cursor-pointer" onClick={() => ouvrirDetails(s)}>
                  <td className="font-medium">{s.titre}</td>
                  <td>{dateCourte(s.date_session)}</td>
                  <td>{s.lieu || '-'}</td>
                  <td>{s.createur?.username}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal création */}
      <Modal ouvert={modalCreer} onFermer={() => setModalCreer(false)} titre="Nouvelle session" taille="md">
        <div className="space-y-3">
          <div>
            <label className="label">Titre *</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={3} />
          </div>
          <div>
            <label className="label">Date et heure *</label>
            <input type="datetime-local" value={dateSession} onChange={(e) => setDateSession(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Lieu</label>
            <input value={lieu} onChange={(e) => setLieu(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Rang minimum requis</label>
            <select value={rangMin} onChange={(e) => setRangMin(Number(e.target.value))} className="input">
              {Object.entries(NOMS_RANGS).reverse().map(([lvl, nom]) => (
                <option key={lvl} value={lvl}>{nom}</option>
              ))}
            </select>
          </div>
          <button onClick={creerSession} className="bouton-bleu w-full">Créer la session</button>
        </div>
      </Modal>

      {/* Modal détails */}
      <Modal ouvert={!!modalDetails} onFermer={() => setModalDetails(null)} titre={modalDetails?.titre} taille="lg">
        {modalDetails && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><span className="text-texte-gris">Date :</span> {dateTime(modalDetails.date_session)}</p>
              {modalDetails.lieu && <p><span className="text-texte-gris">Lieu :</span> {modalDetails.lieu}</p>}
              {modalDetails.description && <p className="text-gray-300">{modalDetails.description}</p>}
            </div>

            {new Date(modalDetails.date_session) >= new Date() && (
              <div className="flex gap-2">
                <button onClick={() => marquerParticipation(modalDetails.id, true)} className="bouton-vert flex-1">Je participe</button>
                <button onClick={() => marquerParticipation(modalDetails.id, false)} className="bouton-rouge flex-1">Je serai absent</button>
              </div>
            )}

            <div>
              <h3 className="titre-section">Participants ({inscrits.length})</h3>
              {inscrits.length === 0 ? (
                <p className="text-texte-gris text-sm">Aucun participant</p>
              ) : (
                <ul className="space-y-1">
                  {inscrits.map((i) => (
                    <li key={i.id} className="flex items-center justify-between text-sm bg-fond-clair p-2 rounded">
                      <span className="text-white">{i.user?.username}</span>
                      <span>{i.present ? '✅ Présent' : '❌ Absent'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </LayoutApp>
  );
}
