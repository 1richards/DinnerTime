---
phase: 21-pantry-intelligence-smarter-dedup-presentation-categorization-user-defined-scan-rules
plan: 01
subsystem: database
tags: [supabase, postgres, rls, rpc, migrations, canonical-ingredients, staples, rules]

# Dependency graph
requires:
  - phase: 24-ai-vision-and-pantry-data-model-deep-refactor
    provides: canonical_ingredients + ingredient_aliases + scan_events substrate (migrations 00011-00015)
  - phase: 18
    provides: item_override_events append-only log (migration 00010) — consumed by Phase 21 suggestion aggregator
provides:
  - user_staples table (per-user staple canonicals; PK (user_id, canonical_ingredient_id); RLS auth.uid)
  - user_location_rules table (precedence int8 for drag-reorder first-match-wins; CHECK source_location enum; full CRUD RLS)
  - suggested_rules table (composite unique (user_id, rule_type, payload) for upsert; partial index on active suggestions; full CRUD RLS)
  - canonical_scan_counts counter-table (read-all, service-role write)
  - promote_candidate_canonicals() RPC (SECURITY DEFINER, search_path-pinned, GRANT EXECUTE to authenticated + service_role)
affects:
  - 21-02 (Wave 1 services — ruleEvaluator, suggestionAggregator, canonicalPromoter)
  - 21-03 (Wave 2 routes — /rules, /staples, /suggestions)
  - 21-04/21-05/21-06 (mobile consumption)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Counter-table pattern for canonical promotion (picked over JSONB-path RPC for O(1) increment + indexed UPDATE)"
    - "Composite unique (user_id, rule_type, payload) as upsert onConflict key for suggestion aggregator"
    - "precedence int8 with (user_id, precedence asc) index for drag-reorder first-match-wins"
    - "Partial index idx_suggested_rules_user_active ON (user_id, dismissed_at) WHERE dismissed_at IS NULL for active-suggestion surface"
    - "SECURITY DEFINER + search_path=public pinning on RPCs that cross service-role-protected tables"

key-files:
  created:
    - supabase/migrations/00016_user_staples.sql
    - supabase/migrations/00017_user_location_rules.sql
    - supabase/migrations/00018_suggested_rules.sql
    - supabase/migrations/00019_canonical_scan_counts_and_promote_rpc.sql
  modified:
    - packages/server/src/__tests__/migrations.test.ts

key-decisions:
  - "Counter-table over JSONB-path RPC for candidate promotion — per RESEARCH Pattern 3 simpler recommendation"
  - "updated_at = now() preserved in RPC (verified 00011 declares updated_at on canonical_ingredients — fallback clause unnecessary)"
  - "Partial index on suggested_rules scoped to dismissed_at IS NULL (majority query shape) over full covering index"
  - "Only SELECT + INSERT + DELETE policies on user_staples (no UPDATE — staples are on/off, no in-place edits)"
  - "Full CRUD RLS on user_location_rules + suggested_rules (both support edit flows)"
  - "Payload JSONB shape intentionally schema-light in suggested_rules — future rule types can extend without migration"

patterns-established:
  - "Phase 21 migrations follow Phase 18 (00010) + Phase 24a (00011-00015) conventions: RLS ENABLE + explicit policies per operation + narrow indexes + COMMENT ON TABLE documenting consumer path"
  - "Static SQL regex contract tests added as 4 new describe blocks in the existing migrations.test.ts (no new helpers, no live-DB probe for schema-only slice)"

requirements-completed: ["Pantry UX improvement (post-v1)"]

# Metrics
duration: 3min
completed: 2026-04-19
---

# Phase 21 Plan 01: Wave 0 Schema Foundation Summary

**Four migrations (00016-00019) landing the Phase 21 schema substrate: user_staples + user_location_rules + suggested_rules + canonical_scan_counts counter-table + promote_candidate_canonicals() RPC, all on top of Phase 24a's canonical-ingredient corpus.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-19T19:05:19Z
- **Completed:** 2026-04-19T19:07:50Z
- **Tasks:** 2
- **Files modified:** 5 (4 new SQL migrations + 1 extended test file)

## Accomplishments

- Three user-scoped tables with RLS keyed on `auth.uid()`: `user_staples`, `user_location_rules`, `suggested_rules`
- Counter-table pattern (`canonical_scan_counts`) + idempotent `promote_candidate_canonicals(threshold int DEFAULT 5)` RPC with `SECURITY DEFINER` and pinned `search_path=public`
- 23 new static SQL regex contract assertions across 4 new describe blocks in `migrations.test.ts` — 68/68 GREEN
- All FKs use `ON DELETE CASCADE`; indexes scoped narrowly (user_id; user_id+precedence ASC; user_id+dismissed_at partial)
- `unique (user_id, rule_type, payload)` composite on `suggested_rules` supports the Wave 1 aggregator's upsert-on-conflict pattern
- Forward-compatible with Phase 24a canonical substrate (`status` column, `canonical_ingredient_id` FKs, `updated_at` column all verified present before authoring the RPC)

## Task Commits

1. **Task 1: Author 4 migrations (00016-00019)** — `f4f7b4b` (feat)
2. **Task 2: Extend migrations.test.ts with static contract assertions** — `69ea575` (test)

_Plan metadata commit created at end of plan (final_commit step)._

## Files Created/Modified

- `supabase/migrations/00016_user_staples.sql` — user_staples table (PK user+canonical, RLS auth.uid SELECT/INSERT/DELETE only, user_id index)
- `supabase/migrations/00017_user_location_rules.sql` — user_location_rules table (precedence int8, source_location CHECK enum, full CRUD RLS, user_id+precedence ASC index)
- `supabase/migrations/00018_suggested_rules.sql` — suggested_rules table (rule_type CHECK enum, composite unique for upsert, partial index on active, full CRUD RLS)
- `supabase/migrations/00019_canonical_scan_counts_and_promote_rpc.sql` — counter-table + RPC (service-role-write RLS, SECURITY DEFINER RPC with GRANT EXECUTE to authenticated + service_role)
- `packages/server/src/__tests__/migrations.test.ts` — added 4 new describe blocks with 23 new static SQL regex assertions; 68/68 GREEN

## Decisions Made

- **Counter-table picked over JSONB-path RPC** (RESEARCH Pattern 3 explicit recommendation). Avoids jsonpath syntax fragility and gives O(1) increment via UPSERT + cheap indexed UPDATE for the promotion sweep. Invocation cost is single-RPC per scan commit, fire-and-forget.
- **`updated_at = now()` clause retained in the RPC** — verified 00011 declares `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` on canonical_ingredients before authoring 00019. No fallback clause needed.
- **Only SELECT + INSERT + DELETE policies on `user_staples`** (no UPDATE). Staples are an on/off marker — editing a staple row is meaningless; user toggles by delete+reinsert. Aligns with 00010_item_override_events's similar append-only policy.
- **Full CRUD RLS on `user_location_rules` + `suggested_rules`** — both need user-driven edits (drag-reorder writes precedence updates; suggestions need `dismissed_at` writes and occurrence_count bumps via upsert).
- **Partial index `idx_suggested_rules_user_active`** scoped to `WHERE dismissed_at IS NULL` — the Wave 3 mobile surface only ever queries active suggestions; dismissed rows are retained only for aggregator idempotency (prevents re-suggesting identical payloads).

## Deviations from Plan

None in terms of scope or behavior. Two minor additions beyond the plan's explicit SQL snippets — both accretive, neither in conflict:

1. Added `canonical_scan_counts_write_service_role` policy (plan omitted the service-role write policy; without it the counter-table would be read-only and unincrementable). This mirrors the shape of `canonical_ingredients_write` in 00011 and is in plan spirit — classified as **Rule 2 (missing critical functionality)** since the Wave 1 `canonicalPromoter` would be unable to write counts otherwise.
2. Added `COMMENT ON TABLE` stanzas on all four migrations documenting the consumer path (Phase 21 services), matching the convention established by 00010 and 00011.

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `canonical_scan_counts_write_service_role` policy**

- **Found during:** Task 1 (authoring 00019)
- **Issue:** Plan's SQL snippet for 00019 only defined a public SELECT policy on `canonical_scan_counts`. Without a service-role write policy, RLS would block `canonicalPromoter.ts` from incrementing the counter even under the service-role client (RLS is enforced for all roles unless a policy grants access). The table would be effectively read-only.
- **Fix:** Added `CREATE POLICY "canonical_scan_counts_write_service_role" ... FOR ALL TO service_role USING (true) WITH CHECK (true)` mirroring the exact shape of `canonical_ingredients_write` in 00011.
- **Files modified:** `supabase/migrations/00019_canonical_scan_counts_and_promote_rpc.sql`
- **Verification:** Assertion `for\s+all[\s\S]*to\s+service_role` added to the migrations.test.ts describe block for 00019; 68/68 GREEN.
- **Committed in:** `f4f7b4b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 missing critical functionality)
**Impact on plan:** Necessary for the Wave 1 canonicalPromoter to function. No scope creep — the counter-table is within the plan's declared artifact surface.

## Issues Encountered

**Pre-existing TS errors on `main`** (unrelated, out-of-scope per deviation scope boundary):
- `packages/server/src/services/__tests__/suggestions.test.ts` has multiple `HouseholdMemberRow.member_type` union mismatches
- `packages/server/src/services/recipeParser.ts:415` uses `'ai'` against a narrower `'url' | 'photo' | 'manual'` union

Verified via `git stash && npx tsc --noEmit -p packages/server` — both are pre-existing on the committed baseline. Logged to `.planning/phases/21-.../deferred-items.md` for a future `/gsd:quick` or Phase 23 hygiene micro-plan. No action taken in 21-01.

## User Setup Required

None — schema migrations only. Supabase will apply migrations 00016-00019 on next `supabase db push` (or the project's migration runner). No secrets, no environment vars, no external service configuration.

## Next Phase Readiness

**Ready for 21-02 (Wave 1 services):**
- `ruleEvaluator.ts` can query `user_location_rules` ordered by `precedence ASC`
- `suggestionAggregator.ts` can upsert to `suggested_rules` via `onConflict: 'user_id,rule_type,payload'`
- `canonicalPromoter.ts` can increment `canonical_scan_counts` and invoke `promote_candidate_canonicals(5)` RPC

**Ready for 21-03 (Wave 2 routes):** All tables exist with correct RLS so route-level POST/PATCH/DELETE handlers will be authorized by `auth.uid()` automatically.

**No blockers, no concerns.** Schema substrate is complete and forward-compatible with Phase 24a.

## Self-Check: PASSED

- [x] FOUND: `supabase/migrations/00016_user_staples.sql` (46 lines)
- [x] FOUND: `supabase/migrations/00017_user_location_rules.sql` (56 lines)
- [x] FOUND: `supabase/migrations/00018_suggested_rules.sql` (67 lines)
- [x] FOUND: `supabase/migrations/00019_canonical_scan_counts_and_promote_rpc.sql` (82 lines)
- [x] FOUND: `packages/server/src/__tests__/migrations.test.ts` (533 lines, 68/68 GREEN)
- [x] FOUND: commit `f4f7b4b` (Task 1)
- [x] FOUND: commit `69ea575` (Task 2)

## Known Stubs

None. All four migrations are fully-wired SQL artifacts — no placeholder DO blocks, no TODO markers, no hardcoded empties. The `suggested_rules.payload` JSONB field is intentionally schema-light (shape enforced at service layer in Wave 1) but this is architecture, not a stub.

---

*Phase: 21-pantry-intelligence-smarter-dedup-presentation-categorization-user-defined-scan-rules*
*Completed: 2026-04-19*
