"use client";

import { useCallback, useEffect, useState } from "react";
import {
  emptyStoredFormEntities,
  loadStoredFormEntities,
  saveStoredFormEntities,
  type StoredFormEntities,
} from "@/lib/dashboard/form-settings-storage";

export function useFormSettings() {
  const [stored, setStored] = useState<StoredFormEntities>(emptyStoredFormEntities);

  useEffect(() => {
    setStored(loadStoredFormEntities());
  }, []);

  const persist = useCallback((next: StoredFormEntities) => {
    saveStoredFormEntities(next);
    setStored(next);
  }, []);

  return { stored, persist };
}
