"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ensureWorkspaceDefaults,
  fetchDashboardData,
  persistTargets,
  deleteTargetsByIds,
  seedDemoData,
  type DashboardBundle,
} from "@/lib/dashboard/supabase-data";
import {
  applySubmittedVideosDelta,
  applyTargetRowEdit,
  mergeTargetForms,
  type CreatorTargetRowSave,
} from "@/lib/dashboard/merge-targets";
import { createClient } from "@/lib/supabase/client";
import {
  formatSupabaseClientError,
  supabaseErrorDebugPayload,
} from "@/lib/supabase/format-client-error";
import { useCreatorHanindoPercents } from "@/hooks/useCreatorHanindoPercents";
import { withPostgrestSchemaRetry } from "@/lib/supabase/postgrest-retry";
import {
  DEFAULT_HANINDO_SHARING_PERCENT,
  mergeHanindoPercentsFromCreators,
} from "@/lib/dashboard/creator-financial-overrides";
import {
  HANINDO_SHARING_RATE_ON_TARGET_REVENUE,
  OVERVIEW_FOLO_SEGMENT_SHARE,
  OVERVIEW_TNC_SEGMENT_SHARE,
} from "@/lib/dashboard/financial-rules";
import {
  TABLE_CHIP_OPTIONS,
  targetMatchesTableQuickFilter,
} from "@/lib/dashboard/table-segments";
import {
  normalizeTargetTableSegmentForKey,
  type Brand,
  type CreatorTarget,
  type DashboardFilters,
  type QuickFilter,
  type TargetFormRow,
  type TargetStatus,
} from "@/lib/types";

function labelTableSegment(raw: string): string {
  const seg = normalizeTargetTableSegmentForKey(raw);
  return TABLE_CHIP_OPTIONS.find((o) => o.id === seg)?.label ?? seg;
}

/**
 * Alokasi perf table: ER = incentives + [TNC] + [HND], [HND] = hanindoRate × ER.
 * hanindoRate: 0–0,5 (default dari konstant overview). Per creator bisa di localStorage.
 */
export function splitErForTncHndColumns(
  expectedRevenue: number,
  incentives: number,
  hanindoRate: number = HANINDO_SHARING_RATE_ON_TARGET_REVENUE,
): { tncExpectedProfit: number; hndExpectedProfit: number } {
  const r = Math.max(
    0,
    Math.min(0.5, Number.isFinite(hanindoRate) ? hanindoRate : 0),
  );
  const hndExpectedProfit = r * expectedRevenue;
  const tncExpectedProfit = expectedRevenue - incentives - hndExpectedProfit;
  return { tncExpectedProfit, hndExpectedProfit };
}

export interface AggregatedCreatorRow {
  creatorId: string;
  targetVideos: number;
  submittedVideos: number;
  expectedRevenue: number;
  actualRevenue: number;
  incentives: number;
  reimbursements: number;
  expectedProfit: number;
  /** Sisa ER − incentives − [HND] (identitas: ER = incentives + [TNC] + [HND]). */
  tncExpectedProfit: number;
  /** 15% × expected revenue creator (Hanindo). */
  hndExpectedProfit: number;
  actualProfit: number;
  status: TargetStatus;
}

export interface BreakdownRow {
  targetId: string;
  creatorId: string;
  projectId: string;
  projectName: string;
  /** Segmen meja dari Submit Targets (All / Hanindo PCP / FOLO Public; id tnc|folo). */
  tableSegmentLabel: string;
  tableSegmentId: string;
  basePay: number;
  incentivePerVideo: number;
  campaignObjectiveId: string;
  campaignLabel: string;
  creatorType: CreatorTarget["creatorType"];
  tiktokAccountId: string;
  month: string;
  targetVideos: number;
  submittedVideos: number;
  expectedRevenue: number;
  actualRevenue: number;
  incentives: number;
  reimbursements: number;
  expectedProfit: number;
  actualProfit: number;
}

export interface TotalRow extends AggregatedCreatorRow {
  isTotal: true;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function computeStatus(submitted: number, target: number): TargetStatus {
  if (target <= 0) return "on_track";
  if (submitted > target) return "exceeded";
  if (submitted < target * 0.9) return "below";
  return "on_track";
}

/** Jumlah expected revenue per nilai segmen meja (all | tnc | folo). */
function sumExpectedRevenueForTableSegment(
  list: CreatorTarget[],
  segment: "all" | "tnc" | "folo",
): number {
  return sum(
    list
      .filter(
        (t) => normalizeTargetTableSegmentForKey(t.tableSegmentId) === segment,
      )
      .map((t) => t.expectedRevenue),
  );
}

export function useCreatorDashboard() {
  const { snapshot: hanindoLocalSnapshot } = useCreatorHanindoPercents();
  const supabase = useMemo(() => createClient(), []);

  const [bundle, setBundle] = useState<DashboardBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const loadGenerationRef = useRef(0);

  const [selectedMonth, setSelectedMonth] = useState<string>("2026-03");
  const [filters, setFilters] = useState<DashboardFilters>({
    creatorId: "all",
    brandId: "all",
  });
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const load = useCallback(async () => {
    const gen = ++loadGenerationRef.current;
    setLoading(true);
    try {
      const d = await withPostgrestSchemaRetry(supabase, async () => {
        await ensureWorkspaceDefaults(supabase);
        return fetchDashboardData(supabase);
      });
      if (gen !== loadGenerationRef.current) return;
      setBundle(d);
      toast.dismiss("creator-dashboard-load");
    } catch (e) {
      if (gen !== loadGenerationRef.current) return;
      const description = formatSupabaseClientError(e);
      toast.error("Gagal memuat data workspace", {
        id: "creator-dashboard-load",
        description,
        duration: 14_000,
      });
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[useCreatorDashboard.load]",
          description,
          supabaseErrorDebugPayload(e),
        );
      }
      setBundle(null);
    } finally {
      if (gen === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const creators = bundle?.creators ?? [];
  const projects = bundle?.projects ?? [];
  const brands = bundle?.brands ?? [];
  const organizations = bundle?.organizations ?? [];
  const campaignObjectives = bundle?.campaignObjectives ?? [];
  const tiktokAccounts = bundle?.tiktokAccounts ?? [];
  const targets = bundle?.targets ?? [];

  const hanindoPercentByCreator = useMemo(
    () => mergeHanindoPercentsFromCreators(creators, hanindoLocalSnapshot),
    [creators, hanindoLocalSnapshot],
  );

  const monthTargets = useMemo(
    () => targets.filter((t) => t.month === selectedMonth),
    [targets, selectedMonth],
  );

  const targetsAfterDashboardFilters = useMemo(() => {
    let list = monthTargets;
    if (filters.creatorId !== "all") {
      list = list.filter((t) => t.creatorId === filters.creatorId);
    }
    if (filters.brandId !== "all") {
      const pids = new Set(
        projects.filter((p) => p.brandId === filters.brandId).map((p) => p.id),
      );
      list = list.filter((t) => pids.has(t.projectId));
    }
    return list;
  }, [monthTargets, filters, projects]);

  /** Baris segmen "All" (belum ditugaskan ke meja Hanindo PCP / FOLO Public) — tidak ikut chip gabungan. */
  const unassignedTableSegmentTargetCount = useMemo(
    () =>
      targetsAfterDashboardFilters.filter(
        (t) => normalizeTargetTableSegmentForKey(t.tableSegmentId) === "all",
      ).length,
    [targetsAfterDashboardFilters],
  );

  const filteredLeafTargets = useMemo(() => {
    let list = targetsAfterDashboardFilters.filter((t) =>
      targetMatchesTableQuickFilter(quickFilter, t.tableSegmentId),
    );

    const byCreator = new Map<string, CreatorTarget[]>();
    for (const t of list) {
      const arr = byCreator.get(t.creatorId) ?? [];
      arr.push(t);
      byCreator.set(t.creatorId, arr);
    }

    const creatorIds = [...byCreator.keys()].filter((cid) => {
      const c = creators.find((x) => x.id === cid);
      return Boolean(c);
    });

    return { byCreator, visibleCreatorIds: creatorIds };
  }, [targetsAfterDashboardFilters, quickFilter, creators]);

  const creatorRows: AggregatedCreatorRow[] = useMemo(() => {
    const { byCreator, visibleCreatorIds } = filteredLeafTargets;
    return visibleCreatorIds.map((cid) => {
      const rows = byCreator.get(cid) ?? [];
      const targetVideos = sum(rows.map((r) => r.targetVideos));
      const submittedVideos = sum(rows.map((r) => r.submittedVideos));
      const creatorExpectedRevenue = sum(rows.map((r) => r.expectedRevenue));
      const creatorIncentives = sum(rows.map((r) => r.incentives));
      const hndPct =
        hanindoPercentByCreator[cid] ?? DEFAULT_HANINDO_SHARING_PERCENT;
      const { tncExpectedProfit, hndExpectedProfit } = splitErForTncHndColumns(
        creatorExpectedRevenue,
        creatorIncentives,
        hndPct / 100,
      );
      return {
        creatorId: cid,
        targetVideos,
        submittedVideos,
        expectedRevenue: creatorExpectedRevenue,
        actualRevenue: sum(rows.map((r) => r.actualRevenue)),
        incentives: creatorIncentives,
        reimbursements: sum(rows.map((r) => r.reimbursements)),
        expectedProfit: tncExpectedProfit + hndExpectedProfit,
        tncExpectedProfit,
        hndExpectedProfit,
        actualProfit: sum(rows.map((r) => r.actualProfit)),
        status: computeStatus(submittedVideos, targetVideos),
      };
    });
  }, [filteredLeafTargets, hanindoPercentByCreator]);

  const breakdownByCreator = useCallback(
    (creatorId: string): BreakdownRow[] => {
      const { byCreator, visibleCreatorIds } = filteredLeafTargets;
      if (!visibleCreatorIds.includes(creatorId)) return [];
      const rows = byCreator.get(creatorId) ?? [];
      return rows.map((t) => {
        const p = projects.find((x) => x.id === t.projectId);
        const camp = campaignObjectives.find(
          (x) => x.id === t.campaignObjectiveId,
        );
        return {
          targetId: t.id,
          creatorId: t.creatorId,
          projectId: t.projectId,
          projectName: p?.name ?? t.projectId,
          tableSegmentLabel: labelTableSegment(t.tableSegmentId),
          tableSegmentId: t.tableSegmentId,
          basePay: t.basePay,
          incentivePerVideo: t.incentivePerVideo,
          campaignObjectiveId: t.campaignObjectiveId,
          campaignLabel: camp?.label ?? t.campaignObjectiveId,
          creatorType: t.creatorType,
          tiktokAccountId: t.tiktokAccountId,
          month: t.month,
          targetVideos: t.targetVideos,
          submittedVideos: t.submittedVideos,
          expectedRevenue: t.expectedRevenue,
          actualRevenue: t.actualRevenue,
          incentives: t.incentives,
          reimbursements: t.reimbursements,
          expectedProfit: t.expectedProfit,
          actualProfit: t.actualProfit,
        };
      });
    },
    [filteredLeafTargets, projects, campaignObjectives],
  );

  const totalRow: TotalRow | null = useMemo(() => {
    if (creatorRows.length === 0) return null;
    return {
      isTotal: true,
      creatorId: "__total__",
      targetVideos: sum(creatorRows.map((r) => r.targetVideos)),
      submittedVideos: sum(creatorRows.map((r) => r.submittedVideos)),
      expectedRevenue: sum(creatorRows.map((r) => r.expectedRevenue)),
      actualRevenue: sum(creatorRows.map((r) => r.actualRevenue)),
      incentives: sum(creatorRows.map((r) => r.incentives)),
      reimbursements: sum(creatorRows.map((r) => r.reimbursements)),
      expectedProfit: sum(creatorRows.map((r) => r.expectedProfit)),
      tncExpectedProfit: sum(creatorRows.map((r) => r.tncExpectedProfit)),
      hndExpectedProfit: sum(creatorRows.map((r) => r.hndExpectedProfit)),
      actualProfit: sum(creatorRows.map((r) => r.actualProfit)),
      status: "on_track",
    };
  }, [creatorRows]);

  const handleSubmitTargets = useCallback(
    async (rows: TargetFormRow[]) => {
      setBundle((prev) => {
        if (!prev) return prev;
        const defaultCamp = prev.campaignObjectives[0]?.id;
        if (!defaultCamp) {
          queueMicrotask(() =>
            toast.error("Validasi", {
              description:
                "Workspace belum punya campaign objective. Muat ulang halaman atau hubungi admin.",
            }),
          );
          return prev;
        }
        const nextTargets = mergeTargetForms(
          prev.targets,
          rows,
          defaultCamp,
        );
        void (async () => {
          try {
            await persistTargets(supabase, nextTargets);
            await load();
          } catch (e) {
            toast.error(formatSupabaseClientError(e));
          }
        })();
        return { ...prev, targets: nextTargets };
      });
    },
    [supabase, load],
  );

  const handleUpdateTargetRows = useCallback(
    async (updates: CreatorTargetRowSave[]) => {
      if (updates.length === 0) return;
      const byId = new Map(updates.map((u) => [u.targetId, u]));

      let nextTargets: CreatorTarget[] | undefined;
      setBundle((prev) => {
        if (!prev) return prev;
        nextTargets = prev.targets.map((t) => {
          const u = byId.get(t.id);
          if (!u) return t;
          return applyTargetRowEdit(t, {
            targetVideos: u.targetVideos,
            tableSegmentId: u.tableSegmentId,
            basePay: u.basePay,
            incentivePerVideo: u.incentivePerVideo,
          });
        });
        return { ...prev, targets: nextTargets };
      });

      if (!nextTargets) return;

      try {
        await persistTargets(supabase, nextTargets);
        toast.success("Target berhasil disimpan");
        await load();
      } catch (e) {
        toast.error(formatSupabaseClientError(e));
        await load();
      }
    },
    [supabase, load],
  );

  const handleDeleteCreatorTargets = useCallback(
    async (creatorId: string) => {
      const ids = breakdownByCreator(creatorId).map((b) => b.targetId);
      if (ids.length === 0) return;
      try {
        await deleteTargetsByIds(supabase, ids);
        toast.success("Target dihapus");
        await load();
      } catch (e) {
        toast.error(formatSupabaseClientError(e));
        await load();
      }
    },
    [supabase, load, breakdownByCreator],
  );

  const handleSubmitVideoUrls = useCallback(
    async (deltas: { targetId: string; addVideos: number }[]) => {
      const byId = new Map<string, number>();
      for (const d of deltas) {
        const add = Math.max(0, Math.floor(Number(d.addVideos)) || 0);
        if (add <= 0) continue;
        byId.set(d.targetId, (byId.get(d.targetId) ?? 0) + add);
      }
      if (byId.size === 0) return;

      let nextTargets: CreatorTarget[] | undefined;
      setBundle((prev) => {
        if (!prev) return prev;
        nextTargets = prev.targets.map((t) => {
          const add = byId.get(t.id);
          if (add === undefined || add <= 0) return t;
          return applySubmittedVideosDelta(t, add);
        });
        return { ...prev, targets: nextTargets };
      });

      if (!nextTargets) return;

      try {
        await persistTargets(supabase, nextTargets);
        toast.success("Video submissions berhasil disimpan");
        await load();
      } catch (e) {
        toast.error(formatSupabaseClientError(e));
        await load();
      }
    },
    [supabase, load],
  );

  const seedIfEmpty = useCallback(async () => {
    try {
      await seedDemoData(supabase);
      await load();
    } catch (e) {
      toast.error(formatSupabaseClientError(e));
    }
  }, [supabase, load]);

  const overviewStats = useMemo(() => {
    const base = targetsAfterDashboardFilters;
    const tncSegmentRevenue = sumExpectedRevenueForTableSegment(base, "tnc");
    const foloSegmentRevenue = sumExpectedRevenueForTableSegment(base, "folo");
    const allSegmentRevenue = sumExpectedRevenueForTableSegment(base, "all");
    const targetRevenue =
      tncSegmentRevenue + foloSegmentRevenue + allSegmentRevenue;
    /** 50% revenue Hanindo PCP + 54% revenue FOLO Public (expected per segmen, filter header). */
    const tncRevenue =
      OVERVIEW_TNC_SEGMENT_SHARE * tncSegmentRevenue +
      OVERVIEW_FOLO_SEGMENT_SHARE * foloSegmentRevenue;
    /** 15% × total target revenue (semua segmen). */
    const hanindoSharingTotal =
      HANINDO_SHARING_RATE_ON_TARGET_REVENUE * targetRevenue;
    return {
      targetRevenue,
      tncRevenue,
      hanindoSharingTotal,
      tncSegmentRevenue,
      foloSegmentRevenue,
      allSegmentRevenue,
    };
  }, [targetsAfterDashboardFilters]);

  return {
    creators,
    projects,
    brands,
    organizations,
    campaignObjectives,
    tiktokAccounts,
    targets,
    selectedMonth,
    setSelectedMonth,
    filters,
    setFilters,
    quickFilter,
    setQuickFilter,
    unassignedTableSegmentTargetCount,
    creatorRows,
    breakdownByCreator,
    totalRow,
    hasRows: creatorRows.length > 0,
    handleSubmitTargets,
    handleUpdateTargetRows,
    handleDeleteCreatorTargets,
    handleSubmitVideoUrls,
    loading,
    overviewStats,
    reload: load,
    seedIfEmpty,
  };
}
