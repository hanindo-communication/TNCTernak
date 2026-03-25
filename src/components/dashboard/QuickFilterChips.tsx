"use client";

import { cn } from "@/lib/utils";

export interface TableSegmentOption {
  id: string;
  label: string;
}

interface QuickFilterChipsProps {
  segments: TableSegmentOption[];
  value: string;
  onChange: (v: string) => void;
}

export function QuickFilterChips({
  segments,
  value,
  onChange,
}: QuickFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {segments.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition",
              active
                ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan shadow-[0_0_20px_rgba(50,230,255,0.2)]"
                : "border-white/10 bg-white/[0.03] text-muted hover:border-neon-purple/40 hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
