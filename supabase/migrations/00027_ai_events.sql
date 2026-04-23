-- Phase 23 Wave 0: AI-call telemetry append-only event log.
--
-- Producer: mobile apps/mobile/src/ai/telemetry.ts (batched client, ships in
-- plan 23-06), POSTed via /api/v1/telemetry/ai (packages/server/src/routes/telemetry.ts
-- extension, ships in plan 23-06).
--
-- Consumer: offline analysis only in this phase. Aggregation queries run by
-- hand against Supabase SQL editor to answer NFR-17 (per-model latency +
-- tokens in/out per task route) + rate-limit cohort comparison. No foreground
-- reads by the app yet.
--
-- Schema intent (clones the shopping_events / cooking_events / plan_events
-- append-only precedent exactly — see 20-RESEARCH.md Pattern 2 and 22-RESEARCH.md):
--   - profile_id FK to auth.users with on-delete cascade so user deletion
--     wipes telemetry (privacy; NFR-04 delete-cascade parity).
--   - session_id is a client-generated UUID per app-session, used to group
--     per-session event streams across pantry-scan / recipe-import / cooking
--     boundaries.
--   - event_type is a free-form text (NOT a Postgres enum) so adding event
--     kinds in later waves requires no migration. Known values today:
--       ai.request_started | ai.request_succeeded | ai.request_failed |
--       ai.rate_limited | ai.retry_attempted
--   - task_name identifies the *semantic* call site (distinct from event_type):
--       pantry.scan | recipe.import_url | recipe.import_text |
--       recipe.discover | planner.generate_week | something_new.search |
--       cooking.ask | shopping.draft_cart | ...
--     Kept as free-form text so new AI surfaces land without migrations.
--   - model identifies the exact Claude model slug in use
--     (e.g., 'claude-sonnet-4-20250514', 'claude-haiku-4-20250514'). Enables
--     per-model cost & latency rollups.
--   - payload jsonb is a sanitized, structured key surface only. Client MUST
--     NOT forward raw prompts, raw outputs, user emails/names, or pantry item
--     strings. Known whitelisted keys: latency_ms, input_tokens, output_tokens,
--     status, retry_count, error_code. See plan 23-06 sanitizePayload().
--   - client_ts = device ISO ts; server_ts = db-side default(now()) for
--     latency-skew analysis and reliable ordering.
--
-- RLS: auth.uid() = profile_id for select + insert. No update/delete policies
-- — telemetry is append-only (matches cooking_events, shopping_events, plan_events,
-- scan_events, item_override_events).

CREATE TABLE ai_events (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  task_name TEXT NOT NULL,
  model TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_ts TIMESTAMPTZ NOT NULL,
  server_ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_events_profile_ts_idx
  ON ai_events(profile_id, server_ts DESC);

CREATE INDEX ai_events_task_name_idx
  ON ai_events(task_name);

CREATE INDEX ai_events_session_idx
  ON ai_events(session_id);

ALTER TABLE ai_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own ai events"
  ON ai_events
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "users insert own ai events"
  ON ai_events
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- No UPDATE or DELETE policy — events are append-only.

COMMENT ON TABLE ai_events IS
  'Phase 23 NFR-17. Append-only AI-call telemetry: per-request status/latency/token-counts across Claude model + task-route combinations. Payload is a sanitized structured key surface; raw prompts, raw outputs, and any PII MUST NEVER be forwarded (client responsibility via sanitizePayload). Clones the cooking_events/shopping_events/plan_events pattern — see 22-RESEARCH.md Pattern 2 and 20-RESEARCH.md Pitfall 6.';
