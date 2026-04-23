'use client';

import { useEffect, useState } from 'react';
import { Plus, Siren } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { PermissionGate } from '@/components/PermissionGate';
import { AccesRefuse } from '@/components/AccesRefuse';
import { Avatar } from '@/components/Avatar';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte } from '@/lib/utils';

export default function PageCrash() {
  const supabase = useSupabase();
  const { user, hasRang } = useUser();
  const [onglet, setOnglet] = useState('membres');
  const [membresCrash, setMembresCrash] = useState<any[]>([]);
  const [enquetes, setEnquetes] = useState<any[]>([]);
  const [aBadgeCrash, setABadgeCrash] = useState(false);
  const [modalEnquete, setModalEnquete] = useState(false);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');

  async function charger() {
    if (!user) return;
    const { data: badge } = await supabase
      .from('user_badges')
      .select('id, badge:badge_id(code)')
      .eq('user_id', user.id)
      .eq('is_active', true);
    const ok = (badge || []).some((b: any) => b.badge?.code === 'CRASH');
    setABadgeCrash(ok);
    if (!ok) return;

    const { data: m } = await supabase
      .from('crash_members')
      .select('*, user:user_id(username, avatar_url, rank_level)')
      .eq('is_active', true);
    setMembresCrash(m || []);

    const { data: e } = await supabase
      .from('investigations')
      .select('*, responsable:responsable_id(username, avatar_url)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setEnquetes(e || []);
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function creerEnquete() {
    if (!user || !titre) return;
    await supabase.from('investigations').insert({
      titre, description, responsable_id: user.id, statut: 'ouverte',
    });
    setTitre(''); setDescription('');
    setModalEnquete(false);
    charger();
  }

  if (!hasRang(6) || !aBadgeCrash) {
    return <LayoutApp><AccesRefuse message="Section réservée aux opérateurs avec le badge CRASH." /></LayoutApp>;
  }

  return (
    <LayoutApp>
      <div className="flex items-center gap-2 mb-4">
        <Siren className="text-red-500" />
        <h1 className="titre-page">Unité CRASH</h1>
      </div>

      <Tabs
        onglets={[{ id: 'membres', label: 'Membres' }, { id: 'enquetes', label: 'Enquêtes' }]}
        actif={onglet}
        onChange={setOnglet}
      />

      {onglet === 'membres' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {membresCrash.map((m) => (
            <div key={m.id} className="carte flex items-center gap-3">
              <Avatar src={m.user?.avatar_url} nom={m.user?.username || '?'} taille={48} />
              <div>
                <p className="text-white font-medium">{m.user?.username}</p>
                <p className="text-xs text-texte-gris">{m.role}</p>
              </div>
            </div>
          ))}
          {membresCrash.length === 0 && <p className="text-texte-gris text-center col-span-3 py-8">Aucun membre</p>}
        </div>
      )}

      {onglet === 'enquetes' && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => setModalEnquete(true)} className="bouton-bleu flex items-center gap-2">
              <Plus size={16} /> Nouvelle enquête
            </button>
          </div>
          <div className="grid gap-3">
            {enquetes.map((e) => (
              <div key={e.id} className="carte">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-semibold">{e.titre}</p>
                    <p className="text-xs text-texte-gris">Responsable : {e.responsable?.username}</p>
                    {e.description && <p className="text-sm text-gray-300 mt-2">{e.description}</p>}
                  </div>
                  <div className="text-right">
                    <span className="badge-statut bg-bleu/20 text-bleu-clair capitalize">{e.statut}</span>
                    <p className="text-xs text-texte-gris mt-1">{dateCourte(e.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
            {enquetes.length === 0 && <p className="text-texte-gris text-center py-8">Aucune enquête</p>}
          </div>
        </>
      )}

      <Modal ouvert={modalEnquete} onFermer={() => setModalEnquete(false)} titre="Nouvelle enquête">
        <div className="space-y-3">
          <div>
            <label className="label">Titre *</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={5} />
          </div>
          <button onClick={creerEnquete} className="bouton-bleu w-full" disabled={!titre}>
            Créer
          </button>
        </div>
      </Modal>
    </LayoutApp>
  );
}
