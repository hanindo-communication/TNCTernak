"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  HANINDO_SHARING_RATE_ON_TARGET_REVENUE,
  OVERVIEW_FOLO_SEGMENT_SHARE,
  OVERVIEW_TNC_SEGMENT_SHARE,
} from "@/lib/dashboard/financial-rules";
import {
  TABLE_SEGMENT_FOLO_LABEL,
  TABLE_SEGMENT_TNC_LABEL,
} from "@/lib/dashboard/table-segments";
import { formatCurrency, labelMonth } from "@/lib/utils";

export interface OverviewStats {
  targetRevenue: number;
  /** 50% × revenue Hanindo PCP + 54% × revenue FOLO Public (expected per segmen). */
  tncRevenue: number;
  /** 15% × total target revenue (semua segmen meja). */
  hanindoSharingTotal: number;
  tncSegmentRevenue: number;
  foloSegmentRevenue: number;
  /** Segmen kolom Table = All (belum ditempatkan ke meja Hanindo PCP / FOLO Public). */
  allSegmentRevenue: number;
}

interface OverviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthKey: string;
  stats: OverviewStats | null;
}

function useCountUpOnMount(
  target: number,
  reducedMotion: boolean,
  durationMs: number,
) {
  const [v, setV] = useState(() => (reducedMotion ? target : 0));

  useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;
    let start: number | null = null;
    let raf = 0;

    const step = (now: number) => {
      if (cancelled) return;
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setV(target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(() => {
      if (cancelled) return;
      setV(0);
      raf = requestAnimationFrame(step);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [target, reducedMotion, durationMs]);

  return reducedMotion ? target : v;
}

function OverviewFigures({
  stats,
  reducedMotion,
}: {
  stats: OverviewStats;
  reducedMotion: boolean;
}) {
  const tr = stats.targetRevenue;
  const tncRev = stats.tncRevenue;
  const hst = stats.hanindoSharingTotal;
  const tnc = stats.tncSegmentRevenue;
  const folo = stats.foloSegmentRevenue;
  const allSeg = stats.allSegmentRevenue;

  const trA = useCountUpOnMount(tr, reducedMotion, 340);
  const tncRevA = useCountUpOnMount(tncRev, reducedMotion, 380);
  const hstA = useCountUpOnMount(hst, reducedMotion, 400);
  const tncA = useCountUpOnMount(tnc, reducedMotion, 320);
  const foloA = useCountUpOnMount(folo, reducedMotion, 320);
  const allSegA = useCountUpOnMount(allSeg, reducedMotion, 320);

  return (
    <div className="grid gap-4 pt-2">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Target revenue
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
          {formatCurrency(trA)}
        </p>
        <p className="mt-2 text-xs text-muted">
          {TABLE_SEGMENT_TNC_LABEL} {formatCurrency(tncA)} +{" "}
          {TABLE_SEGMENT_FOLO_LABEL} {formatCurrency(foloA)}
          {allSeg > 0 ? ` + All Creators ${formatCurrency(allSegA)}` : ""}.
        </p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          TNC revenue
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-neon-cyan">
          {formatCurrency(tncRevA)}
        </p>
        <p className="mt-2 text-xs text-muted">
          {Math.round(OVERVIEW_TNC_SEGMENT_SHARE * 100)}% dari total revenue{" "}
          {TABLE_SEGMENT_TNC_LABEL} +{" "}
          {Math.round(OVERVIEW_FOLO_SEGMENT_SHARE * 100)}% dari total revenue{" "}
          {TABLE_SEGMENT_FOLO_LABEL} (
          {formatCurrency(OVERVIEW_TNC_SEGMENT_SHARE * tnc)} +{" "}
          {formatCurrency(OVERVIEW_FOLO_SEGMENT_SHARE * folo)}).
        </p>
      </div>
      <div className="rounded-xl border border-neon-purple/25 bg-neon-purple/10 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          Hanindo sharing total
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-neon-purple">
          {formatCurrency(hstA)}
        </p>
        <p className="mt-2 text-xs text-muted">
          {Math.round(HANINDO_SHARING_RATE_ON_TARGET_REVENUE * 100)}% × total
          target revenue semua segmen (
          {formatCurrency(tr)} ×{" "}
          {Math.round(HANINDO_SHARING_RATE_ON_TARGET_REVENUE * 100)}%).
        </p>
      </div>
    </div>
  );
}

const EMPTY_STATS: OverviewStats = {
  targetRevenue: 0,
  tncRevenue: 0,
  hanindoSharingTotal: 0,
  tncSegmentRevenue: 0,
  foloSegmentRevenue: 0,
  allSegmentRevenue: 0,
};

export function OverviewModal({
  open,
  onOpenChange,
  monthKey,
  stats,
}: OverviewModalProps) {
  const reducedMotion = usePrefersReducedMotion();
  const s = stats ?? EMPTY_STATS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-neon-cyan/20">
        <DialogHeader>
          <DialogTitle>Overview</DialogTitle>
          <DialogDescription>
            Ringkasan untuk{" "}
            <span className="font-medium text-foreground">
              {labelMonth(monthKey)}
            </span>
            . Angka memakai{" "}
            <span className="font-medium text-foreground">
              total revenue (expected)
            </span>{" "}
            per segmen meja{" "}
            <span className="font-medium text-foreground">
              {TABLE_SEGMENT_TNC_LABEL}
            </span>{" "}
            dan{" "}
            <span className="font-medium text-foreground">
              {TABLE_SEGMENT_FOLO_LABEL}
            </span>,
            mengikuti filter creator &amp; brand di header (bukan quick filter chip
            di tabel).
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <OverviewFigures
            key={monthKey}
            stats={s}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
