# Deferred Items — Phase 12

Out-of-scope issues discovered during Phase 12 execution. Logged here rather
than fixed, per the GSD scope-boundary rule (only auto-fix issues directly
caused by the current phase's changes).

## Flow 13 (settings) — `.*Add Member.*` not found

- **Discovered:** 2026-04-18 during 12-03 Task 3 (full Maestro suite run)
- **Scope:** Settings screen UI — pre-dates Phase 12 (Home + Recipes merge)
- **Symptom:** `maestro test .maestro/13-settings.yaml` fails at
  `Element not found: Text matching regex: .*Add Member.*`
- **Root cause (hypothesis):** The "Add Member" button was likely renamed or
  moved during post-v1 polish work on the Settings screen (see state.md
  post-v1 landing log between 2026-04-13 and 2026-04-14). Flow 13 has not
  been touched since commit `72d256a` (2026-04-13, "14/14 Maestro flows
  passing end-to-end").
- **Impact:** Flow 13 is the only suite failure post-Phase-12. The other
  20/21 flows (including all 7 flows Phase 12 touched) are green.
- **Why deferred:** This is a Settings-screen regression from post-v1 polish
  work unrelated to the Kitchen-tab consolidation. Fixing it would be
  scope creep for Phase 12-03.
- **Fix path (future):** Small single-task update — read Settings screen
  source, grep for the new member-management CTA copy, update flow 13's
  assertion to match.
