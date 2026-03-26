import { FOLO_TARGET_EXPECTED_PROFIT_REVENUE_SHARE } from "@/lib/dashboard/financial-rules";
import type { CreatorTarget, TargetFormRow } from "@/lib/types";
import {
  buildTargetCompositeKey,
  normalizeTargetTableSegmentForKey,
} from "@/lib/types";

/**
 * Single source of truth: expected revenue & incentives dari leaf target,
 * bukan kolom tersimpan yang bisa stale (seed lama / upsert parsial).
 *
 * - expected revenue = targetVideos × basePay
 * - incentives (total ke creator) = targetVideos × incentivePerVideo
 * - expected profit: basis revenue = expected revenue; segmen meja FOLO Public memakai
 *   porsi {@link FOLO_TARGET_EXPECTED_PROFIT_REVENUE_SHARE} sebelum kurangi insentif & reimb.
 */
export function syncDerivedFinancials(t: CreatorTarget): CreatorTarget {
  const tv = Math.max(0, Math.floor(Number(t.targetVideos)) || 0);
  const bp = Math.max(0, Number(t.basePay) || 0);
  const ipv = Math.max(0, Math.floor(Number(t.incentivePerVideo)) || 0);
  const expectedRevenue = tv * bp;
  const incentives = tv * ipv;
  const seg = normalizeTargetTableSegmentForKey(t.tableSegmentId);
  const profitRevenueBase =
    seg === "folo"
      ? expectedRevenue * FOLO_TARGET_EXPECTED_PROFIT_REVENUE_SHARE
      : expectedRevenue;
  const expectedProfit = profitRevenueBase - incentives - t.reimbursements;
  const actualProfit = t.actualRevenue - incentives - t.reimbursements;
  return {
    ...t,
    targetVideos: tv,
    basePay: bp,
    incentivePerVideo: ipv,
    expectedRevenue,
    incentives,
    expectedProfit,
    actualProfit,
  };
}

function tableSegmentFromFormRow(row: TargetFormRow): string {
  return normalizeTargetTableSegmentForKey(row.tableSegmentId);
}

/** Payload simpan dari dialog Edit target (satu baris leaf). */
export interface CreatorTargetRowEditPayload {
  targetVideos: number;
  tableSegmentId: string;
  basePay: number;
  incentivePerVideo: number;
}

export type CreatorTargetRowSave = CreatorTargetRowEditPayload & {
  targetId: string;
};

/** Terapkan edit penuh satu baris + sync expected revenue / incentives / profit. */
export function applyTargetRowEdit(
  t: CreatorTarget,
  edit: CreatorTargetRowEditPayload,
): CreatorTarget {
  return syncDerivedFinancials({
    ...t,
    targetVideos: Math.max(0, Math.floor(Number(edit.targetVideos)) || 0),
    tableSegmentId: normalizeTargetTableSegmentForKey(edit.tableSegmentId),
    basePay: Math.max(0, Number(edit.basePay) || 0),
    incentivePerVideo: Math.max(
      0,
      Math.floor(Number(edit.incentivePerVideo)) || 0,
    ),
  });
}

/** Update leaf target video count and recompute expected revenue / profit (actuals unchanged). */
export function applyTargetVideosUpdate(
  t: CreatorTarget,
  targetVideos: number,
): CreatorTarget {
  const v = Math.max(0, Math.floor(Number(targetVideos)) || 0);
  return syncDerivedFinancials({ ...t, targetVideos: v });
}

/** Add completed video count (from URL lines); keeps revenue fields unchanged. */
export function applySubmittedVideosDelta(
  t: CreatorTarget,
  delta: number,
): CreatorTarget {
  const d = Math.max(0, Math.floor(Number(delta)) || 0);
  const submittedVideos = Math.max(0, t.submittedVideos + d);
  return { ...t, submittedVideos };
}

function compositeKeyFromRow(
  row: TargetFormRow,
  campaignObjectiveId: string,
): string {
  return buildTargetCompositeKey({
    creatorId: row.creatorId,
    projectId: row.projectId,
    campaignObjectiveId,
    tiktokAccountId: row.tiktokAccountId,
    month: row.month,
    tableSegmentId: tableSegmentFromFormRow(row),
  });
}

export function mergeTargetForms(
  prev: CreatorTarget[],
  rows: TargetFormRow[],
  defaultCampaignObjectiveId: string,
): CreatorTarget[] {
  const map = new Map<string, CreatorTarget>();
  for (const t of prev) {
    map.set(buildTargetCompositeKey(t), t);
  }

  for (const row of rows) {
    const key = compositeKeyFromRow(row, defaultCampaignObjectiveId);
    const existing = map.get(key);
    const id = existing?.id ?? crypto.randomUUID();
    const submittedVideos = existing?.submittedVideos ?? 0;
    const actualRevenue = existing?.actualRevenue ?? 0;
    const reimbursements = existing?.reimbursements ?? 0;

    const targetVideos = Math.max(0, Math.floor(Number(row.targetVideos)) || 0);
    const incentivePerVideo = Math.max(
      0,
      Math.floor(Number(row.incentivePerVideo)) || 0,
    );

    const next: CreatorTarget = syncDerivedFinancials({
      id,
      creatorId: row.creatorId,
      projectId: row.projectId,
      campaignObjectiveId: defaultCampaignObjectiveId,
      creatorType: row.creatorType,
      tiktokAccountId: row.tiktokAccountId,
      month: row.month,
      tableSegmentId: tableSegmentFromFormRow(row),
      targetVideos,
      submittedVideos,
      incentivePerVideo,
      basePay: row.basePay,
      expectedRevenue: 0,
      actualRevenue,
      incentives: 0,
      reimbursements,
      expectedProfit: 0,
      actualProfit: actualRevenue - reimbursements,
    });
    map.set(key, next);
  }

  return [...map.values()];
}
