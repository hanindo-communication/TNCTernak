-- Dipanggil dari app (supabase.rpc) saat PostgREST masih cache lama setelah DDL.
-- Jalankan migrasi ini di SQL Editor setelah 001–003 agar retry otomatis di browser jalan.

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
