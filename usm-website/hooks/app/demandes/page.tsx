'use client';

import { useEffect, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Modal } from '@/components/Modal';
import { PermissionGate } from '@/components/PermissionGate';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte } from '@/lib/utils';

const TYPES = [
  { id: 'badge', label: 'Attribution de badge' },
  { id: 'rang', label: 'Changement de rang' },
  { id: 'conge', label: 'Congé d\'inactivité' },
];

const COULEURS_STATUT: Record<string, string> = {
  en_attente: 'bg-yellow-500/20 text-yellow-300',
  approuve: 'bg-emerald-500/20 text-emerald-300',
  refuse: 'bg-red-500/20 text-red-300',
  annule: 'bg-gray-500/20 text-gray-300',
};

export default function PageDemandes() {
  const supabase = useSupabase();
  const { user, hasRang } = useUser();
  const [demandes, setDemandes] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [modalDetails, setModalDetails] = useState<any>(null);

  const [type, setType] = useState('badge');
  const [justification, setJustification] = useState('');
  const [details, setDetails] = useState('');
  const [commentaire, setCommentaire] = useState('');

  async function charger() {
    const { data } = await supabase
      .from('requests')
      .select('*, demandeur:demandeur_id(username, avatar_url)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setDemandes(data || []);
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('demandes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function creer() {
    if (!user || !justification.trim()) return;
    await supabase.from('requests').insert({
      type,
      demandeur_id: user.id,
      contenu: { details },
      justification,
      statut: 'en_attente',
    });
    setType('badge'); setJustification(''); setDetails('');
    setModal(false);
  }

  async function traiter(id: string, ok: boolean) {
    if (!user || !commentaire.trim()) return;
    await supabase.from('requests').update({
      statut: ok ? 'approuve' : 'refuse',
      traite_par: user.id,
      date_traitement: new Date().toISOString(),
      commentaire_traitement: commentaire,
    }).eq('id', id);
    setCommentaire('');
    setModalDetails(null);
  }

  return (
    <LayoutApp>
      <div className="flex items-center justify-between mb-4">
        <h1 className="titre-page">Demandes</h1>
        <button onClick={() => setModal(true)} className="bouton-bleu flex items-center gap-2">
          <Plus size={16} /> Nouvelle demande
        </button>
      </div>

      <div className="grid gap-3">
        {demandes.map((d) => {
          const tInfo = TYPES.find((t) => t.id === d.type);
          return (
            <button key={d.id} onClick={() => setModalDetails(d)} className="carte-hover text-left">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white font-semibold">{tInfo?.label}</p>
                  <p className="text-xs text-texte-gris mt-1">par {d.demandeur?.username}</p>
                  {d.justification && (
                    <p className="text-sm text-gray-300 mt-2 line-clamp-2">{d.justification}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`badge-statut ${COULEURS_STATUT[d.statut]}`}>{d.statut.replace('_', ' ')}</span>
                  <p className="text-xs text-texte-gris mt-1">{dateCourte(d.created_at)}</p>
                </div>
              </div>
            </button>
          );
        })}
        {demandes.length === 0 && (
          <p className="text-center text-texte-gris py-8">Aucune demande</p>
        )}
      </div>

      {/* Modal création */}
      <Modal ouvert={modal} onFermer={() => setModal(false)} titre="Nouvelle demande">
        <div className="space-y-3">
          <div>
            <label className="label">Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Détails</label>
            <input value={details} onChange={(e) => setDetails(e.target.value)} className="input" placeholder={type === 'badge' ? 'Quel badge ?' : type === 'rang' ? 'Quel rang ?' : 'Durée ?'} />
          </div>
          <div>
            <label className="label">Justification *</label>
            <textarea value={justification} onChange={(e) => setJustification(e.target.value)} className="input" rows={5} />
          </div>
          <button onClick={creer} className="bouton-bleu w-full" disabled={!justification.trim()}>
            Soumettre
          </button>
        </div>
      </Modal>

      {/* Modal détails */}
      <Modal ouvert={!!modalDetails} onFermer={() => setModalDetails(null)} titre={modalDetails && TYPES.find(t=>t.id===modalDetails.type)?.label}>
        {modalDetails && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><span className="text-texte-gris">Demandeur :</span> {modalDetails.demandeur?.username}</p>
              <p><span className="text-texte-gris">Date :</span> {dateCourte(modalDetails.created_at)}</p>
              <p><span className="text-texte-gris">Statut :</span> <span className={`badge-statut ${COULEURS_STATUT[modalDetails.statut]}`}>{modalDetails.statut.replace('_',' ')}</span></p>
            </div>
            {modalDetails.contenu?.details && (
              <div className="bg-fond-clair p-3 rounded">
                <p className="text-xs text-texte-gris mb-1">Détails</p>
                <p className="text-sm">{modalDetails.contenu.details}</p>
              </div>
            )}
            {modalDetails.justification && (
              <div className="bg-fond-clair p-3 rounded">
                <p className="text-xs text-texte-gris mb-1">Justification</p>
                <p className="text-sm whitespace-pre-wrap">{modalDetails.justification}</p>
              </div>
            )}
            {modalDetails.commentaire_traitement && (
              <div className="bg-fond-clair p-3 rounded">
                <p className="text-xs text-texte-gris mb-1">Commentaire du traitement</p>
                <p className="text-sm">{modalDetails.commentaire_traitement}</p>
              </div>
            )}

            <PermissionGate minRang={6}>
              {modalDetails.statut === 'en_attente' && modalDetails.demandeur_id !== user?.id && (
                <div className="space-y-2 border-t border-gris-bordure pt-4">
                  <label className="label">Commentaire *</label>
                  <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} className="input" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => traiter(modalDetails.id, true)} className="bouton-vert flex-1 flex items-center justify-center gap-2" disabled={!commentaire.trim()}>
                      <Check size={16} /> Approuver
                    </button>
                    <button onClick={() => traiter(modalDetails.id, false)} className="bouton-rouge flex-1 flex items-center justify-center gap-2" disabled={!commentaire.trim()}>
                      <X size={16} /> Refuser
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
