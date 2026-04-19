-- Phase 21: user_location_rules — per-user "X always goes in [fridge|pantry|freezer]" rules.
--
-- Stored as one row per (user_id, canonical_ingredient_id, source_location)
-- triple with an explicit precedence int8. Rule evaluation is first-match-wins
-- ordered by precedence asc inside services/ruleEvaluator.ts (Phase 21 Wave 1).
--
-- Precedence strategy: drag-to-reorder in Settings UI writes a dense integer
-- ordering to this column. int8 (bigint) provides headroom for sparse reordering
-- without renumbering every row.
--
-- Companion tables:
--   - ingredient_aliases (Phase 24a) carries user-created NAME rules via rows
--     with source='user_rule'. Name rules are applied inside canonicalResolver
--     (Stage 2 alias exact match). This table is for LOCATION rules only.
--   - suggested_rules (Phase 21) carries the aggregator's suggestions before
--     user acceptance promotes them into this table.
--
-- RLS: user_id = auth.uid() with full CRUD (users manage their rule list).

create table user_location_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  canonical_ingredient_id uuid not null references canonical_ingredients(id) on delete cascade,
  source_location text not null check (source_location in ('fridge', 'pantry', 'freezer')),
  precedence int8 not null default 0,
  created_at timestamptz not null default now()
);

create index idx_user_location_rules_user_precedence
  on user_location_rules(user_id, precedence asc);

alter table user_location_rules enable row level security;

create policy "user_location_rules_select_own"
  on user_location_rules
  for select
  using (user_id = auth.uid());

create policy "user_location_rules_insert_own"
  on user_location_rules
  for insert
  with check (user_id = auth.uid());

create policy "user_location_rules_update_own"
  on user_location_rules
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_location_rules_delete_own"
  on user_location_rules
  for delete
  using (user_id = auth.uid());

comment on table user_location_rules is
  'Phase 21. Per-user canonical-to-location mapping rules. precedence int8 supports drag-to-reorder first-match-wins evaluation inside services/ruleEvaluator.ts. Name-mapping rules live in ingredient_aliases with source=user_rule, not here.';
