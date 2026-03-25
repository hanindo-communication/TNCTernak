"use client";

import { Trash2 } from "lucide-react";
import type {
  Creator,
  CreatorType,
  Project,
  TargetFormRow,
  TikTokAccount,
} from "@/lib/types";
import { CreatorPicker } from "@/components/dashboard/CreatorPicker";

const inputClass =
  "h-10 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-foreground outline-none transition focus:border-neon-cyan/55 focus:ring-2 focus:ring-neon-cyan/20";

interface TargetRowEditorProps {
  row: TargetFormRow;
  rowIndex: number;
  onChange: (next: TargetFormRow) => void;
  onRemove?: () => void;
  creators: Creator[];
  projects: Project[];
  tiktokAccounts: TikTokAccount[];
  defaultBasePay: (type: CreatorType) => number;
}

export function TargetRowEditor({
  row,
  rowIndex,
  onChange,
  onRemove,
  creators,
  projects,
  tiktokAccounts,
  defaultBasePay,
}: TargetRowEditorProps) {
  const accountsForCreator = tiktokAccounts.filter(
    (t) => t.creatorId === row.creatorId,
  );

  const patch = (partial: Partial<TargetFormRow>) => {
    onChange({ ...row, ...partial });
  };

  const onCreatorChange = (creatorId: string) => {
    const c = creators.find((x) => x.id === creatorId);
    const firstTt = tiktokAccounts.find((t) => t.creatorId === creatorId);
    patch({
      creatorId,
      creatorType: c?.creatorType ?? row.creatorType,
      tiktokAccountId: firstTt?.id ?? "",
      basePay: c ? defaultBasePay(c.creatorType) : row.basePay,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 md:grid-cols-12 md:items-end">
      <div className="md:col-span-2">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
          Creator
        </label>
        <CreatorPicker
          creators={creators}
          value={row.creatorId}
          onChange={onCreatorChange}
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
          Project
        </label>
        <select
          className={inputClass}
          value={row.projectId}
          onChange={(e) => patch({ projectId: e.target.value })}
        >
          <option value="">Select…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
          Creator type
        </label>
        <select
          className={inputClass}
          value={row.creatorType}
          onChange={(e) => {
            const creatorType = e.target.value as CreatorType;
            patch({
              creatorType,
              basePay: defaultBasePay(creatorType),
            });
          }}
        >
          <option value="Internal">Internal</option>
          <option value="External">External</option>
          <option value="AssetLoan">Asset Loan</option>
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
          TikTok account
        </label>
        <select
          className={inputClass}
          value={row.tiktokAccountId}
          onChange={(e) => patch({ tiktokAccountId: e.target.value })}
          disabled={!row.creatorId}
        >
          <option value="">Select…</option>
          {accountsForCreator.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-1">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
          Month
        </label>
        <input
          type="month"
          className={inputClass}
          value={row.month}
          onChange={(e) => patch({ month: e.target.value })}
        />
      </div>

      <div className="md:col-span-1">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
          Target
        </label>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={row.targetVideos}
          onChange={(e) =>
            patch({ targetVideos: Number(e.target.value) || 0 })
          }
        />
      </div>

      <div className="md:col-span-1">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
          Incentive / vid
        </label>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={row.incentivePerVideo}
          onChange={(e) =>
            patch({ incentivePerVideo: Number(e.target.value) || 0 })
          }
        />
      </div>

      <div className="md:col-span-1">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
          Base pay
        </label>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={row.basePay}
          onChange={(e) => patch({ basePay: Number(e.target.value) || 0 })}
        />
      </div>

      <div className="md:col-span-12 flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted">
          Row <span className="font-mono text-foreground/80">{rowIndex + 1}</span>
        </p>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted transition hover:border-red-400/40 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
