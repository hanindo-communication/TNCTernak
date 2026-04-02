/**
 * Maps Supabase JS / PostgREST errors to short, actionable text for toasts.
 */

function extractParts(e: unknown): {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
} {
  if (e == null) {
    return { message: "Unknown error" };
  }
  if (typeof e === "object" && e !== null && "message" in e) {
    const err = e as {
      message: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return {
      message: err.message ?? "Unknown error",
      details: err.details,
      hint: err.hint,
      code: err.code,
    };
  }
  if (e instanceof Error) {
    return { message: e.message };
  }
  return { message: String(e) };
}

/** Untuk console.warn (bukan console.error) — hindari overlay error Next.js dev. */
export function supabaseErrorDebugPayload(e: unknown): Record<string, unknown> {
  if (e != null && typeof e === "object") {
    const o = e as Record<string, unknown>;
    return {
      message: o.message,
      code: o.code,
      details: o.details,
      hint: o.hint,
    };
  }
  return { value: String(e) };
}

export function formatSupabaseClientError(e: unknown): string {
  const { message, details, hint, code } = extractParts(e);
  const lower = message.toLowerCase();
  const codeU = code?.toUpperCase() ?? "";

  if (
    lower.includes("table_segment") &&
    (lower.includes("does not exist") ||
      lower.includes("column") ||
      lower.includes("schema cache"))
  ) {
    const mentionsCreatorTargets =
      lower.includes("creator_targets") ||
      lower.includes("creator targets");
    if (mentionsCreatorTargets) {
      return [
        "Kolom creator_targets.table_segment belum ada (diperlukan untuk simpan kolom Table di Edit target).",
        "Buka Supabase → SQL Editor: jalankan urutan supabase/migrations/005_creator_targets_table_segment.sql lalu 006_creator_targets_unique_table_segment.sql, akhiri dengan NOTIFY pgrst, 'reload schema';",
        "Jika Data settings gagal sinkron brand: jalankan juga 003_brands_table_segment.sql.",
        "Detail: cursor-docs/supabase-setup.md.",
      ].join(" ");
    }
    return [
      "Kolom brands.table_segment belum ada di database (diperlukan untuk Simpan & sinkron Data settings / brand).",
      "Buka Supabase → SQL Editor, jalankan supabase/migrations/003_brands_table_segment.sql lalu: NOTIFY pgrst, 'reload schema';",
      "Detail: cursor-docs/supabase-setup.md.",
    ].join(" ");
  }

  if (
    lower.includes("submitted_video_urls") &&
    (lower.includes("does not exist") ||
      lower.includes("column") ||
      lower.includes("schema cache"))
  ) {
    return [
      "Kolom creator_targets.submitted_video_urls belum ada (simpan link video / upsert target).",
      "Supabase → SQL Editor: jalankan supabase/migrations/008_submitted_video_urls.sql, lalu: NOTIFY pgrst, 'reload schema';",
      "Atau jalan urutan incremental: supabase/manual/apply_migrations_005_to_008.sql (termasuk 008–009 + NOTIFY di akhir).",
      "Lokal: npm run db:apply-video-urls (perlu DATABASE_URL di .env.local).",
      "Detail: cursor-docs/supabase-setup.md.",
    ].join(" ");
  }

  if (
    lower.includes("workspace_activity_log") &&
    (lower.includes("does not exist") ||
      lower.includes("could not find the table") ||
      lower.includes("schema cache") ||
      codeU === "PGRST205")
  ) {
    return [
      "Tabel workspace_activity_log (Riwayat perubahan) belum ada atau cache PostgREST belum mengenalinya.",
      "Supabase → SQL Editor: jalankan supabase/migrations/009_workspace_activity_log.sql atau supabase/manual/apply_migration_009_workspace_activity_log.sql, lalu: NOTIFY pgrst, 'reload schema';",
      "Jika DB sudah 001–008: cukup jalankan supabase/manual/apply_migrations_005_to_008.sql sekali (bagian 009 idempotent; NOTIFY di akhir).",
      "Detail: cursor-docs/supabase-setup.md.",
    ].join(" ");
  }

  if (
    lower.includes("weekly_progress") &&
    (lower.includes("does not exist") ||
      lower.includes("could not find the table") ||
      lower.includes("schema cache") ||
      codeU === "PGRST205")
  ) {
    return [
      "Tabel weekly_progress (simpan Weekly progress ke cloud) belum ada atau belum ter-cache.",
      "Supabase → SQL Editor: jalankan supabase/migrations/011_weekly_progress.sql atau supabase/manual/apply_migration_011_weekly_progress.sql (sudah berisi NOTIFY reload schema).",
      "Detail: cursor-docs/supabase-setup.md.",
    ].join(" ");
  }

  if (
    codeU === "PGRST205" ||
    lower.includes("could not find the table") ||
    lower.includes("schema cache")
  ) {
    return [
      "Tabel di Postgres belum dibuat atau cache API belum mengenali skema.",
      "DB baru: jalankan sekali supabase/manual/apply_all_migrations.sql (001–009 + RPC + NOTIFY).",
      "Sudah punya 001–004: jangan ulang apply_all utuh — jalankan supabase/manual/apply_migrations_005_to_008.sql lalu NOTIFY (sudah di akhir file; termasuk 009).",
      "Hanya cache ketinggal: SQL Editor → NOTIFY pgrst, 'reload schema'; atau tunggu retry otomatis setelah migrasi 004.",
      "Detail: cursor-docs/supabase-setup.md.",
    ].join(" ");
  }

  if (
    lower.includes("violates foreign key constraint") &&
    lower.includes("user_id")
  ) {
    return [
      "Baris memakai user_id workspace bersama; migrasi 001 saja belum cukup.",
      "Jalankan supabase/migrations/002_shared_workspace_rls.sql setelah 001 (cursor-docs/supabase-setup.md).",
    ].join(" ");
  }

  const parts = [message, details, hint].filter(
    (s): s is string => Boolean(s && String(s).trim()),
  );
  if (code) parts.push(`[${code}]`);
  return parts.join(" — ");
}
