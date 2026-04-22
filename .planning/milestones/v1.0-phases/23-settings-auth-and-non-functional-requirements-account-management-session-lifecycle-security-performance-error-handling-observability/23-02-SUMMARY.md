---
phase: 23-settings-auth-nfr
plan: 02
subsystem: account-management
tags: [NFR-03, NFR-04, export, delete, account, privacy, destructive]
dependency_graph:
  requires: [23-00, 23-01]
  provides:
    - "GET /api/v1/account/export endpoint — 5-table JSON dump for user data portability"
    - "POST /api/v1/account/delete endpoint — audit log + auth.users cascade"
    - "buildExportDump(supabase, userId) service — reusable aggregator"
    - "DeleteAccountSheet component + canConfirmDelete + performDelete helpers"
    - "Mobile /settings/account/export screen — cache-write + iOS share sheet"
    - "Mobile /settings/account/delete screen — inline destructive flow"
  affects:
    - "packages/server/src/middleware/auth.ts — now sets c.set('supabaseAdmin') for privileged flows"
    - "apps/mobile/src/app/settings/_layout.tsx — 2 new Stack.Screen entries"
tech_stack:
  added:
    - "expo-file-system@^19 (using /legacy subpath for v18 function API)"
    - "expo-sharing@~14 (with app.json plugin registration)"
  patterns:
    - "Service-role audit-before-cascade for destructive operations"
    - "Two-step confirm primitive: type DELETE literal + separate tap"
    - "performDelete exported separately from sheet component for unit-testability without a renderer"
    - "authedFetch path prefix with /api/v1 — consistent with 23-01 change-password/change-email"
key_files:
  created:
    - "packages/server/src/services/accountExport.ts"
    - "packages/server/src/services/__tests__/accountExport.test.ts"
    - "apps/mobile/src/components/settings/DeleteAccountSheet.tsx"
    - "apps/mobile/src/app/settings/account/export.tsx"
    - "apps/mobile/src/app/settings/account/delete.tsx"
  modified:
    - "packages/server/src/routes/account.ts (501 stubs → full handlers)"
    - "packages/server/src/routes/__tests__/account.test.ts (dropped red-stub @ts-expect-error)"
    - "packages/server/src/middleware/auth.ts (c.set supabaseAdmin)"
    - "apps/mobile/src/components/settings/__tests__/DeleteAccountSheet.test.ts (dropped red-stub @ts-expect-error + indexed-access fixups)"
    - "apps/mobile/src/app/settings/_layout.tsx"
    - "apps/mobile/app.json (expo-sharing plugin)"
    - "apps/mobile/package.json (+2 deps)"
    - "pnpm-lock.yaml"
decisions:
  - "profiles lookup uses .maybeSingle() instead of .single() to tolerate users without a profile row and align with the 23-00 account.test.ts mock shape"
  - "expo-file-system v19 /legacy subpath used — simpler one-off file-write call surface than the new Paths+File class API"
  - "authMiddleware exposes supabaseAdmin via c.set() so privileged routes use c.get('supabaseAdmin') instead of direct config imports — keeps route tests' middleware-mock injection the single point of client swap"
  - "export response body is JSON.stringify(dump) with Content-Type application/json + Content-Disposition attachment — mobile reads as text and writes to cache, no double-parse"
  - "DeleteAccountSheet is an inline controlled component (not a floating Modal) so the destructive action is the user's explicit arrival at the screen, not a misfire"
metrics:
  duration: 8min
  tasks_completed: 2
  files_touched: 10
  tests_added: 9
  tests_green: 21
  completed: 2026-04-22
---

# Phase 23 Plan 23-02: Account Export + Delete Summary

Delivered the destructive half of account management (NFR-03 + NFR-04) — a
full JSON data export behind a share sheet and a two-step-confirm account
deletion that cascades via Supabase admin delete.

## Tasks Completed

### Task 1: Server export + delete handlers

**RED** — Added `packages/server/src/services/__tests__/accountExport.test.ts`
with 4 cases covering the 5-table query shape, canonical output, null-to-[]
coercion, and parallel execution (Promise.all regression guard). The 3
still-red describes in `account.test.ts` from the 23-00 stub (export happy
path + delete happy path + delete without reason) round out the RED surface.

**GREEN** — Shipped:

- `packages/server/src/services/accountExport.ts` — `buildExportDump(supabase, userId)`
  runs 5 parallel queries: `profiles.maybeSingle`, `pantry_items`, `recipes`,
  `meal_plans` (with nested `entries:meal_plan_entries(*)`), and `recipe_cooks`.
  Every row query passes `.eq('profile_id', userId)` explicitly as belt-and-
  suspenders beyond RLS. Null data coerced to `[]` for downstream stability.
  Returns `{ profile, pantry, recipes, meal_plans, cook_history, exported_at }`.
- `routes/account.ts` — GET `/export` handler: serializes the dump with
  `Content-Type: application/json; charset=utf-8` and `Content-Disposition:
  attachment; filename="dinnertime-export-<userId>-<YYYY-MM-DD>.json"`.
- `routes/account.ts` — POST `/delete` handler: parses optional `{ reason }`
  (null if missing/whitespace/malformed body), writes an audit row into
  `account_deletions` via the service-role admin client, then calls
  `supabaseAdmin.auth.admin.deleteUser(user.id)`. Audit-before-cascade so a
  failure mid-flight still leaves a record. Returns `{ deleted: true }`.
- `middleware/auth.ts` — now also sets `c.set('supabaseAdmin', supabaseAdmin)`
  so privileged routes read it from context instead of importing the config
  directly; keeps the mock surface stable for route tests.

**Commit:** `0ec58ba` (RED) + `a18b0a1` (GREEN).

**Tests:** 16/16 green (4 `accountExport` + 12 `account.test.ts`).

### Task 2: Mobile DeleteAccountSheet + export/delete screens

**RED** — The 23-00 `DeleteAccountSheet.test.ts` stub was already red on
entry. It asserts:

- `canConfirmDelete(input)` exact 'DELETE' match (empty, lowercase, whitespace
  padding all false; exact 'DELETE' true)
- `performDelete({ reason })` calls `authedFetch` with POST + URL matching
  `/account/delete$` and fires `useAuthStore.getState().signOut()`

**GREEN** — Shipped:

- `components/settings/DeleteAccountSheet.tsx` — three exports:
  - `canConfirmDelete(input): boolean` — exact `'DELETE'` literal.
  - `performDelete({ reason }): Promise<{ ok, status }>` — POST via authedFetch
    to `/api/v1/account/delete` with `{ reason: string | null }` body; on ok
    calls `useAuthStore.getState().signOut()` so the UI can't observe a stale
    session.
  - `DeleteAccountSheet` component — inline controlled UI: red warning block
    + optional reason Input (multiline, 3 rows) + "Type DELETE to confirm"
    Input + destructive red Pressable (disabled until `canConfirmDelete` true)
    + Cancel Pressable.
- `apps/mobile/src/app/settings/account/export.tsx` — single-CTA screen.
  GETs `/api/v1/account/export` via authedFetch, writes the raw text body to
  `FileSystem.cacheDirectory` (via `expo-file-system/legacy` import —
  v19 refactored the top-level to Paths+File classes but `/legacy` still
  exports the v18 function API), then opens the iOS share sheet via
  `Sharing.shareAsync` with `application/json` mime + `public.json` UTI. On
  any failure: toast + retry.
- `apps/mobile/src/app/settings/account/delete.tsx` — renders
  `DeleteAccountSheet` inline (not a modal). On confirm: `performDelete` →
  on ok fires Alert "Account deleted / 30-day retention" → OK routes
  `router.replace('/(auth)/login')`. On failure: Alert for retry. Cancel:
  `router.back`.
- `settings/_layout.tsx` — registered both Stack.Screen entries.

**Dependencies installed:** `expo-file-system@^19` + `expo-sharing@~14` via
`npx expo install`. expo-sharing auto-registered as a plugin in app.json.

**Commit:** `f76ff09` (sheet) + `98c0843` (screens + deps).

**Tests:** 5/5 green (`DeleteAccountSheet.test.ts`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `profiles.single()` → `profiles.maybeSingle()` in buildExportDump**
- **Found during:** Task 1 GREEN — first `account.test.ts` run
- **Issue:** The 23-00 red-stub mock's chainable builder exposes
  `maybeSingle` only; `.single()` raised `TypeError: ... .single is not a
  function` and the export handler 500'd.
- **Fix:** Changed the profiles query to `.maybeSingle()`. This is the more
  defensive choice anyway — `single()` raises "PGRST116 no rows returned"
  when a profile is missing, but `maybeSingle()` returns `{ data: null }`,
  so a user with no profile row still gets a valid export with
  `profile: null`.
- **Files modified:** `packages/server/src/services/accountExport.ts`
- **Commit:** `a18b0a1`

**2. [Rule 3 — Blocking] Response body keys — `pantry` not `pantry_items`**
- **Found during:** Task 1 planning — reading 23-00 red-stub test
- **Issue:** The must-haves in the plan frontmatter said
  `{ profile, pantry_items, recipes, meal_plans, cook_history, exported_at }`,
  but the 23-00 red-stub test asserts `body.toHaveProperty('pantry')`.
- **Fix:** Shipped with `pantry` as the key (matches the test). The client
  screen only passes the raw text through to the file system, so either
  name works there; the test is the concrete contract.
- **Files modified:** `packages/server/src/services/accountExport.ts` +
  its `accountExport.test.ts`
- **Commit:** `0ec58ba` + `a18b0a1`

**3. [Rule 3 — Blocking] authMiddleware now sets `supabaseAdmin` on context**
- **Found during:** Task 1 GREEN — re-reading the account.test.ts mock
- **Issue:** The 23-00 mock middleware sets `c.set('supabaseAdmin', ...)`, so
  the route MUST read from context (not from a direct `config/supabase.js`
  import); otherwise the `supabaseAdmin.auth.admin.deleteUser` mock never
  triggers. Original auth middleware only set `user` + `supabase`.
- **Fix:** Extended `middleware/auth.ts` to also
  `c.set('supabaseAdmin', supabaseAdmin)`. Harmless for other routes
  (they ignore it) and keeps route tests swapping a single mock client
  surface via `c.set(...)` instead of `vi.mock('../config/supabase.js', ...)`.
- **Files modified:** `packages/server/src/middleware/auth.ts`,
  `packages/server/src/routes/account.ts`
- **Commit:** `a18b0a1`

**4. [Rule 3 — Blocking] Installed expo-file-system + expo-sharing**
- **Found during:** Task 2 — writing `export.tsx`
- **Issue:** Neither package was in `apps/mobile/package.json`; plan
  `<interfaces>` block documented the API but the deps were missing.
- **Fix:** `npx expo install expo-file-system expo-sharing`. app.json got
  an `expo-sharing` plugin entry auto-registered.
- **Files modified:** `apps/mobile/package.json`, `apps/mobile/app.json`,
  `pnpm-lock.yaml`
- **Commit:** `98c0843`

**5. [Rule 3 — Blocking] expo-file-system/legacy subpath import**
- **Found during:** Task 2 — typecheck on `export.tsx`
- **Issue:** expo-file-system v19 refactored the top-level export: the v18
  `cacheDirectory` constant + `writeAsStringAsync` function + `EncodingType`
  enum are no longer on the default namespace (the new API uses `Paths.cache`
  + `File` class). Plan's code snippet assumed the v18 shape.
- **Fix:** Changed the import to `import * as FileSystem from
  'expo-file-system/legacy'`. The v18 function API is still available on
  the `/legacy` subpath.
- **Files modified:** `apps/mobile/src/app/settings/account/export.tsx`
- **Commit:** `98c0843`

**6. [Rule 3 — Blocking] Removed unused @ts-expect-error directives**
- **Found during:** Task 1 + Task 2 GREEN typecheck
- **Issue:** The 23-00 red-stub tests carried `@ts-expect-error` directives
  pointing at `../account.js` / `../DeleteAccountSheet.js` imports that
  didn't exist. Once the modules ship, those directives become unused
  (TS2578).
- **Fix:** Removed three directives across both test files and replaced the
  tuple-destructure in `DeleteAccountSheet.test.ts` with a typed
  `(authedFetch as any).mock.calls[0]` access to avoid tuple-length 0 errors.
- **Files modified:** `packages/server/src/routes/__tests__/account.test.ts`,
  `apps/mobile/src/components/settings/__tests__/DeleteAccountSheet.test.ts`
- **Commits:** `a18b0a1`, `f76ff09`

Zero Rule 1 bugs, zero Rule 2 missing-critical-functionality, zero Rule 4
architectural escalations.

## Deferred Issues

None. All scoped work for NFR-03 + NFR-04 shipped.

Out-of-band: a concurrent workflow landed commit `a2fe848 docs(23-07) legal
pages + App Store Connect asset drafts` in between our RED (`0ec58ba`) and
the `/api/v1` route prefix being used by the authedFetch call. The commit
didn't touch any file in this plan's scope; my mid-plan rebase saw it land
on HEAD and the remaining work continued on top cleanly.

## Verification

- [x] `cd packages/server && pnpm test --run src/services/__tests__/accountExport.test.ts src/routes/__tests__/account.test.ts` → 16/16 green
- [x] `cd apps/mobile && pnpm test --run src/components/settings/__tests__/DeleteAccountSheet.test.ts` → 5/5 green
- [x] Broader mobile settings suite: 14/14 green across 4 files
- [x] Full server test suite: 752/753 (the 1 failure is pre-existing
      `meal-plans.test.ts EMPTY_PANTRY` tracked in deferred-items.md, verified
      reproducing on HEAD before my changes)
- [x] Typecheck clean on all 5 new files + 4 modified files; the 32 mobile
      + 118 server pre-existing TS errors (mostly Hono `c.get<never>` generic
      weakness + red-stub `@ts-expect-error`) are unchanged

## Requirements Completed

- **NFR-03** — Export account data. GET `/account/export` returns a valid
  JSON body with profile, pantry, recipes, meal_plans (with nested entries),
  cook_history, and `exported_at`. Mobile screen writes it to cache + opens
  the iOS share sheet for Save to Files / Mail / AirDrop.
- **NFR-04** — Delete account. Two-step confirm (type DELETE + red button)
  → POST `/account/delete` → audit row into `account_deletions` (30-day
  retention) → `supabaseAdmin.auth.admin.deleteUser` cascades across FK
  tables → client signed out → `/(auth)/login`.

## Self-Check: PASSED

All 5 created files present on disk. SUMMARY.md present. All 4 commits
(`0ec58ba` RED, `a18b0a1` server GREEN, `f76ff09` sheet, `98c0843` screens)
present in git log.
