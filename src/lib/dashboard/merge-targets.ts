import type { CreatorTarget, TargetFormRow } from "@/lib/types";
import { buildTargetCompositeKey } from "@/lib/types";

function recomputeFinancials(t: CreatorTarget): CreatorTarget {
  const expectedRevenue = t.targetVideos * t.incentivePerVideo + t.basePay;
  const expectedProfit = expectedRevenue - t.incentives - t.reimbursements;
  return {
    ...t,
    expectedRevenue,
    expectedProfit,
  };
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
    const incentives = existing?.incentives ?? 0;
    const reimbursements = existing?.reimbursements ?? 0;

    let next: CreatorTarget = {
      id,
      creatorId: row.creatorId,
      projectId: row.projectId,
      campaignObjectiveId: defaultCampaignObjectiveId,
      creatorType: row.creatorType,
      tiktokAccountId: row.tiktokAccountId,
      month: row.month,
      targetVideos: row.targetVideos,
      submittedVideos,
      incentivePerVideo: row.incentivePerVideo,
      basePay: row.basePay,
      expectedRevenue: 0,
      actualRevenue,
      incentives,
      reimbursements,
      expectedProfit: 0,
      actualProfit: actualRevenue - incentives - reimbursements,
    };
    next = recomputeFinancials(next);
    next = {
      ...next,
      actualProfit:
        next.actualRevenue - next.incentives - next.reimbursements,
    };
    map.set(key, next);
  }

  return [...map.values()];
}
