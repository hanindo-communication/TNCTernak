import { FOLO_TARGET_EXPECTED_PROFIT_REVENUE_SHARE } from "@/lib/dashboard/financial-rules";
import { filterPlausibleVideoUrls } from "@/lib/dashboard/video-urls";
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

  const urlList = filterPlausibleVideoUrls(
    (t.submittedVideoUrls ?? []).map((s) => String(s).trim()),
  );
  const storedSubmitted = Math.max(0, Math.floor(Number(t.submittedVideos)) || 0);
  const submittedVideos =
    urlList.length > 0
      ? Math.max(urlList.length, storedSubmitted)
      : storedSubmitted;
  const actualRevenue = submittedVideos * bp;
  const actualProfit = actualRevenue - incentives - t.reimbursements;
  return {
    ...t,
    targetVideos: tv,
    basePay: bp,
    incentivePerVideo: ipv,
    submittedVideos,
    submittedVideoUrls: urlList,
    expectedRevenue,
    incentives,
    expectedProfit,
    actualRevenue,
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

/** Tambah hitungan submit tanpa URL (delta saja). */
export function applySubmittedVideosDelta(
  t: CreatorTarget,
  delta: number,
): CreatorTarget {
  const d = Math.max(0, Math.floor(Number(delta)) || 0);
  if (d <= 0) return syncDerivedFinancials(t);
  const prev = Math.max(0, Math.floor(Number(t.submittedVideos)) || 0);
  return syncDerivedFinancials({ ...t, submittedVideos: prev + d });
}

/** Tambah URL video yang disubmit; menyatukan dengan daftar ada (dedupe). */
export function appendSubmittedVideoUrls(
  t: CreatorTarget,
  newUrls: string[],
): CreatorTarget {
  const add = filterPlausibleVideoUrls(
    newUrls.map((s) => String(s).trim()),
  );
  if (add.length === 0) return syncDerivedFinancials(t);

  const existing = filterPlausibleVideoUrls(
    (t.submittedVideoUrls ?? []).map((s) => String(s).trim()),
  );
  const seen = new Set(existing.map((u) => u.toLowerCase()));
  const merged = [...existing];
  for (const u of add) {
    const k = u.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(u);
  }

  const prevCount = Math.max(0, Math.floor(Number(t.submittedVideos)) || 0);
  const delta = merged.length - existing.length;
  const nextSubmitted =
    existing.length === 0 && prevCount > 0
      ? prevCount + delta
      : merged.length;

  return syncDerivedFinancials({
    ...t,
    submittedVideoUrls: merged,
    submittedVideos: nextSubmitted,
  });
}

/** Ganti daftar URL sepenuhnya (dari editor meja). */
export function replaceSubmittedVideoUrls(
  t: CreatorTarget,
  urls: string[],
): CreatorTarget {
  const cleaned = filterPlausibleVideoUrls(
    urls.map((s) => String(s).trim()),
  );
  return syncDerivedFinancials({
    ...t,
    submittedVideoUrls: cleaned,
    submittedVideos: cleaned.length,
  });
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
    const submittedVideoUrls = existing?.submittedVideoUrls ?? [];
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
      submittedVideoUrls,
      incentivePerVideo,
      basePay: row.basePay,
      expectedRevenue: 0,
      actualRevenue: 0,
      incentives: 0,
      reimbursements,
      expectedProfit: 0,
      actualProfit: 0,
    });
    map.set(key, next);
  }

  return [...map.values()];
}
