-- Phase 25 Wave 0: beta_invites tracking table.
--
-- Producer: Patrick via Supabase SQL editor. No admin UI ships in Phase 25 —
-- the operator workflow lives in .planning/BETA-PLAYBOOK.md (invite list
-- template, welcome-email template, day-1 / day-7 / week-2 check-in prompts).
--
-- Consumer: BETA-PLAYBOOK.md aggregation queries run by Patrick against
-- Supabase SQL editor to track beta-user lifecycle. The status column drives
-- cohort funnels (invited → onboarded → first_scan → first_cook → week_1_checkin,
-- with `lapsed` as the terminal drop-off state).
--
-- Schema intent:
--   - id UUID pk default gen_random_uuid() — stable handle for cross-ref from
--     notes docs without leaking email to dashboards.
--   - email UNIQUE NOT NULL — the human key. Prevents duplicate invites.
--   - invited_by FK to auth.users ON DELETE SET NULL — preserves the invite
--     trail even if the inviting Patrick-account is ever deleted (belt + braces;
--     highly unlikely in practice but cheap to encode).
--   - status CHECK constraint (NOT a Postgres enum) so adding stages in later
--     waves requires no migration — matches the free-form-text convention used
--     by ai_events.event_type / task_name.
--   - invited_at / onboarded_at / first_scan_at / first_cook_at / last_checkin_at
--     are nullable timestamp milestones — Patrick updates them manually as he
--     observes each beta-user's progress during playbook check-ins. No trigger,
--     no server route — SQL editor only.
--   - notes TEXT — free-form field for Patrick's observations (device, dietary
--     constraints noticed during onboarding, feedback highlights, etc).
--
-- RLS: Enabled with NO policies, so only the service_role key (which bypasses
-- RLS) can read or write. Mobile app MUST NOT touch this table directly — it
-- has no product feature that consumes beta_invites. Matches the
-- account_deletions (00028) audit pattern exactly.

CREATE TABLE beta_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (
    status IN ('invited', 'onboarded', 'first_scan', 'first_cook', 'week_1_checkin', 'lapsed')
  ),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  onboarded_at TIMESTAMPTZ,
  first_scan_at TIMESTAMPTZ,
  first_cook_at TIMESTAMPTZ,
  last_checkin_at TIMESTAMPTZ,
  notes TEXT
);

-- Named unique index (redundant with column-level UNIQUE but explicit for
-- contract-test discoverability; the BETA-PLAYBOOK.md query `SELECT ... WHERE
-- email = $1` resolves against this index).
CREATE UNIQUE INDEX beta_invites_email_idx ON beta_invites(email);

-- Status aggregation queries (`SELECT status, count(*) FROM beta_invites
-- GROUP BY status`) filter here.
CREATE INDEX beta_invites_status_idx ON beta_invites(status);

-- RLS enabled with no policies = deny-by-default to anon + authenticated
-- roles. Only the service_role key (which bypasses RLS) can read or write.
-- Mobile app MUST NOT touch this table directly.
ALTER TABLE beta_invites ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE beta_invites IS
  'Phase 25 BETA-05 / BETA-07 / BETA-11 / BETA-24. Tracks beta-user lifecycle (invited → onboarded → first_scan → first_cook → week_1_checkin → lapsed). Producer: Patrick via Supabase SQL editor; consumer: .planning/BETA-PLAYBOOK.md check-in workflows. Access restricted to service_role via deny-by-default RLS. Mobile app MUST NOT touch this directly.';
