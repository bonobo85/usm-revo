'use client';

import { useEffect, useState } from 'react';
import { Search, UserMinus } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { AccesRefuse } from '@/components/AccesRefuse';
import { Modal } from '@/components/Modal';
import { PermissionGate } from '@/components/PermissionGate';
import { RankBadge } from '@/components/RankBadge';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte } from '@/lib/utils';

export default function PageArchives() {
  const supabase = useSupabase();
  const { user, hasRang } = useUser();
  const [archives, setArchives] = useState<any[]>([]);
  const [membresActifs, setMembresActifs] = useState<any[]>([]);
  const [recherche, setRecherche] = useState('');
  const [details, setDetails] = useState<any>(null);
  const [dossier, setDossier] = useState<any[]>([]);
  const [modalArchiver, setModalArchiver] = useState(false);
  const [cibleId, setCibleId] = useState('');
  const [raison, setRaison] = useState<'demission' | 'exclusion' | 'inactivite' | 'autre'>('demission');
  const [notes, setNotes] = useState('');

  async function charger() {
    const { data } = await supabase
      .from('archives')
      .select('*')
      .is('deleted_at', null)
      .order('date_depart', { ascending: false });
    setArchives(data || []);

    const { data: m } = await supabase.from('users').select('id, username, rank_level').eq('is_active', true);
    setMembresActifs(m || []);
  }

  useEffect(() => { charger(); }, []); // eslint-disable-line

  async function ouvrirDossier(a: any) {
    setDetails(a);
    const { data } = await supabase
      .from('archive_records')
      .select('*')
      .eq('archive_id', a.id)
      .order('date_evenement', { ascending: false });
    setDossier(data || []);
  }

  async function archiver() {
    if (!user || !cibleId) return;
    const res = await fetch('/api/archiver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: cibleId, raison, notes }),
    });
    if (res.ok) {
      setCibleId(''); setRaison('demission'); setNotes('');
      setModalArchiver(false);
      charger();
    }
  }

  if (!hasRang(6)) {
    return <LayoutApp><AccesRefuse message="Archives réservées aux opérateurs (rang ≥ 6)." /></LayoutApp>;
  }

  const filtres = archives.filter((a) =>
    !recherche || a.username_final.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <LayoutApp>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="titre-page">Archives</h1>
        <PermissionGate minRang={7}>
          <button onClick={() => setModalArchiver(true)} className="bouton-rouge flex items-center gap-2">
            <UserMinus size={16} /> Archiver un membre
          </button>
        </PermissionGate>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-texte-gris" size={18} />
        <input
          type="text"
          placeholder="Rechercher un ancien membre..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="input pl-10"
        />
      </div>

      <div className="carte p-0">
        <table className="tableau">
          <thead>
            <tr><th>Nom</th><th>Rang au départ</th><th>Raison</th><th>Date</th></tr>
          </thead>
          <tbody>
            {filtres.map((a) => (
              <tr key={a.id} onClick={() => ouvrirDossier(a)} className="cursor-pointer">
                <td className="font-medium">{a.username_final}</td>
                <td>{a.rank_final ? <RankBadge rang={a.rank_final} taille="sm" /> : '-'}</td>
                <td className="capitalize">{a.raison}</td>
                <td>{dateCourte(a.date_depart)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtres.length === 0 && <p className="text-center text-texte-gris py-8">Aucune archive</p>}
      </div>

      <Modal ouvert={!!details} onFermer={() => setDetails(null)} titre={details?.username_final} taille="lg">
        {details && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><span className="text-texte-gris">Rang au départ :</span> {details.rank_final}</p>
              <p><span className="text-texte-gris">Date de départ :</span> {dateCourte(details.date_depart)}</p>
              <p><span className="text-texte-gris">Raison :</span> <span className="capitalize">{details.raison}</span></p>
              {details.notes && <p><span className="text-texte-gris">Notes :</span> {details.notes}</p>}
            </div>
            <div>
              <h3 className="titre-section">Dossier</h3>
              {dossier.length === 0 ? (
                <p className="text-texte-gris text-sm">Aucun enregistrement</p>
              ) : (
                <ul className="space-y-2">
                  {dossier.map((r) => (
                    <li key={r.id} className="bg-fond-clair p-2 rounded text-sm">
                      <p className="text-xs text-texte-gris capitalize">{r.type}</p>
                      <pre className="text-xs overflow-x-auto">{JSON.stringify(r.contenu, null, 2)}</pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal ouvert={modalArchiver} onFermer={() => setModalArchiver(false)} titre="Archiver un membre">
        <div className="space-y-3">
          <div>
            <label className="label">Membre *</label>
            <select value={cibleId} onChange={(e) => setCibleId(e.target.value)} className="input">
              <option value="">Sélectionner...</option>
              {membresActifs.filter(m => m.id !== user?.id).map((m) => (
                <option key={m.id} value={m.id}>{m.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Raison *</label>
            <select value={raison} onChange={(e) => setRaison(e.target.value as any)} className="input">
              <option value="demission">Démission</option>
              <option value="exclusion">Exclusion</option>
              <option value="inactivite">Inactivité</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={4} />
          </div>
          <p className="text-xs text-red-400">⚠️ Cette action désactive le compte et archive tout son historique.</p>
          <button onClick={archiver} className="bouton-rouge w-full" disabled={!cibleId}>
            Confirmer l'archivage
          </button>
        </div>
      </Modal>
    </LayoutApp>
  );
}
