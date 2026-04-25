'use client';

import { useEffect, useState } from 'react';
import { Plus, Siren, FileSearch } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { AccesRefuse } from '@/components/AccesRefuse';
import { Avatar } from '@/components/Avatar';
import { BadgeTag } from '@/components/BadgeTag';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte } from '@/lib/utils';
import { peutVoirCrash, NOMS_RANGS, couleurRang } from '@/lib/permissions';

const STATUT_LABELS: Record<string, { label: string; classe: string }> = {
  ouverte: { label: 'Ouverte', classe: 'bg-amber-500/20 text-amber-300' },
  en_cours: { label: 'En cours', classe: 'bg-blue-500/20 text-blue-300' },
  cloturee: { label: 'Clôturée', classe: 'bg-emerald-500/20 text-emerald-300' },
};

export default function PageCrash() {
  const supabase = useSupabase();
  const { user, rang, badges } = useUser();
  const peutAcces = peutVoirCrash(rang, badges);

  const [onglet, setOnglet] = useState<'membres' | 'enquetes'>('membres');
  const [membresCrash, setMembresCrash] = useState<any[]>([]);
  const [enquetes, setEnquetes] = useState<any[]>([]);
  const [modalEnquete, setModalEnquete] = useState(false);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');

  async function charger() {
    if (!peutAcces) return;
    // Membres avec badge CRASH
    const { data: ub } = await supabase
      .from('user_badges')
      .select('user_id, attribue_le, badge:badge_id(code, nom, couleur)')
      .eq('is_active', true)
      .is('deleted_at', null);
    const userIds = (ub || [])
      .filter((b: any) => b.badge?.code === 'CRASH')
      .map((b: any) => b.user_id);

    if (userIds.length > 0) {
      const { data: us } = await supabase
        .from('users')
        .select('id, username, surnom, avatar_url, rank_level')
        .in('id', userIds)
        .eq('is_active', true);
      setMembresCrash(us || []);
    } else {
      setMembresCrash([]);
    }

    const { data: e } = await supabase
      .from('investigations')
      .select('*, responsable:responsable_id(username, surnom, avatar_url)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setEnquetes(e || []);
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('crash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investigations' }, () => charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badges' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peutAcces]);

  async function creerEnquete() {
    if (!user || !titre) return;
    await supabase.from('investigations').insert({
      titre, description, responsable_id: user.id, statut: 'ouverte',
    });
    setTitre(''); setDescription('');
    setModalEnquete(false);
  }

  if (!peutAcces) {
    return <LayoutApp><AccesRefuse message="Section CRASH réservée aux co-leaders+ ou aux membres avec le badge CRASH." /></LayoutApp>;
  }

  const badgeCrash = { code: 'CRASH', nom: 'CRASH', couleur: '#DC2626' };

  return (
    <LayoutApp>
      <div className="flex items-center gap-2 mb-4">
        <Siren className="text-red-500" />
        <h1 className="titre-page">Unité CRASH</h1>
        <BadgeTag badge={badgeCrash} taille="sm" className="ml-2" />
      </div>

      <Tabs
        onglets={[
          { id: 'membres', label: `Membres (${membresCrash.length})`, icone: Siren },
          { id: 'enquetes', label: `Enquêtes (${enquetes.length})`, icone: FileSearch },
        ]}
        actif={onglet}
        onChange={(id) => setOnglet(id as any)}
      />

      {onglet === 'membres' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {membresCrash.length === 0 ? (
            <p className="text-texte-gris text-center col-span-full py-8">Aucun membre CRASH.</p>
          ) : (
            membresCrash.map((m) => {
              const couleur = couleurRang(m.rank_level);
              return (
                <div key={m.id} className="carte flex items-center gap-3" style={{ borderLeftWidth: 3, borderLeftColor: couleur }}>
                  <Avatar src={m.avatar_url} nom={m.username} taille={48} />
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{m.surnom || m.username}</p>
                    <p className="text-xs" style={{ color: couleur }}>{NOMS_RANGS[m.rank_level]}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {onglet === 'enquetes' && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => setModalEnquete(true)} className="bouton-rouge flex items-center gap-2">
              <Plus size={16} /> Nouvelle enquête
            </button>
          </div>
          <div className="space-y-2">
            {enquetes.length === 0 ? (
              <p className="text-texte-gris text-center py-8">Aucune enquête en cours.</p>
            ) : (
              enquetes.map((e) => {
                const stat = STATUT_LABELS[e.statut] || STATUT_LABELS.ouverte;
                return (
                  <div key={e.id} className="carte !p-3 border-l-2 border-l-red-600">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold">{e.titre}</p>
                        {e.description && <p className="text-sm text-gray-300 mt-1">{e.description}</p>}
                        {e.responsable && (
                          <div className="flex items-center gap-2 mt-2">
                            <Avatar src={e.responsable.avatar_url} nom={e.responsable.username} taille={20} />
                            <p className="text-xs text-texte-gris">
                              {e.responsable.surnom || e.responsable.username} · {dateCourte(e.created_at)}
                            </p>
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${stat.classe}`}>
                        {stat.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      <Modal ouvert={modalEnquete} onFermer={() => setModalEnquete(false)} titre="Nouvelle enquête CRASH" taille="md">
        <div className="space-y-3">
          <div>
            <label className="label">Titre *</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className="input" placeholder="Ex : Affaire 2026-04-25 — disparition…" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={5} />
          </div>
          <button onClick={creerEnquete} className="bouton-rouge w-full" disabled={!titre}>
            Ouvrir l'enquête
          </button>
        </div>
      </Modal>
    </LayoutApp>
  );
}
