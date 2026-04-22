# Phase 23 — Deferred Items

Out-of-scope discoveries logged during plan execution. Each item names the
plan that should resolve it.

## 23-02 (Account deletion)

- `packages/server/src/routes/account.ts` → `POST /account/delete` currently
  returns `501 Not Implemented`. Plan 23-01 shipped change-password +
  change-email only. Plan 23-02 will implement:
  - reason-body parse (optional)
  - insert into `account_deletions` audit table
  - cascade delete of user data
  - `auth.users` row deletion via service-role client
  - sign-out on success
  Four failing test cases in `src/routes/__tests__/account.test.ts` under the
  `POST /account/delete` describe block are the acceptance criteria.

  Reproduced pre-existing on commit before 23-06; NOT caused by this plan.

## Pre-existing mobile test failures (unchanged by 23-06)

- `apps/mobile/__tests__/auth-store.test.ts` → "should set isOnboarded
  based on profile.onboarding_complete". Fails with `expected false to be
  true`. The authStore profile fetch runs inside a `setTimeout(async()=>…,
  0)` to escape the Supabase auth-lock, so the test's post-callback assert
  races the deferred `set(...)`. Reproduces pre-23-06 (verified by swapping
  authStore.ts back to commit 9b58ca5's version — still fails). Fix
  requires the test to `await new Promise((r) => setTimeout(r, 0))` after
  the callback; out of scope for 23-06.
- `apps/mobile/src/lib/__tests__/deepLinkAllowlist.test.ts` — owned by
  Plan 23-07 (deep-link allowlist), not 23-06.
- `apps/mobile/src/components/settings/__tests__/DeleteAccountSheet.test.ts`
  — owned by Plan 23-02 (account deletion), not 23-06.
- `apps/mobile/src/stores/__tests__/progressionStore.test.ts` +
  `shoppingStore.test.ts` — pre-existing failures documented in earlier
  phases (Phase 20 SUMMARY flagged them as unrelated to handoff work).
