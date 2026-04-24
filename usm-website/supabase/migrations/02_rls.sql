-- ============================================================
-- USM - POLITIQUES RLS
-- A executer APRES 01_schema.sql
-- ============================================================

-- ============================================================
-- FONCTIONS HELPER
-- ============================================================

-- Récupère l'user UUID depuis le discord_id (stocké dans auth.jwt()->>'sub' via NextAuth)
-- Note: on passe par un custom claim "user_id" dans le JWT
create or replace function mon_user_id()
returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'user_id','')::uuid;
$$ language sql stable;

-- Récupère mon rang actuel
create or replace function mon_rang()
returns integer as $$
  select coalesce((select rank_level from users where id = mon_user_id() and is_active = true), 0);
$$ language sql stable;

-- Est-ce que j'ai une permission spéciale ?
create or replace function ma_permission(perm text)
returns boolean as $$
  select exists(
    select 1 from user_permissions
    where user_id = mon_user_id()
      and permission = perm
      and deleted_at is null
  );
$$ language sql stable;

-- Est-ce que je suis actif ?
create or replace function suis_actif()
returns boolean as $$
  select coalesce((select is_active from users where id = mon_user_id()), false);
$$ language sql stable;

-- Est-ce que j'ai un badge ?
create or replace function ai_badge(code_badge text)
returns boolean as $$
  select exists(
    select 1 from user_badges ub
    join badges b on b.id = ub.badge_id
    where ub.user_id = mon_user_id()
      and b.code = code_badge
      and ub.is_active = true
      and ub.deleted_at is null
  );
$$ language sql stable;

-- ============================================================
-- ACTIVATION RLS SUR TOUTES LES TABLES
-- ============================================================
alter table ranks enable row level security;
alter table users enable row level security;
alter table user_permissions enable row level security;
alter table badges enable row level security;
alter table user_badges enable row level security;
alter table training_sessions enable row level security;
alter table training_results enable row level security;
alter table crash_members enable row level security;
alter table investigations enable row level security;
alter table investigation_members enable row level security;
alter table questionnaires enable row level security;
alter table questionnaire_questions enable row level security;
alter table evaluations enable row level security;
alter table evaluation_answers enable row level security;
alter table reports enable row level security;
alter table report_attachments enable row level security;
alter table sanctions enable row level security;
alter table requests enable row level security;
alter table documents enable row level security;
alter table archives enable row level security;
alter table archive_records enable row level security;
alter table audit_logs enable row level security;
alter table notifications enable row level security;
alter table rank_history enable row level security;

-- ============================================================
-- RANKS : tout le monde peut lire (référentiel)
-- ============================================================
create policy "ranks_lecture" on ranks for select using (true);

-- ============================================================
-- USERS
-- ============================================================
-- Membres actifs voient tous les autres membres actifs (annuaire)
create policy "users_lecture_annuaire" on users for select
  using (suis_actif() and is_active = true);

-- Je peux me voir moi-même même si désactivé
create policy "users_lecture_moi" on users for select
  using (id = mon_user_id());

-- Modification de son propre statut
create policy "users_maj_statut" on users for update
  using (id = mon_user_id())
  with check (id = mon_user_id());

-- Rank >= 7 peut modifier les autres users (mais pas escalade)
create policy "users_maj_admin" on users for update
  using (mon_rang() >= 7)
  with check (
    mon_rang() >= 7
    and rank_level < mon_rang()  -- anti-escalade
  );

-- Seul Shériff (9) peut créer un user manuellement (en pratique, auth callback)
create policy "users_insert_auth" on users for insert
  with check (true); -- Géré par service role lors de l'auth

-- ============================================================
-- USER_PERMISSIONS
-- ============================================================
create policy "perms_lecture_moi" on user_permissions for select
  using (user_id = mon_user_id());

create policy "perms_lecture_admin" on user_permissions for select
  using (mon_rang() >= 8 or ma_permission('dev'));

create policy "perms_insert" on user_permissions for insert
  with check (mon_rang() = 9 or ma_permission('dev'));

create policy "perms_delete" on user_permissions for delete
  using (mon_rang() = 9 or ma_permission('dev'));

-- ============================================================
-- BADGES : lecture pour tous les membres actifs
-- ============================================================
create policy "badges_lecture" on badges for select using (suis_actif());

-- ============================================================
-- USER_BADGES
-- ============================================================
create policy "ub_lecture" on user_badges for select using (suis_actif());

create policy "ub_insert" on user_badges for insert
  with check (mon_rang() >= 6);

create policy "ub_update" on user_badges for update
  using (mon_rang() >= 6);

-- ============================================================
-- TRAINING_SESSIONS
-- ============================================================
create policy "ts_lecture" on training_sessions for select
  using (suis_actif() and rank_min <= mon_rang());

create policy "ts_insert" on training_sessions for insert
  with check (mon_rang() >= 4);

create policy "ts_update" on training_sessions for update
  using (createur_id = mon_user_id() or mon_rang() >= 6);

create policy "ts_delete" on training_sessions for delete
  using (createur_id = mon_user_id() or mon_rang() >= 7);

-- ============================================================
-- TRAINING_RESULTS
-- ============================================================
create policy "tr_lecture" on training_results for select
  using (suis_actif());

create policy "tr_insert" on training_results for insert
  with check (user_id = mon_user_id() or mon_rang() >= 4);

create policy "tr_update" on training_results for update
  using (user_id = mon_user_id() or mon_rang() >= 4);

-- ============================================================
-- CRASH_MEMBERS
-- ============================================================
create policy "cm_lecture" on crash_members for select
  using (ai_badge('CRASH') and mon_rang() >= 6);

create policy "cm_insert" on crash_members for insert
  with check (mon_rang() >= 7);

create policy "cm_update" on crash_members for update
  using (mon_rang() >= 7);

-- ============================================================
-- INVESTIGATIONS
-- ============================================================
create policy "inv_lecture" on investigations for select
  using (ai_badge('CRASH') and mon_rang() >= 6);

create policy "inv_insert" on investigations for insert
  with check (ai_badge('CRASH') and mon_rang() >= 6);

create policy "inv_update" on investigations for update
  using (ai_badge('CRASH') and (responsable_id = mon_user_id() or mon_rang() >= 7));

-- ============================================================
-- INVESTIGATION_MEMBERS
-- ============================================================
create policy "im_lecture" on investigation_members for select
  using (ai_badge('CRASH') and mon_rang() >= 6);

create policy "im_insert" on investigation_members for insert
  with check (ai_badge('CRASH') and mon_rang() >= 6);

create policy "im_delete" on investigation_members for delete
  using (ai_badge('CRASH') and mon_rang() >= 7);

-- ============================================================
-- QUESTIONNAIRES
-- ============================================================
create policy "q_lecture" on questionnaires for select
  using (suis_actif() and mon_rang() >= 4);

create policy "q_insert" on questionnaires for insert
  with check (mon_rang() >= 4);

create policy "q_update" on questionnaires for update
  using (createur_id = mon_user_id() or mon_rang() >= 7);

-- ============================================================
-- QUESTIONNAIRE_QUESTIONS
-- ============================================================
create policy "qq_lecture" on questionnaire_questions for select
  using (suis_actif() and mon_rang() >= 4);

create policy "qq_insert" on questionnaire_questions for insert
  with check (mon_rang() >= 4);

create policy "qq_update" on questionnaire_questions for update
  using (mon_rang() >= 4);

create policy "qq_delete" on questionnaire_questions for delete
  using (mon_rang() >= 4);

-- ============================================================
-- EVALUATIONS
-- ============================================================
-- Je vois mes évaluations
create policy "eval_lecture_moi" on evaluations for select
  using (candidat_id = mon_user_id());

-- Formateurs voient les leurs et celles qu'ils ont planifiées
create policy "eval_lecture_form" on evaluations for select
  using (mon_rang() >= 4);

create policy "eval_insert" on evaluations for insert
  with check (mon_rang() >= 4);

create policy "eval_update" on evaluations for update
  using (formateur_id = mon_user_id() or candidat_id = mon_user_id() or mon_rang() >= 6);

-- ============================================================
-- EVALUATION_ANSWERS
-- ============================================================
create policy "ea_lecture" on evaluation_answers for select
  using (
    exists(
      select 1 from evaluations e
      where e.id = evaluation_id
        and (e.candidat_id = mon_user_id() or e.formateur_id = mon_user_id() or mon_rang() >= 6)
    )
  );

create policy "ea_insert" on evaluation_answers for insert
  with check (
    exists(
      select 1 from evaluations e
      where e.id = evaluation_id
        and (e.candidat_id = mon_user_id() or e.formateur_id = mon_user_id())
    )
  );

create policy "ea_update" on evaluation_answers for update
  using (mon_rang() >= 4);

-- ============================================================
-- REPORTS
-- ============================================================
-- Je vois mes rapports
create policy "rep_lecture_moi" on reports for select
  using (auteur_id = mon_user_id());

-- Rank >= 6 peut voir tous les rapports à valider
create policy "rep_lecture_op" on reports for select
  using (mon_rang() >= 6);

create policy "rep_insert" on reports for insert
  with check (auteur_id = mon_user_id() and suis_actif());

-- Édition de brouillon
create policy "rep_update_auteur" on reports for update
  using (auteur_id = mon_user_id() and statut in ('draft'));

-- Validation : rank >= 6, pas soi-même
create policy "rep_update_validation" on reports for update
  using (mon_rang() >= 6 and auteur_id != mon_user_id());

-- ============================================================
-- REPORT_ATTACHMENTS
-- ============================================================
create policy "ra_lecture" on report_attachments for select
  using (
    exists(
      select 1 from reports r
      where r.id = report_id
        and (r.auteur_id = mon_user_id() or mon_rang() >= 6)
    )
  );

create policy "ra_insert" on report_attachments for insert
  with check (
    exists(
      select 1 from reports r
      where r.id = report_id and r.auteur_id = mon_user_id()
    )
  );

-- ============================================================
-- SANCTIONS
-- ============================================================
-- Je vois les miennes
create policy "sanc_lecture_moi" on sanctions for select
  using (user_id = mon_user_id());

-- Rank >= 6 voient les sanctions (rang >=7 voit tout)
create policy "sanc_lecture_op" on sanctions for select
  using (mon_rang() >= 6);

create policy "sanc_insert" on sanctions for insert
  with check (mon_rang() >= 6 and user_id != mon_user_id());

create policy "sanc_update" on sanctions for update
  using (mon_rang() >= 7);

-- ============================================================
-- REQUESTS
-- ============================================================
create policy "req_lecture_moi" on requests for select
  using (demandeur_id = mon_user_id());

create policy "req_lecture_admin" on requests for select
  using (mon_rang() >= 6);

create policy "req_insert" on requests for insert
  with check (demandeur_id = mon_user_id() and suis_actif());

create policy "req_update" on requests for update
  using (mon_rang() >= 6);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create policy "doc_lecture" on documents for select
  using (suis_actif() and rank_min <= mon_rang());

create policy "doc_insert" on documents for insert
  with check (mon_rang() >= 6);

create policy "doc_update" on documents for update
  using (mon_rang() >= 6);

create policy "doc_delete" on documents for delete
  using (mon_rang() >= 7);

-- ============================================================
-- ARCHIVES
-- ============================================================
create policy "arch_lecture" on archives for select
  using (mon_rang() >= 6);

create policy "arch_insert" on archives for insert
  with check (mon_rang() >= 7);

-- ============================================================
-- ARCHIVE_RECORDS
-- ============================================================
create policy "ar_lecture" on archive_records for select
  using (mon_rang() >= 6);

create policy "ar_insert" on archive_records for insert
  with check (mon_rang() >= 7);

-- ============================================================
-- AUDIT_LOGS
-- ============================================================
-- Je vois toujours mes propres actions
create policy "audit_lecture_moi" on audit_logs for select
  using (acteur_id = mon_user_id() or cible_user_id = mon_user_id());

-- Rank >= 6 voit tout
create policy "audit_lecture_admin" on audit_logs for select
  using (mon_rang() >= 6);

-- Insertion libre (logged par le backend)
create policy "audit_insert" on audit_logs for insert
  with check (true);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create policy "notif_lecture" on notifications for select
  using (user_id = mon_user_id());

create policy "notif_update" on notifications for update
  using (user_id = mon_user_id());

create policy "notif_insert" on notifications for insert
  with check (true); -- via service role / triggers

-- ============================================================
-- RANK_HISTORY
-- ============================================================
create policy "rh_lecture" on rank_history for select
  using (user_id = mon_user_id() or mon_rang() >= 6);

create policy "rh_insert" on rank_history for insert
  with check (mon_rang() >= 7);

-- ============================================================
-- FIN RLS
-- ============================================================
