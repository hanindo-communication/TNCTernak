import type { Brand, Creator, Project, TikTokAccount } from "@/lib/types";

/** Entitas tambahan dari Data settings (localStorage), digabung ke data workspace untuk form. */
export interface StoredFormEntities {
  v: 1;
  brands: Brand[];
  projects: Project[];
  creators: Creator[];
  tiktokAccounts: TikTokAccount[];
}

const STORAGE_KEY = "tnc-ternak-form-entities-v1";

export function emptyStoredFormEntities(): StoredFormEntities {
  return { v: 1, brands: [], projects: [], creators: [], tiktokAccounts: [] };
}

export function loadStoredFormEntities(): StoredFormEntities {
  if (typeof window === "undefined") return emptyStoredFormEntities();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStoredFormEntities();
    const p = JSON.parse(raw) as StoredFormEntities;
    if (p.v !== 1) return emptyStoredFormEntities();
    return {
      v: 1,
      brands: Array.isArray(p.brands) ? p.brands : [],
      projects: Array.isArray(p.projects) ? p.projects : [],
      creators: Array.isArray(p.creators) ? p.creators : [],
      tiktokAccounts: Array.isArray(p.tiktokAccounts) ? p.tiktokAccounts : [],
    };
  } catch {
    return emptyStoredFormEntities();
  }
}

export function saveStoredFormEntities(s: StoredFormEntities): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
