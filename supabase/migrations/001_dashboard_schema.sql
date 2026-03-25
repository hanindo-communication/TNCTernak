-- Run this in Supabase SQL Editor (or supabase db push) for project dnphxqaqlyniobnlicfx
-- https://supabase.com/dashboard/project/dnphxqaqlyniobnlicfx/sql

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

-- Auto-create profile on signup
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
