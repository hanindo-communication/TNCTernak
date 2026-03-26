-- Daftar URL video yang disubmit per baris target (jsonb array of text).
alter table public.creator_targets
  add column if not exists submitted_video_urls jsonb not null default '[]'::jsonb;

comment on column public.creator_targets.submitted_video_urls is
  'Array URL TikTok per video, disinkron dengan hitungan submitted dan actual revenue.';

notify pgrst, 'reload schema';
