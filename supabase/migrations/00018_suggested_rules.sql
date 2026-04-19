-- Phase 21: suggested_rules — aggregator output surfaced to the user as
-- "Suggested rules" in Settings. User accepts or dismisses manually; no toasts,
-- no auto-apply, no silent rule writes.
--
-- Producer: services/suggestionAggregator.ts (Phase 21 Wave 1) runs fire-and-forget
-- on scan commit. It reads item_override_events (Phase 18) across the last 30
-- days, groups by (item_name, user_location), and upserts a row when a group's
-- occurrence count reaches the threshold (2+ within 30 days per CONTEXT).
--
-- Consumer: mobile Settings → Pantry Rules → Suggestions surface (Phase 21 Wave 3).
-- Accepting a suggestion writes to user_location_rules (location_mapping) OR
-- ingredient_aliases with source='user_rule' (name_mapping) and sets dismissed_at
-- on the suggestion row. Dismissing sets dismissed_at only.
--
-- Composite unique (user_id, rule_type, payload):
--   Lets the aggregator upsert via onConflict without duplicating suggestions
--   when the same (item_name, user_location) pair re-triggers on a later scan.
--   The aggregator bumps occurrence_count + last_seen on the existing row.
--
-- Payload JSONB shape is rule_type-dependent (schema-light by design so Phase 22
-- can add new rule types without a migration):
--   rule_type='location_mapping' → {"item_name": string, "user_location": 'fridge'|'pantry'|'freezer'}
--   rule_type='name_mapping'     → {"source_name": string, "target_canonical_ingredient_id": uuid}
--
-- RLS: user_id = auth.uid() with full CRUD (users manage their suggestion list).

create table suggested_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_type text not null check (rule_type in ('name_mapping', 'location_mapping')),
  payload jsonb not null,
  occurrence_count int not null default 0,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  dismissed_at timestamptz null,
  unique (user_id, rule_type, payload)
);

create index idx_suggested_rules_user_active
  on suggested_rules(user_id, dismissed_at)
  where dismissed_at is null;

alter table suggested_rules enable row level security;

create policy "suggested_rules_select_own"
  on suggested_rules
  for select
  using (user_id = auth.uid());

create policy "suggested_rules_insert_own"
  on suggested_rules
  for insert
  with check (user_id = auth.uid());

create policy "suggested_rules_update_own"
  on suggested_rules
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "suggested_rules_delete_own"
  on suggested_rules
  for delete
  using (user_id = auth.uid());

comment on table suggested_rules is
  'Phase 21. Aggregator-produced suggested rules surfaced in Settings → Pantry Rules → Suggestions. composite unique (user_id, rule_type, payload) enables upsert-on-conflict without duplication. rule_type enum: name_mapping | location_mapping. Payload shape depends on rule_type.';
