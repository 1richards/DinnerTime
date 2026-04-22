-- Phase 25 Wave 0: feedback_submissions capture table.
--
-- Producer: apps/mobile/src/components/settings/FeedbackSheet.tsx (ships in
-- Phase 25 plan 25-01). The sheet POSTs to /api/v1/feedback (also ships in
-- 25-01); the server handler inserts one row per submission with
-- profile_id = c.get('user').id.
--
-- Consumer: Patrick via Supabase SQL editor for read-through during beta.
-- No admin UI in Phase 25 — aggregation queries run by hand per
-- .planning/BETA-PLAYBOOK.md (feedback categorization template).
--
-- Schema intent (clones the ai_events / cooking_events / shopping_events /
-- plan_events append-only precedent exactly):
--   - id BIGSERIAL pk — compact monotonic handle for SQL editor joins.
--   - profile_id FK to auth.users ON DELETE CASCADE — user deletion (NFR-04)
--     wipes their feedback; matches the telemetry cascade parity.
--   - message TEXT NOT NULL with CHECK length 1..4000 — enforced at DB layer
--     so a mis-behaving client cannot submit empty or unbounded prose. The
--     Zod layer in the route (25-01) mirrors this for clearer client-side
--     error messages.
--   - email TEXT nullable — captured by the sheet form (prefilled from auth
--     email but user-editable); leaving nullable supports anonymous-style
--     submissions where the user clears the field.
--   - app_version / build_number / platform — client-inferred metadata for
--     cohort slicing (which build produced this feedback). Platform defaults
--     to 'ios' since Phase 25 is iOS-only; kept free-form text for future
--     expansion to other platforms without migration.
--   - screenshot_path TEXT nullable — optional Supabase Storage path for
--     attached screenshots. 25-01 may or may not wire this; the column is
--     here so a later iteration doesn't require a migration.
--   - created_at server-generated — matches append-only event pattern.
--
-- RLS: auth.uid() = profile_id for SELECT and INSERT only. No UPDATE or
-- DELETE policies — feedback is append-only (matches cooking_events /
-- shopping_events / ai_events / scan_events / item_override_events precedent).

CREATE TABLE feedback_submissions (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  email TEXT,
  app_version TEXT,
  build_number TEXT,
  platform TEXT NOT NULL DEFAULT 'ios',
  screenshot_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index: Patrick's read-through queries filter by profile_id and
-- order recent-first.
CREATE INDEX feedback_submissions_profile_id_idx
  ON feedback_submissions(profile_id, created_at DESC);

ALTER TABLE feedback_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_submissions_own_select
  ON feedback_submissions
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY feedback_submissions_own_insert
  ON feedback_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- No UPDATE or DELETE policy — feedback is append-only.

COMMENT ON TABLE feedback_submissions IS
  'Phase 25 BETA-07 / BETA-24. Append-only in-app feedback capture. Producer: apps/mobile/src/components/settings/FeedbackSheet.tsx (25-01); consumer: Patrick via Supabase SQL editor during beta. Message length clamped 1..4000 via CHECK. profile_id cascades on user delete (NFR-04 parity). Matches the cooking_events/shopping_events/ai_events append-only precedent.';
