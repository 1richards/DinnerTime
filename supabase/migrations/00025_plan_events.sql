-- Phase 22 Wave 0: plan telemetry append-only event log.
--
-- Producer: mobile apps/mobile/src/plan/telemetry.ts (batched client), POSTed
-- via /api/v1/telemetry/plan (packages/server/src/routes/telemetry.ts).
--
-- Consumer: offline analysis only in this phase. Aggregation queries are run
-- by hand against Supabase SQL editor to answer PLAN-X-01..16 conversion
-- funnel questions (recipe_pin_started → _succeeded ratios, shopping-handoff
-- opens per week, stretch_displayed vs completion, etc).
-- No foreground reads by the app yet.
--
-- Schema intent (mirrors shopping_events / cooking_events / scan_events /
-- item_override_events append-only precedent — see Phase 22-RESEARCH.md
-- Pattern 2 which references Phase 20's shopping_events pattern):
--   - profile_id FK to auth.users with on-delete cascade so user deletion
--     wipes telemetry (privacy).
--   - session_id is a client-generated UUID per plan-screen session,
--     used to group per-session event streams across a pin/handoff flow.
--   - event_type is a free-form text (NOT a Postgres enum) so adding event
--     kinds in later waves requires no migration. Known values today:
--       plan.recipe_pin_started | plan.recipe_pin_succeeded |
--       plan.recipe_pin_failed | plan.suggestion_pin_succeeded |
--       plan.shopping_handoff_opened | plan.week_regenerated |
--       plan.week_shifted | plan.week_duplicated | plan.month_opened |
--       plan.day_drill_opened | plan.swipe_action |
--       plan.stretch_displayed | plan.focus_theme_set
--   - meal_plan_id references meal_plans with on-delete set null so a
--     deleted plan does not destroy its historical telemetry.
--   - meal_plan_entry_id references meal_plan_entries with on-delete set
--     null — the durable entry record survives independently of telemetry,
--     and telemetry survives independently of the plan/entry rows.
--   - payload jsonb is a sanitized, structured key surface only. Client MUST
--     NOT forward raw recipe titles, ingredient names, or user notes (see
--     22-RESEARCH.md whitelist — 14 keys parity with shopping telemetry).
--   - client_ts = device ISO ts; server_ts = db-side default(now()) for
--     latency-skew analysis and reliable ordering.
--
-- RLS: auth.uid() = profile_id for select + insert. No update/delete policies
-- — telemetry is append-only (matches shopping_events, cooking_events,
-- scan_events, item_override_events).

CREATE TABLE plan_events (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
  meal_plan_entry_id UUID REFERENCES meal_plan_entries(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_ts TIMESTAMPTZ NOT NULL,
  server_ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX plan_events_profile_ts_idx
  ON plan_events(profile_id, server_ts DESC);

CREATE INDEX plan_events_session_idx
  ON plan_events(session_id);

ALTER TABLE plan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own plan events"
  ON plan_events
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "users insert own plan events"
  ON plan_events
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- No UPDATE or DELETE policy — events are append-only.

COMMENT ON TABLE plan_events IS
  'Phase 22. Append-only plan-experience telemetry: recipe-pin started/succeeded/failed, suggestion-pin succeeded, shopping-handoff opened, week actions (regenerate/shift/duplicate), month view opened, day drill opened, swipe actions (swap/cook/skip), stretch-meal displayed, focus-theme set. Payload is a sanitized structured key surface; raw recipe titles, ingredient names, and user notes MUST NEVER be forwarded (client responsibility). Clones the Phase 20 shopping_events pattern 1:1 — see docs: 22-RESEARCH.md Pattern 2 (which references 20-RESEARCH.md Pitfall 6 whitelist).';
