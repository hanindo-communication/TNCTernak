"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StoredFormEntities } from "@/lib/dashboard/form-settings-storage";
import { mergeBrands, mergeCreators, mergeProjects } from "@/lib/dashboard/merge-entities";
import type {
  Brand,
  Creator,
  CreatorType,
  Organization,
  Project,
  TikTokAccount,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-white/10 bg-white/[0.04] px-2 text-sm text-foreground outline-none transition focus:border-neon-cyan/55 focus:ring-1 focus:ring-neon-cyan/25";

function supabaseErrorMessage(e: unknown): string {
  if (e == null) return "Unknown error";
  if (typeof e === "object" && e !== null && "message" in e) {
    const err = e as {
      message: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    const parts = [err.message, err.details, err.hint].filter(
      (s): s is string => Boolean(s),
    );
    if (err.code) parts.push(`[${err.code}]`);
    return parts.join(" — ");
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

function CommittedTextInput({
  className,
  value,
  onCommit,
  placeholder,
  registerFlush,
}: {
  className?: string;
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  registerFlush: (flush: () => void) => () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const flush = useCallback(() => {
    if (draft !== value) onCommit(draft);
  }, [draft, value, onCommit]);

  useEffect(() => {
    return registerFlush(flush);
  }, [registerFlush, flush]);

  const dirty = draft !== value;

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <input
        className={cn(inputClass, "min-w-0 flex-1")}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") flush();
        }}
      />
      <button
        type="button"
        title="Terapkan"
        disabled={!dirty}
        onClick={flush}
        className="flex h-9 shrink-0 items-center justify-center rounded-md border border-white/10 px-2 text-neon-cyan transition hover:border-neon-cyan/45 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Check className="h-4 w-4" aria-hidden />
        <span className="sr-only">Terapkan</span>
      </button>
      <button
        type="button"
        title="Batalkan"
        disabled={!dirty}
        onClick={() => setDraft(value)}
        className="flex h-9 shrink-0 items-center justify-center rounded-md border border-white/10 px-2 text-muted transition hover:border-red-400/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <X className="h-4 w-4" aria-hidden />
        <span className="sr-only">Batalkan</span>
      </button>
    </div>
  );
}

interface DataSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stored: StoredFormEntities;
  onPersist: (next: StoredFormEntities) => void;
  organizations: Organization[];
  workspaceBrands: Brand[];
  workspaceProjects: Project[];
  workspaceCreators: Creator[];
  workspaceTiktok: TikTokAccount[];
  onSyncToSupabase: (next: StoredFormEntities) => Promise<void>;
  onReload: () => Promise<void>;
}

export function DataSettingsModal({
  open,
  onOpenChange,
  stored,
  onPersist,
  organizations,
  workspaceBrands,
  workspaceProjects,
  workspaceCreators,
  workspaceTiktok,
  onSyncToSupabase,
  onReload,
}: DataSettingsModalProps) {
  const [draft, setDraft] = useState<StoredFormEntities>(stored);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const flushRegistry = useRef<(() => void)[]>([]);
  const registerFlush = useCallback((fn: () => void) => {
    flushRegistry.current.push(fn);
    return () => {
      flushRegistry.current = flushRegistry.current.filter((x) => x !== fn);
    };
  }, []);

  useEffect(() => {
    if (open) setDraft(stored);
  }, [open, stored]);

  const mergedBrands = useMemo(
    () => mergeBrands(workspaceBrands, draft.brands),
    [workspaceBrands, draft.brands],
  );
  const mergedProjects = useMemo(
    () => mergeProjects(workspaceProjects, draft.projects),
    [workspaceProjects, draft.projects],
  );
  const mergedCreators = useMemo(
    () => mergeCreators(workspaceCreators, draft.creators),
    [workspaceCreators, draft.creators],
  );

  const defaultOrgId = organizations[0]?.id ?? "";

  const importFromWorkspace = () => {
    setDraft({
      v: 1,
      brands: workspaceBrands.map((b) => ({ ...b })),
      projects: workspaceProjects.map((p) => ({ ...p })),
      creators: workspaceCreators.map((c) => ({ ...c })),
      tiktokAccounts: workspaceTiktok.map((t) => ({ ...t })),
    });
    toast.success("Draft diisi dari data workspace saat ini.");
  };

  const handleSave = async () => {
    flushSync(() => {
      for (const f of flushRegistry.current) f();
    });

    const d = draftRef.current;

    for (const b of d.brands) {
      if (!b.name.trim()) {
        toast.error("Brand", { description: "Semua brand harus punya nama." });
        return;
      }
    }
    for (const p of d.projects) {
      if (!p.name.trim()) {
        toast.error("Project", { description: "Semua project harus punya nama." });
        return;
      }
    }
    for (const c of d.creators) {
      if (!c.name.trim()) {
        toast.error("Creator", { description: "Semua creator harus punya nama." });
        return;
      }
    }
    const creatorIds = new Set(d.creators.map((c) => c.id));
    for (const t of d.tiktokAccounts) {
      if (!t.label.trim() || !t.creatorId) {
        toast.error("TikTok", {
          description: "Setiap akun TikTok perlu label dan creator.",
        });
        return;
      }
      if (!creatorIds.has(t.creatorId)) {
        toast.error("TikTok", {
          description:
            "Akun TikTok memakai creator yang sudah tidak ada di daftar. Pilih creator yang valid atau hapus akun tersebut.",
        });
        return;
      }
    }

    setSaving(true);
    try {
      onPersist(d);
      await onSyncToSupabase(d);
      await onReload();
      toast.success("Data settings tersimpan & disinkron ke workspace.");
      onOpenChange(false);
    } catch (e) {
      toast.error("Gagal menyimpan", {
        description: supabaseErrorMessage(e),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-[min(96vw,720px)] flex-col gap-0 overflow-hidden border-neon-purple/20 p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-white/10 px-5 py-4 sm:px-6">
          <DialogTitle className="text-lg">Data settings</DialogTitle>
          <DialogDescription className="text-sm text-muted">
            Kelola daftar brand, project, creator, dan akun TikTok untuk form{" "}
            <span className="text-foreground/90">Submit Targets</span>. Perubahan
            disimpan di browser lalu di-push ke workspace bersama (Supabase).
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={importFromWorkspace}
              className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-foreground transition hover:border-neon-cyan/40"
            >
              Ambil dari workspace saat ini
            </button>
          </div>

          <section className="mb-6">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Brands
            </h4>
            <div className="space-y-2">
              {draft.brands.map((b, i) => (
                <div key={b.id} className="flex min-w-0 gap-2">
                  <CommittedTextInput
                    className="min-w-0 flex-1"
                    value={b.name}
                    placeholder="Nama brand"
                    registerFlush={registerFlush}
                    onCommit={(next) => {
                      setDraft((prev) => {
                        const nb = [...prev.brands];
                        const cur = nb[i];
                        if (!cur) return prev;
                        nb[i] = { ...cur, name: next };
                        return { ...prev, brands: nb };
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-white/10 px-2 text-xs text-muted hover:border-red-400/40 hover:text-red-300"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        brands: draft.brands.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Hapus
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-neon-cyan hover:underline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    brands: [
                      ...draft.brands,
                      { id: crypto.randomUUID(), name: "" },
                    ],
                  })
                }
              >
                + Brand
              </button>
            </div>
          </section>

          <section className="mb-6">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Projects
            </h4>
            <div className="space-y-2">
              {draft.projects.map((p, i) => (
                <div key={p.id} className="flex flex-wrap gap-2">
                  <CommittedTextInput
                    className="min-w-[140px] flex-1"
                    value={p.name}
                    placeholder="Nama project"
                    registerFlush={registerFlush}
                    onCommit={(next) => {
                      setDraft((prev) => {
                        const np = [...prev.projects];
                        const cur = np[i];
                        if (!cur) return prev;
                        np[i] = { ...cur, name: next };
                        return { ...prev, projects: np };
                      });
                    }}
                  />
                  <select
                    className={cn(inputClass, "min-w-[160px]")}
                    value={p.brandId}
                    onChange={(e) => {
                      const next = [...draft.projects];
                      next[i] = { ...p, brandId: e.target.value };
                      setDraft({ ...draft, projects: next });
                    }}
                  >
                    <option value="">Brand…</option>
                    {mergedBrands.map((br) => (
                      <option key={br.id} value={br.id}>
                        {br.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-white/10 px-2 text-xs text-muted hover:border-red-400/40 hover:text-red-300"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        projects: draft.projects.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Hapus
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-neon-cyan hover:underline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    projects: [
                      ...draft.projects,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        brandId: mergedBrands[0]?.id ?? "",
                        organizationId: defaultOrgId,
                      },
                    ],
                  })
                }
              >
                + Project
              </button>
            </div>
          </section>

          <section className="mb-6">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Creators
            </h4>
            <div className="space-y-2">
              {draft.creators.map((c, i) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2">
                  <CommittedTextInput
                    className="min-w-[120px] flex-1"
                    value={c.name}
                    placeholder="Nama creator"
                    registerFlush={registerFlush}
                    onCommit={(next) => {
                      setDraft((prev) => {
                        const nc = [...prev.creators];
                        const cur = nc[i];
                        if (!cur) return prev;
                        nc[i] = { ...cur, name: next };
                        return { ...prev, creators: nc };
                      });
                    }}
                  />
                  <CommittedTextInput
                    className="w-[260px] sm:w-[200px]"
                    value={c.handleTikTok}
                    placeholder="Handle TikTok"
                    registerFlush={registerFlush}
                    onCommit={(next) => {
                      setDraft((prev) => {
                        const nc = [...prev.creators];
                        const cur = nc[i];
                        if (!cur) return prev;
                        nc[i] = { ...cur, handleTikTok: next };
                        return { ...prev, creators: nc };
                      });
                    }}
                  />
                  <select
                    className={cn(inputClass, "w-[120px]")}
                    value={c.creatorType}
                    onChange={(e) => {
                      const next = [...draft.creators];
                      next[i] = {
                        ...c,
                        creatorType: e.target.value as CreatorType,
                      };
                      setDraft({ ...draft, creators: next });
                    }}
                  >
                    <option value="Internal">Internal</option>
                    <option value="External">External</option>
                    <option value="AssetLoan">Asset Loan</option>
                  </select>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-white/10 px-2 text-xs text-muted hover:border-red-400/40 hover:text-red-300"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        creators: draft.creators.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Hapus
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-neon-cyan hover:underline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    creators: [
                      ...draft.creators,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        avatarUrl: "",
                        handleTikTok: "",
                        organizationId: defaultOrgId,
                        brandIds: [],
                        creatorType: "Internal",
                      },
                    ],
                  })
                }
              >
                + Creator
              </button>
            </div>
          </section>

          <section className="mb-2">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Akun TikTok
            </h4>
            <div className="space-y-2">
              {draft.tiktokAccounts.map((t, i) => (
                <div key={t.id} className="flex flex-wrap gap-2">
                  <CommittedTextInput
                    className="min-w-[160px] flex-1"
                    value={t.label}
                    placeholder="Label akun"
                    registerFlush={registerFlush}
                    onCommit={(next) => {
                      setDraft((prev) => {
                        const na = [...prev.tiktokAccounts];
                        const cur = na[i];
                        if (!cur) return prev;
                        na[i] = { ...cur, label: next };
                        return { ...prev, tiktokAccounts: na };
                      });
                    }}
                  />
                  <select
                    className={cn(inputClass, "min-w-[180px]")}
                    value={t.creatorId}
                    onChange={(e) => {
                      const next = [...draft.tiktokAccounts];
                      next[i] = { ...t, creatorId: e.target.value };
                      setDraft({ ...draft, tiktokAccounts: next });
                    }}
                  >
                    <option value="">Creator…</option>
                    {mergedCreators.map((cr) => (
                      <option key={cr.id} value={cr.id}>
                        {cr.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-white/10 px-2 text-xs text-muted hover:border-red-400/40 hover:text-red-300"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        tiktokAccounts: draft.tiktokAccounts.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                  >
                    Hapus
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-neon-cyan hover:underline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    tiktokAccounts: [
                      ...draft.tiktokAccounts,
                      {
                        id: crypto.randomUUID(),
                        creatorId: mergedCreators[0]?.id ?? "",
                        label: "",
                      },
                    ],
                  })
                }
              >
                + Akun TikTok
              </button>
            </div>
          </section>
        </div>

        <DialogFooter className="shrink-0 border-t border-white/10 bg-black/30 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-foreground"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="btn-press h-10 rounded-xl bg-gradient-to-r from-neon-cyan via-cyan-300 to-neon-purple px-5 text-sm font-semibold text-night disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Simpan & sinkron"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
