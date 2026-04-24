-- ============================================================
-- USM - RLS pour les nouvelles tables (refactor)
-- A executer APRES 05_refactor.sql
-- ============================================================

alter table training_registrations enable row level security;
alter table training_attendance enable row level security;
alter table announcements enable row level security;
alter table report_templates enable row level security;
alter table helpdesk_tickets enable row level security;
alter table helpdesk_messages enable row level security;
alter table recrutements enable row level security;
alter table rc_resultats enable row level security;
alter table attestations enable row level security;

-- ============================================================
-- TRAINING_REGISTRATIONS : tout membre actif peut s'inscrire/voir
-- ============================================================
drop policy if exists treg_select on training_registrations;
create policy treg_select on training_registrations for select
  using (suis_actif());

drop policy if exists treg_insert on training_registrations;
create policy treg_insert on training_registrations for insert
  with check (user_id = mon_user_id() and suis_actif());

drop policy if exists treg_update on training_registrations;
create policy treg_update on training_registrations for update
  using (user_id = mon_user_id() or est_operateur_min());

drop policy if exists treg_delete on training_registrations;
create policy treg_delete on training_registrations for delete
  using (user_id = mon_user_id() or est_operateur_min());

-- ============================================================
-- TRAINING_ATTENDANCE : tous voient, HG (rank>=5) cochent
-- ============================================================
drop policy if exists tatt_select on training_attendance;
create policy tatt_select on training_attendance for select
  using (suis_actif());

drop policy if exists tatt_insert on training_attendance;
create policy tatt_insert on training_attendance for insert
  with check (est_op_second_min());

drop policy if exists tatt_update on training_attendance;
create policy tatt_update on training_attendance for update
  using (est_op_second_min());

-- ============================================================
-- ANNOUNCEMENTS : tous lisent, op-second+ creent, co-lead+ modifient
-- ============================================================
drop policy if exists annonce_select on announcements;
create policy annonce_select on announcements for select
  using (suis_actif());

drop policy if exists annonce_insert on announcements;
create policy annonce_insert on announcements for insert
  with check (est_op_second_min() or auteur_id = mon_user_id());

drop policy if exists annonce_update on announcements;
create policy annonce_update on announcements for update
  using (est_colead_min() or auteur_id = mon_user_id());

drop policy if exists annonce_delete on announcements;
create policy annonce_delete on announcements for delete
  using (est_colead_min());

-- ============================================================
-- REPORT_TEMPLATES : tous lisent, co-lead+ modifient
-- ============================================================
drop policy if exists rt_select on report_templates;
create policy rt_select on report_templates for select
  using (suis_actif());

drop policy if exists rt_all on report_templates;
create policy rt_all on report_templates for all
  using (est_colead_min())
  with check (est_colead_min());

-- ============================================================
-- HELPDESK_TICKETS : op-second+ creent, co-lead+ traitent
-- Auteur voit le sien; co-lead+ voient tout
-- ============================================================
drop policy if exists help_select on helpdesk_tickets;
create policy help_select on helpdesk_tickets for select
  using (auteur_id = mon_user_id() or cible_user_id = mon_user_id() or est_colead_min());

drop policy if exists help_insert on helpdesk_tickets;
create policy help_insert on helpdesk_tickets for insert
  with check (est_op_second_min() and auteur_id = mon_user_id());

drop policy if exists help_update on helpdesk_tickets;
create policy help_update on helpdesk_tickets for update
  using (est_colead_min() or (auteur_id = mon_user_id() and statut = 'ouvert'));

drop policy if exists help_delete on helpdesk_tickets;
create policy help_delete on helpdesk_tickets for delete
  using (est_colead_min());

-- ============================================================
-- HELPDESK_MESSAGES : auteur ticket + staff
-- ============================================================
drop policy if exists hmsg_select on helpdesk_messages;
create policy hmsg_select on helpdesk_messages for select
  using (
    exists(
      select 1 from helpdesk_tickets t
      where t.id = ticket_id
        and (t.auteur_id = mon_user_id() or t.cible_user_id = mon_user_id() or est_colead_min())
    )
    and (interne = false or est_colead_min())
  );

drop policy if exists hmsg_insert on helpdesk_messages;
create policy hmsg_insert on helpdesk_messages for insert
  with check (
    auteur_id = mon_user_id()
    and exists(
      select 1 from helpdesk_tickets t
      where t.id = ticket_id
        and (t.auteur_id = mon_user_id() or est_colead_min())
    )
  );

-- ============================================================
-- RECRUTEMENTS : visible si formateur badge ou co-lead+
-- ============================================================
drop policy if exists recr_select on recrutements;
create policy recr_select on recrutements for select
  using (peut_voir_formateurs());

drop policy if exists recr_insert on recrutements;
create policy recr_insert on recrutements for insert
  with check (peut_voir_formateurs());

drop policy if exists recr_update on recrutements;
create policy recr_update on recrutements for update
  using (peut_voir_formateurs());

drop policy if exists recr_delete on recrutements;
create policy recr_delete on recrutements for delete
  using (est_colead_min());

-- ============================================================
-- RC_RESULTATS : visible si formateur badge ou co-lead+
-- ============================================================
drop policy if exists rcr_select on rc_resultats;
create policy rcr_select on rc_resultats for select
  using (peut_voir_formateurs());

drop policy if exists rcr_insert on rc_resultats;
create policy rcr_insert on rc_resultats for insert
  with check (peut_voir_formateurs());

drop policy if exists rcr_update on rc_resultats;
create policy rcr_update on rc_resultats for update
  using (peut_voir_formateurs());

drop policy if exists rcr_delete on rc_resultats;
create policy rcr_delete on rc_resultats for delete
  using (est_colead_min());

-- ============================================================
-- ATTESTATIONS : co-lead+ uniquement
-- Le beneficiaire peut voir la sienne
-- ============================================================
drop policy if exists att_select on attestations;
create policy att_select on attestations for select
  using (beneficiaire_id = mon_user_id() or est_colead_min());

drop policy if exists att_all on attestations for all;
create policy att_all on attestations for all
  using (est_colead_min())
  with check (est_colead_min());

-- ============================================================
-- Mise a jour politiques REPORTS : publication par HG
-- ============================================================
drop policy if exists rep_select on reports;
create policy rep_select on reports for select
  using (
    auteur_id = mon_user_id()
    or publie = true
    or est_op_second_min()
  );

drop policy if exists rep_update on reports;
create policy rep_update on reports for update
  using (
    (auteur_id = mon_user_id() and publie = false)
    or est_op_second_min()
  );

-- ============================================================
-- FIN RLS REFACTOR
-- ============================================================
