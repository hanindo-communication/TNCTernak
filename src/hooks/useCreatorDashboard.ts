"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ensureWorkspaceDefaults,
  fetchDashboardData,
  persistTargets,
  seedDemoData,
  type DashboardBundle,
} from "@/lib/dashboard/supabase-data";
import { mergeTargetForms } from "@/lib/dashboard/merge-targets";
import { createClient } from "@/lib/supabase/client";
import { formatSupabaseClientError } from "@/lib/supabase/format-client-error";
import { withPostgrestSchemaRetry } from "@/lib/supabase/postgrest-retry";
import type {
  CreatorTarget,
  DashboardFilters,
  QuickFilter,
  TargetFormRow,
  TargetStatus,
} from "@/lib/types";

export interface AggregatedCreatorRow {
  creatorId: string;
  targetVideos: number;
  submittedVideos: number;
  expectedRevenue: number;
  actualRevenue: number;
  incentives: number;
  reimbursements: number;
  expectedProfit: number;
  actualProfit: number;
  status: TargetStatus;
}

export interface BreakdownRow {
  targetId: string;
  projectId: string;
  projectName: string;
  campaignLabel: string;
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

export function useCreatorDashboard() {
  const supabase = useMemo(() => createClient(), []);

  const [bundle, setBundle] = useState<DashboardBundle | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState<string>("2026-03");
  const [filters, setFilters] = useState<DashboardFilters>({
    creatorId: "all",
    brandId: "all",
  });
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await withPostgrestSchemaRetry(supabase, async () => {
        await ensureWorkspaceDefaults(supabase);
        return fetchDashboardData(supabase);
      });
      setBundle(d);
    } catch (e) {
      console.error(e);
      setBundle(null);
    } finally {
      setLoading(false);
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

  const monthTargets = useMemo(
    () => targets.filter((t) => t.month === selectedMonth),
    [targets, selectedMonth],
  );

  const filteredLeafTargets = useMemo(() => {
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

    if (quickFilter !== "all") {
      const brandIdsInSegment = new Set(
        brands
          .filter((b) => b.tableSegmentId === quickFilter)
          .map((b) => b.id),
      );
      const pids = new Set(
        projects
          .filter((p) => brandIdsInSegment.has(p.brandId))
          .map((p) => p.id),
      );
      list = list.filter((t) => pids.has(t.projectId));
    }

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
  }, [monthTargets, filters, quickFilter, creators, projects, brands]);

  const creatorRows: AggregatedCreatorRow[] = useMemo(() => {
    const { byCreator, visibleCreatorIds } = filteredLeafTargets;
    return visibleCreatorIds.map((cid) => {
      const rows = byCreator.get(cid) ?? [];
      const targetVideos = sum(rows.map((r) => r.targetVideos));
      const submittedVideos = sum(rows.map((r) => r.submittedVideos));
      return {
        creatorId: cid,
        targetVideos,
        submittedVideos,
        expectedRevenue: sum(rows.map((r) => r.expectedRevenue)),
        actualRevenue: sum(rows.map((r) => r.actualRevenue)),
        incentives: sum(rows.map((r) => r.incentives)),
        reimbursements: sum(rows.map((r) => r.reimbursements)),
        expectedProfit: sum(rows.map((r) => r.expectedProfit)),
        actualProfit: sum(rows.map((r) => r.actualProfit)),
        status: computeStatus(submittedVideos, targetVideos),
      };
    });
  }, [filteredLeafTargets]);

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
          projectId: t.projectId,
          projectName: p?.name ?? t.projectId,
          campaignLabel: camp?.label ?? t.campaignObjectiveId,
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

  const seedIfEmpty = useCallback(async () => {
    try {
      await seedDemoData(supabase);
      await load();
    } catch (e) {
      toast.error(formatSupabaseClientError(e));
    }
  }, [supabase, load]);

  const overviewStats = useMemo(() => {
    if (!totalRow) {
      return {
        targetRevenue: 0,
        actualRevenue: 0,
        percentageShare: null as number | null,
      };
    }
    const targetRevenue = totalRow.expectedRevenue;
    const actualRevenue = totalRow.actualRevenue;
    const percentageShare =
      targetRevenue > 0 ? (actualRevenue / targetRevenue) * 100 : null;
    return { targetRevenue, actualRevenue, percentageShare };
  }, [totalRow]);

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
    creatorRows,
    breakdownByCreator,
    totalRow,
    hasRows: creatorRows.length > 0,
    handleSubmitTargets,
    loading,
    overviewStats,
    reload: load,
    seedIfEmpty,
  };
}
