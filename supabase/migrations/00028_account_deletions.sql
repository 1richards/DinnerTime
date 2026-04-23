-- Phase 23 Wave 0: account_deletions audit table.
--
-- Purpose: audit log for POST /account/delete (NFR-04). When a user taps
-- "Delete account" in Settings, the server:
--   1. INSERTs a row into this table capturing {profile_id, requested_at,
--      reason?, scheduled_purge_at = now() + interval '30 days'}.
--   2. Calls supabase.auth.admin.deleteUser(profile_id), which cascades
--      deletion across every table with an auth.users FK (pantry_items,
--      recipes, meal_plans, shopping_lists, all telemetry, etc.) via
--      ON DELETE CASCADE.
--
-- IMPORTANT: profile_id is NOT a foreign key to auth.users. The auth.users
-- row is cascaded away on deletion, so an FK would either (a) prevent the
-- INSERT if added after the delete, or (b) ripple-delete this audit row if
-- added before. We retain the audit trail INDEPENDENTLY of the user row so
-- the 30-day retention window is observable post-delete.
--
-- 30-day retention window per CONTEXT D-04 (Delete account). This is the
-- period during which a user could theoretically request restoration by
-- contacting support; after scheduled_purge_at passes, an offline job
-- (future phase) physically deletes storage bucket objects tied to the
-- profile_id if any survive cascade.
--
-- RLS: Enabled with NO policies, so only the service_role key (bypasses RLS)
-- can insert/select. Mobile app MUST NOT touch this table directly — all
-- access routes through packages/server/src/routes/account.ts /delete
-- handler which uses the service role.

CREATE TABLE account_deletions (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL,  -- NOT FK — auth.users row is cascaded away on delete
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  scheduled_purge_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX account_deletions_profile_id_idx
  ON account_deletions(profile_id);

-- RLS enabled with no policies = deny-by-default to anon + authenticated
-- roles. Only the service_role key (which bypasses RLS) can read or write.
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE account_deletions IS
  'Phase 23 NFR-04. Audit log for /account/delete. profile_id is NOT an FK because the auth.users row is cascaded away on delete — we retain the audit trail independently. 30-day retention window per CONTEXT D-04. Access restricted to service_role via deny-by-default RLS.';
