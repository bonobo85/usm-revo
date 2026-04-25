'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, FileText, Search, ChevronDown, Eye } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { Avatar } from '@/components/Avatar';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte } from '@/lib/utils';
import { estOpSecondMin } from '@/lib/permissions';

type Champ = { nom: string; label: string; type: 'text' | 'textarea' | 'date' | 'datetime' | 'number'; required?: boolean };
type Section = { titre: string; champs: Champ[] };
type Template = { id: string; code: string; nom: string; description: string | null; sections: Section[] };

type Rapport = {
  id: string;
  type: string;
  template_code: string | null;
  titre: string;
  contenu: any;
  sections: Section[] | null;
  auteur_id: string;
  statut: 'draft' | 'submitted' | 'validated' | 'rejected';
  publie: boolean;
  publie_par: string | null;
  publie_le: string | null;
  created_at: string;
  auteur?: { username: string; surnom: string | null; avatar_url: string | null };
};

const STATUT_LABELS: Record<string, { label: string; classe: string }> = {
  draft: { label: 'Brouillon', classe: 'bg-gray-500/20 text-gray-300' },
  submitted: { label: 'Soumis', classe: 'bg-yellow-500/20 text-yellow-300' },
  validated: { label: 'Publié', classe: 'bg-emerald-500/20 text-emerald-300' },
  rejected: { label: 'Rejeté', classe: 'bg-red-500/20 text-red-300' },
};

export default function PageRapports() {
  const supabase = useSupabase();
  const { user, rang } = useUser();
  const peutPublier = estOpSecondMin(rang);

  const [onglet, setOnglet] = useState<'mes' | 'a_publier' | 'publies'>('mes');
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recherche, setRecherche] = useState('');
  const [filtreType, setFiltreType] = useState('');

  // Modal nouveau
  const [modalChoixType, setModalChoixType] = useState(false);
  const [modalRedaction, setModalRedaction] = useState<{ template: Template; brouillon?: Rapport } | null>(null);

  async function chargerTemplates() {
    const { data } = await supabase
      .from('report_templates')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('code');
    setTemplates(data || []);
  }

  async function charger() {
    if (!user) return;
    let q = supabase
      .from('reports')
      .select('*, auteur:auteur_id(username, surnom, avatar_url)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (onglet === 'mes') q = q.eq('auteur_id', user.id);
    else if (onglet === 'a_publier') q = q.eq('statut', 'submitted').eq('publie', false);
    else if (onglet === 'publies') q = q.eq('publie', true);

    const { data } = await q;
    setRapports(data || []);
  }

  useEffect(() => { chargerTemplates(); }, []); // eslint-disable-line

  useEffect(() => {
    charger();
    const ch = supabase
      .channel('rapports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => charger())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet, user?.id]);

  const filtres = useMemo(() => {
    const rq = recherche.trim().toLowerCase();
    return rapports.filter((r) => {
      if (filtreType && r.type !== filtreType) return false;
      if (!rq) return true;
      return (
        r.titre.toLowerCase().includes(rq) ||
        (r.auteur?.surnom || r.auteur?.username || '').toLowerCase().includes(rq)
      );
    });
  }, [rapports, recherche, filtreType]);

  async function publier(r: Rapport) {
    if (!user || !peutPublier) return;
    await supabase.from('reports').update({
      publie: true,
      publie_par: user.id,
      publie_le: new Date().toISOString(),
      statut: 'validated',
    }).eq('id', r.id);
  }

  async function rejeter(r: Rapport, raison: string) {
    if (!user || !peutPublier) return;
    await supabase.from('reports').update({
      statut: 'rejected',
      validateur_id: user.id,
      date_validation: new Date().toISOString(),
      commentaire_validation: raison,
    }).eq('id', r.id);
  }

  const onglets = [
    { id: 'mes', label: 'Mes rapports', icone: FileText },
    ...(peutPublier ? [{ id: 'a_publier', label: 'À publier', icone: FileText }] : []),
    { id: 'publies', label: 'Publiés', icone: FileText },
  ];

  return (
    <LayoutApp>
      <div className="flex items-center justify-between mb-4">
        <h1 className="titre-page">Rapports</h1>
        <button onClick={() => setModalChoixType(true)} className="bouton-bleu flex items-center gap-2">
          <Plus size={16} /> Nouveau rapport
        </button>
      </div>

      <Tabs onglets={onglets} actif={onglet} onChange={(id) => setOnglet(id as any)} />

      {/* Search + filtre type */}
      <div className="carte mb-4 !p-3">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-texte-gris" size={18} />
            <input
              type="text"
              placeholder="Rechercher par titre ou auteur…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="relative">
            <select
              value={filtreType}
              onChange={(e) => setFiltreType(e.target.value)}
              className="input pr-8 appearance-none min-w-48"
            >
              <option value="">Tous les types</option>
              {templates.map((t) => <option key={t.code} value={t.code}>{t.nom}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-texte-gris pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtres.length === 0 ? (
          <p className="text-center text-texte-gris py-12">Aucun rapport.</p>
        ) : (
          filtres.map((r) => (
            <CarteRapport
              key={r.id}
              r={r}
              templateNom={templates.find((t) => t.code === r.template_code)?.nom || r.type}
              peutPublier={peutPublier}
              estMien={r.auteur_id === user?.id}
              onPublier={() => publier(r)}
              onRejeter={() => {
                const raison = window.prompt('Raison du rejet :');
                if (raison && raison.trim()) rejeter(r, raison.trim());
              }}
              onModifier={() => {
                const tmpl = templates.find((t) => t.code === r.template_code);
                if (tmpl) setModalRedaction({ template: tmpl, brouillon: r });
              }}
            />
          ))
        )}
      </div>

      {/* Modal choix type */}
      <Modal ouvert={modalChoixType} onFermer={() => setModalChoixType(false)} titre="Choisir un type de rapport" taille="md">
        <div className="space-y-2">
          {templates.map((t) => (
            <button
              key={t.code}
              onClick={() => { setModalChoixType(false); setModalRedaction({ template: t }); }}
              className="w-full text-left p-3 rounded border border-gris-bordure hover:border-or hover:bg-fond-clair transition-colors"
            >
              <p className="text-white font-medium">{t.nom}</p>
              {t.description && <p className="text-xs text-texte-gris mt-1">{t.description}</p>}
            </button>
          ))}
        </div>
      </Modal>

      {/* Modal rédaction */}
      {modalRedaction && (
        <ModalRedaction
          template={modalRedaction.template}
          brouillon={modalRedaction.brouillon}
          onFermer={() => setModalRedaction(null)}
          onSauvegarde={() => { setModalRedaction(null); charger(); }}
        />
      )}
    </LayoutApp>
  );
}

// =====================================================
// Carte rapport (liste)
// =====================================================
function CarteRapport({
  r, templateNom, peutPublier, estMien, onPublier, onRejeter, onModifier,
}: {
  r: Rapport;
  templateNom: string;
  peutPublier: boolean;
  estMien: boolean;
  onPublier: () => void;
  onRejeter: () => void;
  onModifier: () => void;
}) {
  const statut = STATUT_LABELS[r.statut] || STATUT_LABELS.draft;

  return (
    <div className="carte !p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/rapports/${r.id}`} className="text-white font-semibold hover:text-or transition-colors">
              {r.titre}
            </Link>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-fond-clair text-texte-gris">
              {templateNom}
            </span>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${statut.classe}`}>
              {r.publie ? 'Publié' : statut.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {r.auteur && <Avatar src={r.auteur.avatar_url} nom={r.auteur.username} taille={20} />}
            <p className="text-xs text-texte-gris">
              {r.auteur && (r.auteur.surnom || r.auteur.username)} · {dateCourte(r.created_at)}
            </p>
          </div>
        </div>

        <div className="flex gap-1 flex-wrap">
          <Link href={`/rapports/${r.id}`} className="bouton-gris text-xs px-2 py-1 flex items-center gap-1">
            <Eye size={12} /> Fiche
          </Link>
          {estMien && r.statut !== 'validated' && (
            <button onClick={onModifier} className="bouton-bleu text-xs px-2 py-1">Modifier</button>
          )}
          {peutPublier && r.statut === 'submitted' && !r.publie && (
            <>
              <button onClick={onPublier} className="bouton-or text-xs px-2 py-1">Publier</button>
              <button onClick={onRejeter} className="bouton-rouge text-xs px-2 py-1">Rejeter</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Modal rédaction (sections dynamiques)
// =====================================================
function ModalRedaction({
  template, brouillon, onFermer, onSauvegarde,
}: {
  template: Template;
  brouillon?: Rapport;
  onFermer: () => void;
  onSauvegarde: () => void;
}) {
  const supabase = useSupabase();
  const { user } = useUser();
  const [titre, setTitre] = useState(brouillon?.titre || '');
  const [valeurs, setValeurs] = useState<Record<string, any>>(brouillon?.contenu || {});
  // Pour le mode "custom" : sections libres
  const [sectionsLibres, setSectionsLibres] = useState<{ titre: string; contenu: string }[]>(
    brouillon?.sections && Array.isArray(brouillon.sections)
      ? (brouillon.sections as any)
      : (template.code === 'custom' ? [{ titre: '', contenu: '' }] : [])
  );

  const estCustom = template.code === 'custom';

  async function sauvegarder(statut: 'draft' | 'submitted') {
    if (!user || !titre) return;
    const payload: any = {
      type: template.code,
      template_code: template.code,
      titre,
      contenu: estCustom ? {} : valeurs,
      sections: estCustom ? sectionsLibres : template.sections,
      auteur_id: user.id,
      statut,
    };
    if (brouillon) {
      await supabase.from('reports').update(payload).eq('id', brouillon.id);
    } else {
      await supabase.from('reports').insert(payload);
    }
    onSauvegarde();
  }

  return (
    <Modal ouvert={true} onFermer={onFermer} titre={`${brouillon ? 'Modifier' : 'Nouveau'} — ${template.nom}`} taille="xl">
      <div className="space-y-4">
        <div>
          <label className="label">Titre du rapport *</label>
          <input value={titre} onChange={(e) => setTitre(e.target.value)} className="input" placeholder="Titre court et explicite" />
        </div>

        {/* Sections dynamiques (templates fixes) */}
        {!estCustom && template.sections.map((sec) => (
          <div key={sec.titre} className="bg-fond-clair p-3 rounded border border-gris-bordure">
            <h3 className="text-sm font-semibold text-or mb-2">{sec.titre}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sec.champs.map((c) => (
                <ChampSaisie key={c.nom} champ={c} valeur={valeurs[c.nom]} onChange={(v) => setValeurs({ ...valeurs, [c.nom]: v })} />
              ))}
            </div>
          </div>
        ))}

        {/* Sections libres (custom) */}
        {estCustom && (
          <div className="space-y-2">
            {sectionsLibres.map((s, i) => (
              <div key={i} className="bg-fond-clair p-3 rounded border border-gris-bordure space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={s.titre}
                    onChange={(e) => {
                      const next = [...sectionsLibres];
                      next[i] = { ...next[i], titre: e.target.value };
                      setSectionsLibres(next);
                    }}
                    className="input"
                    placeholder="Titre de la section"
                  />
                  <button
                    type="button"
                    onClick={() => setSectionsLibres(sectionsLibres.filter((_, j) => j !== i))}
                    className="bouton-rouge text-xs px-2 py-1"
                  >
                    Suppr.
                  </button>
                </div>
                <textarea
                  value={s.contenu}
                  onChange={(e) => {
                    const next = [...sectionsLibres];
                    next[i] = { ...next[i], contenu: e.target.value };
                    setSectionsLibres(next);
                  }}
                  className="input"
                  rows={4}
                  placeholder="Contenu…"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSectionsLibres([...sectionsLibres, { titre: '', contenu: '' }])}
              className="bouton-gris text-xs"
            >
              + Ajouter une section
            </button>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-gris-bordure">
          <button onClick={() => sauvegarder('draft')} className="bouton-gris flex-1" disabled={!titre}>
            Sauvegarder brouillon
          </button>
          <button onClick={() => sauvegarder('submitted')} className="bouton-bleu flex-1" disabled={!titre}>
            Soumettre pour publication
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ChampSaisie({
  champ, valeur, onChange,
}: {
  champ: Champ;
  valeur: any;
  onChange: (v: any) => void;
}) {
  const valStr = valeur ?? '';
  const wide = champ.type === 'textarea';

  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="label">
        {champ.label}{champ.required && <span className="text-red-400"> *</span>}
      </label>
      {champ.type === 'textarea' ? (
        <textarea value={valStr} onChange={(e) => onChange(e.target.value)} className="input" rows={3} />
      ) : champ.type === 'date' ? (
        <input type="date" value={valStr} onChange={(e) => onChange(e.target.value)} className="input" />
      ) : champ.type === 'datetime' ? (
        <input type="datetime-local" value={valStr} onChange={(e) => onChange(e.target.value)} className="input" />
      ) : champ.type === 'number' ? (
        <input type="number" value={valStr} onChange={(e) => onChange(e.target.value)} className="input" />
      ) : (
        <input type="text" value={valStr} onChange={(e) => onChange(e.target.value)} className="input" />
      )}
    </div>
  );
}
