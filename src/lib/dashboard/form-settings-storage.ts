import type { Brand, Creator, Project, TikTokAccount } from "@/lib/types";
import { normalizeBrandTableSegment } from "@/lib/dashboard/table-segments";

/** Entitas tambahan dari Data settings (localStorage), digabung ke data workspace untuk form. */
export interface StoredFormEntities {
  v: 1;
  brands: Brand[];
  projects: Project[];
  creators: Creator[];
  tiktokAccounts: TikTokAccount[];
}

const STORAGE_KEY = "tnc-ternak-form-entities-v1";

const FORM_ENTITIES_CHANGED = "tnc-ternak-form-entities-changed";

/** Snapshot stabil untuk SSR (useSyncExternalStore getServerSnapshot). */
const SERVER_SNAPSHOT: StoredFormEntities = {
  v: 1,
  brands: [],
  projects: [],
  creators: [],
  tiktokAccounts: [],
};

let memRaw: string | null = null;
let memVal: StoredFormEntities = SERVER_SNAPSHOT;

function parseStored(raw: string): StoredFormEntities {
  try {
    const p = JSON.parse(raw) as StoredFormEntities;
    if (p.v !== 1) return { ...SERVER_SNAPSHOT };
    const rawBrands = Array.isArray(p.brands) ? p.brands : [];
    const brands: Brand[] = rawBrands.map((b) =>
      normalizeBrandTableSegment({
        id: String((b as Brand).id),
        name: String((b as Brand).name ?? ""),
        tableSegmentId:
          (b as Brand).tableSegmentId === "folo" ? "folo" : "tnc",
      }),
    );
    return {
      v: 1,
      brands,
      projects: Array.isArray(p.projects) ? p.projects : [],
      creators: Array.isArray(p.creators) ? p.creators : [],
      tiktokAccounts: Array.isArray(p.tiktokAccounts) ? p.tiktokAccounts : [],
    };
  } catch {
    return { ...SERVER_SNAPSHOT };
  }
}

function readMem(): StoredFormEntities {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === memRaw) return memVal;
  memRaw = raw;
  memVal = raw ? parseStored(raw) : { ...SERVER_SNAPSHOT };
  return memVal;
}

export function emptyStoredFormEntities(): StoredFormEntities {
  return {
    v: 1,
    brands: [],
    projects: [],
    creators: [],
    tiktokAccounts: [],
  };
}

export function loadStoredFormEntities(): StoredFormEntities {
  return readMem();
}

/** Untuk useSyncExternalStore: subscribe ke perubahan localStorage (tab ini + tab lain). */
export function subscribeStoredFormEntities(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      memRaw = null;
      onChange();
    }
  };
  const onLocal = () => {
    memRaw = null;
    onChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(FORM_ENTITIES_CHANGED, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(FORM_ENTITIES_CHANGED, onLocal);
  };
}

export function getStoredFormEntitiesSnapshot(): StoredFormEntities {
  return readMem();
}

export function getServerStoredFormSnapshot(): StoredFormEntities {
  return SERVER_SNAPSHOT;
}

export function saveStoredFormEntities(s: StoredFormEntities): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(s);
  localStorage.setItem(STORAGE_KEY, json);
  memRaw = json;
  memVal = s;
  window.dispatchEvent(new Event(FORM_ENTITIES_CHANGED));
}
