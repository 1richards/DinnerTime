---
phase: 23-settings-auth-and-non-functional-requirements
plan: 07
subsystem: security
tags: [deep-link-allowlist, ats, https-only, pii-hygiene, app-store-connect, privacy-policy, terms-of-service, sentry-breadcrumbs]

# Dependency graph
requires:
  - phase: 23-00
    provides: deepLinkAllowlist.test.ts red stub (Wave-0 scaffolding), ATS infoPlist block with empty NSExceptionDomains
  - phase: 23-04
    provides: Bearer-token authedFetch (no app-level tokens stored outside Supabase LargeSecureStore)
  - phase: 23-06
    provides: sentry.ts wrapper with beforeSend PII stripping + captureBreadcrumb helper
provides:
  - isDeepLinkAllowed(url) runtime gate covering dinnertime:// custom scheme + https:// universal links with path-traversal guard and silent breadcrumb-logged rejection
  - _layout.tsx Linking subscription (addEventListener + getInitialURL) consulting allowlist
  - SECURITY.md audit trail for NFR-22..NFR-25 invariants
  - PRIVACY.md + TERMS.md placeholder legal text (source of truth for hosted pages at https://dinnertime.app/{privacy,terms})
  - .planning/app-store/{privacy-manifest.json, description.md, keywords.txt, screenshots-shotlist.md} — all four App Store Connect form-filling references pre-drafted
affects: [Phase 25 launch prep, Phase 24]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy-require for RN-native-bridge modules in library code so vitest-node unit tests pass without per-test mocks"
    - "Allowlist-as-regex-tuple with anchored prefix regexes + explicit path-traversal guard"
    - "Silent breadcrumb on security rejection (never user-visible error, always Sentry-visible context)"
    - "Repo-committed PRIVACY.md + TERMS.md as source of truth, hosted pages published out-of-band"
    - "Per-NFR SECURITY.md with written invariants + grep contracts so future regressions get caught in review"

key-files:
  created:
    - apps/mobile/src/lib/deepLinkAllowlist.ts
    - apps/mobile/SECURITY.md
    - apps/mobile/PRIVACY.md
    - apps/mobile/TERMS.md
    - .planning/app-store/privacy-manifest.json
    - .planning/app-store/description.md
    - .planning/app-store/keywords.txt
    - .planning/app-store/screenshots-shotlist.md
  modified:
    - apps/mobile/src/app/_layout.tsx
    - apps/mobile/src/app/onboarding/index.tsx
    - apps/mobile/src/cooking/sse-smoke.ts
    - apps/mobile/src/lib/__tests__/deepLinkAllowlist.test.ts

key-decisions:
  - "Deep-link allowlist stored as readonly RegExp[] (tuple of anchored prefix regexes) rather than string-prefix array — lets us reject /recipes/../admin/secrets via explicit `path.includes('..')` guard before regex match, and still satisfies the test assertion `Array.isArray(ALLOWED_DEEP_LINK_PATHS)`."
  - "captureBreadcrumb imported lazily via require() inside a try/catch rather than ESM import at top of deepLinkAllowlist.ts — @sentry/react-native pulls in a native bridge that vitest-node cannot resolve, and none of the red-stub test cases cover breadcrumb behaviour. Lazy-require keeps the production code path identical while making the module unit-testable without per-test mocks."
  - "LegalSection component NOT created — plan's Task 2 action block explicitly called this consolidation out. AboutSection shipped in 23-01 already renders Privacy Policy + Terms of Service + Support rows wired to WebBrowser.openBrowserAsync(https://dinnertime.app/{privacy,terms}) + mailto:support@dinnertime.app. Adding a second LegalSection would duplicate UX."
  - "HTTPS-only invariant documented in SECURITY.md rather than via a JSON comment in app.json. Expo's JSON parser tolerates extra keys but we avoid adding them to keep the plugin graph noise-free; SECURITY.md is now the written source of truth for the ATS policy."
  - "All console.log calls in apps/mobile/src wrapped in `if (__DEV__)` rather than removed. Onboarding + sse-smoke dev traces are still useful when iterating — they just shouldn't ship in the production bundle. `_layout.tsx` mount log kept for the same reason."
  - "sse-smoke.ts (a manual one-shot dev spike script) logs wrapped in `__DEV__` for defensive hygiene even though the file is never invoked in a production build — the grep contract enforces a global invariant that reviewers can audit line-by-line."

patterns-established:
  - "Pattern: Lazy-require Sentry from library modules — `require('./sentry')` inside try/catch in runtime helpers lets us depend on Sentry at runtime without pulling the native bridge into vitest-node module graphs."
  - "Pattern: Path-traversal guard distinct from allowlist regex — always `path.includes('..')` → reject before any prefix-match, because a regex like `/^\\/recipes\\//` would pass `/recipes/../admin`."
  - "Pattern: SECURITY.md next to app.json documents the ATS invariants + NFR grep contracts. Any future PR touching app.json or adding a console.log must update SECURITY.md or explain why it's still compliant."

requirements-completed:
  - NFR-22
  - NFR-23
  - NFR-24
  - NFR-25
  - NFR-26
  - NFR-27
  - NFR-28
  - NFR-29

# Metrics
duration: 7min
completed: 2026-04-22
---

# Phase 23 Plan 23-07: App Store Readiness + Security Hardening Summary

**Deep-link allowlist with path-traversal guard + PII-hygiene sweep + SECURITY.md audit trail + legal page drafts + four App Store Connect form-filling references pre-populated for Phase 25 launch prep.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-22T09:49:56Z
- **Completed:** 2026-04-22T09:57:25Z
- **Tasks:** 2 implemented + 1 checkpoint deferred (per AUTO_MODE_OVERRIDE)
- **Files created:** 8 (1 module + 1 security audit + 2 legal + 4 app-store drafts)
- **Files modified:** 4

## Accomplishments

- **Flipped 1 red stub green.** `deepLinkAllowlist.test.ts` — 10/10 cases pass covering dinnertime:// scheme variants, https:// universal links, query-string normalization, path-traversal rejection, javascript: URI rejection, empty-string rejection. Removed the now-unused `@ts-expect-error` directive in the test file; tsc clean.
- **Runtime gate live.** `_layout.tsx` subscribes to `Linking.addEventListener('url')` and `Linking.getInitialURL()` on mount; every incoming URL is consulted against `isDeepLinkAllowed` before handoff to expo-router. Rejected URLs are dropped silently with a Sentry breadcrumb (never a user-visible error).
- **PII hygiene sweep completed.** All 14 unguarded `console.log` calls in `apps/mobile/src` wrapped in `if (__DEV__)`: `onboarding/index.tsx` (user.id + full supabase update payload including display_name), `_layout.tsx` (mount log), `cooking/sse-smoke.ts` (6 log sites in a manual dev-spike script). Grep contract in SECURITY.md enforces the invariant for future PRs.
- **HTTPS-only invariant audited.** `app.json`'s `ios.infoPlist.NSAppTransportSecurity` lacks `NSAllowsArbitraryLoads` (default `false`), has `NSAllowsLocalNetworking: true` (Metro dev bundler on localhost), and empty `NSExceptionDomains`. Written up in `SECURITY.md` as NFR-23 invariant.
- **Keychain audit confirmed.** `apps/mobile/src/lib/supabase.ts` uses `LargeSecureStore` → `expo-secure-store` for auth tokens. No other sensitive tokens exist in the app (Anthropic/Google keys live in backend `.env`, Instacart uses anonymous links, Sentry DSN is public by design). Written up in SECURITY.md as NFR-22.
- **Legal placeholder docs drafted.** `PRIVACY.md` + `TERMS.md` in `apps/mobile/` reflect actual data flows (email, photos, recipes, cook history, user ID; Supabase, Anthropic, Google, Instacart, Sentry sub-processors; export + delete rights; 30-day retention; AI output disclaimer). Both flagged as requiring legal counsel review before public launch.
- **App Store Connect prep pre-populated.** `.planning/app-store/privacy-manifest.json` (draft nutrition label answers, jq-valid), `description.md` (~1180-char listing + subtitle + promo text), `keywords.txt` (90 chars, 10 keywords), `screenshots-shotlist.md` (per-device shot list with simctl capture recipe). Everything a user needs to fill the ASC form is pre-staged.

## Task Commits

1. **Task 1: deepLinkAllowlist + Linking wiring + PII sweep + ATS audit** — `8e06494` (feat)
2. **Task 2: Legal pages + .planning/app-store/ assets** — `a2fe848` (docs)
3. **Task 3: Human-action checkpoint — App Store Connect form filling** — **DEFERRED per AUTO_MODE_OVERRIDE.** Not blocking Phase 23 closeout or Phase 24. All artifacts needed to complete the ASC work are pre-populated and committed; user finishes on wake.

**Plan metadata commit will follow in the final metadata commit below.**

## Files Created/Modified

### Created (8)

- `apps/mobile/src/lib/deepLinkAllowlist.ts` — `isDeepLinkAllowed(url)` + `ALLOWED_DEEP_LINK_PATHS` exports. Handles `dinnertime://` custom scheme (with and without leading `/`) and `https://` universal links; strips query strings + fragments; explicit path-traversal guard (`path.includes('..')`); silent Sentry breadcrumb on reject via lazy-required `./sentry`.
- `apps/mobile/SECURITY.md` — written invariants for NFR-22 (keychain), NFR-23 (HTTPS-only), NFR-24 (deep-link allowlist), NFR-25 (PII hygiene grep contract).
- `apps/mobile/PRIVACY.md` — boilerplate SaaS privacy policy (~85 lines) reflecting actual data collection and sub-processors.
- `apps/mobile/TERMS.md` — SaaS terms (~90 lines) with AI-output disclaimer, limitation of liability, governing-law placeholder.
- `.planning/app-store/privacy-manifest.json` — jq-valid draft of ASC privacy-nutrition-label answers.
- `.planning/app-store/description.md` — 1180-char App Store listing description + 30-char subtitle + 170-char promo text.
- `.planning/app-store/keywords.txt` — 90-char comma-separated keyword list.
- `.planning/app-store/screenshots-shotlist.md` — per-device shot list for iPhone 6.9" + 6.5" size classes with simctl capture recipe + post-capture checklist.

### Modified (4)

- `apps/mobile/src/app/_layout.tsx` — added `Linking` import, `isDeepLinkAllowed` import, and the `useEffect` subscribing to `Linking.addEventListener('url', ...)` + `Linking.getInitialURL()`. Wrapped `RootLayout` mount `console.log` in `if (__DEV__)`.
- `apps/mobile/src/app/onboarding/index.tsx` — wrapped 6 `console.log` calls in `handleComplete` in `if (__DEV__)` (user.id + full supabase update payload leaks).
- `apps/mobile/src/cooking/sse-smoke.ts` — wrapped all 6 `console.log` calls in `if (__DEV__)` (dev-spike script, still useful in dev client, silent in production).
- `apps/mobile/src/lib/__tests__/deepLinkAllowlist.test.ts` — removed the now-unused `@ts-expect-error` directive (module is no longer missing).

## Decisions Made

See the `key-decisions` list in the frontmatter. All six decisions were executed as written in the plan with the following clarifications:

- **Allowlist shape.** Plan action suggested RegExp[] — shipped as `readonly RegExp[]` (tuple). Test stub only asserts `Array.isArray(...)` and `.length > 0`, both hold.
- **Lazy Sentry import.** Plan didn't specify how to handle Sentry usage under vitest-node. When the top-of-file ESM import pulled in `@sentry/react-native` and broke the test with `Cannot find module '/node_modules/promise/setimmediate/es6-extensions'`, swapped to `require('./sentry')` inside `safeBreadcrumb` wrapped in try/catch. This matches the existing `sentry.ts` file header comment: "Import lazily from call sites (`await import('../lib/sentry')`) to keep the `@sentry/react-native` native bridge out of the cold-start module graph."
- **LegalSection skipped.** Plan Task 2 explicitly offered the consolidation: "if AboutSection covers this, skip creating LegalSection". AboutSection (23-01) already wires Privacy + Terms + Support rows; no duplication needed.
- **app.json audit.** Plan suggested either adding a `__comment_security` key to app.json or writing a sibling README. Chose the README path (`SECURITY.md`) to keep Expo's plugin graph noise-free — Expo's JSON parser tolerates extra keys but they may confuse `expo prebuild`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Lazy-required `./sentry` in `deepLinkAllowlist.ts`**

- **Found during:** Task 1 (GREEN) — running the `deepLinkAllowlist.test.ts` suite.
- **Issue:** The ESM `import { captureBreadcrumb } from './sentry'` at the top of `deepLinkAllowlist.ts` transitively pulled `@sentry/react-native` into the test file's module graph. vitest-node cannot resolve the RN-native bridge's `/node_modules/promise/setimmediate/es6-extensions` (the `es6-extensions` barrel ships as `.js` but Node's ESM resolver demands the extension). The test file failed to load with `Cannot find module` before any test ran.
- **Fix:** Replaced the top-of-file ESM import with a lazy `require('./sentry')` call inside `safeBreadcrumb`, wrapped in a try/catch. Production code path is identical (RN's CommonJS bridge resolves at runtime). Unit tests now load cleanly without a per-test Sentry mock.
- **Files modified:** `apps/mobile/src/lib/deepLinkAllowlist.ts`.
- **Verification:** `pnpm test --run src/lib/__tests__/deepLinkAllowlist.test.ts` → 10/10 green; broader `pnpm test --run src/lib/__tests__/ src/components/__tests__/` → 78/78 green.
- **Committed in:** `8e06494` (Task 1 commit).

**2. [Rule 3 — Blocking] Removed unused `@ts-expect-error` directive in `deepLinkAllowlist.test.ts`**

- **Found during:** Task 1 (GREEN) — running `tsc --noEmit` after the module shipped.
- **Issue:** The Wave-0 red stub had `@ts-expect-error — module does not exist yet` pinned to the `await import('../deepLinkAllowlist.js')` line. Once the module exists, the directive is unused and TS2578 fires.
- **Fix:** Removed the directive. Same pattern as 23-05's ErrorBoundary/NetworkErrorBanner stub cleanup.
- **Files modified:** `apps/mobile/src/lib/__tests__/deepLinkAllowlist.test.ts`.
- **Verification:** `pnpm exec tsc --noEmit --incremental false -p tsconfig.json` → clean on all modified files.
- **Committed in:** `8e06494` (Task 1 commit).

---

**Total deviations:** 2 auto-fixed (both Rule 3 Blocking).
**Impact on plan:** Both auto-fixes were required to get the plan's own stated verification (`pnpm test --run src/lib/__tests__/deepLinkAllowlist.test.ts`) to pass. Zero Rule 1/2/4 deviations. Zero scope creep.

## Issues Encountered

**Unstaged pre-existing server edits.** When I arrived, `packages/server/src/middleware/auth.ts` and `packages/server/src/routes/account.ts` showed as modified in `git status` — these are from plan 23-02 work in progress and are NOT my changes. I staged only the files I modified (via explicit `git add <path>`) and did not touch those. They remain unstaged.

**Grep false positive.** The single-line `grep -v '__DEV__'` filter still reports `sse-smoke.ts:71` because the `if (__DEV__)` guard is on line 70 (multi-line call). Verified line-by-line that the guard is present; no remediation needed. SECURITY.md's grep contract documents this false positive so reviewers know to expect it.

## User Setup Required

**Deferred: App Store Connect form filling.** All artifacts are pre-populated and committed. Complete out-of-band (not blocking Phase 23 closeout or Phase 24). Steps (reproduced from the plan's checkpoint block):

1. **App Store Connect → DinnerTime → App Privacy** — paste answers from `.planning/app-store/privacy-manifest.json`. Confirm "Used for Tracking" = No.
2. **App Store Connect → DinnerTime → App Information** — paste description from `.planning/app-store/description.md`; paste keywords from `.planning/app-store/keywords.txt`.
3. **Screenshots** (recommend deferring to Phase 25 prep) — follow `.planning/app-store/screenshots-shotlist.md`; use `xcrun simctl io booted screenshot` per device size.
4. **Legal page hosting** (post-Phase 25) — publish `apps/mobile/PRIVACY.md` → https://dinnertime.app/privacy, `apps/mobile/TERMS.md` → https://dinnertime.app/terms via Vercel/Netlify/GitHub Pages.

## Next Phase Readiness

- Phase 23-02 (account management backend work) and Phase 23-08 (remaining app-store readiness items) still open — this plan did not touch them.
- Phase 24 can start immediately; nothing in 23-07 blocks it.
- Phase 25 launch prep inherits the pre-populated `.planning/app-store/*` drafts — only final review + paste + screenshot capture remain.

## Self-Check: PASSED

Verified:

- `apps/mobile/src/lib/deepLinkAllowlist.ts` — FOUND
- `apps/mobile/SECURITY.md` — FOUND
- `apps/mobile/PRIVACY.md` — FOUND
- `apps/mobile/TERMS.md` — FOUND
- `.planning/app-store/privacy-manifest.json` — FOUND (jq-valid)
- `.planning/app-store/description.md` — FOUND
- `.planning/app-store/keywords.txt` — FOUND (90 chars, under 100 limit)
- `.planning/app-store/screenshots-shotlist.md` — FOUND
- Commit `8e06494` (Task 1) — FOUND in git log
- Commit `a2fe848` (Task 2) — FOUND in git log
- `deepLinkAllowlist.test.ts` — 10/10 GREEN
- `src/lib/__tests__/ + src/components/__tests__/ + src/components/settings/__tests__/` — 78/78 GREEN
- `app.json` `NSAllowsArbitraryLoads` — ABSENT (HTTPS-only enforced)
- Unguarded `console.log` grep — 1 false-positive (multi-line `if (__DEV__)` on line above), documented in SECURITY.md

---
*Phase: 23-settings-auth-and-non-functional-requirements*
*Completed: 2026-04-22*
