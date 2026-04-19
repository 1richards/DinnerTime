---
phase: 21-pantry-intelligence-smarter-dedup-presentation-categorization-user-defined-scan-rules
plan: 02
subsystem: api
tags: [typescript, supabase, vitest, hono, canonical-resolver, rule-evaluator, suggestion-aggregator, candidate-promotion, tdd]

# Dependency graph
requires:
  - phase: 21-01
    provides: Migrations 00016-00019 (user_staples, user_location_rules, suggested_rules, canonical_scan_counts + promote_candidate_canonicals RPC)
  - phase: 24-03
    provides: canonicalResolver.resolveCanonicalBatch (consumed by suggestionAggregator W3 for canonical pre-resolution)
  - phase: 24-04
    provides: ScanResult shape + FieldConfidence (ruleEvaluator applyLocationRules input type)
  - phase: 18-02
    provides: item_override_events table (aggregator read source)

provides:
  - ruleEvaluator.applyLocationRules (pure function, first-match-wins by precedence ASC)
  - ruleEvaluator.loadUserLocationRules (Supabase fetch helper for user_location_rules)
  - suggestionAggregator.aggregateLocationSuggestions (fire-and-forget aggregator with canonical pre-resolved in payload)
  - canonicalPromoter.promoteCandidateCanonicals (thin RPC wrapper)
  - canonicalPromoter.incrementScanCounts (sequential read-modify-write batch counter)

affects:
  - 21-03 (routes + reconcileItems integration — imports all three services)
  - 21-06 (Maestro UAT — smoke covers the rules pipeline end-to-end)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defensive sort on pure rule evaluators — applyLocationRules re-sorts locationRules ASC by precedence despite loadUserLocationRules already doing so at the fetch layer; keeps the function correct regardless of how callers construct UserRules (unit tests, in-memory caches, future route composition)"
    - "Fire-and-forget aggregator contract — try/catch wraps the whole aggregator body; scan-confirm callers can `void aggregateLocationSuggestions(...)` without risk of telemetry errors propagating into the scan path"
    - "W3 canonical pre-resolution — suggestionAggregator resolves item_name → canonicalId at aggregation time and persists the ID in payload JSONB, eliminating accept-path drift hazard (21-03 reads payload.canonical_ingredient_id with a canonical.status === 'active' guard)"
    - "Un-resolvable-name defensive skip — aggregator filters out groups whose item_name resolveMap entry is undefined; prevents orphan suggestions 21-03 cannot accept (belt-and-braces, canonicalResolver auto-creates candidates in practice)"
    - "Sequential read-modify-write counter — incrementScanCounts uses per-id SELECT scan_count then UPSERT scan_count+1. Acceptable for private-beta scale (single-digit canonicals/scan, no concurrent-scan contention); documented path to atomic-RPC follow-up if races show up"

key-files:
  created:
    - packages/server/src/services/ruleEvaluator.ts
    - packages/server/src/services/suggestionAggregator.ts
    - packages/server/src/services/canonicalPromoter.ts
    - packages/server/src/services/__tests__/ruleEvaluator.test.ts
    - packages/server/src/services/__tests__/suggestionAggregator.test.ts
    - packages/server/src/services/__tests__/canonicalPromoter.test.ts
  modified: []

key-decisions:
  - "applyLocationRules preserves referential identity on pass-through — returns the original scanItem object (not a shallow spread) when rules are empty or no rule matches; callers can `===` compare to detect a no-op"
  - "applyLocationRules defensively re-sorts locationRules ASC by precedence even though loadUserLocationRules already orders ASC — pure function contract shouldn't trust caller-supplied ordering"
  - "Name-mapping rules are explicitly NOT implemented here — documented with a module-level NOTE comment; they live in ingredient_aliases (source='user_rule') and are applied transparently by canonicalResolver Stage 2 alias match"
  - "aggregateLocationSuggestions filters to qualifying groups BEFORE calling resolveCanonicalBatch — saves an unnecessary canonical lookup for below-threshold groups (test confirms yogurt at count=1 is never passed to resolveCanonicalBatch)"
  - "Qualifying groups whose item_name cannot be resolved via resolveCanonicalBatch are SKIPPED (no upsert); prevents 21-03 /suggestions/:id/accept from ever seeing a payload without canonical_ingredient_id (W3 defensive skip)"
  - "incrementScanCounts uses sequential read+upsert (per-id SELECT scan_count, then UPSERT scan_count+1) — private-beta-acceptable; atomic-RPC follow-up noted in module header when concurrency races appear"
  - "All three services swallow errors via try/catch + console.warn — scan-confirm never blocked by telemetry failures (aggregator + promoter are fire-and-forget by contract; evaluator is pure and cannot throw)"

patterns-established:
  - "Pure-function pattern for rule evaluation — applyLocationRules takes (match, scanItem, rules) and returns a ScanResult; zero I/O, testable without any mocks. Matches the ruleEvaluator separation CONTEXT specified (evaluator owns location only, name-mapping stays in ingredient_aliases)"
  - "Hoisted vi.mock for canonicalResolver dependency — suggestionAggregator.test.ts uses vi.hoisted(() => vi.fn()) paired with vi.mock('../canonicalResolver.js') so the test controls resolveCanonicalBatch return values per case. Pattern re-usable in 21-03 tests that mock 21-02 services"
  - "Thenable-chain supabase mock extension — extends the Phase 24-03 canonicalResolver.test.ts pattern to cover three additional supabase shapes: (a) .eq().order() chains, (b) .eq().gte() chains, (c) .eq().maybeSingle() single-row reads. All three return thenables that resolve to { data, error } tuples"
  - "Capture-array assertion pattern — mocks push { row, opts } into a shared array for post-hoc assertions on upsert payloads, on-conflict keys, and per-id scan_count values. Reusable for 21-03 route tests that need to verify composed service call shapes"

requirements-completed: ["Pantry UX improvement (post-v1)"]

# Metrics
duration: 7min
completed: 2026-04-19
---

# Phase 21 Plan 02: Pantry Intelligence Services Summary

**Three deterministic server services (ruleEvaluator + suggestionAggregator + canonicalPromoter) authored TDD-first with 23/23 vitest cases GREEN; W3 revision lands canonical_ingredient_id pre-resolved in suggested_rules.payload so 21-03's accept path skips re-resolution**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-19T19:06:03Z
- **Completed:** 2026-04-19T19:13:00Z (approx)
- **Tasks:** 3 (all TDD RED+GREEN)
- **Files modified:** 6 (3 service + 3 test)

## Accomplishments

- **ruleEvaluator.ts + loadUserLocationRules** — pure function evaluates user_location_rules against a canonical-resolved ScanResult with first-match-wins ASC precedence; defensive sort guards against caller-supplied unordered rule arrays; pass-through preserves referential identity so `===` detects no-ops. Supabase fetch helper returns an empty UserRules on error, never throwing into the scan path. 6/6 vitest cases GREEN.
- **suggestionAggregator.aggregateLocationSuggestions** — reads item_override_events (Phase 18) filtered to the 30-day window via `.gte(created_at, since)`, groups by (item_name, user_location), filters to groups at threshold ≥2, resolves each qualifying group's canonical via `resolveCanonicalBatch` (W3 pre-resolution), and upserts suggested_rules with `payload.canonical_ingredient_id` baked in. Un-resolvable names are skipped defensively. Entire body wrapped in try/catch so scan-confirm callers safely `void` it. 8/8 vitest cases GREEN including the W3 skip test.
- **canonicalPromoter.promoteCandidateCanonicals + incrementScanCounts** — thin RPC wrapper returns the promoted-count integer (0 on error) and a sequential per-id read-modify-write counter-incrementer. Both swallow errors; incrementScanCounts no-ops on empty input. Concurrency trade-off documented in module header (sequential path is private-beta-acceptable; atomic-RPC follow-up noted). 9/9 vitest cases GREEN.
- **Full suite clean on new files** — `npx tsc --noEmit` reports zero errors in the three new files (pre-existing tsc failures in suggestions.test.ts + recipeParser.ts are out of scope per SCOPE BOUNDARY rule). Pre-existing vitest failures (pantry.test.ts live-DB integration + taskRouting.test.ts env-var loading) are also out of scope; confirmed via `grep` that pantry.ts does not import any of the three new services.

## Task Commits

Each task shipped RED+GREEN in a single commit (TDD tests and implementation co-authored within one task scope, tests authored first per plan `tdd="true"`):

1. **Task 1: TDD ruleEvaluator.ts** — `2e5fee1` (feat: first-match-wins precedence, loadUserLocationRules helper, name-mapping exclusion documented)
2. **Task 2: TDD suggestionAggregator.ts** — `b69992b` (feat: 30-day window aggregation with W3 canonical pre-resolved payload + fire-and-forget safety)
3. **Task 3: TDD canonicalPromoter.ts** — `98399cc` (feat: RPC wrapper + sequential read-modify-write scan-count UPSERT)

Plan metadata commit appended after SUMMARY creation.

## Files Created/Modified

- `packages/server/src/services/ruleEvaluator.ts` — Pure applyLocationRules + loadUserLocationRules; 77 lines
- `packages/server/src/services/suggestionAggregator.ts` — aggregateLocationSuggestions with W3 canonical pre-resolved payload; 125 lines
- `packages/server/src/services/canonicalPromoter.ts` — promoteCandidateCanonicals RPC wrapper + incrementScanCounts batch counter; 97 lines
- `packages/server/src/services/__tests__/ruleEvaluator.test.ts` — 6 vitest cases (5 plan + error-path bonus)
- `packages/server/src/services/__tests__/suggestionAggregator.test.ts` — 8 vitest cases (6 plan + window-doc + resolver-throw bonus)
- `packages/server/src/services/__tests__/canonicalPromoter.test.ts` — 9 vitest cases (5 plan + throw-throw/custom-threshold/first-scan-insert bonus)

## Decisions Made

- **applyLocationRules preserves referential identity on pass-through** — returns the original scanItem object (not a shallow spread) when rules are empty or no rule matches; callers can `===` compare to detect a no-op. Chosen because 21-03 reconcileItems can short-circuit source_location derivation when the evaluator reports a no-op.
- **applyLocationRules defensively re-sorts locationRules ASC by precedence** — even though loadUserLocationRules already orders ASC, a pure function's contract shouldn't trust caller-supplied ordering. Cheap for typical N ≤ 20 rule counts.
- **Name-mapping rules are explicitly NOT implemented in ruleEvaluator** — documented with a module-level NOTE. Per CONTEXT.md §Rules UI, name-mapping rules are persisted as `ingredient_aliases(source='user_rule')` rows and applied transparently by canonicalResolver Stage 2 (exact alias match). ruleEvaluator owns location rules only.
- **aggregateLocationSuggestions filters to qualifying groups BEFORE resolveCanonicalBatch** — saves one canonical lookup per below-threshold group. Test verifies yogurt at count=1 is never passed to the resolver.
- **Qualifying groups whose item_name fails to resolve are SKIPPED** — W3 defensive skip prevents 21-03's /suggestions/:id/accept from ever seeing a payload without `canonical_ingredient_id`. In practice canonicalResolver auto-creates candidates so this path is rare, but belt-and-braces.
- **incrementScanCounts ships sequential read+upsert (not an atomic RPC)** — private-beta-acceptable: single-digit canonicals per scan, no concurrent-scan contention. Module header documents the atomic-RPC follow-up path for when concurrency races show up post-launch.
- **All three services swallow errors via try/catch + console.warn** — scan-confirm is never blocked by telemetry. applyLocationRules is pure and cannot throw; loadUserLocationRules/aggregator/promoter each wrap supabase calls defensively.

## Deviations from Plan

None - plan executed exactly as written. Test counts exceeded plan minimums (6/5, 8/6, 9/5) with additional edge-case coverage (error-path, resolver-throw, custom-threshold, first-scan-insert). All additions are tightening, not new functionality.

## Issues Encountered

- **Pre-existing vitest failures (out of scope, not regressions):**
  - `__tests__/pantry.test.ts` — "confirms items and adds them to the pantry" returns 500 "Reconciliation failed" (live-Supabase integration test; pre-dates this plan).
  - `src/ai/__tests__/taskRouting.test.ts` — env.GOOGLE_API_KEY throw expectation fails when unset (env-var loading edge case; pre-dates this plan).
  - Confirmed via `grep` that `pantry.ts` does not import ruleEvaluator, suggestionAggregator, or canonicalPromoter — neither failure is attributable to this plan's changes.
- **Pre-existing tsc failures (out of scope):** `src/services/recipeParser.ts` (source_type='ai' unassignable) and `src/services/__tests__/suggestions.test.ts` (member_type='adult'|'kid' narrowing). Zero tsc errors in any of the three new files.
- **Plan 21-01 landed between Tasks 1 and 2** — observed via `git log` during commit: `f4f7b4b feat(21-01): add Phase 21 schema` and `69ea575 test(21-01): extend migrations.test.ts` interleaved with my commits. Parallel wave execution working as designed; no action needed (21-02 depends_on=[], services use mocked Supabase).

## User Setup Required

None - no external service configuration required. Services use existing Supabase client + RPC; migrations shipped by 21-01.

## Next Phase Readiness

**21-03 (routes + reconcileItems integration):** All three services export the shapes 21-03's CONTEXT specifies:
- `ruleEvaluator.ts` → `applyLocationRules(match, scanItem, rules)` + `loadUserLocationRules(supabase, userId)` + `UserRules` + `UserLocationRule` type exports ready for import.
- `suggestionAggregator.ts` → `aggregateLocationSuggestions(supabase, userId)` safe under `void aggregateLocationSuggestions(...)` in scan-confirm. 21-03's /suggestions/:id/accept path can read `payload.canonical_ingredient_id` directly and only needs the `canonical.status === 'active'` guard.
- `canonicalPromoter.ts` → `promoteCandidateCanonicals(supabase, threshold=5)` and `incrementScanCounts(supabase, canonicalIds)` both swallow errors and are safe to invoke fire-and-forget after reconcileItems success.

**W3 revision fully realized:** suggested_rules rows written by this plan carry `payload.canonical_ingredient_id`, so 21-03's accept path never re-resolves and never lands on a different canonical than the one the user saw when the suggestion surfaced.

**No blockers for 21-03.**

## Self-Check: PASSED

Verified files and commits exist:

- FOUND: packages/server/src/services/ruleEvaluator.ts
- FOUND: packages/server/src/services/suggestionAggregator.ts
- FOUND: packages/server/src/services/canonicalPromoter.ts
- FOUND: packages/server/src/services/__tests__/ruleEvaluator.test.ts
- FOUND: packages/server/src/services/__tests__/suggestionAggregator.test.ts
- FOUND: packages/server/src/services/__tests__/canonicalPromoter.test.ts
- FOUND commit 2e5fee1 (Task 1 ruleEvaluator)
- FOUND commit b69992b (Task 2 suggestionAggregator)
- FOUND commit 98399cc (Task 3 canonicalPromoter)

---

*Phase: 21-pantry-intelligence-smarter-dedup-presentation-categorization-user-defined-scan-rules*
*Completed: 2026-04-19*
