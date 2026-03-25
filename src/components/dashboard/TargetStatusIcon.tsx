"use client";

import { AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import type { TargetStatus } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const meta: Record<
  TargetStatus,
  { label: string; description: string; Icon: typeof CheckCircle2; className: string }
> = {
  on_track: {
    label: "On track",
    description: "Submissions are within ~10% of the target band.",
    Icon: CheckCircle2,
    className: "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]",
  },
  below: {
    label: "Below target",
    description: "Submissions are under 90% of the set target.",
    Icon: AlertTriangle,
    className: "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]",
  },
  exceeded: {
    label: "Exceeded",
    description: "Submissions surpassed the target for this period.",
    Icon: Zap,
    className: "text-neon-cyan drop-shadow-[0_0_10px_rgba(50,230,255,0.55)]",
  },
};

export function TargetStatusIcon({
  status,
  className,
}: {
  status: TargetStatus;
  className?: string;
}) {
  const m = meta[status];
  const Icon = m.Icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex rounded-lg p-1 transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-neon-cyan/40",
            className,
          )}
          aria-label={m.label}
        >
          <Icon className={cn("h-5 w-5", m.className)} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="font-semibold text-neon-cyan">{m.label}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted">
          {m.description}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
