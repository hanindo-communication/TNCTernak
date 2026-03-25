export type CreatorType = "Internal" | "External" | "AssetLoan";

export type TargetStatus = "on_track" | "below" | "exceeded";

export interface Brand {
  id: string;
  name: string;
}

export interface Organization {
  id: string;
  name: string;
}

export interface Creator {
  id: string;
  name: string;
  avatarUrl: string;
  handleTikTok: string;
  organizationId: string;
  brandIds: string[];
  creatorType: CreatorType;
}

export interface Project {
  id: string;
  name: string;
  brandId: string;
  organizationId: string;
}

export interface CampaignObjective {
  id: string;
  label: string;
}

export interface TikTokAccount {
  id: string;
  creatorId: string;
  label: string;
}

/** Leaf record; upsert key = composite fields + month */
export interface CreatorTarget {
  id: string;
  creatorId: string;
  projectId: string;
  campaignObjectiveId: string;
  creatorType: CreatorType;
  tiktokAccountId: string;
  month: string;
  targetVideos: number;
  submittedVideos: number;
  incentivePerVideo: number;
  basePay: number;
  expectedRevenue: number;
  actualRevenue: number;
  incentives: number;
  reimbursements: number;
  expectedProfit: number;
  actualProfit: number;
}

export interface TargetFormRow {
  creatorId: string;
  projectId: string;
  creatorType: CreatorType;
  tiktokAccountId: string;
  month: string;
  targetVideos: number;
  incentivePerVideo: number;
  basePay: number;
}

export type QuickFilter = "all" | "internal" | "external";

export interface DashboardFilters {
  creatorId: string;
  brandId: string;
}

export function buildTargetCompositeKey(
  t: Pick<
    CreatorTarget,
    | "creatorId"
    | "projectId"
    | "campaignObjectiveId"
    | "tiktokAccountId"
    | "month"
  >,
): string {
  return [
    t.creatorId,
    t.projectId,
    t.campaignObjectiveId,
    t.tiktokAccountId,
    t.month,
  ].join("::");
}
