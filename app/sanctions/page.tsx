'use client';

import { useEffect, useState } from 'react';
import { Plus, ShieldAlert } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Modal } from '@/components/Modal';
import { PermissionGate } from '@/components/PermissionGate';
import { Avatar } from '@/components/Avatar';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte } from '@/lib/utils';

const TYPES = [
  { id: 'avertissement', label: 'Avertissement', couleur: '#FACC15' },
  { id: 'blame', label: 'Blâme', couleur: '#F97316' },
  { id: 'suspension', label: 'Suspension', couleur: '#DC2626' },
];

export default function PageSanctions() {
  const supabase = useSupabase();
  const { user, hasRang } = useUser();
  const [sanctions, setSanctions] = useState<any[]>([]);
  const [membres, setMembres] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [filtre, setFiltre] = useState<'active' | 'toutes'>('active');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const [cible, setCible] = useState('');
  const [type, setType] = useState('avertissement');
  const [raison, setRaison] = useState('');
  const [dureeJours, setDureeJours] = useState<number | ''>('');

  async function charger() {
    if (!user) return;
    let q = supabase
      .from('sanctions')
      .select('*, user:user_id(username, avatar_url, rank_level), createur:createur_id(username)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!hasRang(6)) q = q.eq('user_id', user.id);
    if (filtre === 'active') q = q.eq('is_active', true);

    const { data } = await q;
    setSanctions(data || []);

    const { data: m } = await supabase
      .from('users')
      .select('id, username, avatar_url, rank_level')
      .eq('is_active', true)
      .lt('rank_level', user.rank_level)
      .order('username');
    setMembres(m || []);
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('sanctions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sanctions' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtre, user?.id]);

  async function creer() {
    setErreur('');
    if (!cible || !raison.trim()) return;
    setEnCours(true);
    try {
      const res = await fetch('/api/sanctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: cible,
          type,
          raison,
          dureeJours: type === 'suspension' ? Number(dureeJours) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.erreur || 'erreur');
        return;
      }
      setCible(''); setType('avertissement'); setRaison(''); setDureeJours('');
      setModal(false);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <LayoutApp>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="titre-page">Sanctions</h1>
        <div className="flex gap-2">
          <select value={filtre} onChange={(e) => setFiltre(e.target.value as any)} className="input w-auto">
            <option value="active">Actives</option>
            <option value="toutes">Toutes</option>
          </select>
          <PermissionGate minRang={6}>
            <button onClick={() => setModal(true)} className="bouton-rouge flex items-center gap-2">
              <Plus size={16} /> Nouvelle sanction
            </button>
          </PermissionGate>
        </div>
      </div>

      {sanctions.length === 0 ? (
        <div className="carte text-center text-texte-gris py-12">
          <ShieldAlert size={40} className="mx-auto mb-2 opacity-50" />
          <p>Aucune sanction</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sanctions.map((s) => {
            const tInfo = TYPES.find((t) => t.id === s.type);
            return (
              <div key={s.id} className="carte" style={{ borderLeftWidth: 4, borderLeftColor: tInfo?.couleur }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={s.user?.avatar_url} nom={s.user?.username || '?'} taille={40} />
                    <div>
                      <p className="text-white font-medium">{s.user?.username}</p>
                      <p className="text-xs" style={{ color: tInfo?.couleur }}>{tInfo?.label}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-texte-gris">
                    <p>{dateCourte(s.created_at)}</p>
                    {s.is_active ? (
                      <span className="badge-statut bg-red-500/20 text-red-300">Active</span>
                    ) : (
                      <span className="badge-statut bg-gray-500/20 text-gray-300">Expirée</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-300 mt-3">{s.raison}</p>
                {s.duree_jours && (
                  <p className="text-xs text-texte-gris mt-1">Durée : {s.duree_jours} jours</p>
                )}
                {s.createur?.username && (
                  <p className="text-xs text-texte-gris mt-2">Par {s.createur.username}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal ouvert={modal} onFermer={() => { setModal(false); setErreur(''); }} titre="Nouvelle sanction">
        <div className="space-y-3">
          <div>
            <label className="label">Membre ciblé *</label>
            <select value={cible} onChange={(e) => setCible(e.target.value)} className="input">
              <option value="">Sélectionner...</option>
              {membres.map((m) => (
                <option key={m.id} value={m.id}>{m.username}</option>
              ))}
            </select>
            <p className="text-xs text-texte-gris mt-1">Seuls les membres de rang inférieur au tien sont listés.</p>
          </div>
          <div>
            <label className="label">Type *</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          {type === 'suspension' && (
            <div>
              <label className="label">Durée (jours) *</label>
              <input
                type="number"
                value={dureeJours}
                onChange={(e) => setDureeJours(e.target.value === '' ? '' : Number(e.target.value))}
                className="input"
                min={1}
                max={365}
              />
            </div>
          )}
          <div>
            <label className="label">Raison détaillée * (min 5 caractères)</label>
            <textarea value={raison} onChange={(e) => setRaison(e.target.value)} className="input" rows={4} />
          </div>
          {erreur && <p className="text-sm text-red-400">{erreur}</p>}
          <button onClick={creer} className="bouton-rouge w-full" disabled={!cible || !raison.trim() || enCours}>
            {enCours ? 'En cours...' : 'Appliquer la sanction'}
          </button>
        </div>
      </Modal>
    </LayoutApp>
  );
}
