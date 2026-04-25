'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, MessageSquare, ShieldAlert, Inbox, Send } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { AccesRefuse } from '@/components/AccesRefuse';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateTime, dateCourte } from '@/lib/utils';
import { estOpSecondMin, estColeadMin, NOMS_RANGS, couleurRang } from '@/lib/permissions';

type Ticket = {
  id: string;
  type: 'retour' | 'sanction';
  titre: string;
  contenu: string;
  auteur_id: string;
  cible_user_id: string | null;
  statut: 'ouvert' | 'en_cours' | 'applique' | 'rejete' | 'resolu' | 'ferme';
  priorite: 'basse' | 'normale' | 'haute' | 'critique';
  traite_par: string | null;
  traite_le: string | null;
  sanction_appliquee_id: string | null;
  created_at: string;
  auteur?: { id: string; username: string; surnom: string | null; avatar_url: string | null; rank_level: number };
  cible?: { id: string; username: string; surnom: string | null; avatar_url: string | null; rank_level: number };
  traiteur?: { username: string; surnom: string | null };
};

type Message = {
  id: string;
  ticket_id: string;
  auteur_id: string;
  contenu: string;
  interne: boolean;
  created_at: string;
  auteur?: { username: string; surnom: string | null; avatar_url: string | null; rank_level: number };
};

const STATUT_LABELS: Record<string, { label: string; classe: string }> = {
  ouvert: { label: 'Ouvert', classe: 'bg-blue-500/20 text-blue-300' },
  en_cours: { label: 'En cours', classe: 'bg-amber-500/20 text-amber-300' },
  applique: { label: 'Appliqué', classe: 'bg-emerald-500/20 text-emerald-300' },
  rejete: { label: 'Rejeté', classe: 'bg-red-500/20 text-red-300' },
  resolu: { label: 'Résolu', classe: 'bg-emerald-500/20 text-emerald-300' },
  ferme: { label: 'Fermé', classe: 'bg-gray-500/20 text-gray-300' },
};

const PRIORITE_LABELS: Record<string, { label: string; classe: string }> = {
  basse: { label: 'Basse', classe: 'bg-gray-500/20 text-gray-300' },
  normale: { label: 'Normale', classe: 'bg-blue-500/20 text-blue-300' },
  haute: { label: 'Haute', classe: 'bg-amber-500/20 text-amber-300' },
  critique: { label: 'Critique', classe: 'bg-red-500/20 text-red-300' },
};

const TYPES_SANCTION = [
  { id: 'avertissement', label: 'Avertissement' },
  { id: 'blame', label: 'Blâme' },
  { id: 'suspension', label: 'Suspension' },
];

export default function PageRetourSanction() {
  const supabase = useSupabase();
  const { user, rang } = useUser();
  const peutCreer = estOpSecondMin(rang);
  const peutAppliquer = estColeadMin(rang);

  const [onglet, setOnglet] = useState<'mes' | 'a_traiter' | 'tous'>('mes');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [membres, setMembres] = useState<any[]>([]);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reponse, setReponse] = useState('');
  const [interne, setInterne] = useState(false);

  // Modal création
  const [modalCreer, setModalCreer] = useState(false);
  const [form, setForm] = useState({
    type: 'retour' as 'retour' | 'sanction',
    titre: '',
    contenu: '',
    cible_user_id: '',
    priorite: 'normale' as Ticket['priorite'],
  });

  // Modal application sanction
  const [modalAppliquer, setModalAppliquer] = useState<Ticket | null>(null);
  const [sanctionForm, setSanctionForm] = useState({
    type: 'avertissement',
    raison: '',
    duree_jours: '' as string,
  });

  async function charger() {
    if (!user) return;
    let q = supabase
      .from('helpdesk_tickets')
      .select(`
        *,
        auteur:auteur_id(id, username, surnom, avatar_url, rank_level),
        cible:cible_user_id(id, username, surnom, avatar_url, rank_level),
        traiteur:traite_par(username, surnom)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (onglet === 'mes') q = q.eq('auteur_id', user.id);
    else if (onglet === 'a_traiter') q = q.in('statut', ['ouvert', 'en_cours']);

    const { data } = await q;
    setTickets(data || []);

    if (peutCreer) {
      const { data: m } = await supabase
        .from('users')
        .select('id, username, surnom, rank_level')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('rank_level', { ascending: false });
      setMembres(m || []);
    }
  }

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('helpdesk')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'helpdesk_tickets' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet, user?.id]);

  async function ouvrirDetail(t: Ticket) {
    setDetail(t);
    const { data } = await supabase
      .from('helpdesk_messages')
      .select('*, auteur:auteur_id(username, surnom, avatar_url, rank_level)')
      .eq('ticket_id', t.id)
      .is('deleted_at', null)
      .order('created_at');
    setMessages(data || []);
  }

  async function creerTicket() {
    if (!user || !form.titre || !form.contenu) return;
    if (form.type === 'sanction' && !form.cible_user_id) return;
    await supabase.from('helpdesk_tickets').insert({
      type: form.type,
      titre: form.titre,
      contenu: form.contenu,
      auteur_id: user.id,
      cible_user_id: form.type === 'sanction' ? form.cible_user_id : null,
      priorite: form.priorite,
      statut: 'ouvert',
    });
    setForm({ type: 'retour', titre: '', contenu: '', cible_user_id: '', priorite: 'normale' });
    setModalCreer(false);
  }

  async function envoyerMessage() {
    if (!user || !detail || !reponse.trim()) return;
    await supabase.from('helpdesk_messages').insert({
      ticket_id: detail.id,
      auteur_id: user.id,
      contenu: reponse,
      interne: interne && peutAppliquer,
    });
    // Si pas en cours et le traiteur répond → en cours
    if (detail.statut === 'ouvert' && peutAppliquer) {
      await supabase.from('helpdesk_tickets').update({
        statut: 'en_cours',
        traite_par: user.id,
      }).eq('id', detail.id);
    }
    setReponse('');
    setInterne(false);
    ouvrirDetail(detail);
  }

  async function changerStatut(t: Ticket, statut: Ticket['statut']) {
    if (!user) return;
    await supabase.from('helpdesk_tickets').update({
      statut,
      traite_par: user.id,
      traite_le: new Date().toISOString(),
    }).eq('id', t.id);
    if (detail?.id === t.id) ouvrirDetail({ ...t, statut });
  }

  async function appliquerSanction() {
    if (!user || !modalAppliquer || !modalAppliquer.cible_user_id) return;
    if (!sanctionForm.raison.trim()) return;

    // Crée la sanction
    const payload: any = {
      user_id: modalAppliquer.cible_user_id,
      type: sanctionForm.type,
      raison: sanctionForm.raison,
      createur_id: user.id,
      is_active: true,
    };
    if (sanctionForm.type === 'suspension' && sanctionForm.duree_jours) {
      payload.duree_jours = Number(sanctionForm.duree_jours);
    }
    const { data: sanction } = await supabase.from('sanctions').insert(payload).select().single();

    await supabase.from('helpdesk_tickets').update({
      statut: 'applique',
      traite_par: user.id,
      traite_le: new Date().toISOString(),
      sanction_appliquee_id: sanction?.id || null,
    }).eq('id', modalAppliquer.id);

    setSanctionForm({ type: 'avertissement', raison: '', duree_jours: '' });
    setModalAppliquer(null);
  }

  const onglets = [
    { id: 'mes', label: 'Mes tickets', icone: Inbox },
    ...(peutAppliquer ? [{ id: 'a_traiter', label: 'À traiter', icone: ShieldAlert }] : []),
    { id: 'tous', label: 'Tous', icone: MessageSquare },
  ];

  if (!peutCreer) {
    return <LayoutApp><AccesRefuse message="Section réservée aux opérateurs second et plus (rang ≥ 5)." /></LayoutApp>;
  }

  return (
    <LayoutApp>
      <div className="flex items-center justify-between mb-4">
        <h1 className="titre-page">Retour &amp; Sanction</h1>
        <button onClick={() => setModalCreer(true)} className="bouton-bleu flex items-center gap-2">
          <Plus size={16} /> Nouveau ticket
        </button>
      </div>

      <Tabs onglets={onglets} actif={onglet} onChange={(id) => setOnglet(id as any)} />

      <div className="space-y-2">
        {tickets.length === 0 ? (
          <p className="text-center text-texte-gris py-12">Aucun ticket.</p>
        ) : (
          tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => ouvrirDetail(t)}
              className="carte !p-3 block w-full text-left hover:border-or/40 transition-colors"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
                      t.type === 'sanction' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {t.type === 'sanction' ? 'Sanction' : 'Retour'}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${PRIORITE_LABELS[t.priorite].classe}`}>
                      {PRIORITE_LABELS[t.priorite].label}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${STATUT_LABELS[t.statut].classe}`}>
                      {STATUT_LABELS[t.statut].label}
                    </span>
                  </div>
                  <p className="text-white font-semibold mt-1">{t.titre}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {t.auteur && (
                      <span className="text-xs text-texte-gris flex items-center gap-1">
                        <Avatar src={t.auteur.avatar_url} nom={t.auteur.username} taille={16} />
                        {t.auteur.surnom || t.auteur.username}
                      </span>
                    )}
                    {t.cible && (
                      <span className="text-xs text-texte-gris">
                        → cible : <span className="text-red-300">{t.cible.surnom || t.cible.username}</span>
                      </span>
                    )}
                    <span className="text-xs text-texte-gris">· {dateCourte(t.created_at)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Modal création */}
      <Modal ouvert={modalCreer} onFermer={() => setModalCreer(false)} titre="Nouveau ticket" taille="md">
        <div className="space-y-3">
          <div>
            <label className="label">Type *</label>
            <div className="flex gap-2">
              {(['retour', 'sanction'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 px-3 py-2 rounded font-medium text-sm ${
                    form.type === t ? (t === 'sanction' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300') : 'bg-fond-clair text-texte-gris'
                  }`}
                >
                  {t === 'sanction' ? 'Demande de sanction' : 'Retour / Feedback'}
                </button>
              ))}
            </div>
          </div>
          {form.type === 'sanction' && (
            <div>
              <label className="label">Membre ciblé *</label>
              <select
                value={form.cible_user_id}
                onChange={(e) => setForm({ ...form, cible_user_id: e.target.value })}
                className="input"
              >
                <option value="">Sélectionner…</option>
                {membres.filter((m: any) => m.id !== user?.id).map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.surnom || m.username} — {NOMS_RANGS[m.rank_level]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Titre *</label>
            <input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Description *</label>
            <textarea value={form.contenu} onChange={(e) => setForm({ ...form, contenu: e.target.value })} className="input" rows={5} />
          </div>
          <div>
            <label className="label">Priorité</label>
            <select value={form.priorite} onChange={(e) => setForm({ ...form, priorite: e.target.value as any })} className="input">
              <option value="basse">Basse</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
              <option value="critique">Critique</option>
            </select>
          </div>
          <button
            onClick={creerTicket}
            className="bouton-bleu w-full"
            disabled={!form.titre || !form.contenu || (form.type === 'sanction' && !form.cible_user_id)}
          >
            Créer le ticket
          </button>
        </div>
      </Modal>

      {/* Modal détail */}
      <Modal
        ouvert={!!detail}
        onFermer={() => { setDetail(null); setMessages([]); }}
        titre={detail?.titre}
        taille="lg"
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
                detail.type === 'sanction' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
              }`}>
                {detail.type === 'sanction' ? 'Sanction' : 'Retour'}
              </span>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${PRIORITE_LABELS[detail.priorite].classe}`}>
                {PRIORITE_LABELS[detail.priorite].label}
              </span>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${STATUT_LABELS[detail.statut].classe}`}>
                {STATUT_LABELS[detail.statut].label}
              </span>
            </div>

            <div className="bg-fond-clair p-3 rounded">
              <div className="flex items-center gap-2 mb-2">
                {detail.auteur && <Avatar src={detail.auteur.avatar_url} nom={detail.auteur.username} taille={28} />}
                <div>
                  <p className="text-white text-sm font-medium">
                    {detail.auteur?.surnom || detail.auteur?.username}
                  </p>
                  <p className="text-[10px] text-texte-gris">{dateTime(detail.created_at)}</p>
                </div>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{detail.contenu}</p>
              {detail.cible && (
                <p className="text-xs text-texte-gris mt-2 pt-2 border-t border-gris-bordure">
                  → Cible : <span className="text-red-300">{detail.cible.surnom || detail.cible.username}</span>
                  {' '}({NOMS_RANGS[detail.cible.rank_level]})
                </p>
              )}
            </div>

            {/* Messages */}
            <div className="space-y-2">
              {messages.length > 0 && (
                <h3 className="text-xs uppercase tracking-wider text-texte-gris">Échanges ({messages.length})</h3>
              )}
              {messages.map((m) => {
                const couleur = m.auteur ? couleurRang(m.auteur.rank_level) : '#6B7280';
                return (
                  <div
                    key={m.id}
                    className={`p-2 rounded text-sm ${m.interne ? 'bg-amber-900/20 border border-amber-700/30' : 'bg-fond-clair'}`}
                    style={{ borderLeft: `3px solid ${couleur}` }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        {m.auteur && <Avatar src={m.auteur.avatar_url} nom={m.auteur.username} taille={20} />}
                        <span className="text-xs text-white font-medium">
                          {m.auteur?.surnom || m.auteur?.username}
                        </span>
                        {m.interne && (
                          <span className="text-[9px] uppercase tracking-wider bg-amber-700/30 text-amber-200 px-1.5 rounded">
                            Interne
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-texte-gris">{dateTime(m.created_at)}</span>
                    </div>
                    <p className="text-gray-200 whitespace-pre-wrap">{m.contenu}</p>
                  </div>
                );
              })}
            </div>

            {/* Actions selon rôle */}
            {(detail.statut === 'ouvert' || detail.statut === 'en_cours') && (
              <div className="space-y-2 pt-3 border-t border-gris-bordure">
                <textarea
                  value={reponse}
                  onChange={(e) => setReponse(e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="Votre réponse…"
                />
                {peutAppliquer && (
                  <label className="flex items-center gap-2 text-xs text-texte-gris">
                    <input type="checkbox" checked={interne} onChange={(e) => setInterne(e.target.checked)} />
                    Note interne (visible staff uniquement)
                  </label>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={envoyerMessage} className="bouton-bleu flex items-center gap-2" disabled={!reponse.trim()}>
                    <Send size={14} /> Envoyer
                  </button>
                  {peutAppliquer && detail.type === 'sanction' && detail.cible_user_id && detail.statut !== 'applique' && (
                    <button onClick={() => setModalAppliquer(detail)} className="bouton-rouge">
                      Appliquer la sanction
                    </button>
                  )}
                  {peutAppliquer && (
                    <>
                      <button onClick={() => changerStatut(detail, 'rejete')} className="bouton-gris">Rejeter</button>
                      <button onClick={() => changerStatut(detail, 'resolu')} className="bouton-vert">Résoudre</button>
                    </>
                  )}
                </div>
              </div>
            )}

            {detail.traiteur && detail.traite_le && (
              <p className="text-xs text-texte-gris">
                Traité par {detail.traiteur.surnom || detail.traiteur.username} le {dateTime(detail.traite_le)}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Modal application sanction */}
      <Modal
        ouvert={!!modalAppliquer}
        onFermer={() => setModalAppliquer(null)}
        titre={modalAppliquer ? `Appliquer une sanction — ${modalAppliquer.cible?.surnom || modalAppliquer.cible?.username}` : ''}
        taille="md"
      >
        <div className="space-y-3">
          <div>
            <label className="label">Type *</label>
            <select
              value={sanctionForm.type}
              onChange={(e) => setSanctionForm({ ...sanctionForm, type: e.target.value })}
              className="input"
            >
              {TYPES_SANCTION.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          {sanctionForm.type === 'suspension' && (
            <div>
              <label className="label">Durée (jours) *</label>
              <input
                type="number"
                min={1}
                max={365}
                value={sanctionForm.duree_jours}
                onChange={(e) => setSanctionForm({ ...sanctionForm, duree_jours: e.target.value })}
                className="input"
              />
            </div>
          )}
          <div>
            <label className="label">Raison *</label>
            <textarea
              value={sanctionForm.raison}
              onChange={(e) => setSanctionForm({ ...sanctionForm, raison: e.target.value })}
              className="input"
              rows={4}
            />
          </div>
          <button
            onClick={appliquerSanction}
            className="bouton-rouge w-full"
            disabled={!sanctionForm.raison.trim() || (sanctionForm.type === 'suspension' && !sanctionForm.duree_jours)}
          >
            Appliquer la sanction
          </button>
        </div>
      </Modal>
    </LayoutApp>
  );
}
