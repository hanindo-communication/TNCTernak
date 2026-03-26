"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TABLE_CHIP_OPTIONS,
  TABLE_SEGMENT_ALL_ID,
  TABLE_SEGMENT_FOLO_LABEL,
  TABLE_SEGMENT_TNC_LABEL,
} from "@/lib/dashboard/table-segments";
import type { User } from "@supabase/supabase-js";
import { CreatorDetailDrawer } from "@/components/dashboard/CreatorDetailDrawer";
import { DashboardAtmosphere } from "@/components/dashboard/DashboardAtmosphere";
import { DashboardCommandMenu } from "@/components/dashboard/DashboardCommandMenu";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DataSettingsModal } from "@/components/dashboard/DataSettingsModal";
import { OverviewModal } from "@/components/dashboard/OverviewModal";
import { PerformanceTable } from "@/components/dashboard/PerformanceTable";
import { QuickFilterChips } from "@/components/dashboard/QuickFilterChips";
import { SubmitTargetsModal } from "@/components/dashboard/SubmitTargetsModal";
import { SubmitVideosModal } from "@/components/dashboard/SubmitVideosModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCreatorDashboard } from "@/hooks/useCreatorDashboard";
import { useFormSettings } from "@/hooks/useFormSettings";
import {
  persistCreatorHanindoSharingPercent,
  syncStoredFormEntitiesToSupabase,
} from "@/lib/dashboard/supabase-data";
import {
  mergeBrands,
  mergeCreators,
  mergeProjects,
  mergeTikTokAccounts,
} from "@/lib/dashboard/merge-entities";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function CreatorDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const sessionResolvedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    sessionResolvedRef.current = false;

    const fallbackMs = 25_000;
    const fallbackId = window.setTimeout(() => {
      if (!cancelled && !sessionResolvedRef.current) {
        sessionResolvedRef.current = true;
        setUser(null);
        setAuthReady(true);
      }
    }, fallbackMs);

    const finish = (u: User | null) => {
      if (cancelled) return;
      window.clearTimeout(fallbackId);
      sessionResolvedRef.current = true;
      setUser(u);
      setAuthReady(true);
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => finish(session?.user ?? null))
      .catch(() => finish(null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      window.clearTimeout(fallbackId);
      finish(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackId);
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  if (!authReady) {
    return (
      <div className="relative min-h-screen overflow-x-hidden">
        <div className="app-bg-grid" aria-hidden />
        <div className="app-bg-noise" aria-hidden />
        <div
          className="pointer-events-none fixed inset-0 animate-gradient-bg opacity-70"
          aria-hidden
        />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
          <div className="glass-panel w-full max-w-md space-y-4 rounded-2xl p-8">
            <div className="h-5 w-44 rounded-lg skeleton-shimmer" />
            <div className="h-3 w-full rounded skeleton-shimmer" />
            <div className="h-3 w-4/5 max-w-sm rounded skeleton-shimmer" />
            <p className="pt-2 text-center text-xs text-muted">
              Memuat sesi…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <CreatorDashboardInner userEmail={user.email} onSignOut={signOut} />
  );
}

function CreatorDashboardInner({
  userEmail,
  onSignOut,
}: {
  userEmail: string | undefined;
  onSignOut: () => void;
}) {
  const {
    creators,
    projects,
    brands,
    tiktokAccounts,
    organizations,
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
    hasRows,
    handleSubmitTargets,
    handleUpdateTargetRows,
    handleDeleteCreatorTargets,
    handleSubmitVideoUrls,
    handleReplaceTargetVideoLinks,
    targets,
    campaignObjectives,
    loading,
    overviewStats,
    seedIfEmpty,
    reload,
  } = useCreatorDashboard();

  const { stored: formSettingsStored, persist: persistFormSettings } =
    useFormSettings();
  const supabaseForm = useMemo(() => createClient(), []);

  const mergedBrands = useMemo(
    () => mergeBrands(brands, formSettingsStored.brands),
    [brands, formSettingsStored.brands],
  );
  const mergedProjects = useMemo(
    () => mergeProjects(projects, formSettingsStored.projects),
    [projects, formSettingsStored.projects],
  );
  const mergedCreators = useMemo(
    () => mergeCreators(creators, formSettingsStored.creators),
    [creators, formSettingsStored.creators],
  );
  const mergedTiktok = useMemo(
    () => mergeTikTokAccounts(tiktokAccounts, formSettingsStored.tiktokAccounts),
    [tiktokAccounts, formSettingsStored.tiktokAccounts],
  );

  const persistHanindoPercent = useCallback(
    async (creatorId: string, percent: number) => {
      try {
        await persistCreatorHanindoSharingPercent(
          supabaseForm,
          creatorId,
          percent,
        );
        await reload();
      } catch (e) {
        toast.error("Gagal menyimpan % Hanindo", {
          description:
            e instanceof Error ? e.message : "Periksa koneksi dan coba lagi.",
        });
        throw e;
      }
    },
    [supabaseForm, reload],
  );

  useEffect(() => {
    const ok = TABLE_CHIP_OPTIONS.some((s) => s.id === quickFilter);
    if (!ok) setQuickFilter(TABLE_SEGMENT_ALL_ID);
  }, [quickFilter, setQuickFilter]);

  /** Banner demo hanya jika tidak ada creator/project/TikTok sama sekali (workspace + Data settings). */
  const showSeedBanner =
    !loading &&
    mergedCreators.length === 0 &&
    mergedProjects.length === 0 &&
    mergedTiktok.length === 0;

  const [targetsModalOpen, setTargetsModalOpen] = useState(false);
  const [dataSettingsOpen, setDataSettingsOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCreatorId, setDrawerCreatorId] = useState<string | null>(null);
  const [videoSubmitTargetIds, setVideoSubmitTargetIds] = useState<
    Set<string>
  >(() => new Set());
  const [videosModalOpen, setVideosModalOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    creatorId: string;
    creatorName: string;
    targetCount: number;
    targetIds: string[];
  } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleVideoSubmitTarget = useCallback(
    (targetId: string, selected: boolean) => {
      setVideoSubmitTargetIds((prev) => {
        const next = new Set(prev);
        if (selected) next.add(targetId);
        else next.delete(targetId);
        return next;
      });
    },
    [],
  );

  const toggleAllVideoSubmitTargets = useCallback(
    (targetIds: string[], selected: boolean) => {
      setVideoSubmitTargetIds((prev) => {
        const next = new Set(prev);
        for (const id of targetIds) {
          if (selected) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [],
  );

  const openSubmitVideosForCreator = useCallback(
    (creatorId: string) => {
      const ids = breakdownByCreator(creatorId).map((b) => b.targetId);
      setVideoSubmitTargetIds(new Set(ids));
      setVideosModalOpen(true);
    },
    [breakdownByCreator],
  );

  const requestDeleteCreatorTargets = useCallback(
    (creatorId: string) => {
      const ids = breakdownByCreator(creatorId).map((b) => b.targetId);
      if (ids.length === 0) return;
      const c = mergedCreators.find((x) => x.id === creatorId);
      setDeleteConfirm({
        creatorId,
        creatorName: c?.name ?? "Creator",
        targetCount: ids.length,
        targetIds: ids,
      });
    },
    [breakdownByCreator, mergedCreators],
  );

  const runConfirmedDeleteCreatorTargets = useCallback(async () => {
    if (!deleteConfirm) return;
    const { creatorId, targetIds } = deleteConfirm;
    setDeleteConfirm(null);
    await handleDeleteCreatorTargets(creatorId);
    setVideoSubmitTargetIds((prev) => {
      const next = new Set(prev);
      for (const id of targetIds) next.delete(id);
      return next;
    });
  }, [deleteConfirm, handleDeleteCreatorTargets]);

  const submitVideosAndClear = useCallback(
    async (deltas: { targetId: string; urls: string[] }[]) => {
      await handleSubmitVideoUrls(deltas);
      setVideoSubmitTargetIds(new Set());
    },
    [handleSubmitVideoUrls],
  );

  const selectedVideoTargetIdsList = useMemo(
    () => [...videoSubmitTargetIds],
    [videoSubmitTargetIds],
  );

  const drawerCreator = useMemo(
    () => mergedCreators.find((c) => c.id === drawerCreatorId) ?? null,
    [mergedCreators, drawerCreatorId],
  );

  const drawerAggregate = useMemo(
    () => creatorRows.find((r) => r.creatorId === drawerCreatorId) ?? null,
    [creatorRows, drawerCreatorId],
  );

  const openCreator = (creatorId: string) => {
    setDrawerCreatorId(creatorId);
    setDrawerOpen(true);
  };

  const showMainSkeleton = loading && creators.length === 0;

  return (
    <TooltipProvider delayDuration={120}>
      <DashboardAtmosphere>
        <div className="relative z-10 mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-10 sm:px-6 lg:px-10">
          {showMainSkeleton ? (
            <DashboardSkeleton />
          ) : (
            <>
              <div className="dash-reveal-item">
                <DashboardHeader
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  filters={filters}
                  onFiltersChange={setFilters}
                  creatorOptions={mergedCreators.map((c) => ({
                    id: c.id,
                    name: c.name,
                  }))}
                  brandOptions={mergedBrands.map((b) => ({
                    id: b.id,
                    name: b.name,
                  }))}
                  onSubmitTargets={() => setTargetsModalOpen(true)}
                  showSubmitVideos={videoSubmitTargetIds.size > 0}
                  onSubmitVideos={() => setVideosModalOpen(true)}
                  onOverview={() => setOverviewOpen(true)}
                  onDataSettings={() => setDataSettingsOpen(true)}
                  userEmail={userEmail}
                  onSignOut={onSignOut}
                />
              </div>

              {showSeedBanner ? (
                <div className="dash-reveal-item dash-reveal-delay-1 flex flex-col gap-3 rounded-2xl border border-neon-purple/30 bg-neon-purple/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-foreground/90">
                    Belum ada data creator / target di workspace bersama. Muat
                    contoh sekali — semua user login akan melihat & mengedit data
                    yang sama (tersinkron di Supabase).
                  </p>
                  <button
                    type="button"
                    onClick={() => void seedIfEmpty()}
                    className="btn-press shrink-0 rounded-xl border border-neon-cyan/40 bg-neon-cyan/15 px-4 py-2 text-sm font-semibold text-neon-cyan transition hover:bg-neon-cyan/25"
                  >
                    Muat data demo
                  </button>
                </div>
              ) : null}

              <div className="dash-reveal-item dash-reveal-delay-2 space-y-2">
                <QuickFilterChips
                  segments={TABLE_CHIP_OPTIONS}
                  value={quickFilter}
                  onChange={setQuickFilter}
                />
                <p className="max-w-3xl text-xs leading-relaxed text-muted">
                  <span className="font-medium text-foreground/80">
                    All Creators
                  </span>{" "}
                  memuat gabungan target meja{" "}
                  <span className="text-foreground/85">
                    {TABLE_SEGMENT_TNC_LABEL}
                  </span>{" "}
                  dan{" "}
                  <span className="text-foreground/85">
                    {TABLE_SEGMENT_FOLO_LABEL}
                  </span>
                  {unassignedTableSegmentTargetCount > 0 ? (
                    <>
                      , plus{" "}
                      <span className="text-foreground/85">
                        {unassignedTableSegmentTargetCount} baris
                      </span>{" "}
                      bersegmen All (kolom Table belum ke salah satu meja).
                    </>
                  ) : null}
                  . Pindahkan per baris lewat{" "}
                  <span className="font-medium text-foreground/80">Edit</span> →
                  Table.
                </p>
              </div>

              <div className="dash-reveal-item dash-reveal-delay-3">
                <PerformanceTable
                  creators={mergedCreators}
                  creatorRows={creatorRows}
                  breakdownByCreator={breakdownByCreator}
                  totalRow={totalRow}
                  hasRows={hasRows}
                  onCreatorClick={openCreator}
                  onUpdateTargetRows={handleUpdateTargetRows}
                  tableSegments={TABLE_CHIP_OPTIONS}
                  videoSubmitSelectedIds={videoSubmitTargetIds}
                  onToggleVideoSubmitTarget={toggleVideoSubmitTarget}
                  onToggleAllVideoSubmitTargets={
                    toggleAllVideoSubmitTargets
                  }
                  onOpenSubmitVideosForCreator={openSubmitVideosForCreator}
                  onDeleteCreatorTargets={requestDeleteCreatorTargets}
                  onPersistHanindoPercent={persistHanindoPercent}
                  onReplaceTargetVideoLinks={handleReplaceTargetVideoLinks}
                />
              </div>
            </>
          )}

          <OverviewModal
            open={overviewOpen}
            onOpenChange={setOverviewOpen}
            monthKey={selectedMonth}
            stats={overviewStats}
          />

          <SubmitTargetsModal
            open={targetsModalOpen}
            onOpenChange={setTargetsModalOpen}
            selectedMonth={selectedMonth}
            creators={creators}
            projects={projects}
            tiktokAccounts={tiktokAccounts}
            tableSegments={TABLE_CHIP_OPTIONS}
            onSubmitTargets={handleSubmitTargets}
          />

          <SubmitVideosModal
            open={videosModalOpen}
            onOpenChange={setVideosModalOpen}
            selectedTargetIds={selectedVideoTargetIdsList}
            selectedMonth={selectedMonth}
            targets={targets}
            creators={creators}
            brands={brands}
            projects={projects}
            campaignObjectives={campaignObjectives}
            tiktokAccounts={tiktokAccounts}
            tableSegments={TABLE_CHIP_OPTIONS}
            onSubmitVideos={submitVideosAndClear}
          />

          <Dialog
            open={deleteConfirm !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteConfirm(null);
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Hapus target creator?</DialogTitle>
                <DialogDescription>
                  Anda akan menghapus{" "}
                  <strong className="font-semibold text-foreground/90">
                    {deleteConfirm?.targetCount ?? 0} baris target
                  </strong>{" "}
                  untuk{" "}
                  <strong className="font-semibold text-foreground/90">
                    {deleteConfirm?.creatorName}
                  </strong>{" "}
                  (bulan dan filter dashboard saat ini). Data di Supabase ikut
                  terhapus dan tidak bisa dikembalikan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="border-t border-white/10 pt-4 sm:justify-end sm:gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="h-10 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-foreground transition hover:bg-white/[0.06]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => void runConfirmedDeleteCreatorTargets()}
                  className="btn-press h-10 rounded-xl border border-red-400/35 bg-red-500/15 px-5 text-sm font-semibold text-red-200 transition hover:border-red-400/55 hover:bg-red-500/25"
                >
                  Hapus permanen
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DataSettingsModal
            open={dataSettingsOpen}
            onOpenChange={setDataSettingsOpen}
            stored={formSettingsStored}
            onPersist={persistFormSettings}
            organizations={organizations}
            workspaceBrands={brands}
            workspaceProjects={projects}
            workspaceCreators={creators}
            workspaceTiktok={tiktokAccounts}
            onSyncToSupabase={(next) =>
              syncStoredFormEntitiesToSupabase(supabaseForm, next)
            }
            onReload={reload}
          />

          {drawerCreator && drawerAggregate ? (
            <CreatorDetailDrawer
              open={drawerOpen}
              onOpenChange={(o) => {
                setDrawerOpen(o);
                if (!o) setDrawerCreatorId(null);
              }}
              creator={drawerCreator}
              aggregate={drawerAggregate}
            />
          ) : null}

          <DashboardCommandMenu
            open={commandOpen}
            onOpenChange={setCommandOpen}
            onOverview={() => setOverviewOpen(true)}
            onDataSettings={() => setDataSettingsOpen(true)}
            onSubmitTargets={() => setTargetsModalOpen(true)}
            showSubmitVideos={videoSubmitTargetIds.size > 0}
            onSubmitVideos={() => setVideosModalOpen(true)}
            creatorFilterId={filters.creatorId}
            onCreatorFilterChange={(creatorId) =>
              setFilters({ ...filters, creatorId })
            }
            creatorOptions={mergedCreators.map((c) => ({
              id: c.id,
              name: c.name,
            }))}
          />
        </div>
      </DashboardAtmosphere>
    </TooltipProvider>
  );
}
