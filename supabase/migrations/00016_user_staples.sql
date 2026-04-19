-- Phase 21: user_staples — per-user canonical ingredients marked as recurring staples.
--
-- Keyed by (user_id, canonical_ingredient_id). When a canonical is a staple for
-- a given user, future scans auto-accept that canonical at a lower confidence
-- threshold (0.3 vs default 0.7). Staples are canonical-ingredient-level, NOT
-- per-item — a single row is "user X treats canonical Y as a staple."
--
-- Consumption:
--   - Phase 21 mobile client reads via GET /staples
--   - Server-side scan review applies aggressive threshold when canonical is staple
--   - Pantry tab surfaces a "Staples" filter chip
--
-- Server-side guard (enforced in routes layer, not in schema):
--   Only canonical rows with status='active' may be marked as staples.
--   Candidate canonicals are filtered out at the API boundary.
--
-- RLS: user_id = auth.uid() (users own their staple list).

create table user_staples (
  user_id uuid not null references auth.users(id) on delete cascade,
  canonical_ingredient_id uuid not null references canonical_ingredients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, canonical_ingredient_id)
);

create index idx_user_staples_user on user_staples(user_id);

alter table user_staples enable row level security;

create policy "user_staples_select_own"
  on user_staples
  for select
  using (user_id = auth.uid());

create policy "user_staples_insert_own"
  on user_staples
  for insert
  with check (user_id = auth.uid());

create policy "user_staples_delete_own"
  on user_staples
  for delete
  using (user_id = auth.uid());

comment on table user_staples is
  'Phase 21. Per-user staple canonical ingredients. Marks canonicals for aggressive auto-accept (threshold 0.3 vs default 0.7) on future scans. Keyed on (user_id, canonical_ingredient_id).';
