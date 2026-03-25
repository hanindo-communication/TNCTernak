# Supabase setup (TNC Ternak)

Project dashboard: [Supabase project](https://supabase.com/dashboard/project/dnphxqaqlyniobnlicfx)

## 1. Environment variables

1. Open **Project Settings → API**.
2. Copy **Project URL** and the **Publishable** key (`sb_publishable_...`). Put it in `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the Supabase JS client accepts the publishable key the same way as the legacy anon JWT).
3. **Secret** key (`sb_secret_...`) is only for trusted server code. Set `SUPABASE_SECRET_KEY` in Vercel/server **without** the `NEXT_PUBLIC_` prefix. Do not expose it to the browser. The current dashboard only needs URL + publishable unless you add admin routes.
4. On **Vercel**, add the same public variables for Production / Preview / Development.

Project URL: `https://dnphxqaqlyniobnlicfx.supabase.co`

## 2. Database schema

Run the SQL in `supabase/migrations/001_dashboard_schema.sql` via **SQL Editor** in the Supabase dashboard (or use Supabase CLI).

This creates tables, RLS policies, and a trigger to insert a `profiles` row when a user signs up.

## 3. Auth URLs (for Vercel)

Under **Authentication → URL configuration**:

- **Site URL**: your Vercel URL, e.g. `https://your-app.vercel.app`
- **Redirect URLs**: add  
  `http://localhost:3000/**`  
  `https://your-app.vercel.app/**`

## 4. First login

1. Register on `/login` or create a user under **Authentication → Users**.
2. After login, click **Muat data demo** once to seed example creators and targets (stored per user in Postgres).

Data then persists across deploys because it lives in Supabase, not in the Next.js build.
