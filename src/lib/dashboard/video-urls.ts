/** Cuplikan teks yang bukan URL (mis. pesan error toast / SQL yang tertempel). */
const JUNK_URL_MARKERS = [
  "tabel di postgres",
  "pgrst205",
  "pgrst",
  "schema cache",
  "could not find the table",
  "supabase/manual",
  "apply_all_migrations",
  "cursor-docs",
  "sql editor",
  "notify pgrst",
  "formatclienterror",
  "gagal memuat",
  "periksa koneksi",
] as const;

/**
 * URL yang masuk akal untuk kolom submit video (bukan paragraf error / teks bantuan).
 */
export function isPlausibleSubmittedVideoUrl(raw: string): boolean {
  const s = String(raw).trim();
  if (s.length < 10 || s.length > 2048) return false;
  const lower = s.toLowerCase();
  if (JUNK_URL_MARKERS.some((m) => lower.includes(m))) return false;
  if (s.length > 400 && !/^https?:\/\//i.test(s)) return false;

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      return Boolean(u.hostname?.includes("."));
    } catch {
      return false;
    }
  }

  // TikTok sering ditempel tanpa skema: vm.tiktok.com/… atau www.tiktok.com/…
  return /^[\w.-]+\.[a-z]{2,}\/[\w./?#&@=-]+$/i.test(s);
}

/** Hilangkan entri sampah; urutan & dedupe case-insensitive. */
export function filterPlausibleVideoUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const s = String(raw).trim();
    if (!isPlausibleSubmittedVideoUrl(s)) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/** Daftar URL unik dari teks (satu URL per baris atau dipisah koma). */
export function parseVideoUrlsFromText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[\n,]+/)) {
    const s = part.trim();
    if (!s.length) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return filterPlausibleVideoUrls(out);
}

/** Hitung entri video dari teks (satu URL per baris atau dipisah koma). */
export function countVideoUrlLines(text: string): number {
  return parseVideoUrlsFromText(text).length;
}
