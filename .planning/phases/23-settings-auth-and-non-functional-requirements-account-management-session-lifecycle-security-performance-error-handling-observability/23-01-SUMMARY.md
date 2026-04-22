---
phase: 23-settings-auth-nfr
plan: 01
subsystem: settings
tags: [account-management, password, email, about, connected-services, hono, zod, supabase, expo-router]
dependency_graph:
  requires:
    - phase: 23
      plan: 00
      why: "Wave 0 shipped the red test stubs (account.test.ts, AccountSection.test.ts, AboutSection.test.ts) and the app.json/migration foundation this plan flips green."
  provides:
    - "POST /api/v1/account/change-password — re-auth guarded password update"
    - "POST /api/v1/account/change-email — triggers Supabase's email-confirmation flow"
    - "AccountSection — 4 rows: Change password, Change email, Export data, Delete account (last two are stubs awaiting 23-02)"
    - "AboutSection — version, build number, Privacy, Terms, Support"
    - "ConnectedServicesSection — Instacart 'Not connected' row (v1 anonymous link model per D-05)"
    - "/settings/account/change-password and /settings/account/change-email screens"
  affects:
    - "23-02 — will add export + delete route handlers, DeleteAccountSheet wiring, and merge 'Session' back into the new AccountSection"
    - "23-04 — the inline fetch in both screens is marked TODO-23-04 for migration to the shared authedFetch wrapper"
tech-stack:
  added: []
  patterns:
    - "Hono + zod body validation per route (ChangePasswordSchema / ChangeEmailSchema) mirroring the /auth router shape"
    - "Re-auth via supabase.auth.signInWithPassword(currentEmail, currentPassword) as the Supabase-idiomatic substitute for a dedicated reauthenticate primitive"
    - "501 stubs for routes whose happy-path ships in a later plan but whose 401-no-auth case needs to go green via authMiddleware"
    - "Flat JSX children (not .map()) in section components so Wave 0's vitest tree-walker recurses past them"
    - "Double-wire onPress on outer Pressable + inner Text in row components — harmless at runtime, lets label + handler co-locate in one element for the walker's visit-match rule"
key-files:
  created:
    - "packages/server/src/routes/account.ts"
    - "apps/mobile/src/components/settings/AccountSection.tsx"
    - "apps/mobile/src/components/settings/AboutSection.tsx"
    - "apps/mobile/src/components/settings/ConnectedServicesSection.tsx"
    - "apps/mobile/src/app/settings/account/change-password.tsx"
    - "apps/mobile/src/app/settings/account/change-email.tsx"
  modified:
    - "packages/server/src/index.ts"
    - "apps/mobile/src/app/settings/_layout.tsx"
    - "apps/mobile/src/app/(tabs)/settings.tsx"
    - "apps/mobile/src/components/settings/__tests__/AccountSection.test.ts"
    - "apps/mobile/src/components/settings/__tests__/AboutSection.test.ts"
key-decisions:
  - "501 stubs for /account/export + /account/delete instead of omitting the routes so the 401-no-auth test cases (which run through authMiddleware) go green immediately while leaving the happy-path RED for 23-02."
  - "Re-auth via signInWithPassword against the authenticated user's own email — Supabase has no dedicated reauthenticate primitive for password flows; a failing signInWithPassword is the idiomatic 'current password was wrong' signal."
  - "Inlined the token+fetch in change-password/change-email screens with a TODO-23-04 marker instead of importing authedFetch from a parallel plan. Scope discipline: 23-04 is executing in parallel and the import would create a cross-plan diff coupling; 401-on-wrong-current-password is NOT a session-expiry 401 anyway, so authedFetch's refresh-retry flow would actively hurt UX."
  - "Double-wire onPress on outer Pressable + inner Text. The 23-00 walker's visit-match rule requires a single node with both string children and an onPress prop. Text.onPress is native RN, harmless at runtime, and keeps the test contract satisfied without mutating the walker itself."
  - "Flat children (not .map()) in sections. The walker only recurses one level into arrays; `.map()` inside JSX produces nested arrays that the walker bails on. Writing 4 sibling Pressables as literal children is uglier source but testable."
  - "Renamed the existing 'Account' sign-out block to 'Session'. 23-04 polishes the copy further; this rename prevents a double 'ACCOUNT' header while the new AccountSection carries the real account-management rows."
requirements-completed:
  - NFR-01
  - NFR-02
  - NFR-05
  - NFR-06
metrics:
  duration: "11min"
  completed: "2026-04-22"
---

# Phase 23 Plan 01: Account Management Summary

**Non-destructive account management — password + email change, About section, Connected Services placeholder. 5 red stubs flipped green; Export/Delete affordances visible but routed to 23-02 stubs.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-22T09:31:07Z
- **Tasks:** 2 (both TDD GREEN steps — RED tests shipped in 23-00)
- **Files created:** 6
- **Files modified:** 5

## Accomplishments

- `POST /api/v1/account/change-password` — zod-validated body, `supabase.auth.signInWithPassword({ email, currentPassword })` re-auth gate, then `supabase.auth.updateUser({ password })`. Returns 401 on wrong current password (vs 500 — preserves the red test's semantic).
- `POST /api/v1/account/change-email` — triggers Supabase's own confirmation-email flow. Response is `{ success: true, emailConfirmationSent: true }` so the mobile side can show the "Check your inbox — your current email stays active" toast without a second round-trip.
- Mobile `AccountSection` — 4 rows (Change password / Change email / Export data / Delete account) under "ACCOUNT". Export + Delete route to `/settings/account/export` and `/settings/account/delete` stubs that 23-02 will wire up; the visible affordance lands now so users aren't surprised by the progression.
- Mobile `AboutSection` — version + build + Privacy Policy + Terms of Service + Support mailto row. Privacy/Terms open `WebBrowser.openBrowserAsync('https://dinnertime.app/privacy' | '/terms')`; Support opens `Linking.openURL('mailto:support@dinnertime.app')`.
- Mobile `ConnectedServicesSection` — single Instacart row showing "Not connected — handoff happens in Shopping" per D-05's anonymous-link model. Tap shows a clarifying toast.
- `change-password` screen — 3 inputs (current / new / confirm), client-side validation (8+ chars, matches confirm), POSTs inline, 401 → inline error, 400 → inline error, 200 → toast + `router.back()`.
- `change-email` screen — 1 input with `keyboardType="email-address"`, client regex sanity check, guards against entering the current email, 200 → success toast + `router.back()`.
- Settings tab wiring — 3 new sections mounted between BiometricUnlockSection (from parallel 23-03) and the existing Session/Sign Out block.

## Verification

- `cd packages/server && pnpm test --run src/routes/__tests__/account.test.ts -t "change-password|change-email"` → **7 passed / 5 skipped** (all change-password + change-email cases; export + delete intentionally skipped).
- `cd packages/server && pnpm test --run src/routes/__tests__/account.test.ts` → 9 passed / 3 failed (the 3 failures are export-happy-path + 2 delete-happy-paths — RED until 23-02 ships).
- `cd apps/mobile && pnpm test --run src/components/settings/__tests__/AccountSection.test.ts src/components/settings/__tests__/AboutSection.test.ts` → **7 passed** (3 AccountSection + 4 AboutSection).
- `cd apps/mobile && npx tsc --noEmit` → no new errors on any of the 6 new files or the 2 modified source files.
- Pre-existing failures unchanged: `auth-store.test.ts`, `shoppingStore.test.ts`, `progressionStore.test.ts`, `deepLinkAllowlist.test.ts`, `DeleteAccountSheet.test.ts`, `meal-plans.test.ts`, `taskRouting.test.ts` — all reproduce on `git stash` (bare HEAD before my changes).

## Task Commits

1. **Task 1: Server /account route (change-password + change-email)** — `cba7899` (feat)
   - Creates `packages/server/src/routes/account.ts`, mounts at `/api/v1/account` in `index.ts`.
   - 7 of 12 account.test.ts cases flip green.
2. **Task 2: Mobile sections + screens** — files shipped in `211ccb3` (see "Deviations from Plan — Commit Routing" below).
   - `AccountSection.tsx`, `AboutSection.tsx`, `ConnectedServicesSection.tsx`, `change-password.tsx`, `change-email.tsx`, `_layout.tsx` and `(tabs)/settings.tsx` wired. Also removed the now-unused `@ts-expect-error` pragmas in `AccountSection.test.ts` + `AboutSection.test.ts`.

## Files Created/Modified

### Created

- `packages/server/src/routes/account.ts` — Hono router with `authMiddleware` global + change-password / change-email handlers + 501 export/delete stubs for 23-02.
- `apps/mobile/src/components/settings/AccountSection.tsx` — 4-row account-management section.
- `apps/mobile/src/components/settings/AboutSection.tsx` — version / build / legal / support rows.
- `apps/mobile/src/components/settings/ConnectedServicesSection.tsx` — Instacart placeholder row.
- `apps/mobile/src/app/settings/account/change-password.tsx` — password change modal screen.
- `apps/mobile/src/app/settings/account/change-email.tsx` — email change modal screen.

### Modified

- `packages/server/src/index.ts` — imports + mounts `/account` route alongside `/telemetry`.
- `apps/mobile/src/app/settings/_layout.tsx` — registered two new `Stack.Screen` entries for the account sub-routes.
- `apps/mobile/src/app/(tabs)/settings.tsx` — imported + mounted the 3 new sections; renamed the tail "Account" sign-out block to "Session" to prevent a double-header collision with the new AccountSection.
- `apps/mobile/src/components/settings/__tests__/AccountSection.test.ts` — removed the now-unused `@ts-expect-error` pragma.
- `apps/mobile/src/components/settings/__tests__/AboutSection.test.ts` — same cleanup.

## Decisions Made

Captured in frontmatter `key-decisions`. Highlights:

- Re-auth via `signInWithPassword` on the caller's own email (Supabase has no dedicated reauthenticate primitive; a failing signInWithPassword IS the canonical "wrong current password" signal).
- Kept the inline fetch in both screens rather than importing the parallel-plan `authedFetch` — 401 on wrong-current-password is not a session-expiry 401, so the refresh-retry wrapper would interfere with UX.
- Double-wire `onPress` on Pressable + Text to satisfy the Wave 0 walker's visit-match rule.
- Flat sibling children instead of `.map()` — the Wave 0 walker doesn't recurse into nested arrays.

## Deviations from Plan

### Rule 3 — Blocking

**1. [Rule 3 - Blocking] Stripped `JSX.Element` return-type annotations.**
- **Found during:** Task 2 typecheck pass.
- **Issue:** My initial drafts typed each component as `(): JSX.Element`. Under React 19.2 + this project's `tsconfig.json`, the global `JSX` namespace was dropped (`error TS2503: Cannot find namespace 'JSX'`). The entire codebase's existing settings components (FamilyMembersSection, DietarySection, etc.) omit the return type annotation — they rely on inference.
- **Fix:** Removed the `: JSX.Element` annotation on all 5 new component/screen declarations. Inference produces the correct type.
- **Files modified:** `AccountSection.tsx`, `AboutSection.tsx`, `ConnectedServicesSection.tsx`, `change-password.tsx`, `change-email.tsx`.
- **Verification:** `npx tsc --noEmit` passes on all 5.
- **Committed in:** `211ccb3` (alongside the files themselves).

**2. [Rule 3 - Blocking] Removed now-unused `@ts-expect-error` pragmas from AccountSection.test.ts + AboutSection.test.ts.**
- **Found during:** Task 2 typecheck pass.
- **Issue:** 23-00 shipped both test files with `// @ts-expect-error — module does not exist yet` directly above `await import('../<Name>.js')`. Once the modules landed in this plan, the directives became `error TS2578: Unused '@ts-expect-error' directive`.
- **Fix:** Deleted the pragma line on both files.
- **Files modified:** `AccountSection.test.ts`, `AboutSection.test.ts`.
- **Verification:** Test suite still passes (7/7) and tsc is clean.
- **Committed in:** `211ccb3` (see Commit Routing below).

**3. [Rule 3 - Blocking] Initial AccountSection used `.map()` inside JSX — walker couldn't reach the rows.**
- **Found during:** First Task 2 test run. The walker visits `el.props.children` arrays one level deep, but `.map()` inside JSX produces `children = [textEl, [p1, p2, p3, p4]]`. The walker recursed into the inner array, `visit`ed it (array passes the `typeof === 'object'` check), then bailed because arrays have no `.type` or `.props.children`.
- **Fix:** Rewrote the 4 rows as literal JSX siblings of the section header. Source is ~4× longer but the test walker now visits every row.
- **Files modified:** `AccountSection.tsx` (also applied pre-emptively to `AboutSection.tsx`).
- **Verification:** All 7 tests pass.
- **Committed in:** `211ccb3`.

### Commit Routing — unusual but benign

**4. [Rule 3 - Blocking, infrastructure] Task 2 files ended up committed under the 23-04 parallel agent's `211ccb3` commit, not a 23-01 commit.**
- **Found during:** Post-Task-2 commit step.
- **Issue:** The autonomous directive spawned 23-03, 23-04, 23-05, 23-06 in parallel with me (23-01). All agents share the working tree. While I was finishing Task 2's typecheck fixes, the 23-04 agent ran `git commit` with a broad file inclusion — it swept my then-untracked Task 2 files (AccountSection, AboutSection, ConnectedServicesSection, change-password, change-email, _layout.tsx, settings.tsx, and the 2 test cleanups) into its commit `211ccb3` titled `feat(23-04): forgot-password + reset-password + login link + sign-out polish (Task 2)`. The 23-04 agent's own work (forgot-password + reset-password screens, login link, sign-out polish, authStore NFR-11 comment) is also in that commit. The commit message, however, only lists 23-04's scope — mine is an uncredited passenger.
- **Fix considered and rejected:** Rewriting history to split `211ccb3` into separate commits would require `git reset --hard HEAD~` followed by replaying — destructive, and the GSD safety protocol forbids destructive git without explicit user opt-in. Left the commit as-is; documented the routing here so verification + future phase archaeology can still attribute the 23-01 files correctly via `git log --follow <file>`.
- **Verification:** Files intact on HEAD, tests still pass (7/7 server change-password/email + 7/7 mobile sections).
- **Impact:** Zero functional impact. The 6 Task 2 files + 3 edits + 2 test cleanups all exist on HEAD with identical content to what I wrote. Attribution reads oddly in `git log --oneline` but is recoverable via `git log --follow apps/mobile/src/components/settings/AccountSection.tsx` (which shows exactly one commit: `211ccb3`).

---

**Total deviations:** 4 Rule 3 blocking (3 technical: React 19 JSX namespace, unused ts-expect-error, walker array recursion; 1 infrastructure: cross-agent commit routing).
**Impact on plan:** Zero scope creep. All deliverables shipped as specified. One commit-attribution artifact documented for future readers.

## Issues Encountered

- Parallel-agent commit-tree collision (documented as deviation 4). No code impact; attribution-only.
- Initial walker mismatch in Task 2 (`.map()` producing nested child array) surfaced early via test run and was corrected inline.

## Authentication Gates

None — all development against local mocks + Supabase fixtures baked into Wave 0's test stubs.

## Known Stubs

- **`ConnectedServicesSection.tsx` — Instacart "Not connected" display.**
  - Reason: per D-05, v1 uses Instacart's anonymous link-based handoff — no user-level OAuth connection exists to persist. The row is a deliberate placeholder so users see the account surface is alive.
  - Resolution: a future post-v1 phase that switches to authenticated cart-based handoff replaces the stub with connect/disconnect affordances. Not in 23-02's scope (which ships export + delete against the same backend).
- **`change-password.tsx` + `change-email.tsx` — inline fetch with `TODO-23-04` marker.**
  - Reason: 23-04 is executing in parallel and owns `apps/mobile/src/lib/authedFetch.ts`. Importing from a parallel plan's in-flight deliverable would couple this plan's diff to another; 401 on wrong current password is semantically different from 401 on session expiry anyway.
  - Resolution: 23-04 (or a follow-up sweep) migrates both screens to `authedFetch`. No behavior change expected — the current inline fetch correctly handles the 401 as "wrong password" which is the contract here.
- **Export data + Delete account rows in `AccountSection` route to `/settings/account/export` + `/settings/account/delete`.**
  - Reason: 23-02 owns these screens + server handlers. The row labels + routes are in place per plan so the affordance is visible at 23-01 ship.
  - Resolution: 23-02 adds the target screens (`export.tsx`, `delete.tsx`) and the `/account/export` + `/account/delete` handlers; my 501 stubs flip green at that point.

## Next Plan Readiness

- 23-02 (export + delete) has a clean handoff: the AccountSection rows already route to the right paths, the server has `/account` mounted, and the `account_deletions` migration from 23-00 is ready.
- 23-04's parallel work composed with mine on `apps/mobile/src/app/(tabs)/settings.tsx` (they polished the sign-out Alert copy; I renamed the block header to 'Session' and inserted 3 sections above it) — merge artifact clean.

## Self-Check: PASSED

All created files exist; commits present in `git log --oneline`:

- `packages/server/src/routes/account.ts` → FOUND
- `apps/mobile/src/components/settings/AccountSection.tsx` → FOUND
- `apps/mobile/src/components/settings/AboutSection.tsx` → FOUND
- `apps/mobile/src/components/settings/ConnectedServicesSection.tsx` → FOUND
- `apps/mobile/src/app/settings/account/change-password.tsx` → FOUND
- `apps/mobile/src/app/settings/account/change-email.tsx` → FOUND
- Commit `cba7899` (Task 1) → FOUND
- Commit `211ccb3` (Task 2 files, cross-attributed) → FOUND
- Tests green: 7/7 server change-password+email, 7/7 mobile AccountSection+AboutSection.

---
*Phase: 23-settings-auth-nfr*
*Completed: 2026-04-22*
