import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST belum mengenali tabel/kolom baru (DDL di SQL Editor, belum reload). */
export function isPostgrestSchemaError(e: unknown): boolean {
  if (e == null || typeof e !== "object") return false;
  const err = e as { code?: string; message?: string };
  const code = String(err.code ?? "").toUpperCase();
  const msg = String(err.message ?? "").toLowerCase();
  if (code === "PGRST205") return true;
  if (msg.includes("could not find the table")) return true;
  if (msg.includes("schema cache")) return true;
  return false;
}

/**
 * Satu kali retry setelah memicu reload cache (butuh migrasi 004 di Supabase).
 * Tidak membantu jika tabel memang belum dibuat — user tetap harus jalanin SQL migrasi.
 */
export async function withPostgrestSchemaRetry<T>(
  supabase: SupabaseClient,
  op: () => Promise<T>,
): Promise<T> {
  try {
    return await op();
  } catch (e) {
    if (!isPostgrestSchemaError(e)) throw e;
    // Bukan Promise standar — jangan pakai .catch(). Error biasanya di { error }, tidak di-throw.
    try {
      const { error: rpcErr } = await supabase.rpc(
        "request_postgrest_schema_reload",
      );
      void rpcErr;
    } catch {
      /* network / client tak terduga */
    }
    await new Promise((r) => setTimeout(r, 1600));
    return await op();
  }
}
