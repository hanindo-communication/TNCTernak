-- Workspace dashboard bersama: semua user terautentikasi memakai user_id sentinel
-- (bukan FK ke auth.users). Normalisasi data lama ke UUID yang sama.

begin;

-- Hapus kebijakan per-user
drop policy if exists "orgs_all_own" on public.organizations;
drop policy if exists "brands_all_own" on public.brands;
drop policy if exists "projects_all_own" on public.projects;
drop policy if exists "creators_all_own" on public.creators;
drop policy if exists "campaigns_all_own" on public.campaign_objectives;
drop policy if exists "tiktok_all_own" on public.tiktok_accounts;
drop policy if exists "targets_all_own" on public.creator_targets;

-- Lepaskan FK user_id -> auth.users agar sentinel UUID valid
alter table public.organizations drop constraint if exists organizations_user_id_fkey;
alter table public.brands drop constraint if exists brands_user_id_fkey;
alter table public.projects drop constraint if exists projects_user_id_fkey;
alter table public.creators drop constraint if exists creators_user_id_fkey;
alter table public.campaign_objectives drop constraint if exists campaign_objectives_user_id_fkey;
alter table public.tiktok_accounts drop constraint if exists tiktok_accounts_user_id_fkey;
alter table public.creator_targets drop constraint if exists creator_targets_user_id_fkey;

-- Satukan ke workspace bersama
update public.organizations set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.brands set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.projects set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.creators set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.campaign_objectives set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.tiktok_accounts set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.creator_targets set user_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Akses penuh untuk role authenticated (baca/tulis bersama)
create policy "orgs_shared_auth"
  on public.organizations for all to authenticated using (true) with check (true);

create policy "brands_shared_auth"
  on public.brands for all to authenticated using (true) with check (true);

create policy "projects_shared_auth"
  on public.projects for all to authenticated using (true) with check (true);

create policy "creators_shared_auth"
  on public.creators for all to authenticated using (true) with check (true);

create policy "campaigns_shared_auth"
  on public.campaign_objectives for all to authenticated using (true) with check (true);

create policy "tiktok_shared_auth"
  on public.tiktok_accounts for all to authenticated using (true) with check (true);

create policy "targets_shared_auth"
  on public.creator_targets for all to authenticated using (true) with check (true);

commit;
