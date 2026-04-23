---
phase: 24-ai-vision-and-pantry-data-model-deep-refactor
plan: 02
subsystem: api
tags: [units, quantity, conversion, pantry, vitest, pure-function]

# Dependency graph
requires:
  - phase: none
    provides: "pure-function module; no upstream dependencies in this phase"
provides:
  - "Quantity type {value, unit, system} as shared exported contract"
  - "areCompatible / convert / add / sanitize pure functions for unit math"
  - "Dimension-pure conversion table (imperial-volume, imperial-weight, metric-weight, metric-volume, count)"
  - "41-case test suite covering all base conversions + incompatibility + sanitize edge cases"
affects:
  - "24-04 (vision tool schema mirrors Quantity shape)"
  - "24-05 (reconcileItems calls add() for rescan aggregation, falls through to multi-row when null)"
  - "24-03 (seed data quantity columns align to system enum)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure pure-function service module (zero deps, zero side effects) — mirrors sourceLocation.ts leaf style"
    - "Defensive sanitize() for untrusted AI outputs → safe Quantity"
    - "Dimension-pure conversion via shared-base lookup (no density assumption)"

key-files:
  created:
    - "packages/server/src/services/units.ts"
    - "packages/server/src/services/__tests__/units.test.ts"
  modified: []

key-decisions:
  - "custom system never compatible with anything (including another custom) — forces multi-row fallback in 24-05 reconcileItems rather than silently aggregating unlike units"
  - "sanitize() top-level non-object → {value:1, unit:'piece', system:'count'}, but object-with-missing-fields → system:'custom' (preserves user-provided unit/value if present, only escapes conversion when system is unrecognized)"
  - "Zero/NaN/Infinity inputs sanitized to 0 (not 1) to avoid silently adding phantom quantities during rescan aggregation"
  - "convert() round-trip preserves value within floating-point tolerance (validated by cup→tsp→cup test at 1e-9)"
  - "No density conversion (cup ↔ oz, g ↔ ml) — returns null; 24-CONTEXT lockdown. Volume↔weight conversion would require density metadata per canonical ingredient, deliberately deferred indefinitely."

patterns-established:
  - "ConversionEntry table pattern: each unit keyed to {base, toBase, system}; two units compatible iff same base — O(1) lookup, no branching"
  - "Sanitize-before-arithmetic contract: callers of add()/convert() can rely on finite non-negative values once sanitize() has run"
  - "RED test file written in Task 1 with no automated verify (Task 2 GREEN run is the single contract enforcement point) — avoids brittle negated-grep RED checks that mask infra failures"

requirements-completed:
  - "Platform quality (post-v1)"

# Metrics
duration: 3min
completed: 2026-04-19
---

# Phase 24 Plan 02: Unit Conversion Library Summary

**Pure `Quantity = {value, unit, system}` conversion + aggregation library (areCompatible, convert, add, sanitize) powering re-scan quantity aggregation in 24-05 and shared as the wire shape for the vision tool schema in 24-04 — zero deps, dimension-pure, 41 tests green.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-19T17:31:15Z
- **Completed:** 2026-04-19T17:34:16Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files created:** 2

## Accomplishments

- Shipped `packages/server/src/services/units.ts` — pure-function module, 149 lines, zero external dependencies, exports `QuantitySystem`, `Quantity`, `areCompatible`, `convert`, `add`, `sanitize`.
- Shipped `packages/server/src/services/__tests__/units.test.ts` — 41 vitest cases covering every conversion pair both directions, cross-dimension null guards, compatible-unit aggregation (2 cup + 4 tbsp = 2.25 cup), incompatibility returns null, and sanitize coercion for every malformed-input shape the AI might emit.
- Established the Quantity wire contract that 24-04 vision schema and 24-05 reconcileItems both consume.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing unit tests (RED)** — `9bc1a98` (test)
2. **Task 2: Implement units.ts (GREEN)** — `e293f54` (feat)

_Note: TDD plan — Task 1 wrote 41 failing tests against an unwritten module; Task 2 implemented the module and all 41 tests pass. Plan's W1 revision explicitly skipped RED-phase automated verify (Task 2 GREEN run is the single contract gate)._

## Files Created/Modified

- `packages/server/src/services/units.ts` — pure conversion library (CONVERSION_TABLE + 4 public functions)
- `packages/server/src/services/__tests__/units.test.ts` — 41 vitest cases
- `.planning/phases/24-ai-vision-and-pantry-data-model-deep-refactor-scan-quality-item-creation-categorization-deduplication-quantity-extraction-canonical-storage/deferred-items.md` — logged unrelated pre-existing issues (created)

## Decisions Made

- **CONVERSION_TABLE includes `system` per entry** (plan's § 6 skeleton had only `{base, toBase}`). The convert() return needs a `system` field on the target Quantity; storing it on the table entry avoids a second lookup to derive it and keeps convert() branch-free.
- **`sanitize({})` returns `system: 'custom'` not `'count'`**. When the AI omits `system` entirely, the safest interpretation is "not a known system" — custom forces the reconcileItems multi-row path rather than silently coercing to count (which would change aggregation semantics). Valid top-level-null input still returns count-piece-1 (the "I truly have no quantity info at all" default).
- **`Number.isFinite` alone is sufficient** for NaN/±Infinity — no separate `Number.isNaN` check needed (isFinite returns false for both NaN and Infinity). Negative values are absolute-valued, not zeroed, because a negative quantity from the AI is more likely a sign error than a deliberate zero.
- **Empty-string unit falls back to 'piece'** even when `system: 'count'` — keeps every persisted Quantity self-describing (no ambiguous "count of empty string").

## Deviations from Plan

None — plan executed exactly as written. The only field added to the plan's sketch (`system` on `ConversionEntry`) is a structural refinement to satisfy the return-type contract convert() must already honor, not a behavior change.

## Issues Encountered

- **vitest CLI arg forwarding:** `pnpm --filter @dinnertime/server test -- --run src/services/__tests__/units.test.ts` did not pass the path through to vitest (pnpm swallowed the `--run` as a recursive flag). Verified the 41-test suite green by running `npx vitest run src/services/__tests__/units.test.ts` directly from `packages/server`. All 41 tests pass, 140ms total.
- **Full-suite exposed 2 pre-existing failures** in parallel-wave territory (`canonicalResolver.test.ts` RED placeholder for plan 24-01; `taskRouting.test.ts` env getter flake). Out of scope per deviation-rules SCOPE BOUNDARY — logged to `deferred-items.md`. Zero TS errors in `units.ts` or `units.test.ts` (verified by grep-filtering `npx tsc --noEmit -p packages/server` output).

## Downstream Consumers (Next Phase Readiness)

- **24-04 (vision tool schema):** Import `Quantity` and `QuantitySystem` to build the `quantity: { value, unit, system }` tool-schema object. Type is already exported.
- **24-05 (reconcileItems rewrite):** Call `units.add(existing.quantity, incoming.quantity)`. On `null` return, insert a second pantry_items row with `item_attributes.reconcile_hint = 'incompatible_units'` (per 24a-RESEARCH § 7). On non-null return, UPDATE the row with the merged quantity.
- **24-03 (seed data for canonical_ingredients):** Seed rows do not carry quantity, but any default-quantity examples in fixtures or tests should use the `{value, unit, system}` JSONB shape with `system` from the `QuantitySystem` enum.
- **vision.ts normalizeScanItems:** Call `sanitize()` on every AI-returned quantity before handing it to reconcileItems. Prevents NaN/Infinity from propagating into the DB.

## Self-Check: PASSED

- `packages/server/src/services/units.ts` — FOUND
- `packages/server/src/services/__tests__/units.test.ts` — FOUND
- Task 1 commit `9bc1a98` — FOUND (`test(24-02): add failing tests...`)
- Task 2 commit `e293f54` — FOUND (`feat(24-02): implement units.ts...`)
- 41/41 units.test.ts cases pass under vitest 4.1.4
- Zero TS errors in units.ts / units.test.ts (verified via tsc + grep)
- Zero stubs / placeholders / TODO markers in delivered files
- Zero external dependencies added to package.json

---
*Phase: 24-ai-vision-and-pantry-data-model-deep-refactor*
*Completed: 2026-04-19*
