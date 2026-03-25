-- Segment table untuk chip filter (TNC Hanindo vs FOLO), per brand.
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

notify pgrst, 'reload schema';
