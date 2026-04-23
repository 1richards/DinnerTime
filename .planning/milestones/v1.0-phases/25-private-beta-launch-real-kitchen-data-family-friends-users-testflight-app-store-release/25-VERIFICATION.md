---
phase: 25-private-beta-launch
verified: 2026-04-20T07:30:00Z
status: human_needed
score: 8/8 automated must-haves verified
human_verification:
  - test: "Scan real fridge/pantry/freezer from own iPhone via TestFlight build"
    expected: "App identifies ingredients and generates suggestions from real kitchen data (BETA-01..04)"
    why_human: "Requires a physical device, real pantry contents, and a shipped TestFlight build"
  - test: "Apply Supabase migrations 00029 + 00030 to production: supabase db push --linked"
    expected: "beta_invites + feedback_submissions tables created in prod; supabase db diff --linked shows no pending"
    why_human: "Requires Patrick's Supabase CLI linked to the production project"
  - test: "Deploy backend to Fly.io per DEPLOYMENT.md steps 2-8 (flyctl install → fly deploy → health curl)"
    expected: "curl https://dinnertime-api.fly.dev/api/v1/health returns {\"status\":\"ok\"} (BETA-22)"
    why_human: "Requires Patrick's Fly.io account, billing, fly apps create, and 8 fly secrets set commands"
  - test: "Rotate prod secrets per DEPLOYMENT.md env-rotation table (ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, INSTACART_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY) — BETA-23"
    expected: "All 8 env vars set in fly secrets; dev laptop keys remain separate"
    why_human: "Requires Patrick's credentials in console.anthropic.com, Supabase dashboard, developer.instacart.com"
  - test: "Create App Store Connect record and fill listing details (BETA-08..09, BETA-13..20)"
    expected: "ASC record with bundle id com.dinnertime.app created; ascAppId + appleTeamId back-filled into apps/mobile/eas.json; description, keywords, age rating 4+, export compliance 'No', privacy label filled"
    why_human: "Requires Patrick's Apple Developer account login; cannot automate ASC form filling"
  - test: "Run Maestro flow 38 on iPhone 17 Pro simulator and iPhone 11 Pro Max simulator, rename output PNGs, upload to ASC (BETA-14)"
    expected: "5 PNGs produced per device bucket (10 total); uploaded to ASC 6.9\" + 6.5\" screenshot buckets"
    why_human: "Requires booted simulators with seeded test data (>=4 pantry items, 1 planned day, 1 recipe); upload requires ASC login"
  - test: "EAS build + submit: eas build --profile production --platform ios && eas submit --profile production --platform ios --latest (BETA-08)"
    expected: "Build completes; build appears in TestFlight Internal testing group; beta testers receive invite"
    why_human: "Requires Apple ID auth, EAS account, production Fly.io backend live at api.dinnertime.app, ascAppId filled"
  - test: "Invite 5-15 beta users per BETA-PLAYBOOK.md (BETA-05..06): insert rows into beta_invites, send welcome emails with TestFlight link"
    expected: "At least 1 non-builder tester installs from TestFlight and completes onboarding (Phase 25 DONE criterion)"
    why_human: "Requires Patrick's personal contact list, TestFlight public link from ASC, and a completed EAS submit"
  - test: "Run the 20-min Onboarding Observation Script (BETA-06) with at least one non-builder tester via Zoom/QuickTime"
    expected: "Verbatim quotes captured; friction points logged; BETA-PLAYBOOK.md check-in schedule started"
    why_human: "Requires a willing non-builder participant and Patrick's facilitation"
  - test: "Open Settings → About on a simulator booted with the dev build and verify 'Send feedback' row is visible and tapping it opens the feedback sheet"
    expected: "Modal appears with textarea, character counter, Cancel, and Send buttons"
    why_human: "Requires a running simulator with the installed dev client — confirms BETA-07 end-to-end in the real UI"
---

# Phase 25: Private Beta Launch — Verification Report

**Phase Goal:** Ship DinnerTime to a small circle of real users — Patrick's household + family + friends. Seed the app with real kitchen data, distribute via TestFlight (with App Store review path), gather structured feedback, and establish a release rhythm.

**Verified:** 2026-04-20T07:30:00Z
**Status:** HUMAN NEEDED — all automated artifacts verified; human-only launch steps are correctly deferred per LAUNCH-HANDOFF.md design
**Re-verification:** No — initial verification

## Goal Achievement

### Phase Design Note

Phase 25 was explicitly designed with a two-track architecture:

- **Automated track (25-00 + 25-01 + 25-02 + 25-03):** Code, tests, migrations, runbooks, and configuration that Claude can ship autonomously. These are verifiable against the codebase.
- **Human-only track:** TestFlight upload, Fly.io deploy, App Store Connect form filling, real-kitchen dogfooding, beta user outreach, and check-in rituals. These require Patrick's credentials, devices, and relationships. They are correctly documented in LAUNCH-HANDOFF.md and are NOT gaps — they are expected human responsibilities.

The `human_needed` status is the correct outcome for a phase of this design. `gaps_found` would be wrong here.

### Observable Truths (Automated Track)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 00029_beta_invites.sql creates the beta lifecycle tracking table with correct schema, indexes, and service-role-only RLS | VERIFIED | File exists (3553 bytes); CREATE TABLE, CHECK enum, UNIQUE INDEX, status INDEX, ENABLE ROW LEVEL SECURITY, no CREATE POLICY — all confirmed by inspection and 140-passing migration test suite |
| 2 | 00030_feedback_submissions.sql creates append-only feedback capture with auth.uid() RLS | VERIFIED | File exists (3495 bytes); BIGSERIAL pk, profile_id FK ON DELETE CASCADE, char_length CHECK BETWEEN 1 AND 4000, own_select + own_insert policies (no UPDATE/DELETE), confirmed by migration tests |
| 3 | POST /api/v1/feedback route validates, server-injects profile_id, inserts to feedback_submissions, returns 201+{id} | VERIFIED | packages/server/src/routes/feedback.ts exists (5186 bytes); Zod FeedbackSchema, profile_id from c.get('user').id, supabase.from('feedback_submissions').insert(), 201 response; 5/5 tests green |
| 4 | GET /api/v1/admin/beta-invites is gated by ADMIN_EMAILS_LIST, reads beta_invites via service-role client | VERIFIED | feedback.ts lines 115-149 implement the gate; env.ts ADMIN_EMAILS_LIST getter confirmed; supabaseAdmin client used; 5/5 tests green |
| 5 | FeedbackSheet.tsx exists in Settings → About with textarea, character counter, Send/Cancel; POSTs via authedFetch | VERIFIED | FeedbackSheet.tsx exists (10896 bytes); authedFetch import at line 35; submitFeedback posts to /api/v1/feedback (line 98); AboutSection.tsx wires "Send feedback" row at line 149; 5/5 FeedbackSheet tests + 4/4 AboutSection tests green |
| 6 | RELEASE.md, DEPLOYMENT.md, BETA-PLAYBOOK.md exist as copy-pasteable runbooks with correct cross-links | VERIFIED | All three exist: RELEASE.md 230 lines, DEPLOYMENT.md 343 lines, BETA-PLAYBOOK.md 333 lines; EAS build command, fly secrets set, supabase db push, INSERT INTO beta_invites, feedback_submissions SQL, Onboarding observation section all confirmed present |
| 7 | Maestro flow 38 exists with 5 takeScreenshot steps; README.md has Phase 25 section | VERIFIED | 38-screenshot-capture.yaml exists (3289 bytes); grep confirms 6 takeScreenshot directives (≥5 required); README.md Phase 25 section at line 120, documents two-bucket run |
| 8 | LAUNCH-HANDOFF.md is the canonical Phase 25 human-action doc; covers BETA-01..26; ROADMAP + STATE updated | VERIFIED | LAUNCH-HANDOFF.md exists (15333 bytes / 200 lines); BETA-01 and BETA-26 both present in coverage matrix; ROADMAP.md lists all 4 plans (25-00..25-03) as [x]; STATE.md shows "Phase 25 of 25 planning complete" and references LAUNCH-HANDOFF.md |

**Score:** 8/8 automated must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00029_beta_invites.sql` | Beta invite lifecycle table + service-role RLS | VERIFIED | 3553 bytes; schema matches plan spec exactly |
| `supabase/migrations/00030_feedback_submissions.sql` | Append-only feedback capture + auth.uid() RLS | VERIFIED | 3495 bytes; SELECT + INSERT policies, no UPDATE/DELETE |
| `packages/server/src/routes/feedback.ts` | POST /feedback + GET /admin/beta-invites | VERIFIED | 5186 bytes; both handlers implemented; mounted via app.route('/', feedback) in index.ts |
| `packages/server/src/config/env.ts` | ADMIN_EMAILS_LIST getter | VERIFIED | Getter confirmed at line 45 |
| `apps/mobile/src/components/settings/FeedbackSheet.tsx` | Modal feedback form | VERIFIED | 10896 bytes; authedFetch wired; submitFeedback exported |
| `apps/mobile/src/components/settings/AboutSection.tsx` | "Send feedback" row wired to FeedbackSheet | VERIFIED | FeedbackSheetHost at line 187; "Send feedback" label at line 160 |
| `apps/mobile/eas.json` | Production profile with channel + env + TODO ASC placeholders | VERIFIED | autoIncrement, channel:"production", EXPO_PUBLIC_API_URL:"https://api.dinnertime.app", ascAppId:"TODO-PATRICK-FILLS-AFTER-ASC-CREATE" |
| `.planning/RELEASE.md` | Per-release TestFlight + App Store runbook | VERIFIED | 230 lines; EAS commands, cross-links present |
| `.planning/DEPLOYMENT.md` | Fly.io backend deploy runbook + env rotation | VERIFIED | 343 lines; fly secrets set, supabase db push, prod-rotate table present |
| `.planning/BETA-PLAYBOOK.md` | Beta invite + check-in + SQL tracking runbook | VERIFIED | 333 lines; INSERT INTO beta_invites, feedback_submissions SQL, Onboarding observation section present |
| `apps/mobile/.maestro/38-screenshot-capture.yaml` | 5-shot App Store screenshot capture flow | VERIFIED | 3289 bytes; 6 takeScreenshot directives |
| `apps/mobile/.maestro/README.md` | Phase 25 two-bucket run docs | VERIFIED | Phase 25 section at line 120 |
| `.planning/LAUNCH-HANDOFF.md` | Canonical human-action checklist BETA-01..26 | VERIFIED | 200 lines; all 26 SCs covered; tri-state status column |
| `.planning/ROADMAP.md` | Phase 25 four plans listed + checked | VERIFIED | 25-00..25-03 all listed as [x] |
| `.planning/STATE.md` | Phase 25 of 25 planning complete | VERIFIED | Current Position updated; LAUNCH-HANDOFF.md referenced |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `FeedbackSheet.tsx` | POST /api/v1/feedback | authedFetch | WIRED | authedFetch import at line 35; submitFeedback posts '/api/v1/feedback' at line 98 |
| `feedback.ts` | feedback_submissions table | supabase.from('feedback_submissions').insert | WIRED | Lines 93-97 confirmed |
| `AboutSection.tsx` | FeedbackSheet | FeedbackSheetHost module-level latch | WIRED | Import at line 7; row at 149; FeedbackSheetHost at 187 |
| `feedback.ts` | ADMIN_EMAILS_LIST env check | env.ADMIN_EMAILS_LIST.includes(email) | WIRED | Line 134 confirmed |
| `LAUNCH-HANDOFF.md` | RELEASE.md + DEPLOYMENT.md + BETA-PLAYBOOK.md | Section cross-links | WIRED | All three linked from header and from relevant steps |
| `RELEASE.md` | eas.json production profile | eas build --profile production command | WIRED | Line confirmed present |
| `DEPLOYMENT.md` | supabase/migrations/00029 + 00030 | supabase db push step | WIRED | supabase db push present in DEPLOYMENT.md |
| `BETA-PLAYBOOK.md` | beta_invites table | INSERT + UPDATE SQL snippets | WIRED | INSERT INTO beta_invites confirmed present |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `feedback.ts POST /feedback` | supabase.from('feedback_submissions').insert(row) | row constructed from Zod-parsed body + user.id | Yes — real DB insert | FLOWING |
| `FeedbackSheet.tsx submitFeedback` | message (state from TextInput) | User input via TextInput onChangeText | Yes — user-entered text POSTed | FLOWING |
| `feedback.ts GET /admin/beta-invites` | supabaseAdmin.from('beta_invites').select('*') | beta_invites table via service-role client | Yes — real DB query | FLOWING |

### Behavioral Spot-Checks

Step 7b: No runnable server to spot-check (server requires ADMIN_EMAILS env + Supabase credentials). Test suite is the behavioral proxy.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| migrations.test.ts (140 assertions for 00029 + 00030 SQL shape) | pnpm --filter @dinnertime/server test --run src/__tests__/migrations.test.ts | 140 passed | PASS |
| feedback route tests (POST + admin GET behaviors) | pnpm --filter @dinnertime/server test --run src/routes/__tests__/feedback.test.ts | 5 passed | PASS |
| FeedbackSheet unit tests (render + submit contract) | pnpm --filter @dinnertime/mobile test --run src/components/settings/__tests__/FeedbackSheet.test.tsx | 5 passed | PASS |
| AboutSection tests (Send feedback row visible + existing rows intact) | pnpm --filter @dinnertime/mobile test --run src/components/settings/__tests__/AboutSection.test.ts | 4 passed | PASS |

### Requirements Coverage

| Requirement | Plan(s) | Status | Evidence |
|-------------|---------|--------|----------|
| BETA-01 (scan real pantry) | 25-03 | HUMAN-ONLY | Documented in LAUNCH-HANDOFF.md Step 10 |
| BETA-02 (import 30 recipes) | 25-03 | HUMAN-ONLY | LAUNCH-HANDOFF.md Step 10 |
| BETA-03 (cook a real week) | 25-03 | HUMAN-ONLY | LAUNCH-HANDOFF.md Step 10 |
| BETA-04 (AI suggestions vs real pantry) | 25-03 | HUMAN-ONLY | LAUNCH-HANDOFF.md Step 10 |
| BETA-05 (invite list confirmed) | 25-00, 25-03 | HUMAN-ONLY | beta_invites table exists; BETA-PLAYBOOK.md invite template; LAUNCH-HANDOFF.md Step 9 |
| BETA-06 (onboarding observation) | 25-03 | HUMAN-ONLY | BETA-PLAYBOOK.md § 4 Observation Script; LAUNCH-HANDOFF.md Step 9 |
| BETA-07 (in-app feedback path) | 25-00, 25-01 | AUTOMATED + HUMAN (exercise) | FeedbackSheet + /api/v1/feedback both shipped and tested |
| BETA-08 (TestFlight build uploaded) | 25-00, 25-03 | HUMAN-ONLY | eas.json production profile ready; RELEASE.md EAS commands; LAUNCH-HANDOFF.md Step 7 |
| BETA-09 (Internal testing group) | 25-00, 25-03 | HUMAN-ONLY | LAUNCH-HANDOFF.md Step 8; RELEASE.md § 1 |
| BETA-10 (External testing group if >25) | 25-03 | HUMAN-ONLY | LAUNCH-HANDOFF.md Step 8 (noted as likely unnecessary for Phase 25 cap 15) |
| BETA-11 (crash + feedback review workflow) | 25-00, 25-01 | AUTOMATED + HUMAN | /admin/beta-invites endpoint; BETA-PLAYBOOK.md SQL queries; LAUNCH-HANDOFF.md Step 11 |
| BETA-12 (build numbering) | 25-00 | AUTOMATED | eas.json autoIncrement: true; channel: "production" |
| BETA-13 (ASC listing drafted) | 25-02, 25-03 | AUTOMATED + HUMAN | 23-07 app-store/ drafts exist; LAUNCH-HANDOFF.md Step 5 |
| BETA-14 (screenshots captured) | 25-03 | AUTOMATED + HUMAN | Maestro flow 38 ships; Patrick runs + uploads per LAUNCH-HANDOFF.md Step 6 |
| BETA-15 (App Preview video) | 25-03 | DEFERRED | Flagged optional in LAUNCH-HANDOFF.md coverage matrix |
| BETA-16 (privacy nutrition label) | 25-02, 25-03 | AUTOMATED + HUMAN | privacy-manifest.json exists; Patrick fills ASC form per LAUNCH-HANDOFF.md Step 5 |
| BETA-17 (Privacy Policy + Terms published) | 25-02, 25-03 | AUTOMATED + HUMAN | PRIVACY.md + TERMS.md exist; Patrick hosts per LAUNCH-HANDOFF.md Step 5 |
| BETA-18 (age rating 4+) | 25-03 | HUMAN-ONLY | LAUNCH-HANDOFF.md Step 5 |
| BETA-19 (export compliance) | 25-03 | HUMAN-ONLY | LAUNCH-HANDOFF.md Step 5 |
| BETA-20 (App submitted for review) | 25-03 | HUMAN-ONLY | LAUNCH-HANDOFF.md Step 12 |
| BETA-21 (release checklist) | 25-02 | AUTOMATED | RELEASE.md shipped |
| BETA-22 (backend prod deployed) | 25-02, 25-03 | HUMAN-ONLY | DEPLOYMENT.md runbook; LAUNCH-HANDOFF.md Step 3 |
| BETA-23 (prod secrets rotated) | 25-02, 25-03 | HUMAN-ONLY | DEPLOYMENT.md env-rotation table; LAUNCH-HANDOFF.md Step 3 |
| BETA-24 (feedback loop established) | 25-00, 25-01, 25-02 | AUTOMATED + HUMAN | Migrations + feedback route + FeedbackSheet + BETA-PLAYBOOK.md check-in schedule all shipped |
| BETA-25 (distribution posture decided) | 25-03 | HUMAN-ONLY | LAUNCH-HANDOFF.md Step 12 |
| BETA-26 (App Store-public consequences understood) | 25-03 | HUMAN-ONLY | BETA-PLAYBOOK.md § 8 promote criteria; LAUNCH-HANDOFF.md Step 12 |

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `apps/mobile/eas.json` | `ascAppId: "TODO-PATRICK-FILLS-AFTER-ASC-CREATE"` | INFO | Intentional placeholder per plan design — EAS Submit will produce a readable error pointing Patrick at the field. Not a stub; value is required human input that cannot exist before ASC record creation. |
| `apps/mobile/.maestro/38-screenshot-capture.yaml` | `optional: true` on recipe-card tap + cook-mode navigation | INFO | Intentional design decision: flow tolerates missing seed data so it does not hard-fail. Screenshots captured at whatever state is reached. Patrick inspects PNGs after the run. |
| `FeedbackSheet.tsx` | Zero-opacity static TextInput marker in outer component | INFO | Intentional test-infra pattern (cloned from ReAuthModal). The invisible marker exists purely for vitest-node tree-walker compatibility; users never see it. The live TextInput is inside FeedbackForm. |

No blockers. No warnings. All flagged patterns are intentional and documented in their respective SUMMARY.md decision logs.

### Human Verification Required

All items below are expected as the human-only track of Phase 25. They are NOT gaps — the automated infrastructure that enables each is already shipped and verified. Patrick works through these top-to-bottom per `.planning/LAUNCH-HANDOFF.md`.

#### 1. Supabase Migrations to Production

**Test:** Run `supabase db push --linked` from repo root, then `supabase db diff --linked`
**Expected:** 00029_beta_invites + 00030_feedback_submissions tables created in production; diff shows no pending migrations
**Why human:** Requires Supabase CLI linked to the production project via Patrick's account

#### 2. Fly.io Backend Deploy (BETA-22)

**Test:** Follow DEPLOYMENT.md steps 1-8: flyctl install → fly auth signup → fly apps create dinnertime-api → 8 fly secrets set commands → fly deploy → health check curl
**Expected:** `curl https://dinnertime-api.fly.dev/api/v1/health` returns `{"status":"ok"}`
**Why human:** Requires Patrick's Fly.io account, billing setup, and all 8 production secrets (Anthropic, Supabase service key, Instacart prod key, etc.)

#### 3. Production Secrets Rotation (BETA-23)

**Test:** Generate fresh prod API keys per DEPLOYMENT.md env-rotation table (ANTHROPIC_API_KEY yes, SUPABASE_SERVICE_ROLE_KEY yes, INSTACART_API_KEY yes, GOOGLE_GENERATIVE_AI_API_KEY yes)
**Expected:** Fly.io secrets contain new prod-only keys; dev laptop still has the old dev keys
**Why human:** Requires Patrick's credentials at console.anthropic.com, Supabase dashboard, developer.instacart.com

#### 4. App Store Connect Record + Listing Fill (BETA-08, BETA-13, BETA-16..19)

**Test:** Follow LAUNCH-HANDOFF.md Step 5: ASC → New App → bundle id com.dinnertime.app → fill description/keywords/age/privacy/export-compliance → back-fill ascAppId + appleTeamId into eas.json
**Expected:** ASC record created; eas.json updated; Settings → About Privacy/Terms rows verified to open the hosted URLs
**Why human:** Requires Apple Developer account login; ASC form filling cannot be automated

#### 5. App Store Screenshot Capture + Upload (BETA-14)

**Test:** Boot iPhone 17 Pro simulator, run `maestro test .maestro/38-screenshot-capture.yaml`, rename PNGs to 6_9_shot_N_*.png, repeat for iPhone 11 Pro Max, upload both buckets to ASC
**Expected:** 10 screenshots (5 per device bucket) uploaded to ASC; no debug banners or status-bar artifacts visible
**Why human:** Requires booted simulators with seeded account data; ASC upload requires Patrick's account login

#### 6. EAS Build + TestFlight Submit (BETA-08)

**Test:** Complete RELEASE.md pre-flight checklist, then: `eas build --profile production --platform ios --non-interactive` → `eas submit --profile production --platform ios --latest`
**Expected:** EAS build email received; ASC processing email received; build appears in TestFlight Internal testing group
**Why human:** Requires Apple ID auth in EAS, production backend live at api.dinnertime.app, ascAppId filled in eas.json

#### 7. Configure TestFlight Internal Testing Group (BETA-09)

**Test:** ASC → DinnerTime → TestFlight → Internal Testing → Add Testers with Patrick's Apple ID and household members
**Expected:** Testers invited; build available for download from TestFlight app
**Why human:** Requires ASC login and a completed EAS submit

#### 8. Beta User Invites + Onboarding Observation (BETA-05, BETA-06)

**Test:** Finalize 5-15 invite list; INSERT rows into beta_invites via BETA-PLAYBOOK.md SQL; send welcome emails with TestFlight public link; schedule one 20-min Zoom call with a non-builder per observation script
**Expected:** At least 1 non-builder installs from TestFlight, completes onboarding, and verbatim quotes captured during observation
**Why human:** Requires Patrick's personal contacts, TestFlight public link from ASC, and a willing non-builder participant

#### 9. Real-Kitchen Dogfooding (BETA-01..04)

**Test:** Patrick scans own fridge/pantry from TestFlight iPhone, imports 30 recipes over a week, generates and cooks a 7-day meal plan, submits 5-10 feedback items via Settings → Send feedback
**Expected:** AI suggestions feel accurate against real pantry state; at least one shopping list generated and sent to Instacart; feedback_submissions table has real entries
**Why human:** Requires physical kitchen, real food, and a full week of cooking

#### 10. UI End-to-End: Settings → Send feedback on Simulator

**Test:** Boot a simulator with the dev client installed. Open app → Settings → About. Verify "Send feedback" row is visible. Tap it. Verify modal opens with textarea, character counter, Cancel, and Send buttons.
**Expected:** Modal opens, character counter reads "0 / 4000", Send is disabled, Cancel closes modal without sending
**Why human:** Requires a running simulator with the installed dev client; quick to verify but cannot be asserted by grep

### Gaps Summary

No gaps found in the automated track. All code artifacts are substantive, wired, and passing their tests. All runbook docs are complete, cross-linked, and meet minimum line counts.

The `human_needed` status reflects the fundamental design of Phase 25: the automatable work was all shipped in four plans (25-00..25-03) and is fully verified. The remaining work is inherently human — it requires Patrick's Apple Developer credentials, a physical iPhone, a real kitchen, and real beta users. These are correctly catalogued in `.planning/LAUNCH-HANDOFF.md` as the 12-step execution order Patrick follows on wake.

The Phase 25 goal is achievable. The automated infrastructure is green. The human runway is documented and unblocked.

---

_Verified: 2026-04-20T07:30:00Z_
_Verifier: Claude (gsd-verifier)_
