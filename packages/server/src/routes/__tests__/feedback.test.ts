/**
 * Red test stub (Phase 25 Wave 0, plan 25-00) — route ships in 25-01.
 *
 * Nyquist contract: all tests are `.skip` placeholders so the file is
 * syntactically valid and reports `0 passed, N skipped, 0 failed` under
 * vitest. 25-01 flips `.skip` to `()` as production code lands.
 *
 * Shape mirrors packages/server/src/routes/__tests__/telemetry.test.ts —
 * once the feedback route module exists, 25-01 un-skips each block and
 * drives one behavior implementation per un-skip.
 *
 * Requirements tracked: BETA-07 (in-app feedback), BETA-11 (admin beta-invite
 * read-through for Patrick), BETA-24 (feedback ingestion).
 */
import { describe, it } from 'vitest';

describe('POST /feedback', () => {
  it.skip('inserts a feedback_submission row with auth.uid() as profile_id', () => {
    // 25-01 will implement: server inserts with profile_id = c.get('user').id
    //                        and returns 201 + { id }. Mirrors the telemetry
    //                        /cooking insert path exactly.
  });

  it.skip('rejects message shorter than 1 char or longer than 4000', () => {
    // Mirrors 00030 CHECK constraint at the Zod layer so the client-side
    // error is clear (400 with a shape-of-payload error envelope) before
    // the DB check fires.
  });

  it.skip('returns 401 when no auth', () => {
    // authMiddleware gate — no session → no insert.
  });
});

describe('GET /admin/beta-invites', () => {
  it.skip('returns beta_invites rows when requesting user email is in ADMIN_EMAILS allowlist', () => {
    // 25-01 will gate on env.ADMIN_EMAILS.split(',') containing the
    // requesting user's email. Uses the service_role key internally to
    // bypass beta_invites' deny-by-default RLS.
  });

  it.skip('returns 403 when requesting user is not admin', () => {
    // Non-allowlisted users get a flat 403, not 404, so the operator log
    // shows the access attempt clearly.
  });
});
