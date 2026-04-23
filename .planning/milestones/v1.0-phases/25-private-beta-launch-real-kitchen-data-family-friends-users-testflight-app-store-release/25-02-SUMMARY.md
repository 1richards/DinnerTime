---
phase: 25-private-beta-launch
plan: 02
subsystem: infra, docs, launch-ops
tags: [fly-io, eas, testflight, app-store-connect, supabase, beta-program, runbook]

requires:
  - phase: 25-00
    provides: "beta_invites + feedback_submissions migrations (SQL snippets in BETA-PLAYBOOK.md reference these tables); eas.json production profile (RELEASE.md references EAS commands + ascAppId/appleTeamId placeholders)"
  - phase: 23-07
    provides: ".planning/app-store/ drafts (description.md + keywords.txt + screenshots-shotlist.md + privacy-manifest.json) + apps/mobile/PRIVACY.md + TERMS.md (RELEASE.md § 9 + DEPLOYMENT.md § 9 + BETA-PLAYBOOK.md § 8 reference these for ASC submission + prod hosting)"
  - phase: 23-06
    provides: "Sentry integration + SENTRY_DSN env var (DEPLOYMENT.md § 6 migrates)"

provides:
  - ".planning/RELEASE.md — copy-pasteable per-release TestFlight + App Store runbook (9 sections: release-type decision, pre-flight checklist, version bump, EAS build+submit, post-submit smoke, changelog + announcement templates, rollback, open questions)"
  - ".planning/DEPLOYMENT.md — Fly.io backend prod runbook (12 sections: Fly.io vs Railway decision, prereqs, server prep greps, inlined Dockerfile + fly.toml, 8-row env-var rotation table with copy-paste fly secrets commands, supabase db push gate, deploy + rollback + custom domain + post-deploy smoke + open questions)"
  - ".planning/BETA-PLAYBOOK.md — 5-15 tester private-beta playbook (9 sections: invite list target, CSV + SQL bulk INSERT, welcome email template, 20-min observation script, day 1/3/7/week 2/week 4 check-in schedule, 8 copy-paste SQL queries for status tracking + feedback feeds, Friday triage labels, TestFlight→App Store promotion criteria, open questions)"

affects:
  - 25-03 (TestFlight handoff references RELEASE.md for the release cut + DEPLOYMENT.md for backend URL)
  - Phase 25 execution (all three docs are runbooks Patrick executes out-of-band — prompts for the human, not Claude)

tech-stack:
  added: []
  patterns:
    - "Runbook convention: three cross-linked markdown docs in .planning/ — RELEASE.md (mobile releases), DEPLOYMENT.md (backend), BETA-PLAYBOOK.md (beta users). Each doc has an 'Open questions' checklist at the end flagging decisions the human executor must make at execution time."
    - "Copy-paste command convention: every CLI block includes the absolute working directory (cd /Users/patrickrichards/DinnerTime/...) — so Patrick can paste into any shell without cwd ambiguity."
    - "Placeholder convention: <VERSION>, <BUILD_NUMBER>, <YYYY-MM-DD>, <TESTFLIGHT_URL>, <YOUR_UUID>, <NAME> — angle-bracketed placeholders Patrick substitutes. No surprises about what's variable."
    - "Env-var rotation table convention: prod-rotate yes/no column per secret. Every row has explicit source (where to find the value) + explicit rotation guidance (dev stays on laptop / re-issue in dashboard / public by design)."
    - "SQL snippet convention: each copy-pasteable block names the table fully-qualified (public.beta_invites, public.feedback_submissions) so snippets paste into the Supabase SQL editor without schema ambiguity."

key-files:
  created:
    - .planning/RELEASE.md
    - .planning/DEPLOYMENT.md
    - .planning/BETA-PLAYBOOK.md
  modified: []

key-decisions:
  - "Fly.io recommended over Railway for the backend — explicit comparison table in DEPLOYMENT.md § 1 with cost, global edge, HTTPS, Docker portability; env-var list identical across both so Railway remains a drop-in alt without a rewrite."
  - "Custom domain api.dinnertime.app required before first production TestFlight cut — EAS production profile bundle-inlines EXPO_PUBLIC_API_URL at build time (CLAUDE.md § Metro); switching hosts post-build requires a new release. DEPLOYMENT.md § 9 makes this a hard dependency, not a nice-to-have."
  - "Internal TestFlight cap 15 for Phase 25 — avoids App Review entirely, lets Patrick push new builds instantly. Documented in BETA-PLAYBOOK.md § 1 + RELEASE.md § 1. Switch to External only at public-launch promotion time."
  - "Observation Script (BETA-PLAYBOOK.md § 4) is the single highest-signal activity — 20 min watching one non-builder, verbatim quote capture, do NOT help unless >60s stuck. Prioritized over daily surveys or auto-prompts because N=1 unfiltered observation beats N=5 survey noise at MVP stage."
  - "Check-in cadence capped at 1 touchpoint/week — testers opted in to do the builder a favor, not become power users. Day 1/3/7/Week 2/Week 4 schedule is deliberately conservative; over-messaging causes opt-outs."
  - "DEPLOYMENT.md § 6 env-rotation table labels yes/no/n/a explicitly (instead of boolean checkbox) so the plan's `prod-rotate` grep-verify anchor lands. Preserves machine-verifiability while staying human-readable."

patterns-established:
  - "Three-doc runbook set for launch: RELEASE (mobile cuts) ↔ DEPLOYMENT (backend) ↔ BETA-PLAYBOOK (user program). Any two-way relationship between release activities is cross-linked; no doc assumes it's read in isolation."
  - "Open questions section at end of every runbook flags decisions Patrick must make at execution time — checkbox format so items can be ticked off in situ. No 'TBD' scattered in prose — all unresolved calls in one place per doc."
  - "Markdown-only deliverables for human-executable work — no code, no tests, no scaffolding. Content is the product."

requirements-completed:
  - BETA-12
  - BETA-13
  - BETA-17
  - BETA-21
  - BETA-22
  - BETA-23

duration: 6min
completed: 2026-04-22
---

# Phase 25 Plan 02: Launch Runbooks Summary

**Three cross-linked markdown runbooks shipped — RELEASE.md (per-release TestFlight + App Store checklist), DEPLOYMENT.md (Fly.io backend prod migration with Dockerfile + fly.toml + 8-row env-rotation table), and BETA-PLAYBOOK.md (5-15 tester program with CSV + SQL + 20-min observation script + 8 copy-paste status-tracking queries).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-22T13:59:06Z
- **Completed:** 2026-04-22T14:05:00Z (approx)
- **Tasks:** 3
- **Files modified:** 3 (all created, zero existing files touched)

## Accomplishments

- Shipped `.planning/RELEASE.md` (230 lines) — Patrick's per-release playbook. Sections: (1) TestFlight Internal vs External vs public App Store tradeoff, (2) 9-step pre-flight checklist with exact commands (git status / pnpm -r typecheck / pnpm -r test --run / pnpm -r lint / expo export / maestro smoke / health curl / supabase db diff / STATE.md update), (3) semver rules + git commit command, (4) EAS build + submit commands with first-submission prompt caveat pointing at eas.json submit.production.ios placeholders, (5) post-submit smoke across scan → suggest → plan → cook + Sentry + feedback_submissions check, (6) paste-into-ASC changelog template under 4000 chars, (7) SMS/Slack announcement template, (8) three-mode rollback (expire + re-push prior + patch re-cut), (9) Open questions checklist flagging ascAppId / appleTeamId / Internal-vs-External / screenshots / privacy hosting / export compliance / age rating.
- Shipped `.planning/DEPLOYMENT.md` (343 lines) — Patrick's one-time Fly.io backend migration runbook. Sections: (1) Fly.io vs Railway decision table (recommend Fly.io: $5-10/mo, 30+ regions, native Node 22, explicit Dockerfile), (2) one-time prereqs (brew install flyctl + fly auth signup + billing + fly apps create + custom-domain decision gate), (3) three grep commands confirming /health + cors + PORT env, (4) inlined 4-stage Dockerfile (alpine + corepack + pnpm workspace filter + dist copy; includes tsc build-script caveat for tsx-only packages/server), (5) inlined fly.toml (dinnertime-api / sea region / http_checks /api/v1/health every 30s / force_https), (6) 8-row env-var migration table (ANTHROPIC/GOOGLE/SUPABASE_URL/SUPABASE_SERVICE_ROLE/SUPABASE_ANON/INSTACART/SENTRY_DSN/ADMIN_EMAILS with yes/no/n/a rotate column + source hint + rotation guidance) + copy-paste `fly secrets set` block, (7) supabase db push --linked pre-deploy gate, (8) fly deploy + fly status + curl /health smoke, (9) fly certs create api.dinnertime.app + CNAME instructions, (10) full 9-step physical-iPhone post-deploy smoke, (11) fly releases rollback + fast-path secret-typo redeploy, (12) open questions (region / custom domain / DR / autoscaling / log retention).
- Shipped `.planning/BETA-PLAYBOOK.md` (333 lines) — Patrick's 5-15 tester private-beta runbook. Sections: (1) invite-target composition table (household / family / cooking friends / non-cooks) with Internal TestFlight cap 15, (2) CSV schema matching beta_invites columns + SQL to look up YOUR_UUID from auth.users + bulk INSERT INTO beta_invites example, (3) personal-tone welcome email template with TestFlight install steps + opt-out line, (4) 20-min Onboarding Observation Script with pre-test/test/post-test breakdown — 6-step test protocol (launch / pantry scan / something to cook / plan / shopping list / optional voice) with explicit "don't help unless >60s stuck" rule + 5 post-test open questions, (5) Day 1 / Day 3 / Day 7 / Week 2 / Week 4 check-in schedule with one-line message templates, (6) 8 copy-paste SQL snippets — list invites + mark onboarded + mark first_scan (with scan_events lookup) + mark first_cook (with cooking_events lookup) + weekly check-in note-append + feedback feed JOIN + feedback volume aggregation + activation funnel, (7) Friday feedback triage labels (Bug / UX friction / Missing feature / Wrong mental model / Nice-to-have) with P0 rule (3+ reports OR single crash), (8) 7-checkbox TestFlight→public App Store promotion criteria (0 crashes / 5+ full-flow completions / 0 open P0 / ASC assets / dogfood bar / prod backend 14+ days green / privacy+terms hosted), (9) open questions (invite names / group chat channel / compensation / recording consent / onboarding step-timing).

## Task Commits

Each task was committed atomically:

1. **Task 1: RELEASE.md** — `f5c79b8` (docs)
2. **Task 2: DEPLOYMENT.md** — `877082e` (docs)
3. **Task 3: BETA-PLAYBOOK.md** — `0b1ef9d` (docs)

_Note: Plans 25-01 and 25-02 were executing in parallel (separate waves). Commits `4868063`, `0f65acc`, `7295a91`, and `aa72d4d` between my three commits are 25-01's feedback-route TDD work — unrelated to this plan._

## Files Created/Modified

- `.planning/RELEASE.md` (230 lines, created) — per-release TestFlight + App Store runbook
- `.planning/DEPLOYMENT.md` (343 lines, created) — Fly.io backend prod runbook with Dockerfile + fly.toml + env rotation
- `.planning/BETA-PLAYBOOK.md` (333 lines, created) — 5-15 tester private-beta playbook with CSV + SQL + observation script

## Decisions Made

- **Fly.io recommended over Railway** for the backend — decision table in DEPLOYMENT.md § 1 with cost / region / HTTPS / Docker comparison; env-var list applies to both so Railway is a CLI-swap alt.
- **Custom domain `api.dinnertime.app` is a hard dependency before first production TestFlight** — EAS production profile bundle-inlines `EXPO_PUBLIC_API_URL` at build time per CLAUDE.md § Metro; switching URLs post-bundle forces a new mobile release. Documented in DEPLOYMENT.md § 9 as a gating step, not a nice-to-have.
- **Internal TestFlight cap 15 for Phase 25** — avoids App Review, enables instant build push. Only promote to External when all 7 promotion criteria (BETA-PLAYBOOK.md § 8) are met.
- **20-min Observation Script (BETA-PLAYBOOK.md § 4) prioritized over any survey/auto-prompt instrument** — N=1 unfiltered observation beats N=5 survey noise at MVP stage. Script enforces "do not help unless >60s stuck" so the quiet spots are legible as UX failures.
- **Check-in cadence capped at 1 touchpoint/week** — BETA-PLAYBOOK.md § 5 explicitly rejects notifications / email blasts / auto-reminders. Testers opted in as a favor; over-messaging causes opt-outs.
- **`prod-rotate` column header lowercased to match plan verify-grep** — first attempt used `Prod-rotate?` which failed the `grep -q "prod-rotate"` contract; switched to `prod-rotate` with `yes/no/n/a` values. Single Rule 3 blocking fix (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DEPLOYMENT.md env-rotation column header lowercase**
- **Found during:** Task 2 verify step
- **Issue:** First draft used `| Env var | Source | Prod-rotate? | Notes |` as the column header. Plan's automated verify ran `grep -q "prod-rotate"` (lowercase, no question mark), which failed because the literal string `prod-rotate` never appeared in the doc.
- **Fix:** Changed column header to `| prod-rotate |` with values `yes / no / n/a` (lowercase). Preserves readability while satisfying the verify contract. The plan's own frontmatter truths section used the lowercase form (`'prod-rotate: yes/no' per BETA-23`), so this is aligned with the documented intent.
- **Files modified:** `.planning/DEPLOYMENT.md`
- **Verification:** Re-ran the 4-grep verify block — all 4 passed (`OK: 343`, `OK: fly secrets set`, `OK: supabase db push`, `OK: prod-rotate table`).
- **Committed in:** `877082e` (Task 2 commit — fix applied before commit, so it's part of the single commit, not a follow-up)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Trivial text adjustment — the fix aligned the doc with the plan's own documented convention. Zero scope creep.

## Issues Encountered

- **25-01 and 25-02 executing in parallel** — noticed 4 commits from 25-01's feedback-route TDD landing between my 3 commits. No file overlap (25-01 touches `packages/server/src/routes/feedback.ts` + `apps/mobile/src/components/settings/FeedbackSheet.tsx`; 25-02 only creates `.planning/*.md`), so no merge conflicts. Behavior matches the 25-CONTEXT wave structure — 25-02 is wave 2 alongside 25-01 per plan frontmatter (`wave: 2`, `depends_on: [25-00]`), and both depend only on 25-00 scaffolding.

## User Setup Required

None — no external service configuration performed by this plan. However, the three docs themselves are instructions for user setup Patrick executes out-of-band:

- **RELEASE.md** — prompts Patrick to fill ascAppId + appleTeamId at first `eas submit`.
- **DEPLOYMENT.md** — prompts Patrick to `brew install flyctl` + `fly auth signup` + `fly apps create dinnertime-api` + 8 `fly secrets set` commands + `supabase db push --linked` + `fly deploy` + `fly certs create api.dinnertime.app` + CNAME DNS setup.
- **BETA-PLAYBOOK.md** — prompts Patrick to finalize 5-15 invite names + pick a group chat channel + run the 20-min observation script on 1-2 testers in week 2.

These are Phase 25's human-only deliverables per 25-CONTEXT.md § "Human-only (Patrick, on wake)".

## Next Phase Readiness

- **25-03 (TestFlight + ASC handoff)** is unblocked — RELEASE.md defines the mobile-release flow 25-03's handoff doc will reference, and DEPLOYMENT.md defines the backend 25-03's final validation depends on.
- **Phase 25 closure** is blocked only on the human-only work listed in § "User Setup Required" above. All automatable prep for TestFlight + App Store + beta program is shipped (25-00 scaffolding + 25-01 feedback route + 25-02 runbooks).

## Self-Check

**Created files verification:**

```
FOUND: /Users/patrickrichards/DinnerTime/.planning/RELEASE.md (230 lines)
FOUND: /Users/patrickrichards/DinnerTime/.planning/DEPLOYMENT.md (343 lines)
FOUND: /Users/patrickrichards/DinnerTime/.planning/BETA-PLAYBOOK.md (333 lines)
```

**Commit verification:**

```
FOUND: f5c79b8 (Task 1: RELEASE.md)
FOUND: 877082e (Task 2: DEPLOYMENT.md)
FOUND: 0b1ef9d (Task 3: BETA-PLAYBOOK.md)
```

**Cross-link verification (each doc links to the other two):**

```
RELEASE.md → DEPLOYMENT.md: FOUND
RELEASE.md → BETA-PLAYBOOK.md: FOUND
DEPLOYMENT.md → RELEASE.md: FOUND
DEPLOYMENT.md → BETA-PLAYBOOK.md: FOUND
BETA-PLAYBOOK.md → RELEASE.md: FOUND
BETA-PLAYBOOK.md → DEPLOYMENT.md: FOUND
```

**Verify-grep contracts (plan-level `<verify>` blocks):**

```
Task 1: RELEASE.md exists, >100 lines, "eas build --profile production" present, "BETA-PLAYBOOK.md" present: OK
Task 2: DEPLOYMENT.md exists, >120 lines, "fly secrets set" present, "supabase db push" present, "prod-rotate" present: OK
Task 3: BETA-PLAYBOOK.md exists, >130 lines, "INSERT INTO beta_invites" present, "feedback_submissions" present, "Onboarding observation" present: OK
```

## Known Stubs

None. All three docs are complete runbooks — the only "TODO" strings in the deliverables are the intentional ASC placeholders Patrick substitutes at execution time (ascAppId, appleTeamId), and those are pre-existing in `eas.json` from 25-00 (the runbooks document how to resolve them, they don't introduce new ones).

## Self-Check: PASSED

---
*Phase: 25-private-beta-launch*
*Plan: 02*
*Completed: 2026-04-22*
