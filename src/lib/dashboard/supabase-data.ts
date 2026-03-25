import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultBasePayByType } from "@/lib/mock-data";
import { SHARED_DASHBOARD_USER_ID } from "@/lib/dashboard/shared-workspace";
import { withPostgrestSchemaRetry } from "@/lib/supabase/postgrest-retry";
import { parseTableSegmentFromDb } from "@/lib/dashboard/table-segments";
import type { StoredFormEntities } from "@/lib/dashboard/form-settings-storage";
import type {
  Brand,
  CampaignObjective,
  Creator,
  CreatorTarget,
  Organization,
  Project,
  TikTokAccount,
} from "@/lib/types";

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

export interface DashboardBundle {
  organizations: Organization[];
  brands: Brand[];
  projects: Project[];
  creators: Creator[];
  campaignObjectives: CampaignObjective[];
  tiktokAccounts: TikTokAccount[];
  targets: CreatorTarget[];
}

/** Minimal baris agar submit target (campaign objective tersimpan otomatis) bisa jalan. */
export async function ensureWorkspaceDefaults(
  supabase: SupabaseClient,
): Promise<void> {
  const wid = SHARED_DASHBOARD_USER_ID;
  const { count: cCount } = await supabase
    .from("campaign_objectives")
    .select("*", { count: "exact", head: true })
    .eq("user_id", wid);
  if ((cCount ?? 0) === 0) {
    const { error } = await supabase
      .from("campaign_objectives")
      .insert({ user_id: wid, label: "Default" });
    if (error) throw error;
  }
  const { count: oCount } = await supabase
    .from("organizations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", wid);
  if ((oCount ?? 0) === 0) {
    const { error } = await supabase
      .from("organizations")
      .insert({ user_id: wid, name: "Default Organization" });
    if (error) throw error;
  }
}

/** Push entitas dari Data settings ke Supabase (shared workspace). */
export async function syncStoredFormEntitiesToSupabase(
  supabase: SupabaseClient,
  stored: StoredFormEntities,
): Promise<void> {
  return withPostgrestSchemaRetry(supabase, () =>
    syncStoredFormEntitiesToSupabaseOnce(supabase, stored),
  );
}

async function syncStoredFormEntitiesToSupabaseOnce(
  supabase: SupabaseClient,
  stored: StoredFormEntities,
): Promise<void> {
  await ensureWorkspaceDefaults(supabase);
  const wid = SHARED_DASHBOARD_USER_ID;
  const { data: orgRows, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("user_id", wid)
    .limit(1);
  if (orgErr) throw orgErr;
  let orgId = orgRows?.[0]?.id as string | undefined;
  if (!orgId) {
    const { data, error } = await supabase
      .from("organizations")
      .insert({ user_id: wid, name: "Default Organization" })
      .select("id")
      .single();
    if (error) throw error;
    orgId = data!.id as string;
  }

  for (const b of stored.brands) {
    const { error } = await supabase.from("brands").upsert(
      {
        id: b.id,
        user_id: wid,
        name: b.name,
        table_segment: b.tableSegmentId === "folo" ? "folo" : "tnc",
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  }
  for (const p of stored.projects) {
    const { error } = await supabase.from("projects").upsert(
      {
        id: p.id,
        user_id: wid,
        name: p.name,
        brand_id: p.brandId || null,
        organization_id: p.organizationId || orgId,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  }
  for (const c of stored.creators) {
    const { error } = await supabase.from("creators").upsert(
      {
        id: c.id,
        user_id: wid,
        name: c.name,
        avatar_url: c.avatarUrl ?? "",
        handle_tiktok:
          c.handleTikTok ||
          `@${c.name.replace(/\s+/g, "").toLowerCase()}`,
        organization_id: c.organizationId || orgId,
        brand_ids: c.brandIds ?? [],
        creator_type: c.creatorType,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  }
  for (const t of stored.tiktokAccounts) {
    const { error } = await supabase.from("tiktok_accounts").upsert(
      {
        id: t.id,
        user_id: wid,
        creator_id: t.creatorId,
        label: t.label,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  }
}

export async function fetchDashboardData(
  supabase: SupabaseClient,
): Promise<DashboardBundle> {
  const wid = SHARED_DASHBOARD_USER_ID;
  const [
    { data: orgRows, error: e0 },
    { data: brandRows, error: e1 },
    { data: projectRows, error: e2 },
    { data: creatorRows, error: e3 },
    { data: campRows, error: e4 },
    { data: ttRows, error: e5 },
    { data: targetRows, error: e6 },
  ] = await Promise.all([
    supabase.from("organizations").select("*").eq("user_id", wid),
    supabase.from("brands").select("*").eq("user_id", wid),
    supabase.from("projects").select("*").eq("user_id", wid),
    supabase.from("creators").select("*").eq("user_id", wid),
    supabase.from("campaign_objectives").select("*").eq("user_id", wid),
    supabase.from("tiktok_accounts").select("*").eq("user_id", wid),
    supabase.from("creator_targets").select("*").eq("user_id", wid),
  ]);

  const err = e0 ?? e1 ?? e2 ?? e3 ?? e4 ?? e5 ?? e6;
  if (err) throw err;

  const organizations: Organization[] = (orgRows ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
  }));

  const brands: Brand[] = (brandRows ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    tableSegmentId: parseTableSegmentFromDb(
      r.table_segment as string | null | undefined,
    ),
  }));

  const projects: Project[] = (projectRows ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    brandId: (r.brand_id as string) ?? "",
    organizationId: (r.organization_id as string) ?? "",
  }));

  const creators: Creator[] = (creatorRows ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    avatarUrl: (r.avatar_url as string) ?? "",
    handleTikTok: r.handle_tiktok as string,
    organizationId: (r.organization_id as string) ?? "",
    brandIds: ((r.brand_ids as string[]) ?? []).map(String),
    creatorType: r.creator_type as Creator["creatorType"],
  }));

  const campaignObjectives: CampaignObjective[] = (campRows ?? []).map(
    (r) => ({
      id: r.id as string,
      label: r.label as string,
    }),
  );

  const tiktokAccounts: TikTokAccount[] = (ttRows ?? []).map((r) => ({
    id: r.id as string,
    creatorId: r.creator_id as string,
    label: r.label as string,
  }));

  const targets: CreatorTarget[] = (targetRows ?? []).map((r) => ({
    id: r.id as string,
    creatorId: r.creator_id as string,
    projectId: r.project_id as string,
    campaignObjectiveId: r.campaign_objective_id as string,
    creatorType: r.creator_type as CreatorTarget["creatorType"],
    tiktokAccountId: r.tiktok_account_id as string,
    month: r.month as string,
    targetVideos: num(r.target_videos),
    submittedVideos: num(r.submitted_videos),
    incentivePerVideo: num(r.incentive_per_video),
    basePay: num(r.base_pay),
    expectedRevenue: num(r.expected_revenue),
    actualRevenue: num(r.actual_revenue),
    incentives: num(r.incentives),
    reimbursements: num(r.reimbursements),
    expectedProfit: num(r.expected_profit),
    actualProfit: num(r.actual_profit),
  }));

  return {
    organizations,
    brands,
    projects,
    creators,
    campaignObjectives,
    tiktokAccounts,
    targets,
  };
}

export async function persistTargets(
  supabase: SupabaseClient,
  targets: CreatorTarget[],
): Promise<void> {
  return withPostgrestSchemaRetry(supabase, () =>
    persistTargetsOnce(supabase, targets),
  );
}

async function persistTargetsOnce(
  supabase: SupabaseClient,
  targets: CreatorTarget[],
): Promise<void> {
  const rows = targets.map((t) => ({
    user_id: SHARED_DASHBOARD_USER_ID,
    creator_id: t.creatorId,
    project_id: t.projectId,
    campaign_objective_id: t.campaignObjectiveId,
    creator_type: t.creatorType,
    tiktok_account_id: t.tiktokAccountId,
    month: t.month,
    target_videos: t.targetVideos,
    submitted_videos: t.submittedVideos,
    incentive_per_video: t.incentivePerVideo,
    base_pay: t.basePay,
    expected_revenue: t.expectedRevenue,
    actual_revenue: t.actualRevenue,
    incentives: t.incentives,
    reimbursements: t.reimbursements,
    expected_profit: t.expectedProfit,
    actual_profit: t.actualProfit,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("creator_targets").upsert(rows, {
    onConflict:
      "user_id,creator_id,project_id,campaign_objective_id,tiktok_account_id,month",
  });
  if (error) throw error;
}

/** Inserts demo rows sekali untuk workspace bersama. Idempotent jika sudah ada creator. */
export async function seedDemoData(supabase: SupabaseClient): Promise<void> {
  const wid = SHARED_DASHBOARD_USER_ID;
  const { count, error: cErr } = await supabase
    .from("creators")
    .select("*", { count: "exact", head: true })
    .eq("user_id", wid);
  if (cErr) throw cErr;
  if ((count ?? 0) > 0) return;

  const { data: o1, error: o1e } = await supabase
    .from("organizations")
    .insert({ user_id: wid, name: "Nova Media Group" })
    .select("id")
    .single();
  if (o1e) throw o1e;
  const { data: o2, error: o2e } = await supabase
    .from("organizations")
    .insert({ user_id: wid, name: "Pulse Creative Lab" })
    .select("id")
    .single();
  if (o2e) throw o2e;

  const org1 = o1!.id as string;
  const org2 = o2!.id as string;

  const { data: b1, error: b1e } = await supabase
    .from("brands")
    .insert({ user_id: wid, name: "USP Branding", table_segment: "tnc" })
    .select("id")
    .single();
  const { data: b2, error: b2e } = await supabase
    .from("brands")
    .insert({ user_id: wid, name: "Cashflow Farm", table_segment: "folo" })
    .select("id")
    .single();
  const { data: b3, error: b3e } = await supabase
    .from("brands")
    .insert({ user_id: wid, name: "Public Goods Co.", table_segment: "tnc" })
    .select("id")
    .single();
  if (b1e || b2e || b3e) throw b1e ?? b2e ?? b3e;

  const brand1 = b1!.id as string;
  const brand2 = b2!.id as string;
  const brand3 = b3!.id as string;

  const { data: p1, error: p1e } = await supabase
    .from("projects")
    .insert({
      user_id: wid,
      name: "Public Campaign",
      brand_id: brand3,
      organization_id: org1,
    })
    .select("id")
    .single();
  const { data: p2, error: p2e } = await supabase
    .from("projects")
    .insert({
      user_id: wid,
      name: "Cashflow Farm",
      brand_id: brand2,
      organization_id: org1,
    })
    .select("id")
    .single();
  const { data: p3, error: p3e } = await supabase
    .from("projects")
    .insert({
      user_id: wid,
      name: "USP Branding",
      brand_id: brand1,
      organization_id: org2,
    })
    .select("id")
    .single();
  if (p1e || p2e || p3e) throw p1e ?? p2e ?? p3e;

  const pr1 = p1!.id as string;
  const pr2 = p2!.id as string;
  const pr3 = p3!.id as string;

  const { data: cr1, error: cr1e } = await supabase
    .from("creators")
    .insert({
      user_id: wid,
      name: "Aira Lin",
      avatar_url:
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Aira&backgroundColor=0f172a",
      handle_tiktok: "@aira.creates",
      organization_id: org1,
      brand_ids: [brand1, brand3],
      creator_type: "Internal",
    })
    .select("id")
    .single();
  const { data: cr2, error: cr2e } = await supabase
    .from("creators")
    .insert({
      user_id: wid,
      name: "Mika Reyes",
      avatar_url:
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Mika&backgroundColor=0f172a",
      handle_tiktok: "@mika.reyes",
      organization_id: org1,
      brand_ids: [brand2],
      creator_type: "External",
    })
    .select("id")
    .single();
  const { data: cr3, error: cr3e } = await supabase
    .from("creators")
    .insert({
      user_id: wid,
      name: "Jordan Vale",
      avatar_url:
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan&backgroundColor=0f172a",
      handle_tiktok: "@jordanvale",
      organization_id: org2,
      brand_ids: [brand1, brand2],
      creator_type: "AssetLoan",
    })
    .select("id")
    .single();
  if (cr1e || cr2e || cr3e) throw cr1e ?? cr2e ?? cr3e;

  const c1 = cr1!.id as string;
  const c2 = cr2!.id as string;
  const c3 = cr3!.id as string;

  const { data: camp1, error: ca1e } = await supabase
    .from("campaign_objectives")
    .insert({ user_id: wid, label: "Awareness" })
    .select("id")
    .single();
  const { data: camp2, error: ca2e } = await supabase
    .from("campaign_objectives")
    .insert({ user_id: wid, label: "Conversion" })
    .select("id")
    .single();
  const { data: camp3, error: ca3e } = await supabase
    .from("campaign_objectives")
    .insert({ user_id: wid, label: "Evergreen" })
    .select("id")
    .single();
  if (ca1e || ca2e || ca3e) throw ca1e ?? ca2e ?? ca3e;

  const cp1 = camp1!.id as string;
  const cp2 = camp2!.id as string;
  const cp3 = camp3!.id as string;

  const { data: t1, error: t1e } = await supabase
    .from("tiktok_accounts")
    .insert({
      user_id: wid,
      creator_id: c1,
      label: "@aira.creates (main)",
    })
    .select("id")
    .single();
  const { data: t2, error: t2e } = await supabase
    .from("tiktok_accounts")
    .insert({
      user_id: wid,
      creator_id: c2,
      label: "@mika.reyes (shop)",
    })
    .select("id")
    .single();
  const { data: t3, error: t3e } = await supabase
    .from("tiktok_accounts")
    .insert({
      user_id: wid,
      creator_id: c3,
      label: "@jordanvale (alt)",
    })
    .select("id")
    .single();
  if (t1e || t2e || t3e) throw t1e ?? t2e ?? t3e;

  const tt1 = t1!.id as string;
  const tt2 = t2!.id as string;
  const tt3 = t3!.id as string;

  const month = "2026-03";

  const targetPayloads = [
    {
      user_id: wid,
      creator_id: c1,
      project_id: pr1,
      campaign_objective_id: cp1,
      creator_type: "Internal" as const,
      tiktok_account_id: tt1,
      month,
      target_videos: 24,
      submitted_videos: 22,
      incentive_per_video: 120,
      base_pay: defaultBasePayByType.Internal,
      expected_revenue: 4080,
      actual_revenue: 3920,
      incentives: 400,
      reimbursements: 120,
      expected_profit: 3360,
      actual_profit: 3180,
    },
    {
      user_id: wid,
      creator_id: c1,
      project_id: pr3,
      campaign_objective_id: cp3,
      creator_type: "Internal" as const,
      tiktok_account_id: tt1,
      month,
      target_videos: 12,
      submitted_videos: 11,
      incentive_per_video: 100,
      base_pay: defaultBasePayByType.Internal,
      expected_revenue: 2400,
      actual_revenue: 2280,
      incentives: 200,
      reimbursements: 80,
      expected_profit: 1920,
      actual_profit: 1820,
    },
    {
      user_id: wid,
      creator_id: c2,
      project_id: pr2,
      campaign_objective_id: cp2,
      creator_type: "External" as const,
      tiktok_account_id: tt2,
      month,
      target_videos: 18,
      submitted_videos: 14,
      incentive_per_video: 90,
      base_pay: defaultBasePayByType.External,
      expected_revenue: 2420,
      actual_revenue: 1980,
      incentives: 280,
      reimbursements: 140,
      expected_profit: 1800,
      actual_profit: 1420,
    },
    {
      user_id: wid,
      creator_id: c3,
      project_id: pr3,
      campaign_objective_id: cp1,
      creator_type: "AssetLoan" as const,
      tiktok_account_id: tt3,
      month,
      target_videos: 10,
      submitted_videos: 12,
      incentive_per_video: 70,
      base_pay: defaultBasePayByType.AssetLoan,
      expected_revenue: 1200,
      actual_revenue: 1340,
      incentives: 150,
      reimbursements: 60,
      expected_profit: 990,
      actual_profit: 1130,
    },
  ];

  const { error: te } = await supabase.from("creator_targets").insert(targetPayloads);
  if (te) throw te;
}

export { defaultBasePayByType };
