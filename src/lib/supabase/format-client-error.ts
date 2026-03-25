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

export function formatSupabaseClientError(e: unknown): string {
  const { message, details, hint, code } = extractParts(e);
  const lower = message.toLowerCase();
  const codeU = code?.toUpperCase() ?? "";

  if (
    lower.includes("table_segment") &&
    (lower.includes("does not exist") || lower.includes("column"))
  ) {
    return [
      "Kolom brands.table_segment belum ada di database (diperlukan untuk Simpan & sinkron).",
      "Buka Supabase → SQL Editor, jalankan supabase/migrations/003_brands_table_segment.sql lalu: NOTIFY pgrst, 'reload schema';",
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
      "Buka Supabase → SQL Editor: untuk DB baru, jalankan sekali supabase/manual/apply_all_migrations.sql; atau berurutan 001 → 002 → 003 di supabase/migrations/.",
      "Jika tabel sudah ada di Table Editor: NOTIFY pgrst, 'reload schema';",
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
