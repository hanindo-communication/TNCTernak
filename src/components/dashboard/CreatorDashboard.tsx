"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TABLE_CHIP_OPTIONS,
  TABLE_SEGMENT_ALL_ID,
} from "@/lib/dashboard/table-segments";
import type { User } from "@supabase/supabase-js";
import { CreatorDetailDrawer } from "@/components/dashboard/CreatorDetailDrawer";
import { DataSettingsModal } from "@/components/dashboard/DataSettingsModal";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { OverviewModal } from "@/components/dashboard/OverviewModal";
import { PerformanceTable } from "@/components/dashboard/PerformanceTable";
import { QuickFilterChips } from "@/components/dashboard/QuickFilterChips";
import { SubmitTargetsModal } from "@/components/dashboard/SubmitTargetsModal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCreatorDashboard } from "@/hooks/useCreatorDashboard";
import { useFormSettings } from "@/hooks/useFormSettings";
import { syncStoredFormEntitiesToSupabase } from "@/lib/dashboard/supabase-data";
import {
  mergeBrands,
  mergeCreators,
  mergeProjects,
  mergeTikTokAccounts,
} from "@/lib/dashboard/merge-entities";
import { createClient } from "@/lib/supabase/client";

export function CreatorDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setAuthReady(true);
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [supabase, router]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Memuat sesi…
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
    creatorRows,
    breakdownByCreator,
    totalRow,
    hasRows,
    handleSubmitTargets,
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

  if (loading && creators.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Memuat data dashboard…
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <div className="relative min-h-screen overflow-x-hidden">
        <div
          className="pointer-events-none fixed inset-0 animate-gradient-bg opacity-70"
          aria-hidden
        />
        <div
          className="pointer-events-none fixed -left-40 top-24 h-72 w-72 rounded-full bg-neon-purple/25 blur-3xl glow-orb"
          aria-hidden
        />
        <div
          className="pointer-events-none fixed -right-32 bottom-0 h-80 w-80 rounded-full bg-neon-cyan/20 blur-3xl glow-orb"
          aria-hidden
          style={{ animationDelay: "1.2s" }}
        />

        <div className="relative mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-10 sm:px-6 lg:px-10">
          <DashboardHeader
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            filters={filters}
            onFiltersChange={setFilters}
            creatorOptions={mergedCreators.map((c) => ({
              id: c.id,
              name: c.name,
            }))}
            brandOptions={mergedBrands.map((b) => ({ id: b.id, name: b.name }))}
            onSubmitTargets={() => setTargetsModalOpen(true)}
            onOverview={() => setOverviewOpen(true)}
            onDataSettings={() => setDataSettingsOpen(true)}
            userEmail={userEmail}
            onSignOut={onSignOut}
          />

          {showSeedBanner ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-neon-purple/30 bg-neon-purple/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground/90">
                Belum ada data creator / target di workspace bersama. Muat contoh
                sekali — semua user login akan melihat & mengedit data yang sama
                (tersinkron di Supabase).
              </p>
              <button
                type="button"
                onClick={() => void seedIfEmpty()}
                className="shrink-0 rounded-xl border border-neon-cyan/40 bg-neon-cyan/15 px-4 py-2 text-sm font-semibold text-neon-cyan transition hover:bg-neon-cyan/25"
              >
                Muat data demo
              </button>
            </div>
          ) : null}

          <QuickFilterChips
            segments={TABLE_CHIP_OPTIONS}
            value={quickFilter}
            onChange={setQuickFilter}
          />

          <PerformanceTable
            creators={mergedCreators}
            creatorRows={creatorRows}
            breakdownByCreator={breakdownByCreator}
            totalRow={totalRow}
            hasRows={hasRows}
            onCreatorClick={openCreator}
            onAdjustTarget={() => setTargetsModalOpen(true)}
          />

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
            creators={mergedCreators}
            brands={mergedBrands}
            projects={mergedProjects}
            tiktokAccounts={mergedTiktok}
            tableSegments={TABLE_CHIP_OPTIONS}
            onSubmitTargets={handleSubmitTargets}
          />

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
        </div>
      </div>
    </TooltipProvider>
  );
}
