-- ============================================================
-- USM - TRIGGERS AUTOMATIQUES
-- A executer APRES 02_rls.sql
-- ============================================================

-- ============================================================
-- Trigger : rank_history à chaque changement de rang
-- ============================================================
create or replace function log_changement_rang()
returns trigger as $$
begin
  if old.rank_level is distinct from new.rank_level then
    insert into rank_history (user_id, ancien_rank, nouveau_rank, modifie_par)
    values (new.id, old.rank_level, new.rank_level, mon_user_id());
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_changement_rang on users;
create trigger trg_changement_rang after update on users
  for each row execute function log_changement_rang();

-- ============================================================
-- Trigger : notif quand rapport soumis (notifie rank >= 6)
-- ============================================================
create or replace function notif_rapport_soumis()
returns trigger as $$
begin
  if old.statut = 'draft' and new.statut = 'submitted' then
    insert into notifications (user_id, type, titre, message, lien)
    select id, 'rapport_soumis',
      'Nouveau rapport à valider',
      'Un rapport "' || new.titre || '" attend validation',
      '/rapports/' || new.id::text
    from users
    where rank_level >= 6 and is_active = true and id != new.auteur_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notif_rapport on reports;
create trigger trg_notif_rapport after update on reports
  for each row execute function notif_rapport_soumis();

-- ============================================================
-- Trigger : notif quand rapport validé/rejeté
-- ============================================================
create or replace function notif_rapport_traite()
returns trigger as $$
begin
  if old.statut = 'submitted' and new.statut in ('validated','rejected') then
    insert into notifications (user_id, type, titre, message, lien)
    values (
      new.auteur_id,
      'rapport_traite',
      case when new.statut = 'validated' then 'Rapport validé' else 'Rapport rejeté' end,
      'Votre rapport "' || new.titre || '" a été ' || case when new.statut = 'validated' then 'validé' else 'rejeté' end,
      '/rapports/' || new.id::text
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notif_rapport_traite on reports;
create trigger trg_notif_rapport_traite after update on reports
  for each row execute function notif_rapport_traite();

-- ============================================================
-- Trigger : notif quand sanction créée
-- ============================================================
create or replace function notif_sanction_creee()
returns trigger as $$
begin
  insert into notifications (user_id, type, titre, message, lien)
  values (
    new.user_id,
    'sanction',
    'Nouvelle sanction',
    'Une sanction de type "' || new.type || '" vous a été attribuée',
    '/sanctions'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notif_sanction on sanctions;
create trigger trg_notif_sanction after insert on sanctions
  for each row execute function notif_sanction_creee();

-- ============================================================
-- Trigger : notif quand demande traitée
-- ============================================================
create or replace function notif_demande_traitee()
returns trigger as $$
begin
  if old.statut = 'en_attente' and new.statut in ('approuve','refuse') then
    insert into notifications (user_id, type, titre, message, lien)
    values (
      new.demandeur_id,
      'demande_traitee',
      'Demande ' || case when new.statut = 'approuve' then 'approuvée' else 'refusée' end,
      'Votre demande a été traitée',
      '/demandes'
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notif_demande on requests;
create trigger trg_notif_demande after update on requests
  for each row execute function notif_demande_traitee();

-- ============================================================
-- Trigger : notif quand badge attribué / retiré
-- ============================================================
create or replace function notif_badge_change()
returns trigger as $$
declare
  nom_badge text;
begin
  select nom into nom_badge from badges where id = new.badge_id;

  if tg_op = 'INSERT' and new.is_active = true then
    insert into notifications (user_id, type, titre, message, lien)
    values (
      new.user_id,
      'badge_attribue',
      'Badge attribué',
      'Le badge "' || nom_badge || '" vous a été attribué',
      '/badges'
    );
  elsif tg_op = 'UPDATE' and old.is_active = true and new.is_active = false then
    insert into notifications (user_id, type, titre, message, lien)
    values (
      new.user_id,
      'badge_retire',
      'Badge retiré',
      'Le badge "' || nom_badge || '" vous a été retiré',
      '/badges'
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notif_badge_ins on user_badges;
create trigger trg_notif_badge_ins after insert on user_badges
  for each row execute function notif_badge_change();

drop trigger if exists trg_notif_badge_upd on user_badges;
create trigger trg_notif_badge_upd after update on user_badges
  for each row execute function notif_badge_change();

-- ============================================================
-- Trigger : notif évaluation planifiée
-- ============================================================
create or replace function notif_eval_planifiee()
returns trigger as $$
begin
  insert into notifications (user_id, type, titre, message, lien)
  values (
    new.candidat_id,
    'evaluation_planifiee',
    'Nouvelle évaluation planifiée',
    'Une évaluation est prévue le ' || to_char(new.date_planifiee, 'DD/MM/YYYY HH24:MI'),
    '/formateurs'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notif_eval on evaluations;
create trigger trg_notif_eval after insert on evaluations
  for each row execute function notif_eval_planifiee();

-- ============================================================
-- STORAGE BUCKETS (à créer manuellement ou via SQL)
-- ============================================================
-- Dans Supabase, crée les buckets suivants dans Storage:
-- - avatars (public)
-- - rapports (privé)
-- - documents (privé)
-- - investigations (privé)
--
-- Policies à ajouter via l'UI Supabase Storage

-- ============================================================
-- FIN TRIGGERS
-- ============================================================
