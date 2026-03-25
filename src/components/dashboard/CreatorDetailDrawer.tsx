"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Image from "next/image";
import type { Creator } from "@/lib/types";
import { performanceHistory } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { CreatorTypeChip } from "@/components/dashboard/CreatorTypeChip";
import type { AggregatedCreatorRow } from "@/hooks/useCreatorDashboard";
import { cn } from "@/lib/utils";

interface CreatorDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: Creator | null;
  aggregate: AggregatedCreatorRow | null;
}

export function CreatorDetailDrawer({
  open,
  onOpenChange,
  creator,
  aggregate,
}: CreatorDetailDrawerProps) {
  if (!creator || !aggregate) return null;

  const series = performanceHistory[creator.id] ?? [
    0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85,
  ];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "sheet-content fixed inset-y-0 right-0 z-[95] flex w-full max-w-md flex-col border-l border-white/10 bg-[#070c18]/95 shadow-2xl backdrop-blur-xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300",
          )}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Creator profile
              </p>
              <p className="text-lg font-semibold text-foreground">
                {creator.name}
              </p>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-2 text-muted transition hover:bg-white/5 hover:text-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/40">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-neon-cyan/30 shadow-[0_0_30px_rgba(50,230,255,0.2)]">
                <Image
                  src={creator.avatarUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="min-w-0 space-y-2">
                <p className="truncate text-sm text-neon-cyan">
                  {creator.handleTikTok}
                </p>
                <CreatorTypeChip type={creator.creatorType} />
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                This month snapshot
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    Target
                  </p>
                  <p className="font-mono text-lg text-foreground">
                    {aggregate.targetVideos}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    Submitted
                  </p>
                  <p className="font-mono text-lg text-foreground">
                    {aggregate.submittedVideos}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    Actual profit
                  </p>
                  <p className="text-xl font-semibold text-neon-cyan">
                    {formatCurrency(aggregate.actualProfit)}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Performance trend (mock)
              </p>
              <Sparkline values={series} />
            </div>

            <div className="glass-panel rounded-2xl p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                History (target vs actual)
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li className="flex justify-between">
                  <span>Last month</span>
                  <span className="font-mono text-foreground/90">92%</span>
                </li>
                <li className="flex justify-between">
                  <span>Quarter avg</span>
                  <span className="font-mono text-foreground/90">88%</span>
                </li>
              </ul>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 320;
  const h = 72;
  const pad = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-6, max - min);
  const pts = values.map((v, i) => {
    const x =
      pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return { x, y };
  });
  const d =
    pts.length === 0
      ? ""
      : pts
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
          .join(" ");

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-24 w-full"
        role="img"
        aria-label="Performance sparkline"
      >
        <defs>
          <linearGradient id="spark" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#32e6ff" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <path
          d={d}
          fill="none"
          stroke="url(#spark)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {values.map((v, i) => {
          const x =
            pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
          const y =
            pad + (1 - (v - min) / span) * (h - pad * 2);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="2.5"
              fill="#32e6ff"
              opacity={0.85}
            />
          );
        })}
      </svg>
    </div>
  );
}
