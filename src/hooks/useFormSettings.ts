"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getServerStoredFormSnapshot,
  getStoredFormEntitiesSnapshot,
  saveStoredFormEntities,
  subscribeStoredFormEntities,
  type StoredFormEntities,
} from "@/lib/dashboard/form-settings-storage";

export function useFormSettings() {
  const stored = useSyncExternalStore(
    subscribeStoredFormEntities,
    getStoredFormEntitiesSnapshot,
    getServerStoredFormSnapshot,
  );

  const persist = useCallback((next: StoredFormEntities) => {
    saveStoredFormEntities(next);
  }, []);

  return { stored, persist };
}
