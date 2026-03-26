-- Satu baris per kombinasi leaf + segmen meja (Hanindo PCP / FOLO Public / All).
-- Tanpa table_segment di unique constraint, upsert hanya bisa menyimpan satu segmen
-- per (user, creator, project, campaign, tiktok, month) — segmen terakhir dalam batch menang (bug).

alter table public.creator_targets
  drop constraint if exists creator_targets_leaf_unique;

alter table public.creator_targets
  add constraint creator_targets_leaf_unique unique (
    user_id,
    creator_id,
    project_id,
    campaign_objective_id,
    tiktok_account_id,
    month,
    table_segment
  );

comment on constraint creator_targets_leaf_unique on public.creator_targets is
  'Unik per segmen meja (all | tnc | folo) agar submit target beda meja tidak saling timpa.';
