-- ============================================================
-- USM - REFACTOR MIGRATION
-- Ajouts additifs (pas de destruction). A executer apres 01-04.
-- ============================================================

-- ============================================================
-- 1. USERS : infos civiles, documents, matricule, surnom
-- ============================================================
alter table users
  add column if not exists surnom text,
  add column if not exists date_naissance date,
  add column if not exists lieu_naissance text,
  add column if not exists telephone text,
  add column if not exists photo_profil_url text,
  add column if not exists carte_identite_url text,
  add column if not exists permis_url text,
  add column if not exists derniere_connexion timestamptz;

create index if not exists idx_users_surnom on users(surnom);

-- Nettoyage si une migration precedente avait installe l'auto-matricule
drop trigger if exists trg_users_matricule on users;
drop function if exists attribuer_matricule();
drop sequence if exists seq_matricule;
alter table users drop column if exists matricule;

-- ============================================================
-- 2. BADGES : nouvelle liste + ordre d'affichage
-- ============================================================
alter table badges
  add column if not exists ordre_affichage integer default 999;

-- Desactive les badges non presents dans la nouvelle liste
update badges set deleted_at = now()
where code in ('K9', 'AIR', 'CONDUITE') and deleted_at is null;

-- Renomme NEGO -> NEGOCIATEUR
update badges set code = 'NEGOCIATEUR', nom = 'Negociateur' where code = 'NEGO';

-- Insert nouveaux badges + met a jour ordre
insert into badges (code, nom, description, couleur, icone, ordre_affichage) values
  ('CRASH', 'CRASH', 'Unite d''investigation speciale', '#DC2626', 'siren', 1),
  ('FORMATEUR', 'Formateur', 'Autorisation de former les recrues', '#3B82F6', 'graduation-cap', 2),
  ('INSTRUCTEUR', 'Instructeur', 'Instructeur specialise', '#F97316', 'target', 3),
  ('NEGOCIATEUR', 'Negociateur', 'Specialiste des prises d''otages', '#A855F7', 'message-circle', 4),
  ('BMO', 'BMO', 'Brigade Moto', '#0EA5E9', 'bike', 5),
  ('DRONE', 'Drone', 'Pilote drone', '#06B6D4', 'plane', 6),
  ('GAV', 'GAV', 'Autorisation de garde a vue', '#6B7280', 'lock', 7),
  ('BRACELET', 'Bracelet', 'Autorisation pose de bracelet', '#8B5CF6', 'watch', 8),
  ('FEDERAL', 'Federal', 'Competence federale', '#FFD700', 'shield-star', 9)
on conflict (code) do update set
  nom = excluded.nom,
  description = excluded.description,
  couleur = excluded.couleur,
  icone = excluded.icone,
  ordre_affichage = excluded.ordre_affichage,
  deleted_at = null;

-- ============================================================
-- 3. TRAINING_SESSIONS : plan, badge cible, capacite
-- ============================================================
alter table training_sessions
  add column if not exists plan text,
  add column if not exists badge_cible_id integer references badges(id),
  add column if not exists capacite_max integer,
  add column if not exists inscriptions_ouvertes boolean default true;

-- ============================================================
-- 4. TRAINING_REGISTRATIONS (inscription a un entrainement)
-- ============================================================
create table if not exists training_registrations (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references training_sessions(id) on delete cascade,
  user_id uuid not null references users(id),
  inscrit_le timestamptz default now(),
  annule boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique(session_id, user_id)
);

create index if not exists idx_treg_session on training_registrations(session_id);
create index if not exists idx_treg_user on training_registrations(user_id);

drop trigger if exists trg_treg_updated on training_registrations;
create trigger trg_treg_updated before update on training_registrations
  for each row execute function maj_updated_at();

-- ============================================================
-- 5. TRAINING_ATTENDANCE (presence cochee par HG)
-- ============================================================
create table if not exists training_attendance (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references training_sessions(id) on delete cascade,
  user_id uuid not null references users(id),
  statut text not null default 'absent' check (statut in ('present','absent','retard','excuse')),
  badge_obtenu boolean default false,
  commentaire text,
  pointe_par uuid references users(id),
  pointe_le timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique(session_id, user_id)
);

create index if not exists idx_tatt_session on training_attendance(session_id);
create index if not exists idx_tatt_user on training_attendance(user_id);

drop trigger if exists trg_tatt_updated on training_attendance;
create trigger trg_tatt_updated before update on training_attendance
  for each row execute function maj_updated_at();

-- ============================================================
-- 6. ANNOUNCEMENTS (communiques + promotions)
-- ============================================================
create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('communique','promotion','info')),
  titre text not null,
  contenu text,
  auteur_id uuid references users(id),
  cible_user_id uuid references users(id), -- pour promotion
  metadata jsonb default '{}'::jsonb, -- ex: {ancien_rang, nouveau_rang}
  epingle boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_annonce_type on announcements(type);
create index if not exists idx_annonce_created on announcements(created_at desc);
create index if not exists idx_annonce_epingle on announcements(epingle);

drop trigger if exists trg_annonce_updated on announcements;
create trigger trg_annonce_updated before update on announcements
  for each row execute function maj_updated_at();

-- ============================================================
-- 7. REPORTS : nouveau workflow (publication au lieu de validation)
-- ============================================================
-- Ajoute nouvelles colonnes, garde l'ancien systeme pour compat
alter table reports
  add column if not exists publie boolean default false,
  add column if not exists publie_par uuid references users(id),
  add column if not exists publie_le timestamptz,
  add column if not exists template_code text,
  add column if not exists sections jsonb default '[]'::jsonb;

-- Etend les types de rapports autorises
alter table reports drop constraint if exists reports_type_check;
alter table reports add constraint reports_type_check
  check (type in ('gav','interrogatoire','bracelet','federal','custom','enquete','incident'));

create index if not exists idx_rep_publie on reports(publie);
create index if not exists idx_rep_template on reports(template_code);

-- ============================================================
-- 8. REPORT_TEMPLATES (schema dynamique par type)
-- ============================================================
create table if not exists report_templates (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  nom text not null,
  description text,
  sections jsonb not null default '[]'::jsonb, -- [{titre, champs:[{nom,type,required,options}]}]
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

drop trigger if exists trg_rt_updated on report_templates;
create trigger trg_rt_updated before update on report_templates
  for each row execute function maj_updated_at();

-- Seed templates de base (structure initiale, ajustable)
insert into report_templates (code, nom, description, sections) values
  ('gav', 'Garde a vue', 'Rapport de garde a vue', '[
    {"titre":"Identite du suspect","champs":[
      {"nom":"nom_suspect","label":"Nom & Prenom","type":"text","required":true},
      {"nom":"date_naissance","label":"Date de naissance","type":"date"},
      {"nom":"telephone","label":"Telephone","type":"text"}
    ]},
    {"titre":"Circonstances","champs":[
      {"nom":"date_faits","label":"Date & heure des faits","type":"datetime","required":true},
      {"nom":"lieu","label":"Lieu","type":"text","required":true},
      {"nom":"motif","label":"Motif de la GAV","type":"textarea","required":true}
    ]},
    {"titre":"Deroulement","champs":[
      {"nom":"deroulement","label":"Deroulement","type":"textarea","required":true},
      {"nom":"temoins","label":"Temoins","type":"textarea"}
    ]},
    {"titre":"Suites","champs":[
      {"nom":"duree_gav","label":"Duree de la GAV","type":"text"},
      {"nom":"suites","label":"Suites donnees","type":"textarea"}
    ]}
  ]'::jsonb),
  ('interrogatoire', 'Interrogatoire', 'Rapport d''interrogatoire', '[
    {"titre":"Identite","champs":[
      {"nom":"interroge","label":"Personne interrogee","type":"text","required":true},
      {"nom":"date_heure","label":"Date & heure","type":"datetime","required":true},
      {"nom":"lieu","label":"Lieu","type":"text"}
    ]},
    {"titre":"Questions/Reponses","champs":[
      {"nom":"echanges","label":"Echanges","type":"textarea","required":true}
    ]},
    {"titre":"Conclusions","champs":[
      {"nom":"conclusions","label":"Conclusions","type":"textarea"}
    ]}
  ]'::jsonb),
  ('bracelet', 'Pose de bracelet', 'Rapport de pose de bracelet', '[
    {"titre":"Sujet","champs":[
      {"nom":"sujet","label":"Nom & Prenom","type":"text","required":true},
      {"nom":"motif","label":"Motif","type":"textarea","required":true}
    ]},
    {"titre":"Pose","champs":[
      {"nom":"date_pose","label":"Date de pose","type":"datetime","required":true},
      {"nom":"lieu","label":"Lieu","type":"text"},
      {"nom":"duree","label":"Duree prevue","type":"text"}
    ]},
    {"titre":"Observations","champs":[
      {"nom":"observations","label":"Observations","type":"textarea"}
    ]}
  ]'::jsonb),
  ('federal', 'Rapport federal', 'Rapport de niveau federal', '[
    {"titre":"Affaire","champs":[
      {"nom":"reference","label":"Reference dossier","type":"text"},
      {"nom":"objet","label":"Objet","type":"text","required":true}
    ]},
    {"titre":"Contexte","champs":[
      {"nom":"contexte","label":"Contexte","type":"textarea","required":true}
    ]},
    {"titre":"Faits","champs":[
      {"nom":"faits","label":"Faits constates","type":"textarea","required":true}
    ]},
    {"titre":"Recommandations","champs":[
      {"nom":"recommandations","label":"Recommandations","type":"textarea"}
    ]}
  ]'::jsonb),
  ('custom', 'Personnalise', 'Rapport avec sections libres', '[]'::jsonb)
on conflict (code) do update set
  nom = excluded.nom,
  description = excluded.description,
  sections = excluded.sections;

-- ============================================================
-- 9. HELPDESK_TICKETS (Retour & Sanction)
-- ============================================================
create table if not exists helpdesk_tickets (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('retour','sanction')),
  titre text not null,
  contenu text not null,
  auteur_id uuid not null references users(id),
  cible_user_id uuid references users(id), -- pour demande de sanction
  statut text not null default 'ouvert' check (statut in ('ouvert','en_cours','applique','rejete','resolu','ferme')),
  priorite text default 'normale' check (priorite in ('basse','normale','haute','critique')),
  traite_par uuid references users(id),
  traite_le timestamptz,
  sanction_appliquee_id uuid references sanctions(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_help_type on helpdesk_tickets(type);
create index if not exists idx_help_statut on helpdesk_tickets(statut);
create index if not exists idx_help_auteur on helpdesk_tickets(auteur_id);
create index if not exists idx_help_cible on helpdesk_tickets(cible_user_id);

drop trigger if exists trg_help_updated on helpdesk_tickets;
create trigger trg_help_updated before update on helpdesk_tickets
  for each row execute function maj_updated_at();

-- Messages/reponses dans un ticket
create table if not exists helpdesk_messages (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references helpdesk_tickets(id) on delete cascade,
  auteur_id uuid not null references users(id),
  contenu text not null,
  interne boolean default false, -- visible uniquement par staff
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_hmsg_ticket on helpdesk_messages(ticket_id);

drop trigger if exists trg_hmsg_updated on helpdesk_messages;
create trigger trg_hmsg_updated before update on helpdesk_messages
  for each row execute function maj_updated_at();

-- ============================================================
-- 10. RECRUTEMENTS (RC a faire)
-- ============================================================
create table if not exists recrutements (
  id uuid primary key default uuid_generate_v4(),
  candidat_nom text not null,
  candidat_discord text,
  candidat_user_id uuid references users(id), -- apres recrutement
  formateur_id uuid references users(id),
  assistants uuid[] default array[]::uuid[],
  date_rc timestamptz,
  lieu text,
  statut text not null default 'planifie' check (statut in ('planifie','en_cours','termine','annule')),
  notes text,
  createur_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_recr_statut on recrutements(statut);
create index if not exists idx_recr_date on recrutements(date_rc);
create index if not exists idx_recr_formateur on recrutements(formateur_id);

drop trigger if exists trg_recr_updated on recrutements;
create trigger trg_recr_updated before update on recrutements
  for each row execute function maj_updated_at();

-- ============================================================
-- 11. RC_RESULTATS (fiche resultat d'un RC)
-- ============================================================
create table if not exists rc_resultats (
  id uuid primary key default uuid_generate_v4(),
  recrutement_id uuid references recrutements(id) on delete set null,
  candidat_nom text not null,
  date_rc timestamptz not null,
  formateur_id uuid references users(id),
  assistants uuid[] default array[]::uuid[],
  -- Evaluations standard (ajustable ensuite)
  tir_note integer check (tir_note between 0 and 20),
  conduite_note integer check (conduite_note between 0 and 20),
  procedure_note integer check (procedure_note between 0 and 20),
  comportement_note integer check (comportement_note between 0 and 20),
  note_globale integer check (note_globale between 0 and 20),
  points_forts text,
  points_faibles text,
  observations text,
  resultat text check (resultat in ('admis','refuse','a_repasser')),
  redacteur_id uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_rcr_recr on rc_resultats(recrutement_id);
create index if not exists idx_rcr_resultat on rc_resultats(resultat);

drop trigger if exists trg_rcr_updated on rc_resultats;
create trigger trg_rcr_updated before update on rc_resultats
  for each row execute function maj_updated_at();

-- ============================================================
-- 12. ATTESTATIONS USM (co-lead min)
-- ============================================================
create table if not exists attestations (
  id uuid primary key default uuid_generate_v4(),
  numero text unique, -- auto-genere
  beneficiaire_id uuid not null references users(id),
  type text not null, -- ex: formation, competence, autorisation
  objet text not null,
  description text,
  valide_du date,
  valide_jusqu date,
  emetteur_id uuid not null references users(id),
  signature text, -- nom signature
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create sequence if not exists seq_attestation start with 1;

create or replace function attribuer_numero_attestation()
returns trigger as $$
begin
  if new.numero is null then
    new.numero := 'ATT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('seq_attestation')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_att_numero on attestations;
create trigger trg_att_numero
  before insert on attestations
  for each row execute function attribuer_numero_attestation();

create index if not exists idx_att_benef on attestations(beneficiaire_id);

drop trigger if exists trg_att_updated on attestations;
create trigger trg_att_updated before update on attestations
  for each row execute function maj_updated_at();

-- ============================================================
-- 13. Trigger : creer une annonce auto sur changement de rang
-- ============================================================
create or replace function annonce_promotion_auto()
returns trigger as $$
declare
  v_nouveau_nom text;
  v_ancien_nom text;
  v_user_nom text;
begin
  if old.rank_level is distinct from new.rank_level then
    select nom into v_nouveau_nom from ranks where level = new.rank_level;
    select nom into v_ancien_nom from ranks where level = old.rank_level;
    v_user_nom := coalesce(new.surnom, new.username);

    insert into announcements (type, titre, contenu, cible_user_id, metadata)
    values (
      'promotion',
      case when new.rank_level > old.rank_level then 'Promotion' else 'Changement de rang' end,
      v_user_nom || ' : ' || v_ancien_nom || ' -> ' || v_nouveau_nom,
      new.id,
      jsonb_build_object('ancien_rang', old.rank_level, 'nouveau_rang', new.rank_level)
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_annonce_promotion on users;
create trigger trg_annonce_promotion
  after update on users
  for each row execute function annonce_promotion_auto();

-- ============================================================
-- 14. Helpers SQL pour RLS
-- ============================================================
create or replace function est_op_second_min() returns boolean
language sql stable as $$
  select coalesce(mon_rang() >= 5, false);
$$;

create or replace function est_operateur_min() returns boolean
language sql stable as $$
  select coalesce(mon_rang() >= 6, false);
$$;

create or replace function est_colead_min() returns boolean
language sql stable as $$
  select coalesce(mon_rang() >= 7, false);
$$;

create or replace function peut_voir_crash() returns boolean
language sql stable as $$
  select coalesce(mon_rang() >= 7, false) or coalesce(ai_badge('CRASH'), false);
$$;

create or replace function peut_voir_formateurs() returns boolean
language sql stable as $$
  select coalesce(mon_rang() >= 7, false) or coalesce(ai_badge('FORMATEUR'), false);
$$;

-- ============================================================
-- FIN REFACTOR MIGRATION
-- ============================================================
