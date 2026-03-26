export type CreatorType = "Internal" | "External" | "AssetLoan";

export type TargetStatus = "on_track" | "below" | "exceeded";

/** Dua meja tetap untuk chip filter & kolom Table (bukan nama brand bebas). */
export type TableSegmentId = "tnc" | "folo";

export interface Brand {
  id: string;
  name: string;
  /** Legacy / sinkron DB (`brands.table_segment`); pemisahan meja pakai kolom Table di target, bukan pengaturan per brand. */
  tableSegmentId: TableSegmentId;
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
  /** 0–50: porsi Hanindo dari ER; null/undefined = pakai default app (15%). */
  hanindoSharingPercent?: number | null;
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
  /** Dari kolom Table di Submit Targets: all | tnc | folo. */
  tableSegmentId: string;
  targetVideos: number;
  submittedVideos: number;
  /** URL TikTok per video disimpan; jika kosong, hitungan mengikuti `submittedVideos` saja. */
  submittedVideoUrls: string[];
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
  /** Sama dengan chip di atas: all | tnc | folo. */
  tableSegmentId: string;
  projectId: string;
  creatorType: CreatorType;
  tiktokAccountId: string;
  month: string;
  targetVideos: number;
  incentivePerVideo: number;
  basePay: number;
}

/** Satu baris di modal Submit Videos (bulk). */
export interface VideoSubmitFormRow {
  /** Null jika baris baru — dicocokkan ke target lewat composite key saat submit. */
  targetId: string | null;
  creatorId: string;
  tableSegmentId: string;
  projectId: string;
  campaignObjectiveId: string;
  creatorType: CreatorType;
  tiktokAccountId: string;
  month: string;
  /** URL TikTok, pisahkan baris baru atau koma. */
  videoUrls: string;
}

/** Chip filter: all | tnc | folo. */
export type QuickFilter = string;

export interface DashboardFilters {
  creatorId: string;
  brandId: string;
}

/** Segmen baris target untuk composite key & upsert: all | tnc | folo */
export function normalizeTargetTableSegmentForKey(raw: string): string {
  if (raw === "tnc" || raw === "folo") return raw;
  return "all";
}

/** Composite key termasuk table segment — dua baris beda meja tidak saling timpa. */
export function buildTargetCompositeKey(
  t: Pick<
    CreatorTarget,
    | "creatorId"
    | "projectId"
    | "campaignObjectiveId"
    | "tiktokAccountId"
    | "month"
    | "tableSegmentId"
  >,
): string {
  const seg = normalizeTargetTableSegmentForKey(t.tableSegmentId);
  return [
    t.creatorId,
    t.projectId,
    t.campaignObjectiveId,
    t.tiktokAccountId,
    t.month,
    seg,
  ].join("::");
}
