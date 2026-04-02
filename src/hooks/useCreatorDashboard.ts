"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  ensureWorkspaceDefaults,
  fetchDashboardData,
  logWorkspaceActivity,
  persistTargets,
  deleteTargetsByIds,
  seedDemoData,
  type DashboardBundle,
} from "@/lib/dashboard/supabase-data";
import {
  appendSubmittedVideoUrls,
  applyTargetRowEdit,
  mergeTargetForms,
  replaceSubmittedVideoUrls,
  syncDerivedFinancials,
  usesSharingPercentModel,
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
import { splitErForTncHndColumns } from "@/lib/dashboard/financial-rules";
import {
  TABLE_CHIP_OPTIONS,
  targetMatchesTableQuickFilter,
} from "@/lib/dashboard/table-segments";
import {
  normalizeTargetTableSegmentForKey,
  type Creator,
  type CreatorTarget,
  type DashboardFilters,
  type Project,
  type QuickFilter,
  type TargetFormRow,
  type TargetStatus,
} from "@/lib/types";
import {
  addMonthsToMonthKey,
  DASHBOARD_REPORT_TIMEZONE,
  monthKeyNowInTimeZone,
} from "@/lib/utils";

function labelTableSegment(raw: string): string {
  const seg = normalizeTargetTableSegmentForKey(raw);
  return TABLE_CHIP_OPTIONS.find((o) => o.id === seg)?.label ?? seg;
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
  /** `YYYY-MM` jika semua leaf target bulan yang sama; null jika campuran. */
  targetMonthKey: string | null;
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
  incentivePercent: number;
  tncSharingPercent: number;
  hndSharingPercent: number;
  campaignObjectiveId: string;
  campaignLabel: string;
  creatorType: CreatorTarget["creatorType"];
  tiktokAccountId: string;
  month: string;
  targetVideos: number;
  submittedVideos: number;
  submittedVideoUrls: string[];
  expectedRevenue: number;
  actualRevenue: number;
  incentives: number;
  reimbursements: number;
  expectedProfit: number;
  actualProfit: number;
  tncSharingAmount: number;
  hndSharingAmount: number;
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

/** Agregasi baris tabel performa untuk satu `monthKey` dengan filter dashboard + quick filter chip. */
function buildVisibleTableAggregation(
  targets: CreatorTarget[],
  creators: Creator[],
  projects: Project[],
  monthKey: string,
  filters: DashboardFilters,
  quickFilter: QuickFilter,
  hanindoPercentByCreator: Record<string, number>,
): {
  creatorRows: AggregatedCreatorRow[];
  byCreator: Map<string, CreatorTarget[]>;
  visibleCreatorIds: string[];
} {
  let monthList = targets.filter((t) => t.month === monthKey);
  if (filters.creatorId !== "all") {
    monthList = monthList.filter((t) => t.creatorId === filters.creatorId);
  }
  if (filters.brandId !== "all") {
    const pids = new Set(
      projects.filter((p) => p.brandId === filters.brandId).map((p) => p.id),
    );
    monthList = monthList.filter((t) => pids.has(t.projectId));
  }
  const list = monthList.filter((t) =>
    targetMatchesTableQuickFilter(quickFilter, t.tableSegmentId),
  );
  const byCreator = new Map<string, CreatorTarget[]>();
  for (const t of list) {
    const arr = byCreator.get(t.creatorId) ?? [];
    arr.push(t);
    byCreator.set(t.creatorId, arr);
  }
  const visibleCreatorIds = [...byCreator.keys()].filter((cid) =>
    creators.some((c) => c.id === cid),
  );
  const creatorRows = visibleCreatorIds.map((cid) => {
    const rows = byCreator.get(cid) ?? [];
    const targetVideos = sum(rows.map((r) => r.targetVideos));
    const submittedVideos = sum(rows.map((r) => r.submittedVideos));
    const creatorExpectedRevenue = sum(rows.map((r) => r.expectedRevenue));
    const creatorIncentives = sum(rows.map((r) => r.incentives));
    const hndPct =
      hanindoPercentByCreator[cid] ?? DEFAULT_HANINDO_SHARING_PERCENT;
    let tncExpectedProfit = 0;
    let hndExpectedProfit = 0;
    for (const r of rows) {
      if (usesSharingPercentModel(r)) {
        tncExpectedProfit += r.tncSharingAmount;
        hndExpectedProfit += r.hndSharingAmount;
      } else {
        const split = splitErForTncHndColumns(
          r.expectedRevenue,
          r.incentives,
          hndPct / 100,
        );
        tncExpectedProfit += split.tncExpectedProfit;
        hndExpectedProfit += split.hndExpectedProfit;
      }
    }
    const monthKeys = [...new Set(rows.map((r) => r.month))];
    const targetMonthKey = monthKeys.length === 1 ? monthKeys[0]! : null;
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
      targetMonthKey,
    };
  });
  return { creatorRows, byCreator, visibleCreatorIds };
}

export function useCreatorDashboard(options?: {
  actorEmail?: string | null;
}) {
  const { snapshot: hanindoLocalSnapshot } = useCreatorHanindoPercents();
  const supabase = useMemo(() => createClient(), []);
  const actorEmailRef = useRef<string | null>(options?.actorEmail ?? null);
  useEffect(() => {
    actorEmailRef.current = options?.actorEmail ?? null;
  }, [options?.actorEmail]);

  const [bundle, setBundle] = useState<DashboardBundle | null>(null);
  const bundleRef = useRef<DashboardBundle | null>(null);
  bundleRef.current = bundle;
  const [loading, setLoading] = useState(true);
  const loadGenerationRef = useRef(0);

  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    monthKeyNowInTimeZone(DASHBOARD_REPORT_TIMEZONE),
  );
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

  const prevMonthKey = useMemo(
    () => addMonthsToMonthKey(selectedMonth, -1),
    [selectedMonth],
  );

  const tableAggregation = useMemo(
    () =>
      buildVisibleTableAggregation(
        targets,
        creators,
        projects,
        selectedMonth,
        filters,
        quickFilter,
        hanindoPercentByCreator,
      ),
    [
      targets,
      creators,
      projects,
      selectedMonth,
      filters,
      quickFilter,
      hanindoPercentByCreator,
    ],
  );

  const { creatorRows, byCreator, visibleCreatorIds } = tableAggregation;

  const filteredLeafTargets = useMemo(
    () => ({ byCreator, visibleCreatorIds }),
    [byCreator, visibleCreatorIds],
  );

  const tableAggregationPreviousMonth = useMemo(
    () =>
      buildVisibleTableAggregation(
        targets,
        creators,
        projects,
        prevMonthKey,
        filters,
        quickFilter,
        hanindoPercentByCreator,
      ),
    [
      targets,
      creators,
      projects,
      prevMonthKey,
      filters,
      quickFilter,
      hanindoPercentByCreator,
    ],
  );

  const totalRowPreviousMonth: TotalRow | null = useMemo(() => {
    const rows = tableAggregationPreviousMonth.creatorRows;
    if (rows.length === 0) return null;
    return {
      isTotal: true,
      creatorId: "__total__",
      targetVideos: sum(rows.map((r) => r.targetVideos)),
      submittedVideos: sum(rows.map((r) => r.submittedVideos)),
      expectedRevenue: sum(rows.map((r) => r.expectedRevenue)),
      actualRevenue: sum(rows.map((r) => r.actualRevenue)),
      incentives: sum(rows.map((r) => r.incentives)),
      reimbursements: sum(rows.map((r) => r.reimbursements)),
      expectedProfit: sum(rows.map((r) => r.expectedProfit)),
      tncExpectedProfit: sum(rows.map((r) => r.tncExpectedProfit)),
      hndExpectedProfit: sum(rows.map((r) => r.hndExpectedProfit)),
      actualProfit: sum(rows.map((r) => r.actualProfit)),
      status: "on_track",
      targetMonthKey: null,
    };
  }, [tableAggregationPreviousMonth.creatorRows]);

  const getCreatorExpectedRevenueSeries = useCallback(
    (creatorId: string): { monthKey: string; expectedRevenue: number }[] => {
      const brandPids =
        filters.brandId === "all"
          ? null
          : new Set(
              projects
                .filter((p) => p.brandId === filters.brandId)
                .map((p) => p.id),
            );
      const points: { monthKey: string; expectedRevenue: number }[] = [];
      for (let d = -5; d <= 0; d++) {
        const key = addMonthsToMonthKey(selectedMonth, d);
        const list = targets.filter((t) => {
          if (t.month !== key) return false;
          if (t.creatorId !== creatorId) return false;
          if (brandPids && !brandPids.has(t.projectId)) return false;
          return true;
        });
        points.push({
          monthKey: key,
          expectedRevenue: sum(list.map((x) => x.expectedRevenue)),
        });
      }
      return points;
    },
    [targets, selectedMonth, filters.brandId, projects],
  );

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
          incentivePercent: t.incentivePercent,
          tncSharingPercent: t.tncSharingPercent,
          hndSharingPercent: t.hndSharingPercent,
          campaignObjectiveId: t.campaignObjectiveId,
          campaignLabel: camp?.label ?? t.campaignObjectiveId,
          creatorType: t.creatorType,
          tiktokAccountId: t.tiktokAccountId,
          month: t.month,
          targetVideos: t.targetVideos,
          submittedVideos: t.submittedVideos,
          submittedVideoUrls: t.submittedVideoUrls ?? [],
          expectedRevenue: t.expectedRevenue,
          actualRevenue: t.actualRevenue,
          incentives: t.incentives,
          reimbursements: t.reimbursements,
          expectedProfit: t.expectedProfit,
          actualProfit: t.actualProfit,
          tncSharingAmount: t.tncSharingAmount,
          hndSharingAmount: t.hndSharingAmount,
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
      targetMonthKey: null,
    };
  }, [creatorRows]);

  const handleSubmitTargets = useCallback(
    async (rows: TargetFormRow[]): Promise<boolean> => {
      const prev = bundleRef.current;
      if (!prev) {
        toast.error("Data belum siap", {
          description: "Muat ulang halaman dan coba lagi.",
        });
        return false;
      }
      const defaultCamp = prev.campaignObjectives[0]?.id;
      if (!defaultCamp) {
        toast.error("Validasi", {
          description:
            "Workspace belum punya campaign objective. Muat ulang halaman atau hubungi admin.",
        });
        return false;
      }
      const nextTargets = mergeTargetForms(prev.targets, rows, defaultCamp);
      setBundle({ ...prev, targets: nextTargets });
      try {
        await persistTargets(supabase, nextTargets);
        await load();
        void logWorkspaceActivity(supabase, {
          actorEmail: actorEmailRef.current,
          action: "create",
          entityType: "creator_target",
          summary: `Submit targets — ${rows.length} baris dari form`,
          metadata: { rowCount: rows.length },
        });
        return true;
      } catch (e) {
        toast.error(formatSupabaseClientError(e));
        await load();
        return false;
      }
    },
    [supabase, load],
  );

  const handleUpdateTargetRows = useCallback(
    async (updates: CreatorTargetRowSave[]) => {
      if (updates.length === 0) return;
      const byId = new Map(updates.map((u) => [u.targetId, u]));

      const prev = bundleRef.current;
      if (!prev) return;
      const firstId = updates[0]?.targetId;
      const firstT = firstId
        ? prev.targets.find((t) => t.id === firstId)
        : undefined;
      const creatorLabel = firstT
        ? creators.find((c) => c.id === firstT.creatorId)?.name
        : undefined;

      let nextTargets: CreatorTarget[] | undefined;
      setBundle((p) => {
        if (!p) return p;
        nextTargets = p.targets.map((t) => {
          const u = byId.get(t.id);
          if (!u) return t;
          return applyTargetRowEdit(t, {
            targetVideos: u.targetVideos,
            tableSegmentId: u.tableSegmentId,
            basePay: u.basePay,
            incentivePercent: u.incentivePercent,
            tncSharingPercent: u.tncSharingPercent,
            hndSharingPercent: u.hndSharingPercent,
          });
        });
        return { ...p, targets: nextTargets };
      });

      if (!nextTargets) return;

      try {
        await persistTargets(supabase, nextTargets);
        toast.success(
          creatorLabel
            ? `Target disimpan — ${creatorLabel}`
            : "Target disimpan",
          {
            description:
              updates.length > 1
                ? `${updates.length} baris diperbarui.`
                : "Baris campaign diperbarui.",
          },
        );
        await load();
        void logWorkspaceActivity(supabase, {
          actorEmail: actorEmailRef.current,
          action: "update",
          entityType: "creator_target",
          summary: creatorLabel
            ? `Mengubah target — ${creatorLabel} (${updates.length} campaign)`
            : `Mengubah target (${updates.length} baris)`,
          metadata: { targetIds: updates.map((u) => u.targetId) },
        });
      } catch (e) {
        toast.error(formatSupabaseClientError(e));
        await load();
      }
    },
    [supabase, load, creators],
  );

  const handleUpdateCreatorTargetMonth = useCallback(
    async (creatorId: string, newMonthKey: string) => {
      if (!/^\d{4}-\d{2}$/.test(newMonthKey)) return;
      const ids = new Set(
        breakdownByCreator(creatorId).map((b) => b.targetId),
      );
      if (ids.size === 0) return;

      const prev = bundleRef.current;
      if (!prev) return;

      let nextTargets: CreatorTarget[] | undefined;
      setBundle((p) => {
        if (!p) return p;
        nextTargets = p.targets.map((t) =>
          ids.has(t.id)
            ? syncDerivedFinancials({ ...t, month: newMonthKey })
            : t,
        );
        return { ...p, targets: nextTargets };
      });

      if (!nextTargets) return;

      const creatorLabel = creators.find((c) => c.id === creatorId)?.name;

      try {
        await persistTargets(supabase, nextTargets);
        toast.success(
          creatorLabel
            ? `Bulan target diubah — ${creatorLabel}`
            : "Bulan target diubah",
          {
            description: `Dipindah ke ${newMonthKey}. Buka bulan itu di filter untuk melihat baris.`,
          },
        );
        await load();
        void logWorkspaceActivity(supabase, {
          actorEmail: actorEmailRef.current,
          action: "update",
          entityType: "creator_target",
          summary: creatorLabel
            ? `Mengubah bulan target — ${creatorLabel} → ${newMonthKey}`
            : `Mengubah bulan target → ${newMonthKey}`,
          metadata: { creatorId, newMonthKey, targetCount: ids.size },
        });
      } catch (e) {
        toast.error(formatSupabaseClientError(e));
        await load();
      }
    },
    [supabase, load, breakdownByCreator, creators],
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
    async (deltas: { targetId: string; urls: string[] }[]) => {
      const byId = new Map<string, string[]>();
      for (const d of deltas) {
        const urls = d.urls
          .map((s) => String(s).trim())
          .filter((s) => s.length > 0);
        if (urls.length === 0) continue;
        const acc = byId.get(d.targetId) ?? [];
        byId.set(d.targetId, [...acc, ...urls]);
      }
      if (byId.size === 0) return;

      let nextTargets: CreatorTarget[] | undefined;
      setBundle((prev) => {
        if (!prev) return prev;
        nextTargets = prev.targets.map((t) => {
          const urls = byId.get(t.id);
          if (!urls || urls.length === 0) return t;
          return appendSubmittedVideoUrls(t, urls);
        });
        return { ...prev, targets: nextTargets };
      });

      if (!nextTargets) return;

      try {
        await persistTargets(supabase, nextTargets);
        await load();
        void logWorkspaceActivity(supabase, {
          actorEmail: actorEmailRef.current,
          action: "update",
          entityType: "creator_target",
          summary: `Menambah URL video — ${byId.size} target`,
          metadata: { targetIds: [...byId.keys()] },
        });
      } catch (e) {
        await load();
        throw e;
      }
    },
    [supabase, load],
  );

  const handleReplaceTargetVideoLinks = useCallback(
    async (targetId: string, urls: string[]) => {
      let nextTargets: CreatorTarget[] | undefined;
      setBundle((prev) => {
        if (!prev) return prev;
        nextTargets = prev.targets.map((t) =>
          t.id === targetId ? replaceSubmittedVideoUrls(t, urls) : t,
        );
        return { ...prev, targets: nextTargets };
      });

      if (!nextTargets) return;

      try {
        await persistTargets(supabase, nextTargets);
        toast.success("Daftar link video disimpan");
        await load();
        void logWorkspaceActivity(supabase, {
          actorEmail: actorEmailRef.current,
          action: "update",
          entityType: "creator_target",
          summary: `Memperbarui daftar link video (1 target, ${urls.length} URL)`,
          metadata: { targetId, urlCount: urls.length },
        });
      } catch (e) {
        await load();
        throw e;
      }
    },
    [supabase, load],
  );

  const seedIfEmpty = useCallback(async () => {
    try {
      await seedDemoData(supabase);
      await load();
      void logWorkspaceActivity(supabase, {
        actorEmail: actorEmailRef.current,
        action: "create",
        entityType: "workspace_seed",
        summary: "Memuat data demo ke workspace bersama",
      });
    } catch (e) {
      toast.error(formatSupabaseClientError(e));
    }
  }, [supabase, load]);

  /** Enam bulan termasuk bulan yang dipilih — trend ER mengikuti filter header + chip segmen (sama seperti footer tabel). */
  const overviewTableSparkline = useMemo(() => {
    const points: { monthKey: string; targetRevenue: number }[] = [];
    for (let d = -5; d <= 0; d++) {
      const key = addMonthsToMonthKey(selectedMonth, d);
      const { creatorRows: rows } = buildVisibleTableAggregation(
        targets,
        creators,
        projects,
        key,
        filters,
        quickFilter,
        hanindoPercentByCreator,
      );
      points.push({
        monthKey: key,
        targetRevenue: sum(rows.map((r) => r.expectedRevenue)),
      });
    }
    return points;
  }, [
    targets,
    creators,
    projects,
    selectedMonth,
    filters,
    quickFilter,
    hanindoPercentByCreator,
  ]);

  return {
    creators,
    projects,
    brands,
    organizations,
    campaignObjectives,
    tiktokAccounts,
    targets,
    hanindoPercentByCreator,
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
    handleUpdateCreatorTargetMonth,
    handleDeleteCreatorTargets,
    handleSubmitVideoUrls,
    handleReplaceTargetVideoLinks,
    loading,
    overviewTableSparkline,
    prevMonthKey,
    totalRowPreviousMonth,
    creatorRowsPreviousMonth: tableAggregationPreviousMonth.creatorRows,
    getCreatorExpectedRevenueSeries,
    reload: load,
    seedIfEmpty,
  };
}
