-- =============================================================================
-- TNC Ternak — terapkan SEMUA migrasi workspace (Postgres + RLS bersama + kolom brand)
-- =============================================================================
-- Pakai file ini jika project Supabase MASIH KOSONG (belum pernah jalan 001).
-- Jika 001/002 sudah pernah dijalankan, jangan jalankan utuh — gunakan file
-- per nomor yang belum (mis. hanya 003_brands_table_segment.sql).
-- Setelah sukses, di SQL Editor jalankan juga:
--   notify pgrst, 'reload schema';
-- =============================================================================

-- ----- 001_dashboard_schema.sql -----
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  table_segment text not null default 'tnc' check (table_segment in ('tnc', 'folo')),
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  brand_id uuid references public.brands(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  avatar_url text not null default '',
  handle_tiktok text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  brand_ids uuid[] not null default '{}',
  creator_type text not null check (creator_type in ('Internal','External','AssetLoan')),
  created_at timestamptz default now()
);

create table if not exists public.campaign_objectives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text not null,
  created_at timestamptz default now()
);

create table if not exists public.tiktok_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  label text not null,
  created_at timestamptz default now()
);

create table if not exists public.creator_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  campaign_objective_id uuid not null references public.campaign_objectives(id) on delete cascade,
  creator_type text not null check (creator_type in ('Internal','External','AssetLoan')),
  tiktok_account_id uuid not null references public.tiktok_accounts(id) on delete cascade,
  month text not null,
  target_videos int not null default 0,
  submitted_videos int not null default 0,
  incentive_per_video numeric not null default 0,
  base_pay numeric not null default 0,
  expected_revenue numeric not null default 0,
  actual_revenue numeric not null default 0,
  incentives numeric not null default 0,
  reimbursements numeric not null default 0,
  expected_profit numeric not null default 0,
  actual_profit numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint creator_targets_leaf_unique unique (
    user_id,
    creator_id,
    project_id,
    campaign_objective_id,
    tiktok_account_id,
    month
  )
);

create index if not exists idx_creator_targets_user_month on public.creator_targets (user_id, month);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.brands enable row level security;
alter table public.projects enable row level security;
alter table public.creators enable row level security;
alter table public.campaign_objectives enable row level security;
alter table public.tiktok_accounts enable row level security;
alter table public.creator_targets enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "orgs_all_own" on public.organizations for all using (auth.uid() = user_id);
create policy "brands_all_own" on public.brands for all using (auth.uid() = user_id);
create policy "projects_all_own" on public.projects for all using (auth.uid() = user_id);
create policy "creators_all_own" on public.creators for all using (auth.uid() = user_id);
create policy "campaigns_all_own" on public.campaign_objectives for all using (auth.uid() = user_id);
create policy "tiktok_all_own" on public.tiktok_accounts for all using (auth.uid() = user_id);
create policy "targets_all_own" on public.creator_targets for all using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----- 002_shared_workspace_rls.sql -----
begin;

drop policy if exists "orgs_all_own" on public.organizations;
drop policy if exists "brands_all_own" on public.brands;
drop policy if exists "projects_all_own" on public.projects;
drop policy if exists "creators_all_own" on public.creators;
drop policy if exists "campaigns_all_own" on public.campaign_objectives;
drop policy if exists "tiktok_all_own" on public.tiktok_accounts;
drop policy if exists "targets_all_own" on public.creator_targets;

alter table public.organizations drop constraint if exists organizations_user_id_fkey;
alter table public.brands drop constraint if exists brands_user_id_fkey;
alter table public.projects drop constraint if exists projects_user_id_fkey;
alter table public.creators drop constraint if exists creators_user_id_fkey;
alter table public.campaign_objectives drop constraint if exists campaign_objectives_user_id_fkey;
alter table public.tiktok_accounts drop constraint if exists tiktok_accounts_user_id_fkey;
alter table public.creator_targets drop constraint if exists creator_targets_user_id_fkey;

update public.organizations set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.brands set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.projects set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.creators set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.campaign_objectives set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.tiktok_accounts set user_id = '00000000-0000-0000-0000-000000000001'::uuid;
update public.creator_targets set user_id = '00000000-0000-0000-0000-000000000001'::uuid;

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

-- ----- 003_brands_table_segment.sql (idempotent untuk DB lama tanpa kolom) -----
alter table public.brands
  add column if not exists table_segment text;

update public.brands
set table_segment = 'tnc'
where table_segment is null;

alter table public.brands
  drop constraint if exists brands_table_segment_check;

alter table public.brands
  add constraint brands_table_segment_check
  check (table_segment in ('tnc', 'folo'));

alter table public.brands
  alter column table_segment set not null;

comment on column public.brands.table_segment is 'Segment chip: tnc (TNC Hanindo) atau folo (FOLO).';

-- ----- 004_postgrest_schema_reload_rpc.sql (retry otomatis dari browser) -----
create or replace function public.request_postgrest_schema_reload()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_notify('pgrst', 'reload schema');
end;
$$;

comment on function public.request_postgrest_schema_reload() is
  'Triggers PostgREST schema cache reload; used by dashboard after PGRST205 / stale schema.';

revoke all on function public.request_postgrest_schema_reload() from public;
grant execute on function public.request_postgrest_schema_reload() to authenticated;
grant execute on function public.request_postgrest_schema_reload() to service_role;

-- Refresh cache API Supabase (PostgREST)
notify pgrst, 'reload schema';
