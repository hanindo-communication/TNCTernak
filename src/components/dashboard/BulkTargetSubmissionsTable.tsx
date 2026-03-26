"use client";

import { Copy, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type {
  Creator,
  CreatorType,
  Project,
  TargetFormRow,
  TikTokAccount,
} from "@/lib/types";
import { CreatorPicker } from "@/components/dashboard/CreatorPicker";
import type { TableSegmentOption } from "@/components/dashboard/QuickFilterChips";
import {
  BASE_PAY_PRESET_VALUES,
  defaultBasePayPreset,
  formatBasePayLabel,
} from "@/lib/dashboard/base-pay-presets";
import { OptionalNonNegIntInput } from "@/components/dashboard/OptionalNonNegIntInput";
import { cn } from "@/lib/utils";

const cell =
  "border-b border-white/[0.07] px-2 py-2 align-middle text-foreground";
const thBase =
  "whitespace-nowrap border-b border-white/15 bg-white/[0.06] px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted";
/** Native selects: `[color-scheme:dark]` + `.bulk-native-select` align OS dropdown with panel palette. */
const fieldClass =
  "h-9 w-full min-w-[7rem] rounded-md border border-white/10 bg-panel px-2 text-sm text-foreground outline-none transition [color-scheme:dark] focus:border-neon-cyan/55 focus:ring-1 focus:ring-neon-cyan/25";

const inputClass = fieldClass;

const selectClass = cn(fieldClass, "bulk-native-select");

function Req({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <span className="text-red-400" aria-hidden>
        {" "}
        *
      </span>
    </>
  );
}

interface BulkTargetSubmissionsTableProps {
  rows: TargetFormRow[];
  rowCount: number;
  onAddRow: () => void;
  onDuplicateLast: () => void;
  onUpdateRow: (idx: number, next: TargetFormRow) => void;
  onRemoveRow: (idx: number) => void;
  creators: Creator[];
  projects: Project[];
  tiktokAccounts: TikTokAccount[];
  /** Sama dengan chip di dashboard: All Creators + Hanindo PCP + FOLO Public. */
  tableSegments: TableSegmentOption[];
}

export function BulkTargetSubmissionsTable({
  rows,
  rowCount,
  onAddRow,
  onDuplicateLast,
  onUpdateRow,
  onRemoveRow,
  creators,
  projects,
  tiktokAccounts,
  tableSegments,
}: BulkTargetSubmissionsTableProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          Bulk Target Submissions{" "}
          <span className="font-normal text-muted">
            ({rowCount} {rowCount === 1 ? "row" : "rows"})
          </span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-xs font-semibold text-foreground transition hover:border-neon-cyan/40 hover:bg-white/[0.07]"
          >
            <span className="text-lg leading-none">+</span>
            Add Row
          </button>
          <button
            type="button"
            onClick={onDuplicateLast}
            disabled={rows.length === 0}
            title="Duplicate last row"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-muted transition hover:border-neon-cyan/40 hover:text-neon-cyan",
              rows.length === 0 && "cursor-not-allowed opacity-40",
            )}
          >
            <Copy className="h-4 w-4" />
            <span className="sr-only">Duplicate last row</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={thBase}>
                <Req>Creator</Req>
              </th>
              <th className={thBase}>
                <Req>Table</Req>
              </th>
              <th className={thBase}>
                <Req>Campaign</Req>
              </th>
              <th className={thBase}>
                <Req>Creator Type</Req>
              </th>
              <th className={thBase}>
                <Req>TikTok Account</Req>
              </th>
              <th className={thBase}>
                <Req>Month</Req>
              </th>
              <th className={thBase}>
                <Req>Target</Req>
              </th>
              <th className={thBase}>Incentive per Video</th>
              <th className={thBase}>Base Pay</th>
              <th className={thBase} aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <BulkTableRow
                key={idx}
                row={row}
                rowIndex={idx}
                canRemove={rows.length > 1}
                onChange={(next) => onUpdateRow(idx, next)}
                onRemove={() => onRemoveRow(idx)}
                creators={creators}
                projects={projects}
                tiktokAccounts={tiktokAccounts}
                tableSegments={tableSegments}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkTableRow({
  row,
  rowIndex,
  canRemove,
  onChange,
  onRemove,
  creators,
  projects,
  tiktokAccounts,
  tableSegments,
}: {
  row: TargetFormRow;
  rowIndex: number;
  canRemove: boolean;
  onChange: (next: TargetFormRow) => void;
  onRemove: () => void;
  creators: Creator[];
  projects: Project[];
  tiktokAccounts: TikTokAccount[];
  tableSegments: TableSegmentOption[];
}) {
  const accountsForCreator = tiktokAccounts.filter(
    (t) => t.creatorId === row.creatorId,
  );

  const patch = (partial: Partial<TargetFormRow>) => {
    onChange({ ...row, ...partial });
  };

  const onTableChange = (tableSegmentId: string) => {
    onChange({ ...row, tableSegmentId });
  };

  const onProjectChange = (projectId: string) => {
    onChange({ ...row, projectId });
  };

  const onCreatorChange = (creatorId: string) => {
    const c = creators.find((x) => x.id === creatorId);
    const firstTt = tiktokAccounts.find((t) => t.creatorId === creatorId);
    onChange({
      ...row,
      creatorId,
      creatorType: c?.creatorType ?? row.creatorType,
      tiktokAccountId: firstTt?.id ?? "",
      basePay: defaultBasePayPreset(),
    });
  };

  return (
    <tr className="hover:bg-white/[0.02]">
      <td className={cn(cell, "min-w-[200px]")}>
        <CreatorPicker
          creators={creators}
          value={row.creatorId}
          onChange={onCreatorChange}
        />
      </td>
      <td className={cn(cell, "min-w-[150px]")}>
        <select
          className={selectClass}
          value={row.tableSegmentId}
          onChange={(e) => onTableChange(e.target.value)}
          aria-label={`Table row ${rowIndex + 1}`}
        >
          {tableSegments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </td>
      <td className={cn(cell, "min-w-[140px]")}>
        <select
          className={selectClass}
          value={row.projectId}
          onChange={(e) => onProjectChange(e.target.value)}
          aria-label={`Campaign row ${rowIndex + 1}`}
        >
          <option value="">Select campaign</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </td>
      <td className={cn(cell, "min-w-[120px]")}>
        <select
          className={selectClass}
          value={row.creatorType}
          onChange={(e) => {
            const creatorType = e.target.value as CreatorType;
            patch({
              creatorType,
              basePay: defaultBasePayPreset(),
            });
          }}
          aria-label={`Creator type row ${rowIndex + 1}`}
        >
          <option value="Internal">Internal</option>
          <option value="External">External</option>
          <option value="AssetLoan">Asset Loan</option>
        </select>
      </td>
      <td className={cn(cell, "min-w-[160px]")}>
        <select
          className={selectClass}
          value={row.tiktokAccountId}
          onChange={(e) => patch({ tiktokAccountId: e.target.value })}
          disabled={!row.creatorId}
          aria-label={`TikTok account row ${rowIndex + 1}`}
        >
          <option value="">Select TikTok account</option>
          {accountsForCreator.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </td>
      <td className={cn(cell, "min-w-[130px]")}>
        <input
          type="month"
          className={inputClass}
          value={row.month}
          onChange={(e) => patch({ month: e.target.value })}
          aria-label={`Month row ${rowIndex + 1}`}
        />
      </td>
      <td className={cn(cell, "w-24 min-w-[5rem]")}>
        <OptionalNonNegIntInput
          className={inputClass}
          value={row.targetVideos}
          onCommit={(n) => patch({ targetVideos: n })}
          aria-label={`Target videos row ${rowIndex + 1}`}
        />
      </td>
      <td className={cn(cell, "min-w-[110px]")}>
        <OptionalNonNegIntInput
          className={inputClass}
          value={row.incentivePerVideo}
          onCommit={(n) => patch({ incentivePerVideo: n })}
          aria-label={`Incentive per video row ${rowIndex + 1}`}
        />
      </td>
      <td className={cn(cell, "min-w-[9rem]")}>
        <select
          className={selectClass}
          value={row.basePay}
          onChange={(e) => patch({ basePay: Number(e.target.value) })}
          aria-label={`Base pay row ${rowIndex + 1}`}
        >
          {BASE_PAY_PRESET_VALUES.map((v) => (
            <option key={v} value={v}>
              {formatBasePayLabel(v)}
            </option>
          ))}
        </select>
      </td>
      <td className={cn(cell, "w-12")}>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-muted transition hover:border-red-400/50 hover:text-red-300"
            title="Remove row"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </td>
    </tr>
  );
}
