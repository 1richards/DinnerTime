---
phase: 17-something-new-ai-powered-recipe-exploration-with-search-and-remix
plan: 02
subsystem: mobile-state
tags: [zustand, persist, asyncstorage, search-action, pure-helper, nyquist-wave-2]

# Dependency graph
requires:
  - phase: 17-something-new-ai-powered-recipe-exploration-with-search-and-remix
    provides: Wave 0 Nyquist red tests for persistence, searchRecipes action, clearHistory action, and dedupPrepend helper (9 red signals + 1 red suite → all green)
  - phase: 17-something-new-ai-powered-recipe-exploration-with-search-and-remix
    provides: 17-01 server endpoint — POST /api/v1/recipes/search (searchRecipes action dispatches here with Authorization Bearer + JSON body)
  - phase: 04-suggestions
    provides: original useSuggestionsStore shape (fetchSuggestions / clearSuggestions / setAutoFetch / autoFetch) — preserved byte-exact per D-10
provides:
  - useSuggestionsStore extended with zustand/middleware persist wrapper (key 'dinnertime-suggestions', version 1, partialize to 4 fields)
  - searchRecipes(query, {pantryOnly}) action — POSTs to /api/v1/recipes/search, populates searchResults, prepends recentQueries via dedupPrepend, handles 200/non-200/network-throw
  - clearHistory() action — resets recentQueries, searchResults, lastQuery (leaves pantryOnly + legacy state intact) per P17-06
  - dedupPrepend(query, list, max) pure helper — trim + dedupe + cap-at-max with whitespace-only no-op
  - SearchOptions interface exported from suggestionsStore
affects:
  - 17-03 (mobile screens) — /search modal's something-new branch dispatches through useSuggestionsStore.searchRecipes; kitchen segment reads searchResults + recentQueries
  - 17-04 (UAT) — Maestro flow 27 walks search → persistence → cold-launch-preserves-results path

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand persist middleware with createJSONStorage(() => AsyncStorage) — matches repo precedent (preferencesStore, recipeStore, pantryStore)"
    - "Hand-curated partialize that explicitly whitelists persisted fields (4) and excludes cross-screen signal flags (autoFetch — Pitfall 1) + transient runtime state (isLoading, error)"
    - "Pure helper extraction for list-mutation logic (dedupPrepend) — separate module instead of colocated lambda → zero-dependency unit test, no zustand/AsyncStorage instantiation needed"
    - "Byte-exact legacy preservation under persist() wrapper: existing fetchSuggestions body copied verbatim with only indentation change from wrapping"

key-files:
  created:
    - "apps/mobile/src/stores/dedupPrepend.ts"
  modified:
    - "apps/mobile/src/stores/suggestionsStore.ts"
    - "apps/mobile/src/stores/__tests__/suggestionsStore.test.ts"
    - "apps/mobile/src/stores/__tests__/suggestionsStore.persist.test.ts"
    - "apps/mobile/src/stores/__tests__/dedupPrepend.test.ts"

key-decisions:
  - "Persist storage key locked at 'dinnertime-suggestions' per Wave 0 test contract — avoids collision with 'dinnertime-recipes' / 'dinnertime-pantry' / 'dinnertime-preferences'"
  - "Partialize whitelist (not exclude-list): safer — any new fields added later are NOT auto-persisted unless explicitly added, preventing accidental rehydration of transient state"
  - "searchRecipes sets lastQuery + pantryOnly BEFORE the fetch call (in the opening `set`) so in-flight UI can read them immediately — subsequent set({ searchResults, recentQueries, ... }) updates the success branch; failure branch leaves lastQuery/pantryOnly in place (intentional — user can retry the same search)"
  - "searchRecipes uses catch on the 4xx body parse (.catch(() => ({}))) — if the server returns an HTML error page or malformed JSON, error defaults to 'Search failed' instead of throwing an unhandled parse error"
  - "dedupPrepend placed in apps/mobile/src/stores/dedupPrepend.ts (sibling to suggestionsStore) rather than apps/mobile/src/lib/ — keeps the module discoverable from the store that's its only caller"

patterns-established:
  - "Wave 0 → Wave 2 @ts-expect-error cleanup: when fields/actions materialize, the Phase 17 Wave 0 annotations get removed as part of the same commit that adds them. TypeScript flags stale annotations, forming a Nyquist-style red gate for future refactors"
  - "First-persist-version convention: start at version: 1 (not 0) — mirrors preferencesStore, recipeStore, pantryStore. No migration needed because no existing users have the 'dinnertime-suggestions' key"

requirements-completed: [P17-02, P17-03, P17-06]

# Metrics
duration: 3 min
completed: 2026-04-21
---

# Phase 17 Plan 02: Mobile suggestionsStore Persist + Search Action Summary

**Zustand persist wrapper + searchRecipes/clearHistory actions + dedupPrepend pure helper — flips 11 Wave 0 red signals green (9 active tests + 1 import-error suite of 6 cases + 1 partialize contract) with D-10 byte-exact preservation of the autoFetch path.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-21T02:58:39Z
- **Completed:** 2026-04-21T03:02:01Z
- **Tasks:** 2
- **Files created/modified:** 1 created + 4 modified (2 source, 3 test)

## Accomplishments

- **Task 1 (dedupPrepend pure helper):** 17-line module with trim + dedupe + cap-at-max semantics. Whitespace-only queries are no-ops; trimmed queries match untrimmed existing entries. 6 cases in `dedupPrepend.test.ts` green.
- **Task 2 (persist + actions):** useSuggestionsStore now wrapped in `zustand/middleware` persist under key `'dinnertime-suggestions'` version 1. Partialize whitelists `searchResults, recentQueries, lastQuery, pantryOnly` (4 fields). searchRecipes POSTs to `/api/v1/recipes/search` with Bearer token + JSON body `{query, pantryOnly}`; success branch populates searchResults + prepends recentQueries via dedupPrepend; failure branches set error + isLoading=false. clearHistory resets exactly 3 fields.
- **D-10 lock verified:** `fetchSuggestions` body is byte-exact identical (same URL, same headers, same response handling, same set() calls). `clearSuggestions`, `setAutoFetch`, `autoFetch` initial value all preserved. `autoFetch` deliberately excluded from persist partialize (Pitfall 1) — setter still mutates in-memory for post-scan flow, but cold launches don't rehydrate it.
- **Test delta:** 9 Wave 0 red → green on mobile. Full store test outcome: `suggestionsStore.test.ts` 10/10 green (4 legacy fetchSuggestions + 1 legacy clearSuggestions + 5 Phase 17). `suggestionsStore.persist.test.ts` 4/4 green. `dedupPrepend.test.ts` 6/6 green. TypeScript `--noEmit` clean.
- **Zero regressions:** Pre-existing mobile failures (auth-store, progressionStore, shoppingStore × 2) unchanged at the same count. No legacy tests broken by the persist wrapper.

## Task Commits

1. **Task 1 (dedupPrepend helper):** `37c310e` — `feat(17-02): add dedupPrepend pure helper for recent-query list`
2. **Task 2 (persist + searchRecipes/clearHistory):** `da697d1` — `feat(17-02): persist suggestionsStore + add searchRecipes/clearHistory`

_Plan metadata commit follows this SUMMARY._

## Files Changed

| File | Type | Lines | Purpose |
|------|------|-------|---------|
| `apps/mobile/src/stores/dedupPrepend.ts` | CREATED | 17 | Pure helper: trim + dedupe + cap-at-max |
| `apps/mobile/src/stores/suggestionsStore.ts` | MODIFIED | 188 (was 90) | Added persist wrapper + SearchOptions interface + searchRecipes + clearHistory + 4 Phase 17 initial-state fields |
| `apps/mobile/src/stores/__tests__/dedupPrepend.test.ts` | MODIFIED | 65 | Removed `@ts-expect-error` on import line (module now exists) |
| `apps/mobile/src/stores/__tests__/suggestionsStore.test.ts` | MODIFIED | 284 | Removed 11 `@ts-expect-error` annotations; materialized the Phase 17 clearHistory test's `searchResults` stub as a full ParsedRecipe to satisfy TS |
| `apps/mobile/src/stores/__tests__/suggestionsStore.persist.test.ts` | MODIFIED | 138 | Removed 6 `@ts-expect-error` annotations; added `ParsedRecipe` type import; used `as unknown as ParsedRecipe[]` cast to preserve Wave 0's minimal-stub payload assertion |

**suggestionsStore.ts diff magnitude:** +175 / -84 = +91 net. Primary drivers:
- `persist(...)` wrapping adds 4 lines of middleware config (name, storage, partialize, version)
- New `searchRecipes` implementation: ~45 lines (mirrors `fetchSuggestions` shape — opening set, try/fetch, non-ok branch, success branch, catch branch)
- New `clearHistory` implementation: ~7 lines
- New type additions: `SearchOptions` interface + 6 new SuggestionsState fields/actions
- Initial-state expansion: 4 new default values (`searchResults`, `recentQueries`, `lastQuery`, `pantryOnly`)

## D-10 Byte-Exact Verification

Confirmed via `git diff HEAD~2..HEAD apps/mobile/src/stores/suggestionsStore.ts`:

**Unchanged bodies (only indentation shifted by persist wrapper):**
- `fetchSuggestions`: identical URL (`/api/v1/ai/suggest`), identical headers (`Authorization: Bearer`, `Content-Type: application/json`), identical response handling (`result.suggestions`, `result.pantry_item_count`, `result.generated_at`), identical error strings, identical set() call shapes.
- `clearSuggestions`: identical 4-field reset (`suggestions: []`, `error: null`, `pantryItemCount: 0`, `generatedAt: null`).
- `setAutoFetch`: identical single-field setter.

**Initial-state preservation:**
- `suggestions: []` — identical
- `isLoading: false` — identical
- `error: null` — identical
- `pantryItemCount: 0` — identical
- `generatedAt: null` — identical
- `autoFetch: false` — identical

**Partialize excludes `autoFetch`:** verified in persist test P17-02 Pitfall 1 (parsed.state.autoFetch is undefined after setState({ autoFetch: true })). Setter still works in memory — `setAutoFetch` mutates runtime state, which is what the Phase 4 post-scan flow expects.

## Test Counts (apps/mobile — store layer)

**Before this plan (Wave 0 baseline):**
- `suggestionsStore.test.ts`: 5 green (legacy) / 5 red (Phase 17 describe block)
- `suggestionsStore.persist.test.ts`: 0 green / 4 red
- `dedupPrepend.test.ts`: 0 green / 6 red (suite fails at import)
- **Total Phase 17 store red: 15 signals (9 active + 6 queued at import)**

**After this plan:**
- `suggestionsStore.test.ts`: **10 green / 0 red** ✅ (5 legacy preserved + 5 Phase 17 flipped)
- `suggestionsStore.persist.test.ts`: **4 green / 0 red** ✅
- `dedupPrepend.test.ts`: **6 green / 0 red** ✅
- **Phase 17 delta: 15 red → 15 green. Zero regressions.**

**Full mobile suite:** 429 green / 15 red. The 15 failures break down as:
- 4 pre-existing baseline (auth-store onboarding, progressionStore fetchVariations, shoppingStore generateList, shoppingStore fetchCurrent) — unchanged from Wave 0 SUMMARY line 83.
- 11 Wave 0 source-contract tests for Plan 03 (search × 4, kitchen × 5, discover × 2) — these are Wave 0 reds intentionally deferred to Plan 17-03 (mobile screens).

No failures caused by this plan. All legacy green tests remain green.

## TypeScript Verification

`pnpm tsc --noEmit` exits 0 (clean). No new TypeScript errors introduced by the persist wrapper or the new actions.

**Wave 0 → Wave 2 @ts-expect-error cleanup:** Removed 17 stale annotations across 3 test files (6 in `persist.test.ts`, 10 in `suggestionsStore.test.ts` Phase 17 describe, 1 in `dedupPrepend.test.ts`). If any remained stale, TypeScript would flag them — zero compile errors confirms the cleanup is complete.

## Decisions Made

- **Persist wrapper applied to the single `create<State>()(persist(...))` form** (not `create<State>()(persist((set, get) => ...))`) — the store only uses `set` in its actions, never `get`. Simpler signature; matches `preferencesStore.ts` precedent for action sets that don't reference other fields.
- **dedupPrepend reads from `s.recentQueries` inside `searchRecipes` via `set((s) => ({ ... }))` functional form** — required because dedupPrepend needs the latest list, and the opening `set({ isLoading: true, ... })` made lastQuery mutation immediate. Two set calls is intentional: first sets loading state, second updates on success.
- **4xx body parse protected with `.catch(() => ({}))`** — defensive. If the server returns a non-JSON 4xx response (HTML error page from a proxy, for example), the error message falls back to `'Search failed'` instead of throwing an unhandled SyntaxError.
- **`persist.test.ts` assertion preserved as `toEqual([{ title: 'Carbonara' }])`** — the Wave 0 test locked the minimal-stub shape; I cast the test input to `ParsedRecipe[]` rather than expanding the stub to a full recipe, keeping the locked assertion byte-exact. The assertion tests persistence wiring, not object shape — filling in every ParsedRecipe field would dilute its purpose.
- **`clearHistory` resets 3 fields (not 4):** Does NOT touch `pantryOnly`. Rationale — clearing history is a user-initiated "start over" gesture; the pantry-only preference is a sticky setting the user chose once and would be annoyed to reset unexpectedly. The test `P17-06: clearHistory resets recentQueries, searchResults, and lastQuery` pins exactly 3 fields; pantryOnly is intentionally excluded.
- **fetchSuggestions auth-failure test path (`mockSupabase.auth.getSession.mockResolvedValueOnce(...)` with null session) passes unchanged** — confirming `getAuthToken` still throws `'Not authenticated'` which the outer try/catch maps to `set({ error: 'Not authenticated', isLoading: false })`. D-10 auth path byte-exact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Wave 0 persist test's minimal-stub object shape needed a TypeScript cast**

- **Found during:** Task 2 (after wrapping the store in persist with strictly-typed `searchResults: ParsedRecipe[]`)
- **Issue:** The Wave 0 test `P17-02: persists searchResults, recentQueries, lastQuery, pantryOnly` sets state with `searchResults: [{ title: 'Carbonara' }]` (a partial ParsedRecipe) and asserts the persisted JSON equals that exact minimal shape. Before Plan 17-02, `@ts-expect-error` bypassed the type check. Now that `searchResults` is strictly-typed `ParsedRecipe[]`, the partial object fails type-check.
- **Options considered:**
  - (a) Expand the test input to a full ParsedRecipe and change the assertion to match — but this dilutes the test's purpose (pin the persist wiring, not the object shape)
  - (b) Cast the test input to `ParsedRecipe[]` via `as unknown as ParsedRecipe[]` — preserves the locked Wave 0 assertion byte-exact, zero behavior change
- **Fix (b chosen):** Added `import type { ParsedRecipe } from '../../types/recipe'` and used `[{ title: 'Carbonara' }] as unknown as ParsedRecipe[]` in the setState call. Assertion stays `toEqual([{ title: 'Carbonara' }])`.
- **Files modified:** `apps/mobile/src/stores/__tests__/suggestionsStore.persist.test.ts`
- **Verification:** All 4 persist tests green. The Wave 0 contract remains locked (persist payload is EXACTLY what was set into state — not expanded or normalized by the persist layer).
- **Committed in:** `da697d1` (Task 2 commit)

**2. [Rule 1 — Type-correctness] Wave 0 clearHistory test's `searchResults: [{ title: 'X' }]` stub needed full ParsedRecipe expansion**

- **Found during:** Task 2 (same root cause as Deviation 1, different test)
- **Issue:** `P17-06: clearHistory resets recentQueries, searchResults, and lastQuery` seeded state with `searchResults: [{ title: 'X' }]` via `@ts-expect-error`. Now that the field is strictly-typed, the partial object fails type-check. Unlike Deviation 1, this test's assertion is `toEqual([])` — the initial object shape is irrelevant (it gets cleared). So I chose option (a) for this test: expand to a full ParsedRecipe.
- **Fix:** Expanded the stub to a full ParsedRecipe with `source_type: 'ai'` and nullable fields set to `null`. Assertion `expect(state.searchResults).toEqual([])` unchanged.
- **Files modified:** `apps/mobile/src/stores/__tests__/suggestionsStore.test.ts`
- **Verification:** `P17-06: clearHistory resets recentQueries, searchResults, and lastQuery` passes.
- **Committed in:** `da697d1` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both type-correctness cleanups post-Wave-0)
**Impact on plan:** Plan instructed "remove the Wave 0 `@ts-expect-error` annotations that Plan 00 added on fields/functions that now exist." The plan did not anticipate that removing the annotations would require downstream edits to test inputs whose minimal-object shapes no longer type-checked. Both deviations preserve Wave 0 contract semantics — Deviation 1 via cast (keeps locked assertion), Deviation 2 via full-shape expansion (assertion unaffected). No scope creep.

## Issues Encountered

- **Pre-existing baseline failures unchanged:** 4 mobile test failures (auth-store onboarding, progressionStore, shoppingStore ×2) are pre-existing per Wave 0 SUMMARY line 83. Deferred per scope-boundary rule. None touched by this plan.
- **Wave 0 source-contract tests for Plan 03 still red:** 11 failures across `search.test.ts`, `kitchen.test.ts`, `discover.test.ts` are Phase 17 Wave 0 cases intentionally queued for Plan 17-03 (mobile screens). Expected per Wave 0 SUMMARY.

## User Setup Required

None — no external service configuration, no new dependencies, no env-var changes. `zustand/middleware` + `@react-native-async-storage/async-storage` were already in `package.json` (used by `preferencesStore`, `recipeStore`, `pantryStore`).

## Next Phase Readiness

- **Plan 17-03 (mobile screens) unblocked:** The `/search` modal's `context=something-new` branch can now dispatch `useSuggestionsStore.getState().searchRecipes(query, {pantryOnly})` and land results in a persisted store that survives cold launches. `kitchen.tsx` can read `searchResults`, `recentQueries`, `lastQuery`, `pantryOnly` from the store and render the Something New segment. `clearHistory` is wired for the ellipsis-menu "Clear History" action.
- **Plan 17-04 (UAT) unblocked:** Maestro flow 27 can exercise the full search → results → cold-launch-persists path against real state.
- **Blockers/concerns:** None. All Phase 17 Wave 0 store-layer reds are green. D-10 byte-exact preservation verified. TypeScript clean.

---

## Self-Check: PASSED

**Files verified on disk:**
- FOUND: `apps/mobile/src/stores/dedupPrepend.ts` (17 lines, exports `dedupPrepend`)
- FOUND: `apps/mobile/src/stores/suggestionsStore.ts` (188 lines, contains `persist`, `searchRecipes`, `clearHistory`, `dedupPrepend` import)
- FOUND: `apps/mobile/src/stores/__tests__/dedupPrepend.test.ts` (no `@ts-expect-error` remaining)
- FOUND: `apps/mobile/src/stores/__tests__/suggestionsStore.test.ts` (no `@ts-expect-error` in Phase 17 describe block)
- FOUND: `apps/mobile/src/stores/__tests__/suggestionsStore.persist.test.ts` (no `@ts-expect-error` remaining)

**Commits verified via `git log`:**
- FOUND: `37c310e` — Task 1 (dedupPrepend helper)
- FOUND: `da697d1` — Task 2 (persist + searchRecipes + clearHistory)

**Test outcomes verified:**
- FOUND: `dedupPrepend.test.ts` 6/6 green
- FOUND: `suggestionsStore.persist.test.ts` 4/4 green
- FOUND: `suggestionsStore.test.ts` 10/10 green (5 legacy + 5 Phase 17)
- FOUND: TypeScript `pnpm tsc --noEmit` exit code 0

*Phase: 17-something-new-ai-powered-recipe-exploration-with-search-and-remix*
*Completed: 2026-04-21*
