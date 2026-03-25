"use client";

import {
  CalendarRange,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Settings2,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardFilters } from "@/lib/types";
import { labelMonth } from "@/lib/utils";
import { cn } from "@/lib/utils";

const selectClass =
  "h-10 min-w-[140px] cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-foreground outline-none transition focus:border-neon-cyan/60 focus:ring-2 focus:ring-neon-cyan/30 hover:border-neon-cyan/35";

interface DashboardHeaderProps {
  selectedMonth: string;
  onMonthChange: (m: string) => void;
  filters: DashboardFilters;
  onFiltersChange: (f: DashboardFilters) => void;
  creatorOptions: { id: string; name: string }[];
  brandOptions: { id: string; name: string }[];
  onSubmitTargets: () => void;
  onOverview: () => void;
  onDataSettings: () => void;
  userEmail?: string | null;
  onSignOut?: () => void;
}

export function DashboardHeader({
  selectedMonth,
  onMonthChange,
  filters,
  onFiltersChange,
  creatorOptions,
  brandOptions,
  onSubmitTargets,
  onOverview,
  onDataSettings,
  userEmail,
  onSignOut,
}: DashboardHeaderProps) {
  return (
    <header className="relative flex flex-col gap-6 border-b border-white/[0.07] pb-8">
      <div
        className="pointer-events-none absolute -left-24 top-0 h-40 w-40 rounded-full bg-neon-purple/20 blur-3xl glow-orb"
        aria-hidden
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-neon-cyan">
            <Sparkles className="h-3.5 w-3.5" />
            Internal Ops
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Creator Targets &amp; Submissions
          </h1>
          <p className="max-w-xl text-sm text-muted">
            Monitor targets, submissions, incentives, and profit in real time.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 neon-border-hover">
            <CalendarRange className="h-4 w-4 text-neon-cyan" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="bg-transparent text-sm text-foreground outline-none"
            />
            <span className="hidden text-xs text-muted sm:inline">
              {labelMonth(selectedMonth)}
            </span>
          </label>

          <FilterSelect
            icon={<User className="h-4 w-4" />}
            value={filters.creatorId}
            onChange={(creatorId) =>
              onFiltersChange({ ...filters, creatorId })
            }
            options={[{ id: "all", name: "All creators" }, ...creatorOptions]}
          />
          <FilterSelect
            icon={<Target className="h-4 w-4" />}
            value={filters.brandId}
            onChange={(brandId) => onFiltersChange({ ...filters, brandId })}
            options={[{ id: "all", name: "All brands" }, ...brandOptions]}
          />

          <button
            type="button"
            onClick={onOverview}
            className="btn-press inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neon-cyan/35 bg-neon-cyan/10 px-5 text-sm font-semibold text-neon-cyan transition hover:bg-neon-cyan/20 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
          >
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </button>

          <button
            type="button"
            onClick={onDataSettings}
            className="btn-press inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-5 text-sm font-semibold text-foreground transition hover:border-neon-purple/35 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-neon-purple/30"
          >
            <Settings2 className="h-4 w-4" />
            Data settings
          </button>

          <button
            type="button"
            onClick={onSubmitTargets}
            className={cn(
              "btn-press inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-night",
              "bg-gradient-to-r from-neon-cyan via-cyan-300 to-neon-purple",
              "shadow-[0_0_32px_rgba(50,230,255,0.35)]",
              "transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-neon-cyan/60",
            )}
          >
            <Target className="h-4 w-4" />
            Submit Targets
          </button>

          {userEmail ? (
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <span className="max-w-[220px] truncate text-right text-xs text-muted">
                {userEmail}
              </span>
              {onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-xs font-semibold uppercase tracking-wide text-muted transition hover:border-red-400/40 hover:text-red-300"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function FilterSelect({
  icon,
  value,
  onChange,
  options,
}: {
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted">
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(selectClass, "appearance-none pl-9 pr-8")}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}
