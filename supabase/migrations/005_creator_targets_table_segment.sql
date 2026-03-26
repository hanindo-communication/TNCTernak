-- Meja (Hanindo PCP / FOLO Public / All) per baris target — dari Submit Targets, bukan dari brand.
alter table public.creator_targets
  add column if not exists table_segment text;

update public.creator_targets
set table_segment = 'all'
where table_segment is null;

alter table public.creator_targets drop constraint if exists creator_targets_table_segment_check;

alter table public.creator_targets
  add constraint creator_targets_table_segment_check
  check (table_segment in ('all', 'tnc', 'folo'));

alter table public.creator_targets
  alter column table_segment set default 'all';

alter table public.creator_targets
  alter column table_segment set not null;

comment on column public.creator_targets.table_segment is
  'Segmen meja dari form Submit Targets: all | tnc | folo.';
