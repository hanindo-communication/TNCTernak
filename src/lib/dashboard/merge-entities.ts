import type { Brand, Creator, Project, TikTokAccount } from "@/lib/types";

/**
 * Gabungkan workspace Supabase dengan Data settings (localStorage).
 * Untuk id yang sama, isi Data settings menang — supaya dropdown Submit Targets
 * selalu mengikuti apa yang baru disimpan di Data settings.
 */
export function mergeById<T extends { id: string }>(fromDb: T[], fromSettings: T[]): T[] {
  const map = new Map<string, T>();
  for (const x of fromDb) map.set(x.id, x);
  for (const x of fromSettings) {
    map.set(x.id, x);
  }
  return [...map.values()];
}

export function mergeCreators(a: Creator[], b: Creator[]): Creator[] {
  return mergeById(a, b);
}

export function mergeProjects(a: Project[], b: Project[]): Project[] {
  return mergeById(a, b);
}

export function mergeBrands(a: Brand[], b: Brand[]): Brand[] {
  return mergeById(a, b);
}

export function mergeTikTokAccounts(a: TikTokAccount[], b: TikTokAccount[]): TikTokAccount[] {
  return mergeById(a, b);
}
