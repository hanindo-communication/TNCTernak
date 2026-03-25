"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, labelMonth } from "@/lib/utils";

export interface OverviewStats {
  targetRevenue: number;
  actualRevenue: number;
  /** Persentase pencapaian actual vs target revenue (null jika target 0) */
  percentageShare: number | null;
}

interface OverviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthKey: string;
  stats: OverviewStats | null;
}

export function OverviewModal({
  open,
  onOpenChange,
  monthKey,
  stats,
}: OverviewModalProps) {
  const tr = stats?.targetRevenue ?? 0;
  const ar = stats?.actualRevenue ?? 0;
  const pct = stats?.percentageShare;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-neon-cyan/20">
        <DialogHeader>
          <DialogTitle>Overview</DialogTitle>
          <DialogDescription>
            Ringkasan revenue untuk periode{" "}
            <span className="font-medium text-foreground">{labelMonth(monthKey)}</span>{" "}
            (sesuai filter & quick filter aktif di tabel).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 pt-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Target revenue
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {formatCurrency(tr)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Actual revenue
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-neon-cyan">
              {formatCurrency(ar)}
            </p>
          </div>
          <div className="rounded-xl border border-neon-purple/25 bg-neon-purple/10 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Percentage sharing total
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-neon-purple">
              {pct == null ? "—" : `${pct.toFixed(1)}%`}
            </p>
            <p className="mt-2 text-xs text-muted">
              {pct == null
                ? "Target revenue nol — tidak bisa menghitung persentase."
                : "Actual revenue dibagi target revenue × 100%."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
