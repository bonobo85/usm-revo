'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, UserMinus, Archive, FileText, FolderOpen, ShieldAlert } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { AccesRefuse } from '@/components/AccesRefuse';
import { Avatar } from '@/components/Avatar';
import { RankBadge } from '@/components/RankBadge';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte, dateTime } from '@/lib/utils';
import { estOperateurMin, estColeadMin, NOMS_RANGS, couleurRang } from '@/lib/permissions';

const RAISON_LABELS: Record<string, { label: string; classe: string }> = {
  demission: { label: 'Démission', classe: 'bg-blue-500/20 text-blue-300' },
  exclusion: { label: 'Exclusion', classe: 'bg-red-500/20 text-red-300' },
  inactivite: { label: 'Inactivité', classe: 'bg-amber-500/20 text-amber-300' },
  autre: { label: 'Autre', classe: 'bg-gray-500/20 text-gray-300' },
};

export default function PageArchives() {
  const supabase = useSupabase();
  const { user, rang } = useUser();
  const peutAcces = estOperateurMin(rang);
  const peutArchiver = estColeadMin(rang);

  const [onglet, setOnglet] = useState<'membres' | 'casier' | 'documents'>('membres');

  // Membres archivés
  const [archives, setArchives] = useState<any[]>([]);
  const [membresActifs, setMembresActifs] = useState<any[]>([]);

  // Casier (sanctions actives + rapports rejetés)
  const [sanctions, setSanctions] = useState<any[]>([]);
  const [rapportsRejetes, setRapportsRejetes] = useState<any[]>([]);

  // Documents archivés
  const [documents, setDocuments] = useState<any[]>([]);

  // Recherche commune
  const [recherche, setRecherche] = useState('');

  // Modal archivage
  const [modalArchiver, setModalArchiver] = useState(false);
  const [cibleId, setCibleId] = useState('');
  const [raison, setRaison] = useState<'demission' | 'exclusion' | 'inactivite' | 'autre'>('demission');
  const [notes, setNotes] = useState('');

  // Modal détail dossier d'un ex-membre
  const [details, setDetails] = useState<any>(null);
  const [dossier, setDossier] = useState<any[]>([]);

  async function charger() {
    const [arch, m, s, rRej, doc] = await Promise.all([
      supabase.from('archives').select('*').is('deleted_at', null).order('date_depart', { ascending: false }),
      supabase.from('users').select('id, username, surnom, rank_level').eq('is_active', true).is('deleted_at', null),
      supabase
        .from('sanctions')
        .select('*, user:user_id(username, surnom, avatar_url, rank_level), createur:createur_id(username, surnom)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('reports')
        .select('*, auteur:auteur_id(username, surnom, avatar_url)')
        .eq('statut', 'rejected')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('documents')
        .select('*, auteur:auteur_id(username, surnom)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ]);
    setArchives(arch.data || []);
    setMembresActifs(m.data || []);
    setSanctions(s.data || []);
    setRapportsRejetes(rRej.data || []);
    setDocuments(doc.data || []);
  }

  useEffect(() => {
    if (!peutAcces) return;
    charger();
    const ch = supabase
      .channel('archives')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'archives' }, () => charger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sanctions' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peutAcces]);

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

  // Filtres
  const archivesFiltres = useMemo(() => {
    if (!recherche) return archives;
    const rq = recherche.toLowerCase();
    return archives.filter((a) => (a.username_final || '').toLowerCase().includes(rq));
  }, [archives, recherche]);

  const sanctionsFiltres = useMemo(() => {
    if (!recherche) return sanctions;
    const rq = recherche.toLowerCase();
    return sanctions.filter((s) =>
      (s.user?.surnom || s.user?.username || '').toLowerCase().includes(rq) ||
      (s.raison || '').toLowerCase().includes(rq)
    );
  }, [sanctions, recherche]);

  const docsFiltres = useMemo(() => {
    if (!recherche) return documents;
    const rq = recherche.toLowerCase();
    return documents.filter((d) =>
      (d.titre || '').toLowerCase().includes(rq) ||
      (d.auteur?.surnom || d.auteur?.username || '').toLowerCase().includes(rq)
    );
  }, [documents, recherche]);

  if (!peutAcces) {
    return <LayoutApp><AccesRefuse message="Archives réservées aux opérateurs (rang ≥ 6)." /></LayoutApp>;
  }

  return (
    <LayoutApp>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="titre-page flex items-center gap-2">
          <Archive size={22} /> Archives
        </h1>
        {peutArchiver && (
          <button onClick={() => setModalArchiver(true)} className="bouton-rouge flex items-center gap-2">
            <UserMinus size={16} /> Archiver un membre
          </button>
        )}
      </div>

      <Tabs
        onglets={[
          { id: 'membres', label: `Membres (${archives.length})`, icone: UserMinus },
          { id: 'casier', label: `Casier (${sanctions.length + rapportsRejetes.length})`, icone: ShieldAlert },
          { id: 'documents', label: `Documents (${documents.length})`, icone: FolderOpen },
        ]}
        actif={onglet}
        onChange={(id) => setOnglet(id as any)}
      />

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-texte-gris" size={18} />
        <input
          type="text"
          placeholder="Rechercher…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* === ONGLET MEMBRES === */}
      {onglet === 'membres' && (
        <div className="space-y-2">
          {archivesFiltres.length === 0 ? (
            <p className="text-center text-texte-gris py-12">Aucun ancien membre.</p>
          ) : (
            archivesFiltres.map((a) => {
              const r = RAISON_LABELS[a.raison] || RAISON_LABELS.autre;
              const couleur = couleurRang(a.rank_final || 1);
              return (
                <button
                  key={a.id}
                  onClick={() => ouvrirDossier(a)}
                  className="carte !p-3 block w-full text-left hover:border-or/40 transition-colors"
                  style={{ borderLeftWidth: 3, borderLeftColor: couleur }}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold">{a.username_final}</p>
                      <p className="text-xs" style={{ color: couleur }}>
                        {NOMS_RANGS[a.rank_final] || 'Inconnu'}
                      </p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${r.classe}`}>
                      {r.label}
                    </span>
                    <span className="text-xs text-texte-gris">{dateCourte(a.date_depart)}</span>
                  </div>
                  {a.notes && <p className="text-sm text-gray-300 mt-2 line-clamp-2">{a.notes}</p>}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* === ONGLET CASIER === */}
      {onglet === 'casier' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-texte-gris mb-2">Sanctions ({sanctionsFiltres.length})</h3>
            <div className="space-y-2">
              {sanctionsFiltres.length === 0 ? (
                <p className="text-sm text-texte-gris">Aucune sanction enregistrée.</p>
              ) : (
                sanctionsFiltres.map((s) => (
                  <div key={s.id} className="carte !p-3 border-l-2 border-l-red-600">
                    <div className="flex items-center gap-3 flex-wrap">
                      {s.user && <Avatar src={s.user.avatar_url} nom={s.user.username} taille={36} />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold">{s.user?.surnom || s.user?.username}</p>
                          <span className="text-[10px] uppercase tracking-wider bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-semibold">
                            {s.type}
                          </span>
                          {s.is_active ? (
                            <span className="text-[10px] uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-semibold">Active</span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-wider bg-gray-500/20 text-gray-300 px-2 py-0.5 rounded font-semibold">Expirée</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300 mt-1">{s.raison}</p>
                        <p className="text-xs text-texte-gris mt-1">
                          {dateCourte(s.created_at)}
                          {s.duree_jours && ` · ${s.duree_jours} jours`}
                          {s.createur && ` · par ${s.createur.surnom || s.createur.username}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider text-texte-gris mb-2">Rapports rejetés ({rapportsRejetes.length})</h3>
            <div className="space-y-2">
              {rapportsRejetes.length === 0 ? (
                <p className="text-sm text-texte-gris">Aucun rapport rejeté.</p>
              ) : (
                rapportsRejetes.map((r) => (
                  <div key={r.id} className="carte !p-3 border-l-2 border-l-amber-600">
                    <div className="flex items-center gap-3 flex-wrap">
                      <FileText size={20} className="text-amber-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{r.titre}</p>
                        <p className="text-xs text-texte-gris">
                          {r.auteur && (r.auteur.surnom || r.auteur.username)} · {dateCourte(r.created_at)}
                        </p>
                        {r.commentaire_validation && (
                          <p className="text-sm text-gray-300 mt-1">{r.commentaire_validation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* === ONGLET DOCUMENTS === */}
      {onglet === 'documents' && (
        <div className="space-y-2">
          {docsFiltres.length === 0 ? (
            <p className="text-center text-texte-gris py-12">Aucun document archivé.</p>
          ) : (
            docsFiltres.map((d) => (
              <div key={d.id} className="carte !p-3 flex items-center gap-3 flex-wrap">
                <FileText size={20} className="text-or" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">{d.titre}</p>
                  <p className="text-xs text-texte-gris">
                    {d.categorie && <span className="capitalize">{d.categorie} · </span>}
                    {d.auteur && (d.auteur.surnom || d.auteur.username)} · {dateCourte(d.created_at)}
                  </p>
                </div>
                {d.url && (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="bouton-gris text-xs px-2 py-1">
                    Ouvrir
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal détail ex-membre */}
      <Modal ouvert={!!details} onFermer={() => setDetails(null)} titre={details?.username_final} taille="lg">
        {details && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-texte-gris">Rang au départ</p>
                <RankBadge rang={details.rank_final} taille="sm" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-texte-gris">Date de départ</p>
                <p className="text-white">{dateCourte(details.date_depart)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-texte-gris">Raison</p>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${RAISON_LABELS[details.raison]?.classe || ''}`}>
                  {RAISON_LABELS[details.raison]?.label || details.raison}
                </span>
              </div>
            </div>
            {details.notes && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-texte-gris mb-1">Notes</p>
                <p className="text-sm text-gray-200 bg-fond-clair p-2 rounded whitespace-pre-wrap">{details.notes}</p>
              </div>
            )}
            <div>
              <h3 className="titre-section">Dossier ({dossier.length})</h3>
              {dossier.length === 0 ? (
                <p className="text-texte-gris text-sm">Aucun enregistrement.</p>
              ) : (
                <ul className="space-y-2">
                  {dossier.map((r) => (
                    <li key={r.id} className="bg-fond-clair p-2 rounded text-sm">
                      <p className="text-xs text-or capitalize">{r.type}</p>
                      <p className="text-[10px] text-texte-gris">{dateTime(r.date_evenement)}</p>
                      <pre className="text-xs overflow-x-auto mt-1 text-gray-200">{JSON.stringify(r.contenu, null, 2)}</pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal archivage */}
      <Modal ouvert={modalArchiver} onFermer={() => setModalArchiver(false)} titre="Archiver un membre" taille="md">
        <div className="space-y-3">
          <div>
            <label className="label">Membre *</label>
            <select value={cibleId} onChange={(e) => setCibleId(e.target.value)} className="input">
              <option value="">Sélectionner…</option>
              {membresActifs.filter((m) => m.id !== user?.id).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.surnom || m.username} — {NOMS_RANGS[m.rank_level]}
                </option>
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
