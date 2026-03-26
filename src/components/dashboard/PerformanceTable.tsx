"use client";

import {
  ChevronRight,
  Eye,
  Film,
  Link2,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Creator } from "@/lib/types";
import {
  DEFAULT_HANINDO_SHARING_PERCENT,
  mergeHanindoPercentsFromCreators,
} from "@/lib/dashboard/creator-financial-overrides";
import { useCreatorHanindoPercents } from "@/hooks/useCreatorHanindoPercents";
import { formatCurrency } from "@/lib/utils";
import {
  splitErForTncHndColumns,
  type AggregatedCreatorRow,
  type BreakdownRow,
  type TotalRow,
} from "@/hooks/useCreatorDashboard";
import { CreatorTypeChip } from "@/components/dashboard/CreatorTypeChip";
import { EditCreatorTargetsDialog } from "@/components/dashboard/EditCreatorTargetsDialog";
import type { TableSegmentOption } from "@/components/dashboard/QuickFilterChips";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CreatorTargetRowSave } from "@/lib/dashboard/merge-targets";
import {
  filterPlausibleVideoUrls,
  isPlausibleSubmittedVideoUrl,
} from "@/lib/dashboard/video-urls";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const th =
  "px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-muted";

interface PerformanceTableProps {
  creators: Creator[];
  creatorRows: AggregatedCreatorRow[];
  breakdownByCreator: (creatorId: string) => BreakdownRow[];
  totalRow: TotalRow | null;
  hasRows: boolean;
  onCreatorClick: (creatorId: string) => void;
  onUpdateTargetRows: (
    updates: CreatorTargetRowSave[],
  ) => void | Promise<void>;
  tableSegments: TableSegmentOption[];
  videoSubmitSelectedIds: Set<string>;
  onToggleVideoSubmitTarget: (targetId: string, selected: boolean) => void;
  onToggleAllVideoSubmitTargets: (
    targetIds: string[],
    selected: boolean,
  ) => void;
  onOpenSubmitVideosForCreator: (creatorId: string) => void;
  onDeleteCreatorTargets: (creatorId: string) => void | Promise<void>;
  onPersistHanindoPercent: (
    creatorId: string,
    percent: number,
  ) => void | Promise<void>;
  onReplaceTargetVideoLinks: (
    targetId: string,
    urls: string[],
  ) => void | Promise<void>;
}

export function PerformanceTable({
  creators,
  creatorRows,
  breakdownByCreator,
  totalRow,
  hasRows,
  onCreatorClick,
  onUpdateTargetRows,
  tableSegments,
  videoSubmitSelectedIds,
  onToggleVideoSubmitTarget,
  onToggleAllVideoSubmitTargets,
  onOpenSubmitVideosForCreator,
  onDeleteCreatorTargets,
  onPersistHanindoPercent,
  onReplaceTargetVideoLinks,
}: PerformanceTableProps) {
  const { snapshot: hanindoLocalSnapshot } = useCreatorHanindoPercents();
  const hanindoPctByCreator = useMemo(
    () => mergeHanindoPercentsFromCreators(creators, hanindoLocalSnapshot),
    [creators, hanindoLocalSnapshot],
  );
  const defaultHanindoPct = DEFAULT_HANINDO_SHARING_PERCENT;
  const resolveHanindoPercent = useCallback(
    (id: string) => hanindoPctByCreator[id] ?? defaultHanindoPct,
    [hanindoPctByCreator, defaultHanindoPct],
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editCtx, setEditCtx] = useState<{
    creatorId: string;
    creatorName: string;
    rows: {
      targetId: string;
      projectName: string;
      campaignLabel: string;
      targetVideos: number;
      tableSegmentId: string;
      basePay: number;
      incentivePerVideo: number;
    }[];
  } | null>(null);

  const toggle = (id: string) => {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  };

  if (!hasRows) {
    return (
      <div className="glass-panel neon-border-hover flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl p-10 text-center">
        <div className="rounded-2xl border border-dashed border-neon-purple/30 bg-neon-purple/5 px-6 py-8">
          <p className="text-sm font-medium text-foreground">
            No targets set for this month yet.
          </p>
          <p className="mt-2 max-w-md text-sm text-muted">
            Click &quot;Submit Targets&quot; to define video targets and sync them
            to this dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent shadow-[0_0_0_1px_rgba(50,230,255,0.06)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          <SlidersHorizontal className="h-4 w-4 text-neon-cyan" />
          Creator Performance / Targets
        </div>
        <div className="h-px flex-1 mx-6 bg-gradient-to-r from-transparent via-neon-cyan/25 to-transparent" />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1220px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className={cn(th, "sticky left-0 z-20 min-w-[220px] bg-[#070c18]/95 backdrop-blur")}>
                Creator
              </th>
              <th className={th}>Target</th>
              <th className={th}>Submitted</th>
              <th className={th}>Expected Revenue</th>
              <th className={th}>Actual Revenue</th>
              <th className={th}>Incentives</th>
              <th className={th}>Reimbursements</th>
              <th
                className={cn(th, "min-w-[108px]")}
                title="ER − incentives − [HND]; dengan ER = incentives + [TNC] + [HND]"
              >
                <span className="block text-[9px] font-semibold normal-case tracking-normal text-neon-cyan/85">
                  [TNC]
                </span>
                <span className="block tracking-[0.14em]">Exp. profit</span>
              </th>
              <th
                className={cn(th, "min-w-[108px]")}
                title="15% × expected revenue (Hanindo); ER = incentives + [TNC] + [HND]"
              >
                <span className="block text-[9px] font-semibold normal-case tracking-normal text-neon-purple/85">
                  [HND]
                </span>
                <span className="block tracking-[0.14em]">Exp. profit</span>
              </th>
            </tr>
          </thead>

          {creatorRows.map((row) => {
            const c = creators.find((x) => x.id === row.creatorId);
            if (!c) return null;
            const avatarSrc = (c.avatarUrl ?? "").trim();
            const hasAvatar = avatarSrc.length > 0;
            const open = expanded[row.creatorId];
            const breakdown = breakdownByCreator(row.creatorId);

            return (
              <tbody
                key={row.creatorId}
                className="group border-b border-white/[0.04] last:border-b-0"
              >
                <tr
                  className={cn(
                    "relative transition-colors duration-300",
                    "hover:bg-white/[0.04]",
                    "hover:shadow-[inset_0_0_0_1px_rgba(50,230,255,0.14),0_0_24px_rgba(50,230,255,0.06)]",
                  )}
                >
                  <td
                    className={cn(
                      "relative sticky left-0 z-10 min-w-[220px] bg-[#070c18]/95 px-3 py-3 backdrop-blur",
                      "border-r border-white/[0.04]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggle(row.creatorId)}
                        className="mt-1 rounded-md p-0.5 text-muted transition hover:bg-white/5 hover:text-neon-cyan"
                        aria-expanded={open}
                        aria-label={open ? "Collapse breakdown" : "Expand breakdown"}
                      >
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 transition-transform",
                            open && "rotate-90",
                          )}
                        />
                      </button>
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-neon-cyan/25 shadow-[0_0_20px_rgba(50,230,255,0.15)]">
                        {hasAvatar ? (
                          <Image
                            src={avatarSrc}
                            alt={c.name}
                            width={40}
                            height={40}
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 text-sm font-bold text-foreground/80"
                            aria-hidden
                          >
                            {(c.name.trim().slice(0, 1) || "?").toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onCreatorClick(row.creatorId)}
                          className="block truncate text-left font-medium text-foreground underline-offset-4 transition hover:text-neon-cyan hover:underline"
                        >
                          {c.name}
                        </button>
                        <div className="mt-1">
                          <CreatorTypeChip type={c.creatorType} />
                        </div>
                        <div className="mt-2 grid w-full min-w-0 grid-cols-2 gap-1">
                          <RowMiniAction
                            icon={<Eye className="h-3 w-3 shrink-0" />}
                            text="Details"
                            onClick={() => onCreatorClick(row.creatorId)}
                          />
                          <RowMiniAction
                            icon={<Film className="h-3 w-3 shrink-0" />}
                            text="Videos"
                            onClick={() =>
                              onOpenSubmitVideosForCreator(row.creatorId)
                            }
                          />
                          <RowMiniAction
                            icon={<Pencil className="h-3 w-3 shrink-0" />}
                            text="Edit"
                            onClick={() => {
                              const b = breakdownByCreator(row.creatorId);
                              setEditCtx({
                                creatorId: row.creatorId,
                                creatorName: c.name,
                                rows: b.map((x) => ({
                                  targetId: x.targetId,
                                  projectName: x.projectName,
                                  campaignLabel: x.campaignLabel,
                                  targetVideos: x.targetVideos,
                                  tableSegmentId: x.tableSegmentId,
                                  basePay: x.basePay,
                                  incentivePerVideo: x.incentivePerVideo,
                                })),
                              });
                            }}
                          />
                          <RowMiniAction
                            icon={<Trash2 className="h-3 w-3 shrink-0" />}
                            text="Delete"
                            variant="danger"
                            onClick={() =>
                              void onDeleteCreatorTargets(row.creatorId)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-foreground">
                    {row.targetVideos}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-foreground">
                    <div className="flex items-center justify-start gap-1.5">
                      <span>{row.submittedVideos}</span>
                      {breakdown.length === 1 && breakdown[0] ? (
                        <SubmittedVideoLinksPopover
                          urls={breakdown[0].submittedVideoUrls}
                          submittedVideos={breakdown[0].submittedVideos}
                          onSave={(urls) =>
                            void onReplaceTargetVideoLinks(
                              breakdown[0]!.targetId,
                              urls,
                            )
                          }
                        />
                      ) : breakdown.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => toggle(row.creatorId)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 text-muted transition hover:border-neon-cyan/40 hover:text-neon-cyan"
                          title="Buka breakdown untuk edit link per campaign"
                          aria-label="Buka breakdown untuk edit link video"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground/90">
                    {formatCurrency(row.expectedRevenue)}
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground/90">
                    {formatCurrency(row.actualRevenue)}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">
                    {formatCurrency(row.incentives)}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">
                    {formatCurrency(row.reimbursements)}
                  </td>
                  <td className="px-3 py-3 text-xs text-neon-cyan/90 tabular-nums">
                    {formatCurrency(row.tncExpectedProfit)}
                  </td>
                  <td className="px-3 py-3 text-xs text-neon-purple/90 tabular-nums">
                    {formatCurrency(row.hndExpectedProfit)}
                  </td>
                </tr>

                <tr className="border-b-0 bg-white/[0.015]">
                  <td colSpan={9} className="p-0">
                    <div
                      className={cn(
                        "perf-expand-inner grid transition-[grid-template-rows] duration-300 ease-out",
                        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                      )}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="px-3 pb-4 pt-1">
                          <div className="ml-12 overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-muted">
                                  <th className="w-10 px-2 py-2 text-left">
                                    <span className="sr-only">
                                      Pilih untuk submit video
                                    </span>
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 rounded border-white/25 bg-white/5 text-neon-cyan focus:ring-neon-cyan/40"
                                      checked={
                                        breakdown.length > 0 &&
                                        breakdown.every((x) =>
                                          videoSubmitSelectedIds.has(
                                            x.targetId,
                                          ),
                                        )
                                      }
                                      ref={(el) => {
                                        if (!el) return;
                                        const all =
                                          breakdown.length > 0 &&
                                          breakdown.every((x) =>
                                            videoSubmitSelectedIds.has(
                                              x.targetId,
                                            ),
                                          );
                                        const some = breakdown.some((x) =>
                                          videoSubmitSelectedIds.has(
                                            x.targetId,
                                          ),
                                        );
                                        el.indeterminate = some && !all;
                                      }}
                                      onChange={(e) =>
                                        onToggleAllVideoSubmitTargets(
                                          breakdown.map((x) => x.targetId),
                                          e.target.checked,
                                        )
                                      }
                                      aria-label="Pilih semua campaign untuk submit video"
                                    />
                                  </th>
                                  <th className="whitespace-nowrap px-3 py-2 text-left">
                                    Table
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    Campaign
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    Target
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    Submitted
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    Exp. Rev
                                  </th>
                                  <th className="px-3 py-2 text-left">
                                    Act. Rev
                                  </th>
                                  <th
                                    className="whitespace-nowrap px-2 py-2 text-left text-neon-cyan/80"
                                    title="ER − incentives − [HND] per baris"
                                  >
                                    [TNC] Exp.
                                  </th>
                                  <th
                                    className="whitespace-nowrap px-2 py-2 text-left text-neon-purple/80"
                                    title="15% × ER baris"
                                  >
                                    [HND] Exp.
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {breakdown.map((b) => {
                                  const hndRate =
                                    (hanindoPctByCreator[b.creatorId] ??
                                      defaultHanindoPct) / 100;
                                  const { tncExpectedProfit, hndExpectedProfit } =
                                    splitErForTncHndColumns(
                                      b.expectedRevenue,
                                      b.incentives,
                                      hndRate,
                                    );
                                  return (
                                  <tr
                                    key={b.targetId}
                                    className="border-t border-white/[0.04]"
                                  >
                                    <td className="px-2 py-2 align-middle">
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 rounded border-white/25 bg-white/5 text-neon-cyan focus:ring-neon-cyan/40"
                                        checked={videoSubmitSelectedIds.has(
                                          b.targetId,
                                        )}
                                        onChange={(e) =>
                                          onToggleVideoSubmitTarget(
                                            b.targetId,
                                            e.target.checked,
                                          )
                                        }
                                        aria-label={`Submit video: ${b.projectName}`}
                                      />
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-muted">
                                      {b.tableSegmentLabel}
                                    </td>
                                    <td className="px-3 py-2 text-foreground/90">
                                      {b.projectName}
                                    </td>
                                    <td className="px-3 py-2 font-mono">
                                      {b.targetVideos}
                                    </td>
                                    <td className="px-3 py-2 font-mono">
                                      <div className="flex items-center gap-1.5">
                                        <span>{b.submittedVideos}</span>
                                        <SubmittedVideoLinksPopover
                                          urls={b.submittedVideoUrls}
                                          submittedVideos={b.submittedVideos}
                                          onSave={(urls) =>
                                            void onReplaceTargetVideoLinks(
                                              b.targetId,
                                              urls,
                                            )
                                          }
                                        />
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">
                                      {formatCurrency(b.expectedRevenue)}
                                    </td>
                                    <td className="px-3 py-2">
                                      {formatCurrency(b.actualRevenue)}
                                    </td>
                                    <td className="px-2 py-2 tabular-nums text-neon-cyan/85">
                                      {formatCurrency(tncExpectedProfit)}
                                    </td>
                                    <td className="px-2 py-2 tabular-nums text-neon-purple/85">
                                      {formatCurrency(hndExpectedProfit)}
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            );
          })}

          {totalRow ? (
            <tfoot>
              <tr className="bg-gradient-to-r from-neon-purple/10 via-transparent to-neon-cyan/10">
                <td className="sticky left-0 z-10 bg-[#0a1020]/95 px-3 py-4 text-sm font-bold text-foreground backdrop-blur">
                  Total
                </td>
                <td className="px-3 py-4 text-sm font-bold font-mono">
                  {totalRow.targetVideos}
                </td>
                <td className="px-3 py-4 text-sm font-bold font-mono">
                  {totalRow.submittedVideos}
                </td>
                <td className="px-3 py-4 text-sm font-bold">
                  {formatCurrency(totalRow.expectedRevenue)}
                </td>
                <td className="px-3 py-4 text-sm font-bold">
                  {formatCurrency(totalRow.actualRevenue)}
                </td>
                <td className="px-3 py-4 text-sm font-bold">
                  {formatCurrency(totalRow.incentives)}
                </td>
                <td className="px-3 py-4 text-sm font-bold">
                  {formatCurrency(totalRow.reimbursements)}
                </td>
                <td className="px-3 py-4 text-sm font-bold tabular-nums text-neon-cyan">
                  {formatCurrency(totalRow.tncExpectedProfit)}
                </td>
                <td className="px-3 py-4 text-sm font-bold tabular-nums text-neon-purple">
                  {formatCurrency(totalRow.hndExpectedProfit)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <EditCreatorTargetsDialog
        open={editCtx !== null}
        onOpenChange={(o) => {
          if (!o) setEditCtx(null);
        }}
        creatorId={editCtx?.creatorId ?? ""}
        creatorName={editCtx?.creatorName ?? ""}
        rows={editCtx?.rows ?? []}
        tableSegments={tableSegments}
        resolveHanindoPercent={resolveHanindoPercent}
        onPersistHanindoPercent={onPersistHanindoPercent}
        onSave={onUpdateTargetRows}
      />
    </div>
  );
}

function SubmittedVideoLinksPopover({
  urls,
  submittedVideos,
  onSave,
}: {
  urls: string[];
  submittedVideos: number;
  onSave: (urls: string[]) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const openedRoundRef = useRef(false);

  useEffect(() => {
    if (!open) {
      openedRoundRef.current = false;
      return;
    }
    if (openedRoundRef.current) return;
    openedRoundRef.current = true;

    const fromServer = filterPlausibleVideoUrls(
      urls.map((u) => String(u).trim()),
    );
    const legacySlots = Math.max(0, submittedVideos - fromServer.length);
    setDraft([...fromServer, ...Array(legacySlots).fill("")]);
    setNewUrl("");
  }, [open, urls, submittedVideos]);

  const patchDraftIdx = (idx: number, value: string) => {
    setDraft((d) => d.map((x, i) => (i === idx ? value : x)));
  };

  const add = () => {
    const s = newUrl.trim();
    if (!s) return;
    if (!isPlausibleSubmittedVideoUrl(s)) {
      toast.error("Bukan URL video yang valid", {
        description:
          "Pakai link TikTok (https://…). Jangan tempel pesan error atau teks panjang dari toast.",
      });
      return;
    }
    setDraft((d) =>
      d.some((x) => x.trim().toLowerCase() === s.toLowerCase()) ? d : [...d, s],
    );
    setNewUrl("");
  };

  const addEmptySlot = () => {
    setDraft((d) => [...d, ""]);
  };

  const save = async () => {
    const cleaned = filterPlausibleVideoUrls(
      draft.map((s) => s.trim()).filter((s) => s.length > 0),
    );
    setSaving(true);
    try {
      await onSave(cleaned);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const filledCount = draft.filter((s) => s.trim().length > 0).length;
  const hasEmptySlots = draft.some((s) => s.trim().length === 0);
  const storedUrlCount = filterPlausibleVideoUrls(
    urls.map((u) => String(u).trim()),
  ).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 text-muted transition hover:border-neon-cyan/40 hover:text-neon-cyan"
          title="Edit daftar link video"
          aria-label="Edit daftar link video"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,380px)] min-w-[280px] border-white/[0.08] bg-[#0a1020]/98 p-3 shadow-2xl"
        align="start"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
          Link video
        </p>
        <p className="mb-3 text-[11px] leading-snug text-muted">
          Hanya link TikTok/URL video yang valid. Teks error atau pesan SQL dari
          toast tidak bisa ditambahkan. Tampilan memuat URL tersimpan di
          database. Satu baris terisi = satu video →{" "}
          <span className="text-foreground/85">Actual revenue</span> ={" "}
          <span className="font-mono text-foreground/80">
            jumlah link × base pay
          </span>
          . <strong className="font-semibold text-foreground/90">Simpan</strong>{" "}
          menyamakan hitungan submit dengan jumlah link yang terisi.
        </p>
        {storedUrlCount === 0 && submittedVideos > 0 ? (
          <p className="mb-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-100/90">
            Ada {submittedVideos} submit di data, belum ada URL tersimpan (jalankan{" "}
            <code className="rounded bg-black/30 px-1">npm run db:apply-video-urls</code>{" "}
            jika simpan error). Isi URL pada baris kosong di bawah lalu Simpan.
          </p>
        ) : null}
        {hasEmptySlots && draft.length > 0 ? (
          <p className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100/90">
            Baris kosong tidak dihitung sampai diisi. Saat ini{" "}
            <span className="font-mono">{filledCount}</span> URL terisi, di meja:{" "}
            <span className="font-mono">{submittedVideos}</span> submitted (sebelum
            simpan).
          </p>
        ) : null}
        <ul className="mb-3 max-h-48 space-y-1.5 overflow-y-auto">
          {draft.length === 0 ? (
            <li className="text-[11px] text-muted">
              Belum ada baris. Tambah URL atau slot kosong.
            </li>
          ) : (
            draft.map((u, idx) => (
              <li
                key={`row-${idx}`}
                className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/30 px-2 py-1.5"
              >
                {u.trim().length > 0 && isPlausibleSubmittedVideoUrl(u) ? (
                  <a
                    href={u.trim().startsWith("http") ? u.trim() : `https://${u.trim()}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 break-all text-[11px] text-neon-cyan/90 underline-offset-2 hover:underline"
                  >
                    {u.trim()}
                  </a>
                ) : (
                  <input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    value={u}
                    onChange={(e) => patchDraftIdx(idx, e.target.value)}
                    placeholder="Tempel URL TikTok (slot…)"
                    className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-foreground placeholder:text-muted focus:border-neon-cyan/40 focus:outline-none"
                  />
                )}
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => d.filter((_, i) => i !== idx))
                  }
                  className="shrink-0 rounded p-0.5 text-muted hover:bg-red-500/15 hover:text-red-300"
                  aria-label="Hapus baris"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
          <div className="flex min-w-0 flex-1 gap-1.5">
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Tempel URL TikTok…"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-neon-cyan/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={add}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] font-semibold text-foreground transition hover:border-neon-cyan/35"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah
            </button>
          </div>
          <button
            type="button"
            onClick={addEmptySlot}
            className="rounded-lg border border-white/10 px-2 py-1.5 text-[11px] font-medium text-muted transition hover:border-white/20 hover:text-foreground"
          >
            + Slot kosong
          </button>
        </div>
        <div className="mt-3 flex justify-end gap-2 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={saving}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-white/5 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg border border-neon-cyan/40 bg-neon-cyan/15 px-3 py-1.5 text-xs font-semibold text-neon-cyan transition hover:bg-neon-cyan/25 disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RowMiniAction({
  icon,
  text,
  onClick,
  variant = "default",
}: {
  icon: ReactNode;
  text: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "pointer-events-auto inline-flex w-full min-w-0 items-center justify-center gap-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/90 shadow-sm backdrop-blur transition",
        variant === "danger"
          ? "hover:border-red-400/45 hover:text-red-300"
          : "hover:border-neon-cyan/40 hover:text-neon-cyan",
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{text}</span>
    </button>
  );
}
