# Phase 25: Private Beta Launch - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode, Claude-selected defaults)

<domain>
## Phase Boundary

Ship DinnerTime to family + friends via TestFlight. This phase splits cleanly into **automatable prep work** and **human-only launch actions**.

**Automatable (Claude will do):**
- In-app feedback form + endpoint
- Release checklist doc (`.planning/RELEASE.md`)
- Build numbering/versioning strategy
- EAS build/submit config
- Backend production-readiness doc (env vars, Fly.io/Railway setup instructions)
- Onboarding polish tests
- Screenshot Maestro flow for simulator
- Beta invite tracking table + admin endpoints
- Beta feedback schema + server ingestion

**Human-only (Patrick, on wake):**
- Scan real pantry (SC-1)
- Import 30 real recipes (SC-2)
- Cook a real week of meal plans (SC-3)
- Evaluate AI suggestions against real pantry (SC-4)
- Confirm invite list + send invites (SC-5)
- Test onboarding with non-builder (SC-6)
- TestFlight upload (SC-8)
- App Store Connect form filling, screenshots, privacy label (SC-13..20)
- Backend deployment to Fly.io/Railway (SC-22, 23)
- Beta user check-ins (SC-24)
- Distribution posture decision (SC-25, 26)

**Out of scope:**
- Actual App Store Review submission — Patrick decides timing.
- Patrick's personal dogfooding schedule — Claude drafts the plan, Patrick executes.
- Paid marketing / growth — not relevant for private beta.

</domain>

<decisions>
## Implementation Decisions

### Feedback Infrastructure (SC 7, 11, 24)

- **In-app feedback form:** New `FeedbackSheet` component in Settings (Phase 19 tokens). Fields: message (textarea), email (prefilled), screenshot-optional. Server `/feedback` endpoint stores in new `feedback_submissions` table.
- **TestFlight feedback:** Native to TestFlight — no code needed; documented in RELEASE.md.
- **Beta check-in tracking:** `beta_invites` table with status (invited, onboarded, first_cook, week_1_checkin). Admin endpoint lists invites; no admin UI (Patrick uses SQL).

### Release Infrastructure (SC 8, 12, 21, 22, 23)

- **`.planning/RELEASE.md`** — step-by-step release checklist: version bump command, EAS build, EAS submit, changelog update, announce template.
- **Build numbering:** EAS auto-increment (`"autoIncrement": true` in eas.json). Version follows semver; v1.0.0 for first TestFlight.
- **`.planning/DEPLOYMENT.md`** — Fly.io setup instructions for backend: `fly launch`, env var migration from `.env` → `fly secrets`, health check config, deployment pipeline. Patrick executes.
- **Prod secrets rotation:** Document in `.planning/DEPLOYMENT.md` — list of env vars requiring prod rotation (Anthropic API key, Supabase service role, Instacart API key).

### App Store Assets (SC 13-19)

- Reuse `.planning/app-store/` drafts from Phase 23-07 (description, keywords, privacy-manifest.json, screenshots-shotlist).
- **Screenshots:** Automated Maestro flow captures iPhone 17 Pro simulator renders; Patrick runs Xcode's "Create App Preview" manually if he wants the 30s video.
- **App Preview video (SC 15):** Deferred — drafted shot-list only. Patrick decides if needed.
- **Privacy Policy / Terms:** Already in `apps/mobile/PRIVACY.md` + `TERMS.md` (Phase 23-07). Host on `dinnertime.app/privacy` + `/terms` (Patrick deploys — doc in DEPLOYMENT.md).
- **Age rating:** 4+ (no objectionable content).
- **Export compliance:** "No" — only HTTPS + Keychain (standard, exempt).

### Beta User Management (SC 5-7, 24)

- **Invite tracking:** Supabase `beta_invites` table. Admin SQL snippets documented in `.planning/BETA-PLAYBOOK.md`.
- **Beta Playbook doc:** Who invites, when, welcome-email template, check-in schedule (day 1 / day 7 / week 2), feedback prompts.

### Claude's Discretion

- Exact feedback form UX polish
- Admin endpoint auth (reuse existing auth middleware, gate by user email matching allowlist)
- Screenshot shot composition
- Fly.io vs Railway recommendation (research in plan)

</decisions>

<code_context>
## Existing Code Insights

- **Phase 23-07 assets:** `.planning/app-store/` has privacy-manifest.json, description.md, keywords.txt, screenshots-shotlist.md ready.
- **Phase 23-07 legal:** `apps/mobile/PRIVACY.md`, `apps/mobile/TERMS.md`.
- **Phase 23-01 Settings About section:** Already has version/build number + privacy/terms links.
- **Phase 23-06 Sentry:** Ready for prod DSN.
- **Phase 23-07 SECURITY.md:** Audit trail + grep contracts ready.
- **EAS config:** `apps/mobile/eas.json` — extend with production profile.

</code_context>

<specifics>
## Specific Ideas

- **BETA-PLAYBOOK.md sections:** Invite List Template, Welcome Email Template, Onboarding Script (5-min observed-test), Day-7 Check-in Script, Feedback Categorization Template.
- **RELEASE.md sections:** Pre-flight checklist, Version bump command, EAS build commands, EAS submit, Post-submit smoke, Changelog template, Announcement template (Slack/SMS).
- **DEPLOYMENT.md sections:** Fly.io vs Railway comparison, Server prep (health check, logging), Env var migration, Deploy commands, Rollback plan, Post-deploy smoke.

</specifics>

<deferred>
## Deferred Ideas

- Public App Store launch (Phase 25 is TestFlight-first).
- Paid user acquisition.
- Web marketing site beyond privacy/terms hosting.
- Referral mechanics.
- Pricing / subscription model — DinnerTime is free during beta.

</deferred>
