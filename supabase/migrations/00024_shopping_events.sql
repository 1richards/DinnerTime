-- Phase 20 Wave 1: shopping telemetry append-only event log.
--
-- Producer: mobile apps/mobile/src/shopping/telemetry.ts (batched client), POSTed
-- via /api/v1/telemetry/shopping (packages/server/src/routes/telemetry.ts).
--
-- Consumer: offline analysis only in this phase. Aggregation queries are run by
-- hand against Supabase SQL editor to answer SHOP-DC-01..06 conversion funnel
-- questions (draft_cart_started → _succeeded → handoff_opened_{app|web} ratios)
-- and to compare draft_cart vs legacy feature-flag cohorts.
-- No foreground reads by the app yet.
--
-- Schema intent (mirrors cooking_events / scan_events / item_override_events
-- append-only precedent — see Phase 20-RESEARCH.md Pattern 2):
--   - profile_id FK to auth.users with on-delete cascade so user deletion
--     wipes telemetry (privacy).
--   - session_id is a client-generated UUID per shopping-screen session,
--     used to group per-session event streams across a handoff flow.
--   - event_type is a free-form text (NOT a Postgres enum) so adding event
--     kinds in later waves requires no migration. Known values today:
--       shopping.draft_cart_started | shopping.draft_cart_succeeded |
--       shopping.draft_cart_failed | shopping.handoff_opened_app |
--       shopping.handoff_opened_web | shopping.handoff_dismissed
--   - shopping_list_id references shopping_lists with on-delete set null so a
--     deleted list does not destroy its historical telemetry.
--   - shopping_order_id references shopping_orders with on-delete set null —
--     the durable handoff record survives independently of telemetry, and
--     telemetry survives independently of the list/order rows.
--   - payload jsonb is a sanitized, structured key surface only. Client MUST
--     NOT forward raw item names, quantities, or checkout details (see
--     20-RESEARCH.md Pitfall 6 whitelist).
--   - client_ts = device ISO ts; server_ts = db-side default(now()) for
--     latency-skew analysis and reliable ordering.
--
-- RLS: auth.uid() = profile_id for select + insert. No update/delete policies
-- — telemetry is append-only (matches cooking_events, scan_events,
-- item_override_events).

CREATE TABLE shopping_events (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  shopping_list_id UUID REFERENCES shopping_lists(id) ON DELETE SET NULL,
  shopping_order_id UUID REFERENCES shopping_orders(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_ts TIMESTAMPTZ NOT NULL,
  server_ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX shopping_events_profile_ts_idx
  ON shopping_events(profile_id, server_ts DESC);

CREATE INDEX shopping_events_session_idx
  ON shopping_events(session_id);

ALTER TABLE shopping_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own shopping events"
  ON shopping_events
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "users insert own shopping events"
  ON shopping_events
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- No UPDATE or DELETE policy — events are append-only.

COMMENT ON TABLE shopping_events IS
  'Phase 20. Append-only shopping-handoff telemetry: draft-cart started/succeeded/failed, handoff opened (app vs web), handoff dismissed. Payload is a sanitized structured key surface; raw item names, quantities, and checkout details MUST NEVER be forwarded (client responsibility). Clones the Phase 16 cooking_events pattern 1:1 — see docs: 20-RESEARCH.md Pattern 2 and Pitfall 6.';
