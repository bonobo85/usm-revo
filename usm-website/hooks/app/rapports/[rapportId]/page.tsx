'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Calendar, User as UserIcon, Stamp } from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { Avatar } from '@/components/Avatar';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateTime } from '@/lib/utils';
import { estOpSecondMin } from '@/lib/permissions';

type Section = { titre: string; champs: { nom: string; label: string; type: string }[] };

const STATUT_LABELS: Record<string, { label: string; classe: string }> = {
  draft: { label: 'Brouillon', classe: 'bg-gray-500/20 text-gray-300' },
  submitted: { label: 'Soumis', classe: 'bg-yellow-500/20 text-yellow-300' },
  validated: { label: 'Publié', classe: 'bg-emerald-500/20 text-emerald-300' },
  rejected: { label: 'Rejeté', classe: 'bg-red-500/20 text-red-300' },
};

export default function PageFicheRapport() {
  const params = useParams();
  const rapportId = params?.rapportId as string;
  const supabase = useSupabase();
  const { user, rang } = useUser();
  const peutPublier = estOpSecondMin(rang);

  const [r, setR] = useState<any>(null);
  const [publicateur, setPublicateur] = useState<any>(null);

  async function charger() {
    const { data } = await supabase
      .from('reports')
      .select('*, auteur:auteur_id(id, username, surnom, avatar_url, rank_level)')
      .eq('id', rapportId)
      .is('deleted_at', null)
      .maybeSingle();
    setR(data);
    if (data?.publie_par) {
      const { data: p } = await supabase
        .from('users')
        .select('username, surnom, avatar_url')
        .eq('id', data.publie_par)
        .maybeSingle();
      setPublicateur(p);
    }
  }

  useEffect(() => {
    if (!rapportId) return;
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rapportId]);

  async function publier() {
    if (!user || !peutPublier || !r) return;
    await supabase.from('reports').update({
      publie: true,
      publie_par: user.id,
      publie_le: new Date().toISOString(),
      statut: 'validated',
    }).eq('id', r.id);
    charger();
  }

  if (!r) {
    return (
      <LayoutApp>
        <Link href="/rapports" className="text-bleu-clair hover:underline text-sm flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Retour
        </Link>
        <p className="text-texte-gris">Rapport introuvable.</p>
      </LayoutApp>
    );
  }

  const statut = STATUT_LABELS[r.statut] || STATUT_LABELS.draft;
  const sections: Section[] = Array.isArray(r.sections) ? r.sections : [];
  const estCustom = r.template_code === 'custom';
  const contenu = r.contenu || {};

  return (
    <LayoutApp>
      <Link href="/rapports" className="text-bleu-clair hover:underline text-sm flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Retour aux rapports
      </Link>

      {/* Entête fiche */}
      <div className="carte mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-or uppercase tracking-wider mb-1">
              <FileText size={12} />
              <span>Rapport — {r.template_code || r.type}</span>
            </div>
            <h1 className="titre-page mb-2">{r.titre}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-texte-gris">
              {r.auteur && (
                <span className="flex items-center gap-1">
                  <UserIcon size={14} /> {r.auteur.surnom || r.auteur.username}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={14} /> {dateTime(r.created_at)}
              </span>
            </div>
          </div>
          <span className={`text-xs uppercase tracking-wider px-3 py-1 rounded font-semibold ${
            r.publie ? 'bg-emerald-500/20 text-emerald-300' : statut.classe
          }`}>
            {r.publie ? 'Publié' : statut.label}
          </span>
        </div>

        {/* Bandeau publication */}
        {r.publie && r.publie_le && (
          <div className="mt-4 pt-3 border-t border-gris-bordure flex items-center gap-2 text-xs text-texte-gris">
            <Stamp size={12} className="text-or" />
            Publié le {dateTime(r.publie_le)}
            {publicateur && <span> par {publicateur.surnom || publicateur.username}</span>}
          </div>
        )}

        {peutPublier && r.statut === 'submitted' && !r.publie && (
          <div className="mt-4 pt-3 border-t border-gris-bordure">
            <button onClick={publier} className="bouton-or">Publier ce rapport</button>
          </div>
        )}
      </div>

      {/* Sections fixes (templates GAV/Interro/Bracelet/Fédéral) */}
      {!estCustom && sections.map((sec) => (
        <div key={sec.titre} className="carte mb-3">
          <h2 className="titre-section flex items-center gap-2 mb-3">
            <span className="w-1 h-5 bg-or rounded" />
            {sec.titre}
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sec.champs.map((c) => (
              <div key={c.nom} className={c.type === 'textarea' ? 'sm:col-span-2' : ''}>
                <dt className="text-[10px] uppercase tracking-wider text-texte-gris">{c.label}</dt>
                <dd className="text-sm text-white whitespace-pre-wrap mt-0.5">
                  {formatValeur(contenu[c.nom], c.type) || <span className="text-texte-gris italic">—</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      {/* Sections libres (custom) */}
      {estCustom && sections.map((sec: any, i) => (
        <div key={i} className="carte mb-3">
          <h2 className="titre-section flex items-center gap-2 mb-2">
            <span className="w-1 h-5 bg-or rounded" />
            {sec.titre || <span className="text-texte-gris italic">Section sans titre</span>}
          </h2>
          <p className="text-sm text-white whitespace-pre-wrap">{sec.contenu || <span className="text-texte-gris italic">—</span>}</p>
        </div>
      ))}

      {/* Auteur en bas */}
      {r.auteur && (
        <div className="carte mt-4 flex items-center gap-3">
          <Avatar src={r.auteur.avatar_url} nom={r.auteur.username} taille={40} />
          <div>
            <p className="text-xs text-texte-gris uppercase tracking-wider">Rédigé par</p>
            <p className="text-white font-medium">{r.auteur.surnom || r.auteur.username}</p>
          </div>
        </div>
      )}
    </LayoutApp>
  );
}

function formatValeur(v: any, type: string): string {
  if (v == null || v === '') return '';
  if (type === 'date' || type === 'datetime') {
    try { return new Date(v).toLocaleString('fr-FR'); } catch { return String(v); }
  }
  return String(v);
}
