'use client';

import { useEffect, useState } from 'react';
import { Download, Upload, FileText } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Tabs } from '@/components/Tabs';
import { Modal } from '@/components/Modal';
import { PermissionGate } from '@/components/PermissionGate';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte } from '@/lib/utils';
import { NOMS_RANGS } from '@/lib/permissions';

const CATEGORIES = [
  { id: 'officiel', label: 'Officiels' },
  { id: 'template', label: 'Templates' },
  { id: 'formation', label: 'Formation' },
];

export default function PageDocuments() {
  const supabase = useSupabase();
  const { user, hasRang } = useUser();
  const [categorie, setCategorie] = useState('officiel');
  const [docs, setDocs] = useState<any[]>([]);
  const [modal, setModal] = useState(false);

  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [cat, setCat] = useState('officiel');
  const [rangMin, setRangMin] = useState(1);
  const [fichier, setFichier] = useState<File | null>(null);

  async function charger() {
    const { data } = await supabase
      .from('documents')
      .select('*, uploader:upload_par(username)')
      .eq('categorie', categorie)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setDocs(data || []);
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorie]);

  async function uploader() {
    if (!user || !fichier || !titre) return;
    const form = new FormData();
    form.append('fichier', fichier);
    form.append('titre', titre);
    form.append('description', description);
    form.append('categorie', cat);
    form.append('rangMin', String(rangMin));
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (res.ok) {
      setTitre(''); setDescription(''); setFichier(null); setRangMin(1);
      setModal(false);
      charger();
    }
  }

  return (
    <LayoutApp>
      <div className="flex items-center justify-between mb-4">
        <h1 className="titre-page">Documents</h1>
        <PermissionGate minRang={6}>
          <button onClick={() => setModal(true)} className="bouton-bleu flex items-center gap-2">
            <Upload size={16} /> Uploader
          </button>
        </PermissionGate>
      </div>

      <Tabs onglets={CATEGORIES} actif={categorie} onChange={setCategorie} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {docs.map((d) => (
          <div key={d.id} className="carte">
            <div className="flex items-start gap-3">
              <FileText size={32} className="text-bleu-clair shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{d.titre}</p>
                {d.description && <p className="text-xs text-texte-gris mt-1 line-clamp-2">{d.description}</p>}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-texte-gris">{dateCourte(d.created_at)}</span>
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-bleu-clair hover:text-bleu text-xs flex items-center gap-1">
                    <Download size={14} /> Télécharger
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
        {docs.length === 0 && <p className="text-center text-texte-gris py-8 col-span-3">Aucun document</p>}
      </div>

      <Modal ouvert={modal} onFermer={() => setModal(false)} titre="Uploader un document">
        <div className="space-y-3">
          <div>
            <label className="label">Titre *</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} />
          </div>
          <div>
            <label className="label">Catégorie *</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Rang minimum</label>
            <select value={rangMin} onChange={(e) => setRangMin(Number(e.target.value))} className="input">
              {Object.entries(NOMS_RANGS).reverse().map(([lvl, nom]) => (
                <option key={lvl} value={lvl}>{nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fichier *</label>
            <input type="file" onChange={(e) => setFichier(e.target.files?.[0] || null)} className="input" />
          </div>
          <button onClick={uploader} className="bouton-bleu w-full" disabled={!titre || !fichier}>
            Uploader
          </button>
        </div>
      </Modal>
    </LayoutApp>
  );
}
