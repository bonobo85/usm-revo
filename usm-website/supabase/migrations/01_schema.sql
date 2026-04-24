-- ============================================================
-- USM - SCHEMA COMPLET
-- A executer dans l'editeur SQL Supabase (dans l'ordre)
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- FONCTION : updated_at automatique
-- ============================================================
create or replace function maj_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. RANKS
-- ============================================================
create table if not exists ranks (
  id serial primary key,
  level integer unique not null check (level between 1 and 9),
  nom text not null,
  couleur text not null,
  icone text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

insert into ranks (level, nom, couleur, icone, description) values
  (9, 'Shériff', '#C9994F', 'crown', 'Chef suprême de l''unité'),
  (8, 'Leader', '#B32134', 'star', 'Direction de l''unité'),
  (7, 'Co-Leader', '#D43A4F', 'shield-check', 'Direction adjointe'),
  (6, 'Opérateur', '#A67C4E', 'shield', 'Gestion opérationnelle'),
  (5, 'Opérateur Second', '#8B6A42', 'shield-half', 'Gestion opérationnelle second'),
  (4, 'Formateur', '#2E5AA8', 'graduation-cap', 'Formation des recrues'),
  (3, 'USM Confirmé', '#1B3E7C', 'badge-check', 'Membre confirmé'),
  (2, 'USM', '#6B7B9C', 'user', 'Marshal en probation'),
  (1, 'BCSO', '#4A5670', 'user-plus', 'Recrue récemment arrivée')
on conflict (level) do nothing;

-- ============================================================
-- 2. USERS (lié à Discord OAuth)
-- ============================================================
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  discord_id text unique not null,
  username text not null,
  avatar_url text,
  email text,
  rank_level integer not null default 1 references ranks(level),
  statut text not null default 'hors_ligne' check (statut in ('disponible','occupe','absent','hors_ligne')),
  date_entree timestamptz default now(),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_users_discord on users(discord_id);
create index if not exists idx_users_rank on users(rank_level);
create index if not exists idx_users_active on users(is_active);
create index if not exists idx_users_statut on users(statut);

create trigger trg_users_updated before update on users
  for each row execute function maj_updated_at();

-- ============================================================
-- 3. USER_PERMISSIONS
-- ============================================================
create table if not exists user_permissions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  permission text not null,
  granted_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique(user_id, permission)
);

create index if not exists idx_perms_user on user_permissions(user_id);

create trigger trg_perms_updated before update on user_permissions
  for each row execute function maj_updated_at();

-- ============================================================
-- 4. BADGES
-- ============================================================
create table if not exists badges (
  id serial primary key,
  code text unique not null,
  nom text not null,
  description text,
  couleur text default '#1E40AF',
  icone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

insert into badges (code, nom, description, couleur, icone) values
  ('CRASH', 'CRASH', 'Unité d''investigation spéciale', '#DC2626', 'siren'),
  ('FORMATEUR', 'Formateur', 'Autorisation de former les recrues', '#3B82F6', 'graduation-cap'),
  ('INSTRUCTEUR', 'Instructeur Tir', 'Autorisation d''entraîner au tir', '#F97316', 'target'),
  ('NEGO', 'Négociateur', 'Spécialiste des prises d''otages', '#A855F7', 'message-circle'),
  ('K9', 'K9 Handler', 'Maître-chien', '#10B981', 'dog'),
  ('AIR', 'Unité Aérienne', 'Pilote hélicoptère', '#06B6D4', 'helicopter'),
  ('GAV', 'GAV', 'Autorisation de garde à vue', '#6B7280', 'lock'),
  ('BRACELET', 'Pose Bracelet', 'Autorisation pose de bracelet', '#8B5CF6', 'watch'),
  ('CONDUITE', 'Conduite Rapide', 'Certifié conduite rapide', '#FFD700', 'car')
on conflict (code) do nothing;

-- ============================================================
-- 5. USER_BADGES
-- ============================================================
create table if not exists user_badges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  badge_id integer not null references badges(id),
  attribue_par uuid references users(id),
  attribue_le timestamptz default now(),
  revoque_par uuid references users(id),
  revoque_le timestamptz,
  raison_revocation text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_ub_user on user_badges(user_id);
create index if not exists idx_ub_badge on user_badges(badge_id);
create index if not exists idx_ub_active on user_badges(is_active);

create trigger trg_ub_updated before update on user_badges
  for each row execute function maj_updated_at();

-- ============================================================
-- 6. TRAINING_SESSIONS
-- ============================================================
create table if not exists training_sessions (
  id uuid primary key default uuid_generate_v4(),
  titre text not null,
  description text,
  date_session timestamptz not null,
  lieu text,
  rank_min integer default 1 references ranks(level),
  createur_id uuid not null references users(id),
  statut text default 'planifie' check (statut in ('planifie','en_cours','termine','annule')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_ts_date on training_sessions(date_session);
create index if not exists idx_ts_createur on training_sessions(createur_id);
create index if not exists idx_ts_statut on training_sessions(statut);

create trigger trg_ts_updated before update on training_sessions
  for each row execute function maj_updated_at();

-- ============================================================
-- 7. TRAINING_RESULTS
-- ============================================================
create table if not exists training_results (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references training_sessions(id) on delete cascade,
  user_id uuid not null references users(id),
  present boolean default false,
  score integer,
  commentaire text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique(session_id, user_id)
);

create index if not exists idx_tr_session on training_results(session_id);
create index if not exists idx_tr_user on training_results(user_id);

create trigger trg_tr_updated before update on training_results
  for each row execute function maj_updated_at();

-- ============================================================
-- 8. CRASH_MEMBERS
-- ============================================================
create table if not exists crash_members (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'agent',
  ajoute_par uuid references users(id),
  ajoute_le timestamptz default now(),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique(user_id)
);

create index if not exists idx_cm_user on crash_members(user_id);
create index if not exists idx_cm_active on crash_members(is_active);

create trigger trg_cm_updated before update on crash_members
  for each row execute function maj_updated_at();

-- ============================================================
-- 9. INVESTIGATIONS
-- ============================================================
create table if not exists investigations (
  id uuid primary key default uuid_generate_v4(),
  titre text not null,
  description text,
  responsable_id uuid not null references users(id),
  statut text default 'ouverte' check (statut in ('ouverte','en_cours','classee')),
  conclusion text,
  date_cloture timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_inv_resp on investigations(responsable_id);
create index if not exists idx_inv_statut on investigations(statut);
create index if not exists idx_inv_created on investigations(created_at);

create trigger trg_inv_updated before update on investigations
  for each row execute function maj_updated_at();

-- ============================================================
-- 10. INVESTIGATION_MEMBERS
-- ============================================================
create table if not exists investigation_members (
  id uuid primary key default uuid_generate_v4(),
  investigation_id uuid not null references investigations(id) on delete cascade,
  user_id uuid not null references users(id),
  role text default 'enqueteur',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  unique(investigation_id, user_id)
);

create index if not exists idx_im_inv on investigation_members(investigation_id);
create index if not exists idx_im_user on investigation_members(user_id);

create trigger trg_im_updated before update on investigation_members
  for each row execute function maj_updated_at();

-- ============================================================
-- 11. QUESTIONNAIRES
-- ============================================================
create table if not exists questionnaires (
  id uuid primary key default uuid_generate_v4(),
  titre text not null,
  description text,
  createur_id uuid not null references users(id),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_q_createur on questionnaires(createur_id);
create index if not exists idx_q_active on questionnaires(is_active);

create trigger trg_q_updated before update on questionnaires
  for each row execute function maj_updated_at();

-- ============================================================
-- 12. QUESTIONNAIRE_QUESTIONS
-- ============================================================
create table if not exists questionnaire_questions (
  id uuid primary key default uuid_generate_v4(),
  questionnaire_id uuid not null references questionnaires(id) on delete cascade,
  ordre integer not null default 0,
  type text not null check (type in ('text','qcm','boolean')),
  question text not null,
  options jsonb,
  bonne_reponse text,
  points integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_qq_quest on questionnaire_questions(questionnaire_id);
create index if not exists idx_qq_ordre on questionnaire_questions(questionnaire_id, ordre);

create trigger trg_qq_updated before update on questionnaire_questions
  for each row execute function maj_updated_at();

-- ============================================================
-- 13. EVALUATIONS
-- ============================================================
create table if not exists evaluations (
  id uuid primary key default uuid_generate_v4(),
  candidat_id uuid not null references users(id),
  formateur_id uuid not null references users(id),
  questionnaire_id uuid not null references questionnaires(id),
  date_planifiee timestamptz,
  date_passee timestamptz,
  statut text default 'planifiee' check (statut in ('planifiee','en_cours','reussie','echouee','annulee')),
  score_obtenu integer,
  score_total integer,
  commentaire text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_eval_candidat on evaluations(candidat_id);
create index if not exists idx_eval_form on evaluations(formateur_id);
create index if not exists idx_eval_statut on evaluations(statut);
create index if not exists idx_eval_date on evaluations(date_planifiee);

create trigger trg_eval_updated before update on evaluations
  for each row execute function maj_updated_at();

-- ============================================================
-- 14. EVALUATION_ANSWERS
-- ============================================================
create table if not exists evaluation_answers (
  id uuid primary key default uuid_generate_v4(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  question_id uuid not null references questionnaire_questions(id),
  reponse text,
  correcte boolean,
  points_obtenus integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_ea_eval on evaluation_answers(evaluation_id);
create index if not exists idx_ea_q on evaluation_answers(question_id);

create trigger trg_ea_updated before update on evaluation_answers
  for each row execute function maj_updated_at();

-- ============================================================
-- 15. REPORTS
-- ============================================================
create table if not exists reports (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('enquete','gav','bracelet','incident')),
  titre text not null,
  contenu jsonb not null default '{}'::jsonb,
  auteur_id uuid not null references users(id),
  statut text default 'draft' check (statut in ('draft','submitted','validated','rejected')),
  validateur_id uuid references users(id),
  date_validation timestamptz,
  commentaire_validation text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_rep_auteur on reports(auteur_id);
create index if not exists idx_rep_statut on reports(statut);
create index if not exists idx_rep_type on reports(type);
create index if not exists idx_rep_created on reports(created_at);

create trigger trg_rep_updated before update on reports
  for each row execute function maj_updated_at();

-- ============================================================
-- 16. REPORT_ATTACHMENTS
-- ============================================================
create table if not exists report_attachments (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid not null references reports(id) on delete cascade,
  url text not null,
  nom_fichier text,
  type_mime text,
  taille integer,
  upload_par uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_ra_report on report_attachments(report_id);

create trigger trg_ra_updated before update on report_attachments
  for each row execute function maj_updated_at();

-- ============================================================
-- 17. SANCTIONS
-- ============================================================
create table if not exists sanctions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  type text not null check (type in ('avertissement','blame','suspension')),
  raison text not null,
  duree_jours integer,
  date_debut timestamptz default now(),
  date_fin timestamptz,
  createur_id uuid not null references users(id),
  valide_par uuid references users(id),
  date_validation timestamptz,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_sanc_user on sanctions(user_id);
create index if not exists idx_sanc_type on sanctions(type);
create index if not exists idx_sanc_active on sanctions(is_active);
create index if not exists idx_sanc_created on sanctions(created_at);

create trigger trg_sanc_updated before update on sanctions
  for each row execute function maj_updated_at();

-- ============================================================
-- 18. REQUESTS
-- ============================================================
create table if not exists requests (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('badge','rang','conge')),
  demandeur_id uuid not null references users(id),
  contenu jsonb not null default '{}'::jsonb,
  justification text,
  statut text default 'en_attente' check (statut in ('en_attente','approuve','refuse','annule')),
  traite_par uuid references users(id),
  date_traitement timestamptz,
  commentaire_traitement text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_req_demandeur on requests(demandeur_id);
create index if not exists idx_req_type on requests(type);
create index if not exists idx_req_statut on requests(statut);
create index if not exists idx_req_created on requests(created_at);

create trigger trg_req_updated before update on requests
  for each row execute function maj_updated_at();

-- ============================================================
-- 19. DOCUMENTS
-- ============================================================
create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  titre text not null,
  categorie text not null check (categorie in ('officiel','template','formation')),
  url text not null,
  nom_fichier text,
  type_mime text,
  taille integer,
  rank_min integer default 1 references ranks(level),
  upload_par uuid references users(id),
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_doc_cat on documents(categorie);
create index if not exists idx_doc_rank on documents(rank_min);

create trigger trg_doc_updated before update on documents
  for each row execute function maj_updated_at();

-- ============================================================
-- 20. ARCHIVES (anciens membres)
-- ============================================================
create table if not exists archives (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id),
  username_final text not null,
  rank_final integer references ranks(level),
  date_entree timestamptz,
  date_depart timestamptz default now(),
  raison text not null check (raison in ('demission','exclusion','inactivite','autre')),
  notes text,
  archive_par uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_arch_user on archives(user_id);
create index if not exists idx_arch_date on archives(date_depart);
create index if not exists idx_arch_raison on archives(raison);

create trigger trg_arch_updated before update on archives
  for each row execute function maj_updated_at();

-- ============================================================
-- 21. ARCHIVE_RECORDS (casier - historique copié)
-- ============================================================
create table if not exists archive_records (
  id uuid primary key default uuid_generate_v4(),
  archive_id uuid not null references archives(id) on delete cascade,
  type text not null, -- rang_change | badge | sanction | rapport | eval
  contenu jsonb not null default '{}'::jsonb,
  date_evenement timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_ar_archive on archive_records(archive_id);
create index if not exists idx_ar_type on archive_records(type);

create trigger trg_ar_updated before update on archive_records
  for each row execute function maj_updated_at();

-- ============================================================
-- 22. AUDIT_LOGS
-- ============================================================
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  acteur_id uuid references users(id),
  action text not null,
  cible_type text,
  cible_id uuid,
  cible_user_id uuid references users(id),
  avant jsonb,
  apres jsonb,
  ip text,
  user_agent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_audit_acteur on audit_logs(acteur_id);
create index if not exists idx_audit_cible_user on audit_logs(cible_user_id);
create index if not exists idx_audit_action on audit_logs(action);
create index if not exists idx_audit_created on audit_logs(created_at);

-- ============================================================
-- NOTIFICATIONS (bonus, requis étape 10)
-- ============================================================
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  titre text not null,
  message text,
  lien text,
  read_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_notif_user on notifications(user_id);
create index if not exists idx_notif_read on notifications(user_id, read_at);
create index if not exists idx_notif_created on notifications(created_at);

create trigger trg_notif_updated before update on notifications
  for each row execute function maj_updated_at();

-- ============================================================
-- HISTORIQUE DES RANGS (pour afficher sur le profil)
-- ============================================================
create table if not exists rank_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  ancien_rank integer references ranks(level),
  nouveau_rank integer not null references ranks(level),
  raison text,
  modifie_par uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_rh_user on rank_history(user_id);
create index if not exists idx_rh_created on rank_history(created_at);

create trigger trg_rh_updated before update on rank_history
  for each row execute function maj_updated_at();

-- ============================================================
-- FIN DU SCHEMA
-- ============================================================
