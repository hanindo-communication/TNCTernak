"use client";

import { Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BulkVideoSubmissionsTable,
  duplicateVideoRowForBulk,
  emptyVideoSubmitRow,
  videoRowFromTarget,
} from "@/components/dashboard/BulkVideoSubmissionsTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFormSettings } from "@/hooks/useFormSettings";
import {
  mergeBrands,
  mergeCreators,
  mergeProjects,
  mergeTikTokAccounts,
} from "@/lib/dashboard/merge-entities";
import { parseVideoUrlsFromText } from "@/lib/dashboard/video-urls";
import {
  buildTargetCompositeKey,
  type Brand,
  type CampaignObjective,
  type Creator,
  type CreatorTarget,
  type Project,
  type TikTokAccount,
  type VideoSubmitFormRow,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TableSegmentOption } from "@/components/dashboard/QuickFilterChips";

function resolveTargetId(
  row: VideoSubmitFormRow,
  targets: CreatorTarget[],
): string | null {
  if (row.targetId) return row.targetId;
  if (
    !row.creatorId ||
    !row.projectId ||
    !row.campaignObjectiveId ||
    !row.tiktokAccountId ||
    !row.month
  )
    return null;
  const key = buildTargetCompositeKey(row);
  const found = targets.find((t) => buildTargetCompositeKey(t) === key);
  return found?.id ?? null;
}

interface SubmitVideosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTargetIds: string[];
  selectedMonth: string;
  targets: CreatorTarget[];
  creators: Creator[];
  brands: Brand[];
  projects: Project[];
  campaignObjectives: CampaignObjective[];
  tiktokAccounts: TikTokAccount[];
  tableSegments: TableSegmentOption[];
  onSubmitVideos: (
    deltas: { targetId: string; urls: string[] }[],
  ) => void | Promise<void>;
}

export function SubmitVideosModal({
  open,
  onOpenChange,
  selectedTargetIds,
  selectedMonth,
  targets,
  creators: creatorsWorkspace,
  brands: brandsWorkspace,
  projects: projectsWorkspace,
  campaignObjectives,
  tiktokAccounts: tiktokWorkspace,
  tableSegments,
  onSubmitVideos,
}: SubmitVideosModalProps) {
  const { stored: formEntities } = useFormSettings();

  const creators = useMemo(
    () => mergeCreators(creatorsWorkspace, formEntities.creators),
    [creatorsWorkspace, formEntities.creators],
  );
  const brands = useMemo(
    () => mergeBrands(brandsWorkspace, formEntities.brands),
    [brandsWorkspace, formEntities.brands],
  );
  const projects = useMemo(
    () => mergeProjects(projectsWorkspace, formEntities.projects),
    [projectsWorkspace, formEntities.projects],
  );
  const tiktokAccounts = useMemo(
    () => mergeTikTokAccounts(tiktokWorkspace, formEntities.tiktokAccounts),
    [tiktokWorkspace, formEntities.tiktokAccounts],
  );

  const [bulkMode, setBulkMode] = useState(true);
  const [rows, setRows] = useState<VideoSubmitFormRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const set = new Set(selectedTargetIds);
    const picked = targets
      .filter((t) => set.has(t.id))
      .map((t) => videoRowFromTarget(t, brands, projects));
    setRows(
      picked.length > 0 ? picked : [emptyVideoSubmitRow(selectedMonth)],
    );
    setBulkMode(true);
  }, [open, selectedTargetIds, selectedMonth, targets, brands, projects]);

  const handleSubmit = async () => {
    const deltas: { targetId: string; urls: string[] }[] = [];
    const problems: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const urls = parseVideoUrlsFromText(row.videoUrls);
      if (urls.length === 0) continue;
      const tid = resolveTargetId(row, targets);
      if (!tid) {
        problems.push(`Baris ${i + 1}: target tidak ditemukan — pastikan kombinasi creator, project, objective, TikTok, dan bulan cocok dengan target yang ada.`);
        continue;
      }
      deltas.push({ targetId: tid, urls });
    }

    if (problems.length > 0) {
      toast.error("Validasi", { description: problems[0] });
      return;
    }
    if (deltas.length === 0) {
      toast.message("Tidak ada URL video", {
        description: "Isi kolom Video URLs (satu URL per baris atau pisahkan koma).",
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitVideos(deltas);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,900px)] max-w-6xl overflow-y-auto border-white/10 bg-[#070c18]/98">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-neon-cyan" />
            Submit Videos
          </DialogTitle>
          <DialogDescription>
            Submit multiple TikTok video URLs for selected campaigns. Setiap URL
            (baris atau koma) menambah hitungan <strong>Submitted</strong> pada
            target yang cocok.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-white/5 text-neon-cyan focus:ring-neon-cyan/40"
              checked={bulkMode}
              onChange={(e) => setBulkMode(e.target.checked)}
            />
            <span>Bulk mode</span>
            <span className="text-xs text-muted">
              (tambah baris &amp; pilih target secara manual)
            </span>
          </label>
        </div>

        <BulkVideoSubmissionsTable
          rows={rows}
          onAddRow={() =>
            setRows((r) => [...r, emptyVideoSubmitRow(selectedMonth)])
          }
          onDuplicateLast={() =>
            setRows((r) => {
              if (r.length === 0) return r;
              return [...r, duplicateVideoRowForBulk(r[r.length - 1]!)];
            })
          }
          onUpdateRow={(idx, next) =>
            setRows((r) => r.map((x, i) => (i === idx ? next : x)))
          }
          onRemoveRow={(idx) =>
            setRows((r) => (r.length <= 1 ? r : r.filter((_, i) => i !== idx)))
          }
          creators={creators}
          projects={projects}
          campaignObjectives={campaignObjectives}
          tiktokAccounts={tiktokAccounts}
          tableSegments={tableSegments}
          bulkMode={bulkMode}
        />

        <p className="text-[11px] leading-relaxed text-muted">
          <kbd className="rounded border border-white/15 bg-white/5 px-1">Tab</kbd> /{" "}
          <kbd className="rounded border border-white/15 bg-white/5 px-1">
            Shift+Tab
          </kbd>{" "}
          pindah sel ·{" "}
          <kbd className="rounded border border-white/15 bg-white/5 px-1">
            Ctrl+V
          </kbd>{" "}
          tempel dari spreadsheet
        </p>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className={cn(
              "rounded-xl px-5 py-2 text-sm font-semibold text-night",
              "bg-gradient-to-r from-neon-cyan via-cyan-300 to-neon-purple",
              "shadow-[0_0_24px_rgba(50,230,255,0.3)] transition hover:brightness-110 disabled:opacity-50",
            )}
          >
            {submitting
              ? "Submitting…"
              : bulkMode
                ? "Submit Videos (Bulk)"
                : "Submit Videos"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
