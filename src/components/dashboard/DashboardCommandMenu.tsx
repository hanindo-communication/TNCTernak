"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "cmdk";
import {
  LayoutDashboard,
  LineChart,
  Settings2,
  Target,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface DashboardCommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOverview: () => void;
  onWeeklyProgress: () => void;
  onPayout: () => void;
  onDataSettings: () => void;
  onSubmitTargets: () => void;
  showSubmitVideos: boolean;
  onSubmitVideos?: () => void;
  creatorFilterId: string;
  onCreatorFilterChange: (creatorId: string) => void;
  creatorOptions: { id: string; name: string }[];
}

export function DashboardCommandMenu({
  open,
  onOpenChange,
  onOverview,
  onWeeklyProgress,
  onPayout,
  onDataSettings,
  onSubmitTargets,
  showSubmitVideos,
  onSubmitVideos,
  creatorFilterId,
  onCreatorFilterChange,
  creatorOptions,
}: DashboardCommandMenuProps) {
  const run = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg gap-0 overflow-hidden border-neon-cyan/25 p-0 sm:rounded-2xl"
        showClose
      >
        <DialogTitle className="sr-only">Palet perintah</DialogTitle>
        <DialogDescription className="sr-only">
          Cari aksi atau filter creator. Tutup dengan Escape.
        </DialogDescription>
        <Command
          className="rounded-none border-0 bg-panel/60 text-foreground"
          label="Palet perintah dashboard"
        >
          <CommandInput
            placeholder="Ketik aksi atau nama creator…"
            className="h-12 border-b border-white/10 bg-white/[0.03] px-4 text-sm outline-none"
          />
          <CommandList className="max-h-[min(60vh,420px)] p-2">
            <CommandEmpty className="py-6 text-center text-sm text-muted">
              Tidak ada hasil.
            </CommandEmpty>
            <CommandGroup heading="Aksi">
              <CommandItem
                value="overview ringkasan"
                onSelect={() => run(onOverview)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 aria-selected:bg-neon-cyan/15"
              >
                <LayoutDashboard className="h-4 w-4 text-neon-cyan" />
                Overview
              </CommandItem>
              <CommandItem
                value="weekly progress mingguan target video"
                onSelect={() => run(onWeeklyProgress)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 aria-selected:bg-neon-cyan/15"
              >
                <LineChart className="h-4 w-4 text-violet-300/95" />
                Weekly Progress
              </CommandItem>
              <CommandItem
                value="payout pembayaran bukti"
                onSelect={() => run(onPayout)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 aria-selected:bg-neon-cyan/15"
              >
                <Wallet className="h-4 w-4 text-amber-300/95" />
                Payout
              </CommandItem>
              <CommandItem
                value="data settings pengaturan"
                onSelect={() => run(onDataSettings)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 aria-selected:bg-neon-cyan/15"
              >
                <Settings2 className="h-4 w-4 text-muted" />
                Data settings
              </CommandItem>
              <CommandItem
                value="submit targets target"
                onSelect={() => run(onSubmitTargets)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 aria-selected:bg-neon-cyan/15"
              >
                <Target className="h-4 w-4 text-neon-purple" />
                Submit Targets
              </CommandItem>
              {showSubmitVideos && onSubmitVideos ? (
                <CommandItem
                  value="submit videos video"
                  onSelect={() => run(onSubmitVideos)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 aria-selected:bg-neon-cyan/15"
                >
                  <Upload className="h-4 w-4 text-neon-cyan" />
                  Submit Videos
                </CommandItem>
              ) : null}
            </CommandGroup>
            <CommandSeparator className="my-2 h-px bg-white/10" />
            <CommandGroup heading="Filter creator">
              <CommandItem
                value="all creators semua"
                onSelect={() => run(() => onCreatorFilterChange("all"))}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 aria-selected:bg-neon-cyan/15",
                  creatorFilterId === "all" && "bg-neon-cyan/10",
                )}
              >
                <Users className="h-4 w-4 text-muted" />
                Semua creator
              </CommandItem>
              {creatorOptions.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} creator filter`}
                  onSelect={() => run(() => onCreatorFilterChange(c.id))}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 aria-selected:bg-neon-cyan/15",
                    creatorFilterId === c.id && "bg-neon-cyan/10",
                  )}
                >
                  <span className="truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t border-white/10 px-3 py-2 text-[10px] text-muted">
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono">
              Ctrl
            </kbd>
            <span className="mx-1">+</span>
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono">
              K
            </kbd>
            <span className="ml-2">buka palet</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
