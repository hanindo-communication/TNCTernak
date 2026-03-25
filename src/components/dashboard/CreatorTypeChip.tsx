"use client";

import type { CreatorType } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles: Record<
  CreatorType,
  { label: string; className: string }
> = {
  Internal: {
    label: "Internal",
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.2)]",
  },
  External: {
    label: "External",
    className:
      "border-amber-400/40 bg-amber-400/10 text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.15)]",
  },
  AssetLoan: {
    label: "Asset Loan",
    className:
      "border-sky-400/40 bg-sky-500/10 text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.18)]",
  },
};

export function CreatorTypeChip({ type }: { type: CreatorType }) {
  const s = styles[type];
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        s.className,
      )}
    >
      {s.label}
    </span>
  );
}
