-- =============================================================================
-- HANYA untuk database yang sudah punya tabel brands TANPA kolom table_segment
-- (mis. 001/002 lama sudah dijalankan). Salin ke SQL Editor → Run.
-- Setelah sukses, coba lagi Simpan & sinkron di Data settings.
-- =============================================================================

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

comment on column public.brands.table_segment is 'Segment chip: tnc (Hanindo PCP) atau folo (FOLO Public).';

notify pgrst, 'reload schema';
