# DinnerTime Phase 25 — Launch Handoff

Canonical human-action checklist for Phase 25 (Private Beta Launch). Read this ONCE on wake; execute top-to-bottom.

Every item below is either:

- **AUTOMATED** — Claude already shipped the code/docs/tests in 25-00/01/02/03. Patrick just verifies it works.
- **HUMAN-ONLY** — requires Patrick's hands, eyes, or login credentials. Nothing Claude can do.
- **AUTOMATED + HUMAN-ONLY** — Claude shipped the artifact (SQL snippet, migration, runbook, Maestro flow, ASC draft text), Patrick executes it against the live service.

Cross-linked docs:
- [RELEASE.md](./RELEASE.md) — per-release EAS build + submit checklist (Patrick runs on every TestFlight cut)
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Fly.io backend deploy runbook (Patrick runs once at launch)
- [BETA-PLAYBOOK.md](./BETA-PLAYBOOK.md) — invite workflow + beta operating rituals (Patrick runs continuously for the beta window)
- [app-store/](./app-store/) — description, keywords, privacy manifest, shot-list (Patrick pastes into App Store Connect)
- [phases/25-private-beta-launch-*/25-CONTEXT.md](./phases/25-private-beta-launch-real-kitchen-data-family-friends-users-testflight-app-store-release/25-CONTEXT.md) — why Phase 25 split automatable vs human-only this way

## Phase 25 SC coverage matrix

| SC | Status | Owner | Where |
|---|---|---|---|
| BETA-01 Scan real pantry | HUMAN-ONLY | Patrick | iPhone, kitchen |
| BETA-02 Import 30 recipes | HUMAN-ONLY | Patrick | iPhone, ongoing |
| BETA-03 Cook a real week | HUMAN-ONLY | Patrick | Kitchen, 7 days |
| BETA-04 AI suggestions vs real pantry | HUMAN-ONLY | Patrick | Log via Send feedback |
| BETA-05 Invite list confirmed | HUMAN-ONLY | Patrick | [BETA-PLAYBOOK.md § 1](./BETA-PLAYBOOK.md) |
| BETA-06 Onboarding with non-builder | HUMAN-ONLY | Patrick | [BETA-PLAYBOOK.md § 4 Observation Script](./BETA-PLAYBOOK.md) |
| BETA-07 Feedback path | AUTOMATED + HUMAN-ONLY | 25-01 shipped in-app FeedbackSheet / Patrick exercises it | Settings → About → Send feedback |
| BETA-08 TestFlight build uploaded | HUMAN-ONLY | Patrick | [RELEASE.md § EAS build+submit](./RELEASE.md) |
| BETA-09 Internal testing group configured | HUMAN-ONLY | Patrick | App Store Connect → TestFlight → Internal |
| BETA-10 External testing group (if >25 users) | DEFERRED | Patrick | App Store Connect (likely not needed — Phase 25 cap 15) |
| BETA-11 TestFlight crash + feedback review workflow | AUTOMATED + HUMAN-ONLY | 25-01 `/admin/beta-invites` endpoint + [BETA-PLAYBOOK.md § 6 SQL queries](./BETA-PLAYBOOK.md) / Patrick reviews weekly | Supabase SQL editor + ASC TestFlight crashes tab |
| BETA-12 Build numbering / versioning | AUTOMATED | 25-00 `eas.json` `autoIncrement: true` | `apps/mobile/eas.json` |
| BETA-13 ASC listing drafted | AUTOMATED + HUMAN-ONLY | 23-07 drafts / Patrick pastes into ASC forms | [app-store/description.md](./app-store/description.md) + [app-store/keywords.txt](./app-store/keywords.txt) |
| BETA-14 Screenshots captured | AUTOMATED + HUMAN-ONLY | 25-03 Maestro flow 38 / Patrick runs + uploads | [apps/mobile/.maestro/38-screenshot-capture.yaml](../apps/mobile/.maestro/38-screenshot-capture.yaml) |
| BETA-15 App Preview video | DEFERRED | Optional | — |
| BETA-16 Privacy nutrition label | AUTOMATED + HUMAN-ONLY | 23-07 privacy-manifest.json / Patrick fills ASC form | [app-store/privacy-manifest.json](./app-store/privacy-manifest.json) |
| BETA-17 Privacy Policy + Terms published | AUTOMATED + HUMAN-ONLY | 23-07 markdown drafts / Patrick hosts at dinnertime.app/privacy + /terms | `apps/mobile/PRIVACY.md`, `apps/mobile/TERMS.md` |
| BETA-18 Age rating | HUMAN-ONLY | Patrick | ASC → App Information → 4+ |
| BETA-19 Export compliance | HUMAN-ONLY | Patrick | ASC → App Information → Export Compliance → "No" |
| BETA-20 App submitted for review | HUMAN-ONLY | Patrick | ASC → Submit for Review (skip until post-beta if staying TestFlight-only) |
| BETA-21 Release checklist | AUTOMATED | 25-02 shipped | [RELEASE.md](./RELEASE.md) |
| BETA-22 Backend prod deployed | HUMAN-ONLY | Patrick | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| BETA-23 Prod secrets rotated | HUMAN-ONLY | Patrick | [DEPLOYMENT.md § 6 env-var table](./DEPLOYMENT.md) |
| BETA-24 Feedback loop established | AUTOMATED + HUMAN-ONLY | 25-01 infra + [BETA-PLAYBOOK.md § 5 check-ins](./BETA-PLAYBOOK.md) / Patrick runs check-ins | — |
| BETA-25 Distribution posture decided | HUMAN-ONLY | Patrick | Pick: TestFlight only / ASC unlisted / ASC public |
| BETA-26 App Store-public consequences understood | HUMAN-ONLY | Patrick | Read [BETA-PLAYBOOK.md § 8 promote criteria](./BETA-PLAYBOOK.md) |

## Execution order (top-to-bottom)

### Step 1: Verify AUTOMATED work landed (15 min)

Before touching any external service, verify Phase 25 plans 00/01/02/03 landed:

- [ ] `git log --oneline -n 20` shows 25-00, 25-01, 25-02, 25-03 commits
- [ ] `ls supabase/migrations/00029_beta_invites.sql supabase/migrations/00030_feedback_submissions.sql` both exist
- [ ] `pnpm -r typecheck` — pre-existing errors only (see STATE.md line 31); no new regressions from Phase 25
- [ ] `pnpm -r test --run` — pre-existing 13 mobile failures reproduce on HEAD per STATE.md line 31; server `meal-plans.test.ts EMPTY_PANTRY` pre-existing. No NEW failures from Phase 25.
- [ ] `ls .planning/RELEASE.md .planning/DEPLOYMENT.md .planning/BETA-PLAYBOOK.md .planning/LAUNCH-HANDOFF.md` all exist
- [ ] `ls apps/mobile/.maestro/38-screenshot-capture.yaml` exists
- [ ] On a booted simulator: open Settings → About. There is a "Send feedback" row. (If not, 25-01 is incomplete.)

If anything's missing, re-run `/gsd:execute-phase 25` before proceeding.

### Step 2: Apply Supabase migrations to prod (5 min)

Addresses BETA-11, BETA-24 (schema infra for beta tracking + feedback).

```bash
cd /Users/patrickrichards/DinnerTime
supabase db push --linked
supabase db diff --linked    # expect "No schema changes found"
```

If `supabase` CLI isn't linked yet: `supabase link --project-ref <your-project-ref>`. See [DEPLOYMENT.md § 7](./DEPLOYMENT.md) for the pre-deploy gate rationale.

### Step 3: Deploy backend to Fly.io (60-90 min first time)

Addresses BETA-22, BETA-23. Full instructions: [DEPLOYMENT.md](./DEPLOYMENT.md).

- [ ] `brew install flyctl` + `fly auth signup` + billing set up (§ 2)
- [ ] `fly apps create dinnertime-api` (§ 2)
- [ ] Create `packages/server/Dockerfile` per [DEPLOYMENT.md § 4](./DEPLOYMENT.md)
- [ ] Create `packages/server/fly.toml` per [DEPLOYMENT.md § 5](./DEPLOYMENT.md)
- [ ] Rotate + set all 8 secrets via `fly secrets set` (ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, INSTACART_API_KEY, SENTRY_DSN, ADMIN_EMAILS) per [DEPLOYMENT.md § 6](./DEPLOYMENT.md)
- [ ] `cd packages/server && fly deploy`
- [ ] `curl https://dinnertime-api.fly.dev/api/v1/health` returns `{"status":"ok"}`
- [ ] (Optional) Attach custom domain api.dinnertime.app per [DEPLOYMENT.md § 9](./DEPLOYMENT.md) — HARD dependency if the mobile production profile's `EXPO_PUBLIC_API_URL` stays `https://api.dinnertime.app` (EAS bundle-inlines at build time)

### Step 4: Point mobile production build at prod backend (5 min)

- [ ] Confirm `apps/mobile/eas.json` → `build.production.env.EXPO_PUBLIC_API_URL` matches the deployed URL
- [ ] If Step 3 skipped the custom domain and you deployed to `https://dinnertime-api.fly.dev`, edit `eas.json` to match before running `eas build`. Rebuild required for any URL change (per CLAUDE.md § Metro — EXPO_PUBLIC_* vars are bundle-time inlined)

### Step 5: Create App Store Connect record (30 min)

Addresses BETA-13, BETA-16, BETA-17, BETA-18, BETA-19.

- [ ] App Store Connect → Apps → + → New App: name "DinnerTime", bundle id `com.dinnertime.app`, category "Food & Drink", platform iOS
- [ ] Copy App ID back into `apps/mobile/eas.json` → `submit.production.ios.ascAppId` (replaces `TODO-PATRICK-FILLS-ASC-APP-ID`)
- [ ] Copy Team ID from developer.apple.com → Membership into `submit.production.ios.appleTeamId` (replaces `TODO-PATRICK-FILLS-APPLE-TEAM-ID`)
- [ ] Fill App Information: paste [.planning/app-store/description.md](./app-store/description.md), paste [.planning/app-store/keywords.txt](./app-store/keywords.txt)
- [ ] Set Age rating 4+ (no objectionable content)
- [ ] Fill App Privacy: match [.planning/app-store/privacy-manifest.json](./app-store/privacy-manifest.json)
- [ ] Fill Export Compliance: "No" (HTTPS + Keychain only, exempt)
- [ ] Host PRIVACY.md + TERMS.md at dinnertime.app/privacy and /terms (or a GitHub Pages equivalent). See `apps/mobile/PRIVACY.md` + `apps/mobile/TERMS.md` for the source content.
- [ ] Verify from a dev build: Settings → About → Privacy Policy + Terms of Service rows open the hosted URLs (hard-coded to dinnertime.app/privacy + /terms per 23-07)

### Step 6: Capture App Store screenshots (30 min)

Addresses BETA-14. Flow already shipped in 25-03.

- [ ] Seed a test account with >= 4 pantry items, 1 planned day on the current week, 1 saved recipe (unseeded = empty-state shots, not acceptable for ASC)
- [ ] Boot `iPhone 17 Pro`, run `cd apps/mobile && maestro test .maestro/38-screenshot-capture.yaml`
- [ ] Rename captures to `6_9_shot_1_*.png` through `6_9_shot_5_*.png` and move into `.planning/app-store/screenshots/`
- [ ] Boot `iPhone 11 Pro Max`, re-run flow 38
- [ ] Rename captures to `6_5_shot_*.png`
- [ ] Upload both buckets to ASC → DinnerTime → Screenshots (6.9" + 6.5" size classes)
- [ ] Review [app-store/screenshots-shotlist.md](./app-store/screenshots-shotlist.md) post-capture checklist (no status-bar artifacts, no debug banners, no seed-data emails)

### Step 7: Build + submit via EAS (20 min wall time; most is EAS build queue)

Addresses BETA-08. Full instructions: [RELEASE.md](./RELEASE.md).

- [ ] Run [RELEASE.md § 2 pre-flight](./RELEASE.md) (typecheck + tests + lint + Maestro smoke + health curl)
- [ ] Version bump `apps/mobile/app.json` → `expo.version = "1.0.0"` → `git commit`
- [ ] `cd apps/mobile && eas build --profile production --platform ios --non-interactive`
- [ ] Wait for EAS build email (~15 min)
- [ ] `eas submit --profile production --platform ios --latest` — will prompt for ascAppId + appleTeamId on first submission if Step 5 didn't edit `eas.json`
- [ ] Wait for ASC processing email (~10-30 min)
- [ ] Post-submit smoke per [RELEASE.md § 5](./RELEASE.md) — scan → suggest → plan → cook on the TestFlight build, Sentry check, `feedback_submissions` row check

### Step 8: Configure TestFlight Internal testing group (10 min)

Addresses BETA-09.

- [ ] ASC → DinnerTime → TestFlight → Internal Testing → Add Testers → your Apple ID + household members (up to 100 Apple IDs, no App Review)
- [ ] (Skip External Testing — Phase 25 caps at 15 users, Internal suffices. If cohort grows >25, return here for External — requires App Review. See [BETA-PLAYBOOK.md § 1](./BETA-PLAYBOOK.md))

### Step 9: Invite beta users (BETA-05, BETA-06, BETA-07 setup — 30 min)

Full playbook: [BETA-PLAYBOOK.md](./BETA-PLAYBOOK.md).

- [ ] Finalize invite list (5-15 names per [BETA-PLAYBOOK.md § 1](./BETA-PLAYBOOK.md) target composition table)
- [ ] Insert into `beta_invites` via SQL snippets from [BETA-PLAYBOOK.md § 2](./BETA-PLAYBOOK.md) (look up YOUR_UUID → bulk INSERT INTO beta_invites)
- [ ] Grab TestFlight invite URL from ASC → TestFlight → Internal → Public Link
- [ ] Send individual welcome emails per [BETA-PLAYBOOK.md § 3](./BETA-PLAYBOOK.md) template, including the TestFlight URL
- [ ] Schedule at least ONE non-builder observation test (20-min Zoom or in-person call) per [BETA-PLAYBOOK.md § 4](./BETA-PLAYBOOK.md) — this is the single highest-signal activity in the beta window (BETA-06)

### Step 10: Dogfood on real kitchen (BETA-01..04 — ongoing, ~1 week wall time)

- [ ] Scan real fridge/pantry/freezer from own iPhone installed from TestFlight (BETA-01)
- [ ] Import 30 real recipes over the week via URLs, photos, manual entry (BETA-02)
- [ ] Generate + cook + shop a full 7-day meal plan from real pantry state (BETA-03)
- [ ] Log 5-10 feedback submissions via Settings → Send feedback noting which AI suggestions felt right and which didn't (BETA-04) — these land in `feedback_submissions` via the 25-01 pipeline

### Step 11: Run beta ritual (BETA-24 — ongoing, weeks 1-4)

Per [BETA-PLAYBOOK.md § 5 check-in schedule](./BETA-PLAYBOOK.md):

- [ ] Day 1 per-user: "Did TestFlight install work?"
- [ ] Day 3 per-user: "Any first reactions?"
- [ ] Day 7 per-user: "Cooked from a suggestion yet?"
- [ ] Week 2 per-user: schedule 20-min call
- [ ] Week 4 per-user: "Still using it?"

Friday-weekly: triage `feedback_submissions` per [BETA-PLAYBOOK.md § 7 Friday triage labels](./BETA-PLAYBOOK.md). Use the SQL snippets in [BETA-PLAYBOOK.md § 6](./BETA-PLAYBOOK.md) for status aggregation + feedback feed + activation funnel.

### Step 12: Decide distribution posture (BETA-25, BETA-26)

After ~2 weeks of stable TestFlight:

- [ ] Read [BETA-PLAYBOOK.md § 8 promote criteria](./BETA-PLAYBOOK.md) (7 checkboxes: 0 crashes / 5+ full-flow completions / 0 open P0 / ASC assets ready / dogfood bar met / prod backend 14+ days green / privacy+terms hosted)
- [ ] Pick posture: stay TestFlight / ASC unlisted / ASC public
- [ ] If promoting (BETA-20): kick off App Review submission via ASC → DinnerTime → Submit for Review. Note: going public means anyone can install — confirm BETA-26 understanding before submitting.

## Open questions Patrick decides

- [ ] Prod backend URL: `dinnertime-api.fly.dev` vs custom `api.dinnertime.app` (custom needs DNS access + AASA update per [DEPLOYMENT.md § 9](./DEPLOYMENT.md))
- [ ] Fly.io region: default `sea` (Seattle) — change if testers skew East Coast / UK (per [DEPLOYMENT.md § 5](./DEPLOYMENT.md))
- [ ] Group chat channel for beta cohort: Slack / iMessage group / WhatsApp (per [BETA-PLAYBOOK.md § 9 open questions](./BETA-PLAYBOOK.md))
- [ ] App Preview video (BETA-15): record 30s clip or defer to post-beta
- [ ] Observation-test recording consent (per [BETA-PLAYBOOK.md § 9](./BETA-PLAYBOOK.md)) — ask-first vs ambient notes

## When Phase 25 is "done"

Per [25-VALIDATION.md](./phases/25-private-beta-launch-real-kitchen-data-family-friends-users-testflight-app-store-release/25-VALIDATION.md):

- [x] Automatable artifacts landed (this checklist's Step 1 confirms — migrations + feedback pipeline + runbooks + Maestro flow 38 + LAUNCH-HANDOFF all shipped across 25-00/01/02/03)
- [ ] TestFlight build uploaded AND at least 1 non-builder tester onboarded successfully — Patrick's responsibility post-handoff. Unblocked after Step 7 (TestFlight upload) + Step 9 (invite sent) + Step 11 Day 1 check-in (non-builder confirms install + first scan).

## If something is broken

If Step 1 verification fails — any missing file, any broken test that ISN'T on the pre-existing-failure list in STATE.md line 31, or any missing Send-feedback row — do NOT proceed to Step 2. Re-plan the gap:

```
/gsd:plan-phase 25 --gaps
```

This generates targeted fix plans for whichever artifact is missing. Only after the gap plan lands and Step 1 passes again should you resume at Step 2.
