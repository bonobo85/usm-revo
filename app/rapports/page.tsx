'use client';

import { useEffect, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { PermissionGate } from '@/components/PermissionGate';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte } from '@/lib/utils';

const TYPES = [
  { id: 'enquete', label: 'Enquête' },
  { id: 'gav', label: 'Garde à vue' },
  { id: 'bracelet', label: 'Pose bracelet' },
  { id: 'incident', label: 'Incident' },
];

const COULEURS_STATUT: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-300',
  submitted: 'bg-yellow-500/20 text-yellow-300',
  validated: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
};

export default function PageRapports() {
  const supabase = useSupabase();
  const { user, hasRang } = useUser();
  const [onglet, setOnglet] = useState('mes');
  const [rapports, setRapports] = useState<any[]>([]);
  const [modalNouveau, setModalNouveau] = useState(false);
  const [modalDetails, setModalDetails] = useState<any>(null);

  const [type, setType] = useState('enquete');
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [commentaire, setCommentaire] = useState('');

  async function charger() {
    if (!user) return;
    let q = supabase.from('reports').select('*, auteur:auteur_id(username, avatar_url)').is('deleted_at', null).order('created_at', { ascending: false });
    if (onglet === 'mes') q = q.eq('auteur_id', user.id);
    else if (onglet === 'valider') q = q.eq('statut', 'submitted');
    const { data } = await q;
    setRapports(data || []);
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('rapports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet, user?.id]);

  async function creer(statut: 'draft' | 'submitted') {
    if (!titre || !user) return;
    await supabase.from('reports').insert({
      type, titre, contenu: { texte: contenu }, auteur_id: user.id, statut,
    });
    setType('enquete'); setTitre(''); setContenu('');
    setModalNouveau(false);
  }

  async function valider(id: string, ok: boolean) {
    if (!user || !commentaire.trim()) return;
    await supabase.from('reports').update({
      statut: ok ? 'validated' : 'rejected',
      validateur_id: user.id,
      date_validation: new Date().toISOString(),
      commentaire_validation: commentaire,
    }).eq('id', id);
    setCommentaire('');
    setModalDetails(null);
  }

  const onglets = [
    { id: 'mes', label: 'Mes rapports' },
    ...(hasRang(6) ? [{ id: 'valider', label: 'À valider' }] : []),
    ...(hasRang(8) ? [{ id: 'tous', label: 'Tous' }] : []),
  ];

  return (
    <LayoutApp>
      <div className="flex items-center justify-between mb-4">
        <h1 className="titre-page">Rapports</h1>
        <button onClick={() => setModalNouveau(true)} className="bouton-bleu flex items-center gap-2">
          <Plus size={16} /> Nouveau rapport
        </button>
      </div>

      <Tabs onglets={onglets} actif={onglet} onChange={setOnglet} />

      <div className="carte p-0">
        <table className="tableau">
          <thead>
            <tr><th>Titre</th><th>Type</th><th>Auteur</th><th>Statut</th><th>Date</th></tr>
          </thead>
          <tbody>
            {rapports.map((r) => (
              <tr key={r.id} onClick={() => setModalDetails(r)} className="cursor-pointer">
                <td className="font-medium">{r.titre}</td>
                <td className="capitalize">{r.type}</td>
                <td>{r.auteur?.username}</td>
                <td>
                  <span className={`badge-statut ${COULEURS_STATUT[r.statut]}`}>{r.statut}</span>
                </td>
                <td>{dateCourte(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rapports.length === 0 && <p className="text-center text-texte-gris py-8">Aucun rapport</p>}
      </div>

      {/* Modal création */}
      <Modal ouvert={modalNouveau} onFermer={() => setModalNouveau(false)} titre="Nouveau rapport">
        <div className="space-y-3">
          <div>
            <label className="label">Type de rapport *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Titre *</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Contenu</label>
            <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} className="input" rows={8} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => creer('draft')} className="bouton-gris flex-1">Sauvegarder brouillon</button>
            <button onClick={() => creer('submitted')} className="bouton-bleu flex-1">Soumettre</button>
          </div>
        </div>
      </Modal>

      {/* Modal détails */}
      <Modal ouvert={!!modalDetails} onFermer={() => setModalDetails(null)} titre={modalDetails?.titre} taille="lg">
        {modalDetails && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><span className="text-texte-gris">Type :</span> <span className="capitalize">{modalDetails.type}</span></p>
              <p><span className="text-texte-gris">Auteur :</span> {modalDetails.auteur?.username}</p>
              <p><span className="text-texte-gris">Statut :</span> <span className={`badge-statut ${COULEURS_STATUT[modalDetails.statut]}`}>{modalDetails.statut}</span></p>
            </div>

            <div className="bg-fond-clair p-3 rounded">
              <p className="text-xs text-texte-gris mb-1">Contenu</p>
              <p className="text-sm text-white whitespace-pre-wrap">{modalDetails.contenu?.texte || '-'}</p>
            </div>

            {modalDetails.commentaire_validation && (
              <div className="bg-fond-clair p-3 rounded">
                <p className="text-xs text-texte-gris mb-1">Commentaire de validation</p>
                <p className="text-sm text-white">{modalDetails.commentaire_validation}</p>
              </div>
            )}

            {/* Validation */}
            <PermissionGate minRang={6}>
              {modalDetails.statut === 'submitted' && modalDetails.auteur_id !== user?.id && (
                <div className="space-y-2 border-t border-gris-bordure pt-4">
                  <label className="label">Commentaire (obligatoire)</label>
                  <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} className="input" rows={3} />
                  <div className="flex gap-2">
                    <button onClick={() => valider(modalDetails.id, true)} className="bouton-vert flex-1 flex items-center justify-center gap-2" disabled={!commentaire.trim()}>
                      <Check size={16} /> Valider
                    </button>
                    <button onClick={() => valider(modalDetails.id, false)} className="bouton-rouge flex-1 flex items-center justify-center gap-2" disabled={!commentaire.trim()}>
                      <X size={16} /> Rejeter
                    </button>
                  </div>
                </div>
              )}
            </PermissionGate>
          </div>
        )}
      </Modal>
    </LayoutApp>
  );
}
