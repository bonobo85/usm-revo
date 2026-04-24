'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Calendar,
  Award,
  FileText,
  GraduationCap,
  ShieldAlert,
  Phone,
  MapPin,
  Cake,
  IdCard,
  Car,
  ImageIcon,
  Pencil,
  Save,
  X,
  Upload,
} from 'lucide-react';
import { LayoutApp } from '@/components/LayoutApp';
import { RankBadge } from '@/components/RankBadge';
import { Avatar } from '@/components/Avatar';
import { BadgesRow } from '@/components/BadgeTag';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { dateCourte, dateLongue } from '@/lib/utils';
import { NOMS_RANGS } from '@/lib/permissions';

type Profil = {
  id: string;
  username: string;
  surnom: string | null;
  avatar_url: string | null;
  rank_level: number;
  statut: string;
  date_entree: string;
  date_naissance: string | null;
  lieu_naissance: string | null;
  telephone: string | null;
  photo_profil_url: string | null;
  carte_identite_url: string | null;
  permis_url: string | null;
  ranks?: { nom: string };
};

export default function PageProfil() {
  const params = useParams();
  const userId = params.userId as string;
  const supabase = useSupabase();
  const { user: moi, hasRang } = useUser();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [histoRang, setHistoRang] = useState<any[]>([]);
  const [sanctions, setSanctions] = useState<any[]>([]);
  const [stats, setStats] = useState({ rapports: 0, entrainements: 0, badges: 0 });
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Partial<Profil>>({});

  const estProprio = moi?.id === userId;
  const peutEditer = estProprio || hasRang(7);

  async function charger() {
    const { data: u } = await supabase
      .from('users')
      .select('*, ranks(nom)')
      .eq('id', userId)
      .maybeSingle();
    if (!u) return;
    setProfil(u as Profil);
    setForm(u as Profil);

    const { data: bs } = await supabase
      .from('user_badges')
      .select('*, badge:badge_id(code, nom, couleur, description), attributeur:attribue_par(username, surnom)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('deleted_at', null);
    setBadges(bs || []);

    const { data: hist } = await supabase
      .from('rank_history')
      .select('*, modifie_par_user:modifie_par(username, surnom)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setHistoRang(hist || []);

    if (estProprio || hasRang(6)) {
      const { data: s } = await supabase
        .from('sanctions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setSanctions(s || []);
    }

    const [rap, ent] = await Promise.all([
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('auteur_id', userId).is('deleted_at', null),
      supabase.from('training_attendance').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('statut', 'present'),
    ]);
    setStats({
      rapports: rap.count || 0,
      entrainements: ent.count || 0,
      badges: bs?.length || 0,
    });
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, moi?.id]);

  async function sauvegarder() {
    const updates: any = {
      surnom: form.surnom ?? null,
      date_naissance: form.date_naissance ?? null,
      lieu_naissance: form.lieu_naissance ?? null,
      telephone: form.telephone ?? null,
    };
    await supabase.from('users').update(updates).eq('id', userId);
    setEdit(false);
    charger();
  }

  async function uploadFichier(type: 'photo_profil_url' | 'carte_identite_url' | 'permis_url', file: File) {
    const bucket = type === 'photo_profil_url' ? 'avatars' : 'documents-prives';
    const ext = file.name.split('.').pop();
    const chemin = `${userId}/${type}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(chemin, file, { upsert: true });
    if (error) { alert(error.message); return; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(chemin);
    await supabase.from('users').update({ [type]: data.publicUrl }).eq('id', userId);
    charger();
  }

  if (!profil) {
    return <LayoutApp><p className="text-texte-gris">Chargement...</p></LayoutApp>;
  }

  const nomAffiche = profil.surnom || profil.username;
  const photoProfil = profil.photo_profil_url || profil.avatar_url;

  return (
    <LayoutApp>
      {/* Header */}
      <div className="carte mb-6">
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <div className="relative">
            <Avatar src={photoProfil} nom={profil.username} taille={120} />
            {estProprio && (
              <UploadBtn
                onFile={(f) => uploadFichier('photo_profil_url', f)}
                accept="image/*"
                className="absolute bottom-0 right-0 bg-bleu p-2 rounded-full hover:bg-bleu-clair"
                icon={<ImageIcon size={14} />}
              />
            )}
          </div>

          <div className="flex-1 text-center md:text-left w-full">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
              <div>
                {edit ? (
                  <input
                    type="text"
                    value={form.surnom || ''}
                    onChange={(e) => setForm({ ...form, surnom: e.target.value })}
                    placeholder="Surnom"
                    className="input text-2xl font-bold mb-2"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-white mb-2">{nomAffiche}</h1>
                )}
                <div className="flex flex-wrap gap-2 items-center justify-center md:justify-start">
                  <RankBadge rang={profil.rank_level} taille="lg" />
                  <span className="text-xs text-texte-gris flex items-center gap-1">
                    <Calendar size={14} /> Depuis le {dateCourte(profil.date_entree)}
                  </span>
                </div>
                {badges.length > 0 && (
                  <div className="mt-3">
                    <BadgesRow badges={badges.map((b) => b.badge)} taille="sm" />
                  </div>
                )}
              </div>
              {peutEditer && (
                <div className="flex gap-2">
                  {edit ? (
                    <>
                      <button onClick={sauvegarder} className="bouton-bleu text-xs flex items-center gap-1">
                        <Save size={14} /> Enregistrer
                      </button>
                      <button onClick={() => { setEdit(false); setForm(profil); }} className="px-3 py-1.5 rounded text-xs bg-fond-clair text-gray-300 hover:bg-fond-carte flex items-center gap-1">
                        <X size={14} /> Annuler
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setEdit(true)} className="bouton-bleu text-xs flex items-center gap-1">
                      <Pencil size={14} /> Modifier
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="carte text-center">
          <Award className="mx-auto text-emerald-500 mb-2" size={22} />
          <p className="text-2xl font-bold text-white">{stats.badges}</p>
          <p className="text-xs text-texte-gris">Badges</p>
        </div>
        <div className="carte text-center">
          <FileText className="mx-auto text-bleu-clair mb-2" size={22} />
          <p className="text-2xl font-bold text-white">{stats.rapports}</p>
          <p className="text-xs text-texte-gris">Rapports</p>
        </div>
        <div className="carte text-center">
          <GraduationCap className="mx-auto text-or mb-2" size={22} />
          <p className="text-2xl font-bold text-white">{stats.entrainements}</p>
          <p className="text-xs text-texte-gris">Entraînements</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Informations */}
        <div className="carte">
          <h2 className="titre-section">Informations</h2>
          <div className="space-y-3">
            <InfoLigne
              icone={<Cake size={16} />}
              label="Date de naissance"
              valeur={profil.date_naissance ? dateCourte(profil.date_naissance) : null}
              editValue={form.date_naissance || ''}
              onEdit={(v) => setForm({ ...form, date_naissance: v || null })}
              edit={edit && peutEditer}
              type="date"
            />
            <InfoLigne
              icone={<MapPin size={16} />}
              label="Lieu de naissance"
              valeur={profil.lieu_naissance}
              editValue={form.lieu_naissance || ''}
              onEdit={(v) => setForm({ ...form, lieu_naissance: v || null })}
              edit={edit && peutEditer}
            />
            <InfoLigne
              icone={<Phone size={16} />}
              label="Téléphone"
              valeur={profil.telephone}
              editValue={form.telephone || ''}
              onEdit={(v) => setForm({ ...form, telephone: v || null })}
              edit={edit && peutEditer}
            />
          </div>
        </div>

        {/* Documents */}
        <div className="carte">
          <h2 className="titre-section">Documents</h2>
          <div className="space-y-3">
            <DocumentLigne
              icone={<ImageIcon size={16} />}
              label="Photo de profil"
              url={profil.photo_profil_url}
              peutEditer={estProprio}
              onUpload={(f) => uploadFichier('photo_profil_url', f)}
              accept="image/*"
            />
            <DocumentLigne
              icone={<IdCard size={16} />}
              label="Carte d'identité"
              url={profil.carte_identite_url}
              peutEditer={estProprio}
              onUpload={(f) => uploadFichier('carte_identite_url', f)}
              accept="image/*,application/pdf"
            />
            <DocumentLigne
              icone={<Car size={16} />}
              label="Permis de conduire"
              url={profil.permis_url}
              peutEditer={estProprio}
              onUpload={(f) => uploadFichier('permis_url', f)}
              accept="image/*,application/pdf"
            />
          </div>
        </div>

        {/* Historique badges */}
        <div className="carte">
          <h2 className="titre-section">Historique badges</h2>
          {badges.length === 0 ? (
            <p className="text-texte-gris text-sm">Aucun badge</p>
          ) : (
            <ul className="space-y-2">
              {badges.map((b) => (
                <li key={b.id} className="flex items-center justify-between p-2 bg-fond-clair rounded">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase"
                      style={{ backgroundColor: b.badge?.couleur, color: '#fff' }}
                    >
                      {b.badge?.code}
                    </span>
                    <div>
                      <p className="text-white text-sm">{b.badge?.nom}</p>
                      {b.attributeur && (
                        <p className="text-[11px] text-texte-gris">
                          Par {b.attributeur.surnom || b.attributeur.username}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-texte-gris">{dateCourte(b.attribue_le)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Historique promotions */}
        <div className="carte">
          <h2 className="titre-section">Historique promotions</h2>
          {histoRang.length === 0 ? (
            <p className="text-texte-gris text-sm">Aucune promotion</p>
          ) : (
            <ul className="space-y-2">
              {histoRang.map((h) => (
                <li key={h.id} className="p-2 bg-fond-clair rounded">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    {h.ancien_rank && <RankBadge rang={h.ancien_rank} taille="sm" />}
                    <span className="text-texte-gris">→</span>
                    <RankBadge rang={h.nouveau_rank} taille="sm" />
                  </div>
                  <div className="text-xs text-texte-gris mt-1 flex items-center gap-2 flex-wrap">
                    <span>{dateLongue(h.created_at)}</span>
                    {h.modifie_par_user && (
                      <span>· par {h.modifie_par_user.surnom || h.modifie_par_user.username}</span>
                    )}
                  </div>
                  {h.raison && <p className="text-xs text-texte-gris italic mt-1">{h.raison}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(estProprio || hasRang(6)) && (
        <div className="carte">
          <h2 className="titre-section flex items-center gap-2">
            <ShieldAlert size={18} className="text-red-400" />
            Sanctions
          </h2>
          {sanctions.length === 0 ? (
            <p className="text-texte-gris text-sm">Aucune sanction</p>
          ) : (
            <ul className="space-y-2">
              {sanctions.map((s) => (
                <li key={s.id} className="p-3 bg-red-900/10 border border-red-900/30 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-red-400 font-medium capitalize">{s.type}</span>
                    <span className="text-xs text-texte-gris">{dateCourte(s.created_at)}</span>
                  </div>
                  <p className="text-sm text-white">{s.raison}</p>
                  {s.duree_jours && (
                    <p className="text-xs text-texte-gris mt-1">Durée : {s.duree_jours} jours</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </LayoutApp>
  );
}

function InfoLigne({
  icone,
  label,
  valeur,
  editValue,
  onEdit,
  edit,
  type = 'text',
}: {
  icone: React.ReactNode;
  label: string;
  valeur: string | null;
  editValue: string;
  onEdit: (v: string) => void;
  edit: boolean;
  type?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-texte-gris mt-1">{icone}</span>
      <div className="flex-1">
        <p className="text-[11px] uppercase tracking-wider text-texte-gris mb-1">{label}</p>
        {edit ? (
          <input
            type={type}
            value={editValue}
            onChange={(e) => onEdit(e.target.value)}
            className="input !py-1.5 text-sm"
          />
        ) : (
          <p className="text-sm text-white">{valeur || <span className="text-texte-gris italic">Non renseigné</span>}</p>
        )}
      </div>
    </div>
  );
}

function DocumentLigne({
  icone,
  label,
  url,
  peutEditer,
  onUpload,
  accept,
}: {
  icone: React.ReactNode;
  label: string;
  url: string | null;
  peutEditer: boolean;
  onUpload: (f: File) => void;
  accept: string;
}) {
  return (
    <div className="flex items-center gap-3 p-2 bg-fond-clair rounded">
      <span className="text-texte-gris">{icone}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{label}</p>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-bleu-clair hover:underline truncate block">
            Voir le document
          </a>
        ) : (
          <p className="text-xs text-texte-gris italic">Non renseigné</p>
        )}
      </div>
      {peutEditer && (
        <UploadBtn
          onFile={onUpload}
          accept={accept}
          icon={<Upload size={14} />}
          className="bouton-bleu text-xs px-2 py-1.5 flex items-center gap-1"
        />
      )}
    </div>
  );
}

function UploadBtn({
  onFile,
  accept,
  icon,
  className,
}: {
  onFile: (f: File) => void;
  accept: string;
  icon: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          if (ref.current) ref.current.value = '';
        }}
      />
      <button type="button" onClick={() => ref.current?.click()} className={className}>
        {icon}
      </button>
    </>
  );
}
