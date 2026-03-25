import type {
  Brand,
  CampaignObjective,
  Creator,
  CreatorTarget,
  Organization,
  Project,
  TikTokAccount,
} from "./types";

export const organizations: Organization[] = [
  { id: "org-1", name: "Nova Media Group" },
  { id: "org-2", name: "Pulse Creative Lab" },
];

export const brands: Brand[] = [
  { id: "brand-1", name: "USP Branding" },
  { id: "brand-2", name: "Cashflow Farm" },
  { id: "brand-3", name: "Public Goods Co." },
];

export const creators: Creator[] = [
  {
    id: "cr-1",
    name: "Aira Lin",
    avatarUrl:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Aira&backgroundColor=0f172a",
    handleTikTok: "@aira.creates",
    organizationId: "org-1",
    brandIds: ["brand-1", "brand-3"],
    creatorType: "Internal",
  },
  {
    id: "cr-2",
    name: "Mika Reyes",
    avatarUrl:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Mika&backgroundColor=0f172a",
    handleTikTok: "@mika.reyes",
    organizationId: "org-1",
    brandIds: ["brand-2"],
    creatorType: "External",
  },
  {
    id: "cr-3",
    name: "Jordan Vale",
    avatarUrl:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan&backgroundColor=0f172a",
    handleTikTok: "@jordanvale",
    organizationId: "org-2",
    brandIds: ["brand-1", "brand-2"],
    creatorType: "AssetLoan",
  },
];

export const projects: Project[] = [
  {
    id: "pr-1",
    name: "Public Campaign",
    brandId: "brand-3",
    organizationId: "org-1",
  },
  {
    id: "pr-2",
    name: "Cashflow Farm",
    brandId: "brand-2",
    organizationId: "org-1",
  },
  {
    id: "pr-3",
    name: "USP Branding",
    brandId: "brand-1",
    organizationId: "org-2",
  },
];

export const campaignObjectives: CampaignObjective[] = [
  { id: "camp-1", label: "Awareness" },
  { id: "camp-2", label: "Conversion" },
  { id: "camp-3", label: "Evergreen" },
];

export const tiktokAccounts: TikTokAccount[] = [
  { id: "tt-1", creatorId: "cr-1", label: "@aira.creates (main)" },
  { id: "tt-2", creatorId: "cr-2", label: "@mika.reyes (shop)" },
  { id: "tt-3", creatorId: "cr-3", label: "@jordanvale (alt)" },
];

/** Default base pay by creator type — swap with rate-card API later */
export const defaultBasePayByType: Record<
  Creator["creatorType"],
  number
> = {
  Internal: 1200,
  External: 800,
  AssetLoan: 500,
};

const MONTH = "2026-03";

export const initialTargets: CreatorTarget[] = [
  {
    id: "t-1",
    creatorId: "cr-1",
    projectId: "pr-1",
    campaignObjectiveId: "camp-1",
    creatorType: "Internal",
    tiktokAccountId: "tt-1",
    month: MONTH,
    targetVideos: 24,
    submittedVideos: 22,
    incentivePerVideo: 120,
    basePay: 1200,
    expectedRevenue: 4080,
    actualRevenue: 3920,
    incentives: 400,
    reimbursements: 120,
    expectedProfit: 3360,
    actualProfit: 3180,
  },
  {
    id: "t-2",
    creatorId: "cr-1",
    projectId: "pr-3",
    campaignObjectiveId: "camp-3",
    creatorType: "Internal",
    tiktokAccountId: "tt-1",
    month: MONTH,
    targetVideos: 12,
    submittedVideos: 11,
    incentivePerVideo: 100,
    basePay: 1200,
    expectedRevenue: 2400,
    actualRevenue: 2280,
    incentives: 200,
    reimbursements: 80,
    expectedProfit: 1920,
    actualProfit: 1820,
  },
  {
    id: "t-3",
    creatorId: "cr-2",
    projectId: "pr-2",
    campaignObjectiveId: "camp-2",
    creatorType: "External",
    tiktokAccountId: "tt-2",
    month: MONTH,
    targetVideos: 18,
    submittedVideos: 14,
    incentivePerVideo: 90,
    basePay: 800,
    expectedRevenue: 2420,
    actualRevenue: 1980,
    incentives: 280,
    reimbursements: 140,
    expectedProfit: 1800,
    actualProfit: 1420,
  },
  {
    id: "t-4",
    creatorId: "cr-3",
    projectId: "pr-3",
    campaignObjectiveId: "camp-1",
    creatorType: "AssetLoan",
    tiktokAccountId: "tt-3",
    month: MONTH,
    targetVideos: 10,
    submittedVideos: 12,
    incentivePerVideo: 70,
    basePay: 500,
    expectedRevenue: 1200,
    actualRevenue: 1340,
    incentives: 150,
    reimbursements: 60,
    expectedProfit: 990,
    actualProfit: 1130,
  },
];

/** Mock sparkline points (normalized 0–1) per creator */
export const performanceHistory: Record<string, number[]> = {
  "cr-1": [0.35, 0.42, 0.5, 0.55, 0.62, 0.7, 0.78, 0.85, 0.9, 0.95],
  "cr-2": [0.5, 0.48, 0.52, 0.45, 0.5, 0.55, 0.5, 0.48, 0.52, 0.54],
  "cr-3": [0.2, 0.28, 0.35, 0.42, 0.5, 0.58, 0.65, 0.72, 0.8, 0.88],
};
