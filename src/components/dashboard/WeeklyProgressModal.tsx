"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Check,
  Copy,
  GripVertical,
  PencilLine,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchWeeklyProgressDocument,
  persistWeeklyProgressDocument,
} from "@/lib/dashboard/supabase-data";
import {
  formatSupabaseClientError,
  supabaseErrorDebugPayload,
} from "@/lib/supabase/format-client-error";
import { cn, labelMonth, parseMonthKey } from "@/lib/utils";
import { toast } from "sonner";

const WEEKS = 4 as const;
const WEEKLY_ROW_DRAG_TYPE = "application/tnc-weekly-row";

export type WeeklyProgressRow = {
  id: string;
  weekIndex: number;
  creatorName: string;
  campaignName: string;
  targetVideoSubmit: string;
  targetReqAnotherCreative: string;
  targetApplyCampaign: string;
  submittedVideo: string;
};

function makeRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyRow(weekIndex: number): WeeklyProgressRow {
  return {
    id: makeRowId(),
    weekIndex,
    creatorName: "",
    campaignName: "",
    targetVideoSubmit: "",
    targetReqAnotherCreative: "",
    targetApplyCampaign: "",
    submittedVideo: "",
  };
}

const inputClass =
  "h-9 w-full min-w-[6rem] rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-neon-cyan/55 focus:ring-2 focus:ring-neon-cyan/20";

function storageKeyV2(monthKey: string) {
  return `tnc-ternak-weekly-progress-v2:${monthKey}`;
}

/** Legacy key (8 baris tetap). */
function storageKeyV1(monthKey: string) {
  return `tnc-ternak-weekly-progress-v1:${monthKey}`;
}

function getWeekRangeLabelsInMonth(monthKey: string): string[] {
  const d0 = parseMonthKey(monthKey);
  const y = d0.getFullYear();
  const m = d0.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const chunk = Math.ceil(lastDay / 4);
  const monthShort = new Intl.DateTimeFormat("en-US", {
    month: "short",
  }).format(d0);

  const labels: string[] = [];
  for (let w = 0; w < 4; w++) {
    const start = w * chunk + 1;
    const end = Math.min(lastDay, (w + 1) * chunk);
    labels.push(`${monthShort} ${start}–${end}`);
  }
  return labels;
}

type LegacyRowV1 = {
  campaignName: string;
  targetVideoSubmit: string;
  targetReqAnotherCreative: string;
  submittedVideo: string;
};

function parseV1(raw: string | null): LegacyRowV1[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || !("rows" in data)) return null;
    const rows = (data as { rows: unknown }).rows;
    if (!Array.isArray(rows) || rows.length !== 8) return null;
    return rows.map((r) => {
      const o = r as Record<string, unknown>;
      return {
        campaignName: String(o.campaignName ?? ""),
        targetVideoSubmit: String(o.targetVideoSubmit ?? ""),
        targetReqAnotherCreative: String(o.targetReqAnotherCreative ?? ""),
        submittedVideo: String(o.submittedVideo ?? ""),
      };
    });
  } catch {
    return null;
  }
}

function migrateV1ToV2(old: LegacyRowV1[]): WeeklyProgressRow[] {
  return old.map((r, i) => ({
    id: makeRowId(),
    weekIndex: Math.min(3, Math.floor(i / 2)),
    creatorName: "",
    campaignName: r.campaignName,
    targetVideoSubmit: r.targetVideoSubmit,
    targetReqAnotherCreative: r.targetReqAnotherCreative,
    targetApplyCampaign: "",
    submittedVideo: r.submittedVideo,
  }));
}

function parseV2(raw: string | null): WeeklyProgressRow[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || !("rows" in data)) return null;
    const rows = (data as { rows: unknown }).rows;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const out: WeeklyProgressRow[] = [];
    for (const r of rows) {
      const o = r as Record<string, unknown>;
      const weekIndex = Number(o.weekIndex);
      if (!Number.isFinite(weekIndex) || weekIndex < 0 || weekIndex > 3) {
        continue;
      }
      const id = typeof o.id === "string" && o.id ? o.id : makeRowId();
      out.push({
        id,
        weekIndex,
        creatorName: String(o.creatorName ?? ""),
        campaignName: String(o.campaignName ?? ""),
        targetVideoSubmit: String(o.targetVideoSubmit ?? ""),
        targetReqAnotherCreative: String(o.targetReqAnotherCreative ?? ""),
        targetApplyCampaign: String(o.targetApplyCampaign ?? ""),
        submittedVideo: String(o.submittedVideo ?? ""),
      });
    }
    return out.length ? ensureWeekCoverage(out) : null;
  } catch {
    return null;
  }
}

/** Pastikan minggu 0–3 punya minimal satu baris (normalisasi data rusak / impor). */
function ensureWeekCoverage(rows: WeeklyProgressRow[]): WeeklyProgressRow[] {
  const buckets: WeeklyProgressRow[][] = [[], [], [], []];
  for (const r of rows) {
    if (r.weekIndex >= 0 && r.weekIndex < WEEKS) {
      buckets[r.weekIndex].push(r);
    }
  }
  const next: WeeklyProgressRow[] = [];
  for (let w = 0; w < WEEKS; w++) {
    if (buckets[w].length === 0) next.push(emptyRow(w));
    else next.push(...buckets[w]);
  }
  return next;
}

function defaultRows(): WeeklyProgressRow[] {
  return [0, 1, 2, 3].map((w) => emptyRow(w));
}

function insertRowInWeek(
  rows: WeeklyProgressRow[],
  row: WeeklyProgressRow,
): WeeklyProgressRow[] {
  const w = row.weekIndex;
  let insertAt = rows.length;
  let lastIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].weekIndex === w) lastIdx = i;
    if (rows[i].weekIndex > w && insertAt === rows.length) insertAt = i;
  }
  if (lastIdx >= 0) insertAt = lastIdx + 1;
  const copy = rows.slice();
  copy.splice(insertAt, 0, row);
  return copy;
}

function insertRowAfter(
  rows: WeeklyProgressRow[],
  afterId: string,
  row: WeeklyProgressRow,
): WeeklyProgressRow[] {
  const idx = rows.findIndex((r) => r.id === afterId);
  const copy = rows.slice();
  if (idx < 0) return insertRowInWeek(copy, row);
  copy.splice(idx + 1, 0, row);
  return copy;
}

function duplicateRowFields(source: WeeklyProgressRow): WeeklyProgressRow {
  return {
    id: makeRowId(),
    weekIndex: source.weekIndex,
    creatorName: source.creatorName,
    campaignName: source.campaignName,
    targetVideoSubmit: source.targetVideoSubmit,
    targetReqAnotherCreative: source.targetReqAnotherCreative,
    targetApplyCampaign: source.targetApplyCampaign,
    submittedVideo: source.submittedVideo,
  };
}

/** Ubah urutan baris dalam satu minggu (indeks flat: minggu 0…3 berturut-turut). */
function reorderWithinWeek(
  rows: WeeklyProgressRow[],
  weekIndex: number,
  activeId: string,
  overId: string,
): WeeklyProgressRow[] {
  if (activeId === overId) return rows;
  const segments: WeeklyProgressRow[][] = [[], [], [], []];
  for (const r of rows) {
    if (r.weekIndex >= 0 && r.weekIndex < WEEKS) {
      segments[r.weekIndex].push(r);
    }
  }
  const seg = segments[weekIndex];
  const fromI = seg.findIndex((r) => r.id === activeId);
  const toI = seg.findIndex((r) => r.id === overId);
  if (fromI < 0 || toI < 0) return rows;
  const nextSeg = seg.slice();
  const [moved] = nextSeg.splice(fromI, 1);
  const insertAt = fromI < toI ? toI - 1 : toI;
  nextSeg.splice(insertAt, 0, moved);
  segments[weekIndex] = nextSeg;
  return segments.flat();
}

function loadRowsFromStorage(monthKey: string): WeeklyProgressRow[] {
  if (typeof window === "undefined") {
    return defaultRows();
  }
  try {
    const rawV2 = window.localStorage.getItem(storageKeyV2(monthKey));
    const parsedV2 = parseV2(rawV2);
    if (parsedV2) return parsedV2;

    const rawV1 = window.localStorage.getItem(storageKeyV1(monthKey));
    const parsedV1 = parseV1(rawV1);
    if (parsedV1) {
      const migrated = migrateV1ToV2(parsedV1);
      try {
        window.localStorage.setItem(
          storageKeyV2(monthKey),
          JSON.stringify({ version: 2, rows: migrated }),
        );
      } catch {
        /* ignore */
      }
      return migrated;
    }
  } catch {
    /* ignore */
  }
  return defaultRows();
}

const EMPTY_DRAFT: WeeklyProgressRow = {
  id: "",
  weekIndex: 0,
  creatorName: "",
  campaignName: "",
  targetVideoSubmit: "",
  targetReqAnotherCreative: "",
  targetApplyCampaign: "",
  submittedVideo: "",
};

interface WeeklyProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthKey: string;
  /** Bila diisi, data dimuat/disimpan ke Supabase (RLS per user) selain localStorage. */
  supabase?: SupabaseClient | null;
}

export function WeeklyProgressModal({
  open,
  onOpenChange,
  monthKey,
  supabase = null,
}: WeeklyProgressModalProps) {
  const [rows, setRows] = useState<WeeklyProgressRow[]>(defaultRows);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WeeklyProgressRow>({ ...EMPTY_DRAFT });
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT });
    setDragRowId(null);
    setDragOverRowId(null);

    if (supabase) {
      let cancelled = false;
      void (async () => {
        try {
          const doc = await fetchWeeklyProgressDocument(supabase, monthKey);
          if (cancelled) return;
          const parsed = doc ? parseV2(doc) : null;
          if (parsed) {
            setRows(parsed);
            try {
              window.localStorage.setItem(
                storageKeyV2(monthKey),
                JSON.stringify({ version: 2, rows: parsed }),
              );
            } catch {
              /* ignore */
            }
            return;
          }
        } catch (e) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "[WeeklyProgress] fetch remote",
              supabaseErrorDebugPayload(e),
            );
          }
        }
        if (!cancelled) setRows(loadRowsFromStorage(monthKey));
      })();
      return () => {
        cancelled = true;
      };
    }

    setRows(loadRowsFromStorage(monthKey));
  }, [open, monthKey, supabase]);

  const persist = useCallback(
    (next: WeeklyProgressRow[]) => {
      setRows(next);
      try {
        window.localStorage.setItem(
          storageKeyV2(monthKey),
          JSON.stringify({ version: 2, rows: next }),
        );
      } catch {
        /* ignore */
      }
      if (supabase) {
        void persistWeeklyProgressDocument(supabase, monthKey, {
          version: 2,
          rows: next,
        }).catch((e) => {
          toast.error("Gagal simpan weekly progress ke cloud", {
            description: formatSupabaseClientError(e),
          });
        });
      }
    },
    [monthKey, supabase],
  );

  const rowsByWeek = useMemo(() => {
    const m = new Map<number, WeeklyProgressRow[]>();
    for (let w = 0; w < WEEKS; w++) m.set(w, []);
    for (const r of rows) {
      const w = r.weekIndex;
      if (w >= 0 && w < WEEKS) {
        m.get(w)!.push(r);
      }
    }
    return m;
  }, [rows]);

  const startEdit = (row: WeeklyProgressRow) => {
    setDraft({ ...row });
    setEditingId(row.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT });
  };

  const confirmEdit = () => {
    if (!editingId) return;
    const next = rows.map((r) =>
      r.id === editingId ? { ...draft, id: r.id, weekIndex: r.weekIndex } : r,
    );
    persist(next);
    cancelEdit();
  };

  const addRowForWeek = (weekIndex: number) => {
    const row = emptyRow(weekIndex);
    persist(insertRowInWeek(rows, row));
  };

  const removeRow = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const sameWeek = rows.filter((r) => r.weekIndex === row.weekIndex);
    if (sameWeek.length <= 1) return;
    if (editingId === id) cancelEdit();
    persist(rows.filter((r) => r.id !== id));
  };

  const duplicateRow = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const clone = duplicateRowFields(row);
    persist(insertRowAfter(rows, id, clone));
  };

  const monthLabel = useMemo(() => labelMonth(monthKey), [monthKey]);
  const weekRangesInMonth = useMemo(
    () => getWeekRangeLabelsInMonth(monthKey),
    [monthKey],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,900px)] min-h-0 max-w-[min(100vw-1.5rem,80rem)] flex-col gap-0 overflow-hidden border-neon-cyan/20 p-0 sm:rounded-2xl"
        showClose
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-white/[0.07] px-5 py-4 pr-14">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Weekly progress
            <span className="ml-2 text-base font-normal text-muted">
              · {monthLabel}
            </span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted">
            <span className="font-medium text-foreground/85">{monthLabel}</span>
            {" — "}
            Empat minggu mengikuti tanggal dalam bulan (WIB). Tiap minggu
            dimulai dengan satu baris; tambah baris bila beberapa creator /
            campaign. Data{" "}
            <strong className="font-semibold text-foreground/90">
              hanya untuk bulan ini
            </strong>
            . Edit per baris lalu Konfirmasi atau Batal. Urutan dalam minggu sama
            bisa diubah dengan menyeret ikon grip di kiri baris.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-8">
            {Array.from({ length: WEEKS }, (_, w) => {
              const weekRows = rowsByWeek.get(w) ?? [];
              const rangeLabel = weekRangesInMonth[w] ?? "";
              return (
                <section
                  key={w}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02]"
                >
                  <div className="flex flex-col gap-2 border-b border-white/[0.07] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      Week {w + 1}
                      <span className="ml-2 font-normal text-muted">
                        · {rangeLabel}
                      </span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => addRowForWeek(w)}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 text-xs font-semibold text-neon-cyan transition hover:bg-neon-cyan/20 focus:outline-none focus:ring-2 focus:ring-neon-cyan/40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tambah baris
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1020px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-black/20">
                          <th
                            className="w-9 px-0 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted"
                            aria-label="Urutkan baris"
                          >
                            <GripVertical
                              className="mx-auto h-3.5 w-3.5 opacity-50"
                              aria-hidden
                            />
                          </th>
                          <th className="whitespace-nowrap px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-3">
                            Creator
                          </th>
                          <th className="whitespace-nowrap px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-3">
                            Campaign name
                          </th>
                          <th className="whitespace-nowrap px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-3">
                            Target video submit
                          </th>
                          <th className="whitespace-nowrap px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-3">
                            Target req another creative
                          </th>
                          <th className="whitespace-nowrap px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-3">
                            Target apply campaign
                          </th>
                          <th className="whitespace-nowrap px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-3">
                            Submitted video
                          </th>
                          <th className="whitespace-nowrap px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted sm:px-3">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekRows.map((row) => {
                          const isEditing = editingId === row.id;
                          const canRemove = weekRows.length > 1;
                          const canDragReorder = editingId === null;
                          const isDragSource = dragRowId === row.id;
                          const isDragOver =
                            dragOverRowId === row.id &&
                            Boolean(dragRowId) &&
                            dragRowId !== row.id;
                          return (
                            <tr
                              key={row.id}
                              className={cn(
                                "border-b border-white/[0.05] transition-colors last:border-b-0",
                                isEditing
                                  ? "bg-neon-cyan/[0.06]"
                                  : "hover:bg-white/[0.02]",
                                isDragSource && "opacity-50",
                                isDragOver &&
                                  "bg-neon-cyan/[0.08] ring-1 ring-inset ring-neon-cyan/40",
                              )}
                              onDragOver={(e) => {
                                if (!canDragReorder || !dragRowId) return;
                                const src = rows.find((r) => r.id === dragRowId);
                                if (
                                  !src ||
                                  src.weekIndex !== w ||
                                  src.weekIndex !== row.weekIndex
                                ) {
                                  return;
                                }
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                setDragOverRowId(row.id);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const fromId =
                                  e.dataTransfer.getData(WEEKLY_ROW_DRAG_TYPE) ||
                                  e.dataTransfer.getData("text/plain") ||
                                  dragRowId;
                                setDragRowId(null);
                                setDragOverRowId(null);
                                if (
                                  !fromId ||
                                  fromId === row.id ||
                                  editingId !== null
                                ) {
                                  return;
                                }
                                const src = rows.find((r) => r.id === fromId);
                                if (
                                  !src ||
                                  src.weekIndex !== w ||
                                  row.weekIndex !== w
                                ) {
                                  return;
                                }
                                persist(
                                  reorderWithinWeek(rows, w, fromId, row.id),
                                );
                              }}
                              onDragLeave={(e) => {
                                if (e.currentTarget.contains(e.relatedTarget as Node)) {
                                  return;
                                }
                                setDragOverRowId((cur) =>
                                  cur === row.id ? null : cur,
                                );
                              }}
                            >
                              {isEditing ? (
                                <>
                                  <td className="w-9 px-0 py-1.5 align-middle" />
                                  <td className="px-2 py-1.5 sm:px-3">
                                    <input
                                      className={inputClass}
                                      value={draft.creatorName}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          creatorName: e.target.value,
                                        }))
                                      }
                                      placeholder="Nama creator"
                                      aria-label={`Creator ${row.id}`}
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 sm:px-3">
                                    <input
                                      className={inputClass}
                                      value={draft.campaignName}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          campaignName: e.target.value,
                                        }))
                                      }
                                      placeholder="Campaign name"
                                      aria-label={`Campaign ${row.id}`}
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 sm:px-3">
                                    <input
                                      className={inputClass}
                                      value={draft.targetVideoSubmit}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          targetVideoSubmit: e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. 5"
                                      aria-label={`Target video ${row.id}`}
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 sm:px-3">
                                    <input
                                      className={inputClass}
                                      value={draft.targetReqAnotherCreative}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          targetReqAnotherCreative:
                                            e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. 2"
                                      aria-label={`Target creative ${row.id}`}
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 sm:px-3">
                                    <input
                                      className={inputClass}
                                      value={draft.targetApplyCampaign}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          targetApplyCampaign: e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. 3"
                                      aria-label={`Target apply campaign ${row.id}`}
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 sm:px-3">
                                    <input
                                      className={inputClass}
                                      value={draft.submittedVideo}
                                      onChange={(e) =>
                                        setDraft((d) => ({
                                          ...d,
                                          submittedVideo: e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. 3"
                                      aria-label={`Submitted ${row.id}`}
                                    />
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-1.5 align-middle sm:px-3">
                                    <div className="flex flex-wrap gap-1.5">
                                      <button
                                        type="button"
                                        onClick={confirmEdit}
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                        Konfirmasi
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] px-2.5 text-xs font-semibold text-foreground/90 transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/20"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        Batal
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td
                                    className={cn(
                                      "w-9 px-0 py-2 align-middle select-none",
                                      canDragReorder &&
                                        "cursor-grab active:cursor-grabbing",
                                    )}
                                    draggable={canDragReorder}
                                    onDragStart={(e) => {
                                      if (!canDragReorder) {
                                        e.preventDefault();
                                        return;
                                      }
                                      e.dataTransfer.setData(
                                        WEEKLY_ROW_DRAG_TYPE,
                                        row.id,
                                      );
                                      e.dataTransfer.setData("text/plain", row.id);
                                      e.dataTransfer.effectAllowed = "move";
                                      setDragRowId(row.id);
                                    }}
                                    onDragEnd={() => {
                                      setDragRowId(null);
                                      setDragOverRowId(null);
                                    }}
                                    title="Seret untuk mengurutkan baris dalam minggu ini"
                                  >
                                    <GripVertical
                                      className="mx-auto h-4 w-4 text-muted/85"
                                      aria-hidden
                                    />
                                    <span className="sr-only">
                                      Urutkan baris
                                    </span>
                                  </td>
                                  <td className="max-w-[10rem] px-2 py-2 align-middle text-foreground/90 sm:px-3">
                                    <span className="line-clamp-2 break-words">
                                      {row.creatorName || "—"}
                                    </span>
                                  </td>
                                  <td className="max-w-[10rem] px-2 py-2 align-middle text-foreground/90 sm:px-3">
                                    <span className="line-clamp-2 break-words">
                                      {row.campaignName || "—"}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 align-middle tabular-nums text-foreground/90 sm:px-3">
                                    {row.targetVideoSubmit || "—"}
                                  </td>
                                  <td className="px-2 py-2 align-middle tabular-nums text-foreground/90 sm:px-3">
                                    {row.targetReqAnotherCreative || "—"}
                                  </td>
                                  <td className="px-2 py-2 align-middle tabular-nums text-foreground/90 sm:px-3">
                                    {row.targetApplyCampaign || "—"}
                                  </td>
                                  <td className="px-2 py-2 align-middle tabular-nums text-foreground/90 sm:px-3">
                                    {row.submittedVideo || "—"}
                                  </td>
                                  <td className="px-2 py-2 align-middle sm:px-3">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => startEdit(row)}
                                        disabled={
                                          editingId !== null && editingId !== row.id
                                        }
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-neon-cyan/35 bg-neon-cyan/10 px-2.5 text-xs font-semibold text-neon-cyan transition hover:bg-neon-cyan/18 focus:outline-none focus:ring-2 focus:ring-neon-cyan/40 disabled:pointer-events-none disabled:opacity-45"
                                      >
                                        <PencilLine className="h-3.5 w-3.5" />
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => duplicateRow(row.id)}
                                        disabled={
                                          editingId !== null && editingId !== row.id
                                        }
                                        title="Duplikat baris di bawahnya (minggu yang sama)"
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/18 bg-white/[0.06] px-2.5 text-xs font-semibold text-foreground/90 transition hover:border-neon-cyan/30 hover:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-neon-cyan/25 disabled:pointer-events-none disabled:opacity-45"
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                        Duplikat
                                      </button>
                                      {canRemove ? (
                                        <button
                                          type="button"
                                          onClick={() => removeRow(row.id)}
                                          disabled={
                                            editingId !== null && editingId !== row.id
                                          }
                                          title="Hapus baris (minimal satu baris per minggu tetap ada)"
                                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-400/35 bg-red-500/10 px-2.5 text-xs font-semibold text-red-200/95 transition hover:bg-red-500/18 focus:outline-none focus:ring-2 focus:ring-red-400/35 disabled:pointer-events-none disabled:opacity-45"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Hapus
                                        </button>
                                      ) : null}
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-muted">
            Disimpan di peramban (localStorage){" "}
            <span className="font-mono text-[11px] text-foreground/70">
              v2 · {monthKey}
            </span>
            {supabase ? (
              <>
                {" "}
                dan disinkron ke Supabase saat Anda mengubah data (cloud
                mengalahkan cache peramban saat modal dibuka).
              </>
            ) : null}
            . Data lama format v1 otomatis dimigrasi sekali buka.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
