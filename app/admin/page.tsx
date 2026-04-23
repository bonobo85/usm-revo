'use client';

import { useEffect, useState } from 'react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { AccesRefuse } from '@/components/AccesRefuse';
import { RankBadge } from '@/components/RankBadge';
import { Avatar } from '@/components/Avatar';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { NOMS_RANGS, peutAttribuerRang } from '@/lib/permissions';

export default function PageAdmin() {
  const supabase = useSupabase();
  const { user, hasRang, hasPermission } = useUser();
  const [onglet, setOnglet] = useState('rangs');
  const [membres, setMembres] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [stats, setStats] = useState({ actifs: 0, archives: 0, rapports: 0, sanctions: 0 });
  const [erreur, setErreur] = useState('');

  const [modifRang, setModifRang] = useState<any>(null);
  const [nouveauRang, setNouveauRang] = useState<number>(1);
  const [raisonRang, setRaisonRang] = useState('');
  const [enCours, setEnCours] = useState(false);

  const [modalPerm, setModalPerm] = useState<any>(null);
  const [nouvellePerm, setNouvellePerm] = useState('dev');

  async function charger() {
    const { data: m } = await supabase.from('users').select('*').order('rank_level', { ascending: false });
    setMembres(m || []);

    const { data: p } = await supabase.from('user_permissions').select('*, user:user_id(username)').is('deleted_at', null);
    setPermissions(p || []);

    const [a, arch, r, s] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('archives').select('id', { count: 'exact', head: true }),
      supabase.from('reports').select('id', { count: 'exact', head: true }),
      supabase.from('sanctions').select('id', { count: 'exact', head: true }),
    ]);
    setStats({ actifs: a.count || 0, archives: arch.count || 0, rapports: r.count || 0, sanctions: s.count || 0 });
  }

  useEffect(() => { charger(); }, []); // eslint-disable-line

  async function modifierRang() {
    setErreur('');
    if (!modifRang || !raisonRang.trim()) return;
    setEnCours(true);
    try {
      const res = await fetch('/api/rang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: modifRang.id,
          nouveauRang,
          raison: raisonRang,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.erreur || 'erreur');
        return;
      }
      setModifRang(null);
      setRaisonRang('');
      charger();
    } finally {
      setEnCours(false);
    }
  }

  async function ajouterPerm() {
    if (!modalPerm || !user) return;
    await supabase.from('user_permissions').insert({
      user_id: modalPerm.id,
      permission: nouvellePerm,
      granted_by: user.id,
    });
    setModalPerm(null);
    charger();
  }

  async function retirerPerm(permId: string) {
    await supabase.from('user_permissions').update({ deleted_at: new Date().toISOString() }).eq('id', permId);
    charger();
  }

  if (!hasRang(7) && !hasPermission('dev')) {
    return <LayoutApp><AccesRefuse message="Admin Panel réservé aux Co-Leaders (rang ≥ 7)." /></LayoutApp>;
  }

  return (
    <LayoutApp>
      <h1 className="titre-page mb-4">Admin Panel</h1>

      <Tabs
        onglets={[
          { id: 'rangs', label: 'Gestion des rangs' },
          { id: 'permissions', label: 'Permissions' },
          { id: 'vue', label: "Vue d'ensemble" },
        ]}
        actif={onglet}
        onChange={setOnglet}
      />

      {onglet === 'rangs' && (
        <div className="carte p-0">
          <table className="tableau">
            <thead>
              <tr><th>Membre</th><th>Rang actuel</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {membres.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar src={m.avatar_url} nom={m.username} taille={32} />
                      <span>{m.username}</span>
                    </div>
                  </td>
                  <td><RankBadge rang={m.rank_level} taille="sm" /></td>
                  <td>
                    {m.is_active ? (
                      <span className="badge-statut bg-emerald-500/20 text-emerald-300">Actif</span>
                    ) : (
                      <span className="badge-statut bg-red-500/20 text-red-300">Inactif</span>
                    )}
                  </td>
                  <td>
                    {m.id !== user?.id && m.rank_level < (user?.rank_level || 0) && m.is_active && (
                      <button
                        onClick={() => {
                          setModifRang(m);
                          setNouveauRang(m.rank_level);
                          setErreur('');
                        }}
                        className="text-xs text-bleu-clair hover:underline"
                      >
                        Modifier rang
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onglet === 'permissions' && (
        <div className="space-y-3">
          {(user?.rank_level === 9 || hasPermission('dev')) ? (
            <>
              <div className="carte">
                <h3 className="titre-section">Permissions actives</h3>
                {permissions.length === 0 ? (
                  <p className="text-texte-gris text-sm">Aucune permission spéciale attribuée</p>
                ) : (
                  <ul className="space-y-2">
                    {permissions.map((p) => (
                      <li key={p.id} className="flex items-center justify-between bg-fond-clair p-2 rounded">
                        <div>
                          <span className="text-white">{p.user?.username}</span>
                          <span className="text-or ml-2">{p.permission}</span>
                        </div>
                        <button onClick={() => retirerPerm(p.id)} className="text-red-400 text-xs hover:underline">
                          Retirer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="carte">
                <h3 className="titre-section">Attribuer une permission</h3>
                <div className="flex gap-2 flex-wrap">
                  {membres.filter(m => m.is_active).map((m) => (
                    <button key={m.id} onClick={() => setModalPerm(m)} className="bouton-gris text-xs">
                      {m.username}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <AccesRefuse message="Gestion des permissions réservée au Shériff (9) ou permission 'dev'." />
          )}
        </div>
      )}

      {onglet === 'vue' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="carte text-center">
            <p className="text-3xl font-bold text-emerald-400">{stats.actifs}</p>
            <p className="text-xs text-texte-gris mt-1">Membres actifs</p>
          </div>
          <div className="carte text-center">
            <p className="text-3xl font-bold text-gray-400">{stats.archives}</p>
            <p className="text-xs text-texte-gris mt-1">Archives</p>
          </div>
          <div className="carte text-center">
            <p className="text-3xl font-bold text-bleu-clair">{stats.rapports}</p>
            <p className="text-xs text-texte-gris mt-1">Rapports totaux</p>
          </div>
          <div className="carte text-center">
            <p className="text-3xl font-bold text-red-400">{stats.sanctions}</p>
            <p className="text-xs text-texte-gris mt-1">Sanctions totales</p>
          </div>
        </div>
      )}

      <Modal ouvert={!!modifRang} onFermer={() => { setModifRang(null); setErreur(''); }} titre={`Modifier le rang de ${modifRang?.username}`}>
        {modifRang && (
          <div className="space-y-3">
            <div>
              <label className="label">Ancien rang</label>
              <RankBadge rang={modifRang.rank_level} />
            </div>
            <div>
              <label className="label">Nouveau rang *</label>
              <select value={nouveauRang} onChange={(e) => setNouveauRang(Number(e.target.value))} className="input">
                {Object.entries(NOMS_RANGS)
                  .filter(([lvl]) => peutAttribuerRang(user?.rank_level || 0, Number(lvl)))
                  .sort((a, b) => Number(b[0]) - Number(a[0]))
                  .map(([lvl, nom]) => (
                    <option key={lvl} value={lvl}>{nom}</option>
                  ))}
              </select>
              <p className="text-xs text-texte-gris mt-1">⚠️ Impossible d'attribuer un rang ≥ au tien.</p>
            </div>
            <div>
              <label className="label">Raison * (min 3 caractères)</label>
              <textarea value={raisonRang} onChange={(e) => setRaisonRang(e.target.value)} className="input" rows={3} />
            </div>
            {erreur && <p className="text-sm text-red-400">{erreur}</p>}
            <button onClick={modifierRang} className="bouton-or w-full" disabled={!raisonRang.trim() || enCours}>
              {enCours ? 'En cours...' : 'Confirmer'}
            </button>
          </div>
        )}
      </Modal>

      <Modal ouvert={!!modalPerm} onFermer={() => setModalPerm(null)} titre={`Permission pour ${modalPerm?.username}`}>
        <div className="space-y-3">
          <div>
            <label className="label">Permission</label>
            <select value={nouvellePerm} onChange={(e) => setNouvellePerm(e.target.value)} className="input">
              <option value="dev">dev</option>
              <option value="admin_panel">admin_panel</option>
              <option value="super_admin">super_admin</option>
            </select>
          </div>
          <button onClick={ajouterPerm} className="bouton-or w-full">Attribuer</button>
        </div>
      </Modal>
    </LayoutApp>
  );
}
