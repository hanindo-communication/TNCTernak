"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BulkTargetSubmissionsTable } from "@/components/dashboard/BulkTargetSubmissionsTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  Brand,
  Creator,
  Project,
  TargetFormRow,
  TikTokAccount,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatSupabaseClientError } from "@/lib/supabase/format-client-error";
import {
  BASE_PAY_PRESET_VALUES,
  defaultBasePayPreset,
} from "@/lib/dashboard/base-pay-presets";
import { TABLE_SEGMENT_ALL_ID } from "@/lib/dashboard/table-segments";
import type { TableSegmentOption } from "@/components/dashboard/QuickFilterChips";

const basePayAllowed = new Set<number>([...BASE_PAY_PRESET_VALUES]);

function emptyRow(month: string): TargetFormRow {
  return {
    creatorId: "",
    tableSegmentId: TABLE_SEGMENT_ALL_ID,
    projectId: "",
    creatorType: "Internal",
    tiktokAccountId: "",
    month,
    targetVideos: 0,
    incentivePerVideo: 0,
    basePay: defaultBasePayPreset(),
  };
}

function validateRow(
  row: TargetFormRow,
  projects: Project[],
  brands: Brand[],
): string | null {
  if (!row.creatorId) return "Each row needs a creator.";
  if (!row.projectId) return "Each row needs a project.";
  if (!row.tiktokAccountId) return "Each row needs a TikTok account.";
  if (!row.month) return "Each row needs a month.";
  if (row.targetVideos < 0) return "Target videos must be 0 or more.";
  if (row.incentivePerVideo < 0)
    return "Incentive per video must be 0 or more.";
  if (!basePayAllowed.has(row.basePay))
    return "Base pay harus salah satu: 785.000, 1.570.000, atau 2.350.000.";
  if (
    row.tableSegmentId === "tnc" ||
    row.tableSegmentId === "folo"
  ) {
    const p = projects.find((x) => x.id === row.projectId);
    const br = p?.brandId
      ? brands.find((b) => b.id === p.brandId)
      : undefined;
    if (!br || br.tableSegmentId !== row.tableSegmentId) {
      return "Project tidak cocok dengan Table (TNC / FOLO) yang dipilih.";
    }
  }
  return null;
}

interface SubmitTargetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMonth: string;
  creators: Creator[];
  brands: Brand[];
  projects: Project[];
  tiktokAccounts: TikTokAccount[];
  tableSegments: TableSegmentOption[];
  onSubmitTargets: (rows: TargetFormRow[]) => void | Promise<void>;
}

export function SubmitTargetsModal({
  open,
  onOpenChange,
  selectedMonth,
  creators,
  brands,
  projects,
  tiktokAccounts,
  tableSegments,
  onSubmitTargets,
}: SubmitTargetsModalProps) {
  const [rows, setRows] = useState<TargetFormRow[]>(() => [
    emptyRow(selectedMonth),
  ]);

  const handleDialogOpenChange = (next: boolean) => {
    if (next) {
      setRows([emptyRow(selectedMonth)]);
    }
    onOpenChange(next);
  };

  const updateRow = (idx: number, next: TargetFormRow) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? next : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(selectedMonth)]);
  };

  const duplicateLastRow = () => {
    setRows((prev) => {
      if (prev.length === 0) return [emptyRow(selectedMonth)];
      const last = prev[prev.length - 1];
      return [...prev, { ...last }];
    });
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalTargets = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.targetVideos) || 0), 0),
    [rows],
  );

  const handleSubmit = async () => {
    for (const row of rows) {
      const err = validateRow(row, projects, brands);
      if (err) {
        toast.error("Validasi", { description: err });
        return;
      }
    }
    try {
      await Promise.resolve(onSubmitTargets(rows));
      toast.success("Data tersimpan — dashboard diperbarui.");
      handleDialogOpenChange(false);
    } catch (e) {
      toast.error("Gagal menyimpan", {
        description: formatSupabaseClientError(e),
      });
    }
  };

  const missingCreators = creators.length === 0;
  const missingProjects = projects.length === 0;
  const missingTiktok = tiktokAccounts.length === 0;
  const hasOptions = !missingCreators && !missingProjects && !missingTiktok;

  const missingHint = [
    missingCreators && "creator",
    missingProjects && "project",
    missingTiktok && "akun TikTok",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] flex-col gap-0 overflow-hidden border-neon-cyan/15 p-0 sm:max-w-[min(96vw,1200px)]"
        showClose
      >
        <DialogHeader className="sr-only shrink-0">
          <DialogTitle>Bulk Target Submissions</DialogTitle>
          <DialogDescription>
            Isi target video untuk beberapa creator dan proyek sekaligus.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-10 sm:px-6 sm:pb-6">
          {!hasOptions ? (
            <div
              className="mb-4 rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 px-4 py-3 text-sm text-foreground/95"
              role="status"
            >
              Lengkapi dulu di{" "}
              <span className="font-semibold text-neon-cyan">Data settings</span>
              {missingHint ? (
                <>
                  : belum ada{" "}
                  <span className="font-semibold text-foreground">{missingHint}</span>
                  . Klik <strong>Simpan &amp; sinkron</strong> setelah mengisi.
                </>
              ) : (
                <> — simpan &amp; sinkron, atau muat data demo di dashboard.</>
              )}
            </div>
          ) : null}
          <BulkTargetSubmissionsTable
            rows={rows}
            rowCount={rows.length}
            onAddRow={addRow}
            onDuplicateLast={duplicateLastRow}
            onUpdateRow={updateRow}
            onRemoveRow={removeRow}
            creators={creators}
            brands={brands}
            projects={projects}
            tiktokAccounts={tiktokAccounts}
            tableSegments={tableSegments}
          />
        </div>

        <DialogFooter className="shrink-0 border-t border-white/10 bg-black/30 px-4 py-4 sm:px-6">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => handleDialogOpenChange(false)}
              className="h-11 rounded-xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-foreground transition hover:border-neon-purple/35 hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-neon-purple/30"
            >
              Cancel
            </button>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <p className="text-[11px] text-muted">
                Total target videos:{" "}
                <span className="font-mono text-sm font-semibold text-neon-cyan">
                  {totalTargets}
                </span>
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                className={cn(
                  "btn-press h-11 rounded-xl px-6 text-sm font-semibold text-night",
                  "bg-gradient-to-r from-neon-cyan via-cyan-300 to-neon-purple",
                  "shadow-[0_0_28px_rgba(50,230,255,0.35)]",
                  "transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50",
                )}
              >
                Submit data
              </button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
