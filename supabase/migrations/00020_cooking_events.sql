-- Phase 16 Wave 1: cooking telemetry append-only event log.
--
-- Producer: mobile apps/mobile/src/cooking/telemetry.ts (batched client), POSTed
-- via /api/v1/telemetry/cooking (packages/server/src/routes/telemetry.ts).
--
-- Consumer: offline analysis only in this phase. Aggregation queries are run
-- by hand against Supabase SQL editor to answer COOK-UX-01 (p95 /ask latency)
-- and COOK-UX-02 (Whisper-fallback decision from STT confidence/error counts).
-- No foreground reads by the app yet.
--
-- Schema intent (mirrors recipe_cooks / scan_events append-only precedent):
--   - profile_id FK to auth.users with on-delete cascade so user deletion
--     wipes telemetry (privacy).
--   - session_id is a client-generated UUID per cooking-mode entry (reset on
--     `cookingStore.enter()`), used to group per-session event streams.
--   - event_type is a free-form text (NOT a Postgres enum) so adding event
--     kinds in later waves requires no migration. Known values today:
--       stt_final | stt_error | intent_routed | ask_start | ask_first_chunk |
--       ask_complete | tts_echo_swallowed | command_unrecognized
--   - recipe_id references recipes with on-delete set null so a deleted recipe
--     does not destroy its historical telemetry.
--   - payload jsonb is a sanitized, structured key surface only. Client MUST
--     NOT forward raw transcripts (see 16-RESEARCH.md Pattern 1 anti-pattern).
--   - client_ts = device ISO ts; server_ts = db-side default(now()) for
--     latency-skew analysis and reliable ordering.
--
-- RLS: auth.uid() = profile_id for select + insert. No update/delete policies
-- — telemetry is append-only (matches recipe_cooks, scan_events, item_override_events).

CREATE TABLE cooking_events (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  step_index INT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_ts TIMESTAMPTZ NOT NULL,
  server_ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cooking_events_profile_ts_idx
  ON cooking_events(profile_id, server_ts DESC);

CREATE INDEX cooking_events_session_idx
  ON cooking_events(session_id);

ALTER TABLE cooking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own cooking events"
  ON cooking_events
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "users insert own cooking events"
  ON cooking_events
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- No UPDATE or DELETE policy — events are append-only.

COMMENT ON TABLE cooking_events IS
  'Phase 16. Append-only cooking-mode telemetry: per-utterance STT metrics, intent routing, /cooking/ask latency, TTS echo swallows, unrecognized commands. Payload is a sanitized structured key surface; raw transcripts MUST NEVER be forwarded (client responsibility). See docs: 16-RESEARCH.md Pattern 1.';
