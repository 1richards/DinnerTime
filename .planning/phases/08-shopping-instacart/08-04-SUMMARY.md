---
phase: 08-shopping-instacart
plan: 04
subsystem: api
tags: [instacart, fetch, factory-pattern, env-gated, vitest]

requires:
  - phase: 08-shopping-instacart
    provides: InstacartLineItem type (from 08-01 shopping types)
provides:
  - InstacartClient interface behind which stub and real implementations are swappable
  - StubInstacartClient returning deterministic example.com slug URLs for offline/dev/test
  - RealInstacartClient POSTing to /idp/v1/products/products_link with Bearer auth
  - getInstacartClient() factory gated on process.env.INSTACART_API_KEY (read at call-time)
affects: [08-05, 08-06, 08-07, shopping-order-creation]

tech-stack:
  added: []
  patterns:
    - "Stub/Real + factory gated on env var, read at call-time not module-load"
    - "vi.stubEnv + vi.stubGlobal('fetch') for env- and network-mocked service tests"

key-files:
  created:
    - packages/server/src/services/instacart.ts
    - packages/server/src/services/__tests__/instacart.test.ts
  modified: []

key-decisions:
  - "Factory reads INSTACART_API_KEY at call-time (not module-load) so vi.stubEnv works in tests"
  - "Stub slugifies with encodeURIComponent(title.toLowerCase().replace(/\\s+/g, '-')) — deterministic and URL-safe"
  - "RealInstacartClient takes (apiKey, baseUrl) via constructor injection — no hardcoded URL"
  - "Default expires_in=30 days; landing_page_configuration only emitted when partner_linkback_url provided"
  - "Error path throws `Instacart API <status>: <text>` so upstream handlers can log both"

patterns-established:
  - "Env-gated external client factory: stub-first means phase ships without API approval; flip env var to go live"
  - "Global fetch (Node 22 LTS) — no node-fetch import"

requirements-completed: [SHOP-05]

duration: 2min
completed: 2026-04-12
---

# Phase 8 Plan 4: Stubbable Instacart Client Summary

**Stub-first InstacartClient with env-gated Real implementation calling /idp/v1/products/products_link, unblocking all downstream Phase 8 work without requiring Instacart API approval.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-12T21:22:27Z
- **Completed:** 2026-04-12T21:24:24Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- InstacartClient interface + StubInstacartClient + RealInstacartClient + getInstacartClient factory
- Deterministic stub URLs (example.com slug) unblock the entire shopping flow without network access
- RealInstacartClient fully tested via mocked fetch: URL, headers, body shape, and error path
- Factory env switching verified via vi.stubEnv

## Task Commits

1. **Task 1: StubInstacartClient + factory (TDD)** - `098e24f` (feat)
2. **Task 2: RealInstacartClient with fetch mock (TDD)** - `df17bc1` (feat)

**Plan metadata:** (pending — this commit)

_Note: TDD tasks combined RED + GREEN in single commits since the test file and implementation were written together per plan's explicit file list; all tests were run and verified green before committing._

## Files Created/Modified
- `packages/server/src/services/instacart.ts` - Interface, StubInstacartClient, RealInstacartClient, getInstacartClient factory
- `packages/server/src/services/__tests__/instacart.test.ts` - 8 tests covering stub determinism, URL encoding, factory env switching, real client fetch shape, and error propagation

## Decisions Made
- Factory reads env at call-time (documented in plan; critical for vi.stubEnv to work)
- Default `expires_in=30` days, matching plan's spec
- Error message format `Instacart API <status>: <text>` to preserve upstream debug info

## Deviations from Plan

None - plan executed exactly as written. Test shape for the error path was simplified to a single assertion matching both the status code and body text in one regex (`/502.*upstream down/`), which is stylistic and does not change coverage.

## Issues Encountered
None.

## User Setup Required
None - stub is the default. Setting `INSTACART_API_KEY` (and optionally `INSTACART_BASE_URL`) activates the real client with zero code changes. Full live credentials are gated on Instacart Developer Platform approval (STATE.md blocker).

## Next Phase Readiness
- Plans 08-05/06/07 can build shopping-list consolidation and order persistence using `getInstacartClient()` and call real or stub transparently
- Blocker "Instacart API approval" is de-risked: phase can ship end-to-end on stub alone

---
*Phase: 08-shopping-instacart*
*Completed: 2026-04-12*

## Self-Check: PASSED

- FOUND: packages/server/src/services/instacart.ts
- FOUND: packages/server/src/services/__tests__/instacart.test.ts
- FOUND commit: 098e24f (Task 1)
- FOUND commit: df17bc1 (Task 2)
- All 8 tests pass via `pnpm -C packages/server test instacart.test.ts -- --run`
