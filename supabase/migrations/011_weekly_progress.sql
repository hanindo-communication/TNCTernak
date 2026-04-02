-- Weekly progress dashboard: satu dokumen JSON per user per bulan (format v2 rows).

create table if not exists public.weekly_progress (
  user_id uuid not null references auth.users on delete cascade,
  month_key text not null,
  version smallint not null default 2,
  rows jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

create index if not exists idx_weekly_progress_user_updated
  on public.weekly_progress (user_id, updated_at desc);

comment on table public.weekly_progress is
  'Weekly progress modal: array of row objects (weekIndex, campaign fields).';

alter table public.weekly_progress enable row level security;

drop policy if exists "weekly_progress_all_own" on public.weekly_progress;

create policy "weekly_progress_all_own"
  on public.weekly_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
