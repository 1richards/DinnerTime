# RELEASE.md — DinnerTime Per-Release Checklist

**Audience:** Patrick (human executor).
**Purpose:** Copy-pasteable runbook for every TestFlight / App Store release.
**Cross-links:** [DEPLOYMENT.md](./DEPLOYMENT.md) (backend), [BETA-PLAYBOOK.md](./BETA-PLAYBOOK.md) (beta users).

---

## 1. Decision: release type

Before starting, decide which release this is:

| Release type | When | Review time | Iteration speed |
|---|---|---|---|
| **TestFlight — Internal** (Phase 25 default) | <25 testers, family/friends | Instant (no App Review) | Push new builds any time; testers pull via TestFlight app |
| **TestFlight — External** | 25+ testers, or external link | ~24h first-time; subsequent builds near-instant | Same as Internal once approved |
| **Public App Store** | Broad launch | 1–3 days (App Review) | Slow — each change re-reviewed |

**Phase 25 default:** Internal TestFlight. See BETA-PLAYBOOK.md § "When to promote TestFlight → public App Store" for promotion criteria.

---

## 2. Pre-flight checklist

Work through this list **in order**. Do not skip. If any step fails, stop and fix before cutting a build — a broken build costs ~30 min of ASC processing to replace.

- [ ] `git status` clean (no uncommitted changes):
  ```bash
  cd /Users/patrickrichards/DinnerTime && git status
  ```
- [ ] Typecheck green across the workspace:
  ```bash
  cd /Users/patrickrichards/DinnerTime && pnpm -r typecheck
  ```
- [ ] Tests green across the workspace:
  ```bash
  cd /Users/patrickrichards/DinnerTime && pnpm -r test --run
  ```
- [ ] Lint green across the workspace:
  ```bash
  cd /Users/patrickrichards/DinnerTime && pnpm -r lint
  ```
- [ ] Metro export succeeds (catches bundle-time errors EAS Build would surface 15 min in):
  ```bash
  cd /Users/patrickrichards/DinnerTime/apps/mobile && npx expo export --platform ios --output-dir /tmp/expo-export
  ```
- [ ] Simulator smoke passes:
  ```bash
  cd /Users/patrickrichards/DinnerTime/apps/mobile && maestro test .maestro/smoke.yaml
  ```
- [ ] Backend health check returns `{"status":"ok"}`:
  ```bash
  curl https://api.dinnertime.app/api/v1/health
  ```
  If the prod backend is not yet provisioned, follow [DEPLOYMENT.md](./DEPLOYMENT.md) first. Do NOT cut a mobile build that points at a non-existent backend.
- [ ] Supabase prod migrations applied (zero pending diff):
  ```bash
  cd /Users/patrickrichards/DinnerTime && supabase db diff --linked
  ```
  Must output zero pending migrations. If anything shows, `supabase db push --linked` first.
- [ ] `.planning/STATE.md` updated with a one-sentence summary of what's shipping in this release.

---

## 3. Version bump

Semver rules for DinnerTime:

| Change | Bump |
|---|---|
| TestFlight beta iteration, bugfix only | `1.0.0 → 1.0.1` |
| New user-facing feature, no breaking UX | `1.0.x → 1.1.0` |
| Breaking UX change (e.g. new onboarding) | `1.x → 2.0.0` |

Edit `apps/mobile/app.json`:

```bash
# Open in editor, find `"expo": { "version": "<OLD>" }` and bump
vim /Users/patrickrichards/DinnerTime/apps/mobile/app.json
```

Commit the bump on its own line:

```bash
cd /Users/patrickrichards/DinnerTime && git commit -am "release: v<VERSION>"
```

**Build number is NOT edited by hand.** `apps/mobile/eas.json` production profile has `"autoIncrement": true` — EAS auto-increments iOS build number on every `eas build`.

---

## 4. EAS build + submit

Two commands. Run them from `apps/mobile`:

```bash
cd /Users/patrickrichards/DinnerTime/apps/mobile
eas build --profile production --platform ios --non-interactive
eas submit --profile production --platform ios --latest
```

**Expected timing:**
- `eas build` — 15–25 min (m-medium resource class, per eas.json).
- `eas submit` — <1 min to hand off, then ~10 min ASC processing email before the build is available in TestFlight.

**First-submission caveat:** The first time you run `eas submit`, it may prompt for `ascAppId` and `appleTeamId` because `apps/mobile/eas.json` currently has placeholder TODO strings:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "patrickrrichards@gmail.com",
      "ascAppId": "TODO-PATRICK-FILLS-AFTER-ASC-CREATE",
      "appleTeamId": "TODO-PATRICK-FILLS-FROM-DEVELOPER-ACCOUNT"
    }
  }
}
```

Paste the real values into eas.json (see § 9 Open questions below for where to find them), commit the change (`chore(eas): fill ascAppId + appleTeamId`), and subsequent submits will auto-fill.

---

## 5. Post-submit smoke

After ASC sends the "Build processing complete" email (~10 min post-submit):

1. Open App Store Connect → My Apps → DinnerTime → TestFlight.
2. Confirm the build appears with the correct version + build number.
3. For Internal group: push the build to the group. Testers get a TestFlight notification on iPhone within ~1 min.
4. Install on your own physical iPhone via TestFlight app.
5. **Complete the full flow end-to-end:**
   - Launch → sign in (or sign up for a fresh account if testing onboarding).
   - Scan pantry (`/scan`) → confirm items appear in Kitchen.
   - Suggest (`/suggest`) → pick one → save.
   - Plan (`/plan`) → add saved recipe to a day.
   - Cook flow → mark cooked → confirm telemetry hits Sentry + cooking_events table.
   - Shopping handoff → verify Instacart link opens.
6. Check [Sentry](https://sentry.io) — confirm `DinnerTime-mobile` project has zero new unhandled errors for the new release tag.
7. Check Supabase → `feedback_submissions` table is empty for this release (no user has filed yet), and `ai_events` has the new release's `app_version` tag.

Only after the full flow passes should you notify beta testers via [BETA-PLAYBOOK.md](./BETA-PLAYBOOK.md) § "Check-in schedule".

---

## 6. Changelog template

Paste this into ASC → TestFlight → Build → **"What to Test"** (4000 char max):

```
DinnerTime v<VERSION> build <BUILD_NUMBER>
Shipped <YYYY-MM-DD>

What changed
- <one-line item 1>
- <one-line item 2>
- <one-line item 3>

What to test
- <specific flow, e.g. "Open /suggest, tap 'Something New' tab, try 3 different queries.">
- <specific flow, e.g. "Plan a week → tap 'Shopping list for week' → confirm Instacart opens.">

Known issues
- <anything broken or partial — be honest>

Feedback
Please use Settings → Send feedback inside the app, or reply to Patrick directly.
Bugs: include device, iOS version, and steps to repro.
```

Keep each entry under 100 chars. Testers skim.

---

## 7. Announcement template

For a notable release (new feature, major fix), send a short note via the group chat channel chosen in BETA-PLAYBOOK.md § 9. One paragraph, link-less (TestFlight auto-notifies):

```
Hey everyone — DinnerTime v<VERSION> is rolling out to TestFlight now
(should land on your phone in <10 min). The big change this time is
<1-sentence headline>. If you have 5 min tonight, try <specific flow>
and let me know what breaks. As always: Settings → Send feedback inside
the app captures bug reports best. Thanks for being on this with me.
```

Skip the announcement for routine bugfix builds — testers get notified by TestFlight automatically. Over-messaging causes opt-outs.

---

## 8. Rollback

If a shipped build is broken (crash on launch, data loss, auth failure):

**(a) Expire the bad build:**
1. ASC → My Apps → DinnerTime → TestFlight → Builds.
2. Click the bad build → "Expire Build" (testers can no longer install it).

**(b) Re-push the prior known-good build:**
1. ASC → TestFlight → Groups → Internal (or your test group).
2. Add the previous known-good build to the group. Testers re-install it from TestFlight.

**(c) Patch + re-cut:**
1. Fix the issue on `main`. Run the full § 2 pre-flight checklist.
2. Bump patch version (`1.0.5 → 1.0.6`).
3. Re-run § 4 build + submit.

**Backend rollback:** see [DEPLOYMENT.md](./DEPLOYMENT.md) § "Rollback". Mobile app version and backend version can rollback independently.

---

## 9. Open questions (Patrick decides at execution)

Unresolved items Patrick should handle at release time. Turn each into a `fill-out / confirm` action.

- [ ] **ascAppId** — created yet?
  - If NO: ASC → My Apps → `+` → New App. Name: "DinnerTime". Bundle ID: `com.dinnertime.app`. SKU: `dinnertime-ios-2026`. Primary Language: English (U.S.). Paste listing content from `.planning/app-store/description.md` + `.planning/app-store/keywords.txt`. Then copy the 10-digit Apple ID from the App Information page and paste into `apps/mobile/eas.json` submit.production.ios.ascAppId.
  - If YES: confirm the value in eas.json matches the ASC App Information page.
- [ ] **appleTeamId** — from developer.apple.com → Membership → Team ID (10-char string). Paste into `apps/mobile/eas.json` submit.production.ios.appleTeamId.
- [ ] **Internal vs External TestFlight group** — Phase 25 default is Internal (cap 25, no App Review, instant). Switch to External only if you want >25 testers or a public-link recruit flow. See [BETA-PLAYBOOK.md](./BETA-PLAYBOOK.md) § 1 for invite-count rationale.
- [ ] **Screenshots for ASC listing** — required at ASC submission time (not required for TestFlight). Capture from the iPhone 17 Pro simulator per `.planning/app-store/screenshots-shotlist.md`. Run [BETA-PLAYBOOK.md](./BETA-PLAYBOOK.md) § 4 Onboarding Observation Script **first** so you have a real pantry + real plan loaded before capture — empty-state screenshots look like a broken app.
- [ ] **Privacy + Terms hosting** — ASC requires public URLs. Host `apps/mobile/PRIVACY.md` at `https://dinnertime.app/privacy` and `apps/mobile/TERMS.md` at `https://dinnertime.app/terms`. See DEPLOYMENT.md § "Custom domain" for DNS and § "Post-deploy smoke" for the verification step.
- [ ] **Export compliance** — ASC asks. Answer: **No** (HTTPS + Keychain only, standard exempt). Saves re-answering every build.
- [ ] **Age rating** — 4+ (no objectionable content). Set once at ASC listing creation.

---

**Last updated:** 2026-04-22 (Phase 25 Plan 25-02).
**Owner:** Patrick.
**Next review:** After first production TestFlight cut.
