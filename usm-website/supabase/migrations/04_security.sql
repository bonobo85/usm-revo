-- ============================================================
-- USM - STORAGE POLICIES + SECURITE SUPPLEMENTAIRE
-- A executer APRES 03_triggers.sql
-- ET APRES avoir créé les buckets dans Supabase Storage UI
-- ============================================================

-- ============================================================
-- BUCKETS ATTENDUS (à créer via UI Supabase Storage) :
-- - documents (privé) - pour les documents officiels
-- - rapports (privé) - pièces jointes rapports
-- - investigations (privé) - screenshots CRASH
-- - avatars (public) - optionnel
-- ============================================================

-- ============================================================
-- Fonctions helper pour Storage
-- ============================================================

-- Récupère l'user_id depuis le JWT (côté storage)
-- Le JWT custom contient déjà user_id
create or replace function storage_mon_user_id()
returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'user_id','')::uuid;
$$ language sql stable;

create or replace function storage_mon_rang()
returns integer as $$
  select coalesce((select rank_level from users where id = storage_mon_user_id() and is_active = true), 0);
$$ language sql stable;

-- ============================================================
-- STORAGE POLICIES : bucket "documents"
-- ============================================================

-- Lecture : membres actifs uniquement, respectent le rank_min du document
create policy "docs_lecture" on storage.objects for select
  using (
    bucket_id = 'documents'
    and storage_mon_rang() > 0
  );

-- Upload : rank >= 6
create policy "docs_upload" on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and storage_mon_rang() >= 6
  );

-- Delete : rank >= 7
create policy "docs_delete" on storage.objects for delete
  using (
    bucket_id = 'documents'
    and storage_mon_rang() >= 7
  );

-- ============================================================
-- STORAGE POLICIES : bucket "rapports"
-- ============================================================

create policy "rap_lecture" on storage.objects for select
  using (
    bucket_id = 'rapports'
    and storage_mon_rang() > 0
  );

create policy "rap_upload" on storage.objects for insert
  with check (
    bucket_id = 'rapports'
    and storage_mon_rang() >= 1
  );

-- ============================================================
-- STORAGE POLICIES : bucket "investigations"
-- ============================================================

create policy "inv_lecture_storage" on storage.objects for select
  using (
    bucket_id = 'investigations'
    and storage_mon_rang() >= 6
    and exists(
      select 1 from user_badges ub
      join badges b on b.id = ub.badge_id
      where ub.user_id = storage_mon_user_id()
        and b.code = 'CRASH'
        and ub.is_active = true
    )
  );

create policy "inv_upload_storage" on storage.objects for insert
  with check (
    bucket_id = 'investigations'
    and storage_mon_rang() >= 6
  );

-- ============================================================
-- STORAGE POLICIES : bucket "avatars"
-- ============================================================

create policy "avat_public" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avat_upload" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and storage_mon_user_id() is not null
  );

-- ============================================================
-- CONTRAINTES SUPPLEMENTAIRES
-- ============================================================

-- Impossible de se sanctionner soi-même (check constraint)
alter table sanctions drop constraint if exists check_pas_sanction_soi;
alter table sanctions add constraint check_pas_sanction_soi
  check (user_id != createur_id);

-- Impossible de valider son propre rapport
alter table reports drop constraint if exists check_pas_auto_validation;
alter table reports add constraint check_pas_auto_validation
  check (validateur_id is null or validateur_id != auteur_id);

-- Impossible de traiter sa propre demande
alter table requests drop constraint if exists check_pas_auto_traitement;
alter table requests add constraint check_pas_auto_traitement
  check (traite_par is null or traite_par != demandeur_id);

-- Évaluation : formateur ≠ candidat
alter table evaluations drop constraint if exists check_form_diff_candidat;
alter table evaluations add constraint check_form_diff_candidat
  check (formateur_id != candidat_id);

-- ============================================================
-- FONCTION : expiration automatique des sanctions
-- ============================================================

create or replace function expirer_sanctions_depassees()
returns void as $$
begin
  update sanctions
  set is_active = false
  where is_active = true
    and date_fin is not null
    and date_fin < now();
end;
$$ language plpgsql;

-- A exécuter via cron Supabase (ou pg_cron) :
-- select cron.schedule('expirer-sanctions', '0 * * * *', 'select expirer_sanctions_depassees()');

-- ============================================================
-- INDEX PARTIELS POUR PERFORMANCE
-- ============================================================

-- Rapports actifs uniquement
create index if not exists idx_rep_actifs on reports(statut, created_at desc)
  where deleted_at is null and statut in ('draft','submitted');

-- Notifications non lues
create index if not exists idx_notif_non_lues on notifications(user_id, created_at desc)
  where read_at is null and deleted_at is null;

-- Users actifs
create index if not exists idx_users_actifs on users(rank_level desc)
  where is_active = true and deleted_at is null;

-- ============================================================
-- FONCTION : compter tentatives connexion échouées (placeholder)
-- ============================================================
-- Pour l'instant, les connexions OK sont loggées dans audit_logs.
-- On peut extraire les stats via queries.

-- ============================================================
-- FIN
-- ============================================================
