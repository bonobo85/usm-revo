-- ============================================================
-- USM - Storage buckets (photos profil, documents)
-- A executer dans Supabase (SQL editor)
-- ============================================================

-- Bucket avatars (public)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Bucket documents prives (carte identite, permis)
insert into storage.buckets (id, name, public)
values ('documents-prives', 'documents-prives', false)
on conflict (id) do nothing;

-- Bucket attachments rapports
insert into storage.buckets (id, name, public)
values ('rapports', 'rapports', false)
on conflict (id) do nothing;

-- Policies : uploads autorises aux utilisateurs authentifies
drop policy if exists "avatars_all" on storage.objects;
create policy "avatars_all" on storage.objects for all to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

drop policy if exists "docs_prives_select_owner" on storage.objects;
create policy "docs_prives_select_owner" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents-prives'
    and (
      owner = auth.uid()
      or (current_setting('request.jwt.claims', true)::json->>'rank_level')::int >= 7
    )
  );

drop policy if exists "docs_prives_insert_owner" on storage.objects;
create policy "docs_prives_insert_owner" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents-prives' and owner = auth.uid());

drop policy if exists "docs_prives_update_owner" on storage.objects;
create policy "docs_prives_update_owner" on storage.objects for update to authenticated
  using (bucket_id = 'documents-prives' and owner = auth.uid());

drop policy if exists "rapports_authenticated" on storage.objects;
create policy "rapports_authenticated" on storage.objects for all to authenticated
  using (bucket_id = 'rapports')
  with check (bucket_id = 'rapports');
