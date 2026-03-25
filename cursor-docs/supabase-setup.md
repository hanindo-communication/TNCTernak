# Supabase setup (TNC Ternak)

Project dashboard: [Supabase project](https://supabase.com/dashboard/project/dnphxqaqlyniobnlicfx)

## 1. Environment variables

1. Open **Project Settings → API**.
2. Copy **Project URL** and the **Publishable** key (`sb_publishable_...`). Put it in `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the Supabase JS client accepts the publishable key the same way as the legacy anon JWT).
3. **Secret** key (`sb_secret_...`) is only for trusted server code. Set `SUPABASE_SECRET_KEY` in Vercel/server **without** the `NEXT_PUBLIC_` prefix. Do not expose it to the browser. The current dashboard only needs URL + publishable unless you add admin routes.
4. On **Vercel**, add the same public variables for Production / Preview / Development.

Project URL: `https://dnphxqaqlyniobnlicfx.supabase.co`

## 2. Database schema (wajib sebelum Data settings / sync)

Aplikasi memakai **workspace bersama** (`user_id` sentinel). Tanpa migrasi, API akan error misalnya **`PGRST205` / "Could not find the table 'public.campaign_objectives'"** — artinya tabel belum ada atau cache PostgREST belum mengenali skema.

### Urutan yang benar

1. Buka **SQL Editor** di project: [SQL Editor](https://supabase.com/dashboard/project/dnphxqaqlyniobnlicfx/sql).

**Opsi A — database masih kosong (disarankan):** salin **seluruh** isi `supabase/manual/apply_all_migrations.sql`, jalankan sekali (Run). File itu berisi 001 + 002 + 003 + **004** (RPC reload untuk retry di browser) + `NOTIFY pgrst` di akhir.

**Opsi B — jalankan per file:**

2. `supabase/migrations/001_dashboard_schema.sql` (Run).
3. `supabase/migrations/002_shared_workspace_rls.sql` (Run).
4. `supabase/migrations/003_brands_table_segment.sql` (Run) — **wajib** jika `brands` sudah ada dari migrasi lama **tanpa** kolom `table_segment`. Install baru lewat `001` terbaru sudah menyertakan `table_segment` di `CREATE TABLE brands`; langkah 4 tetap aman (idempotent).
5. `supabase/migrations/004_postgrest_schema_reload_rpc.sql` (Run) — supaya app bisa memanggil `request_postgrest_schema_reload()` sekali lalu mengulang request saat kena cache PostgREST ketinggalan.

Tanpa **002**, insert dari app memakai UUID `00000000-0000-0000-0000-000000000001` akan **gagal foreign key** ke `auth.users`. Tanpa **001**, tabel seperti `campaign_objectives` tidak ada. Tanpa **`table_segment` pada `brands`**, **Simpan & sinkron** di Data settings akan gagal saat upsert brand.

### Error PGRST205 padahal tabel sudah ada di Table Editor

Cache API kadang tertinggal. Di SQL Editor jalankan:

```sql
notify pgrst, 'reload schema';
```

Tunggu beberapa detik, lalu coba lagi di app. Setelah **004** terpasang, dashboard akan mencoba reload cache otomatis lalu mengulang request sekali. Lihat juga [PostgREST tidak mengenali kolom/tabel baru](https://supabase.com/docs/guides/troubleshooting/postgrest-not-recognizing-new-columns-or-functions-bd75f5).

### CLI (opsional)

Dari folder repo, setelah `supabase link`: `supabase db push` (atau jalankan file migrasi sesuai workflow tim).

Migrasi membuat tabel, RLS, dan trigger `profiles` saat user baru mendaftar.

## 3. Auth URLs (for Vercel)

Under **Authentication → URL configuration**:

- **Site URL**: your Vercel URL, e.g. `https://your-app.vercel.app`
- **Redirect URLs**: add  
  `http://localhost:3000/**`  
  `https://your-app.vercel.app/**`

## 4. First login

1. Register on `/login` or create a user under **Authentication → Users**.
2. After login, click **Muat data demo** once to seed example creators and targets (workspace bersama di Postgres).

Data then persists across deploys because it lives in Supabase, not in the Next.js build.
