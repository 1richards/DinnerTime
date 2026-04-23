# Phase 23: Settings, Auth & Non-Functional Requirements - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode, Claude-selected defaults)

<domain>
## Phase Boundary

Production-grade quality pass covering 7 clusters:
1. **Account management** (password, email, export, delete, connected services, about)
2. **Auth lifecycle** (biometric, session refresh, forgot-password, sign-out, onboarding resume)
3. **Error handling** (global boundary, network, rate-limit)
4. **Observability** (Sentry, structured logs, AI telemetry)
5. **Performance** (startup, transitions, scan latency, image handling)
6. **Security** (keychain, HTTPS-only, deep-link allowlist, PII hygiene)
7. **App Store readiness** (privacy labels, screenshots, legal pages, support contact)

**Out of scope:**
- Building a web dashboard for account management (iOS-only).
- Account recovery via phone/2FA (just password-reset email).
- Third-party OAuth (Apple Sign-In, Google) — deferred.
- Marketing-site privacy policy authorship (use template/existing).
- A/B testing infrastructure — deferred.

</domain>

<decisions>
## Implementation Decisions

### Account Management (SC 1-6)

- **Change password:** Supabase `updateUser({ password })` with current-password re-auth prompt.
- **Change email:** Supabase `updateUser({ email })` triggers confirmation email; old email active until confirmed.
- **Export data:** Server endpoint `GET /account/export` returns JSON with profile + pantry + recipes + meal-plans + cook-history. Mobile triggers share sheet to save as file.
- **Delete account:** Destructive confirm → POST `/account/delete` → server cascades delete + Supabase auth delete → sign-out. 30-day retention policy documented in the confirm.
- **Connected services:** Section lists "Instacart" with connect/disconnect (v1: always shows "Not connected" since current flow is anonymous link — wire actual connection state as follow-up).
- **About section:** Version from `app.json`, build number from native, privacy/terms links to `https://dinnertime.app/privacy` and `/terms` (placeholder URLs), support email `support@dinnertime.app`.

### Auth Lifecycle (SC 7-11)

- **Biometric unlock:** `expo-local-authentication` — opt-in toggle in Settings; on app foreground, prompt Face ID to unlock if enabled.
- **Session refresh:** Supabase handles refresh automatically; intercept 401 in a shared fetch wrapper, trigger silent refresh; if refresh fails → show `ReAuthModal` instead of full sign-out.
- **Forgot password:** `/auth/forgot-password` screen → Supabase `resetPasswordForEmail` → user clicks email link → universal link deep-links into `/auth/reset-password` with token.
- **Sign-out confirm:** Current alert, improve copy ("Sign out? This clears local data like scanned pantry photos and draft meal plans. Cloud data stays.").
- **Onboarding resume:** Check `profile.onboarded_at` on sign-in; if null, resume onboarding; if set, go to tabs.

### Error Handling (SC 12-14)

- **Global error boundary:** React `ErrorBoundary` wraps the root Stack; friendly fallback with "Report issue" button (sends breadcrumbs + error to server).
- **Network errors:** Reusable `NetworkErrorBanner` + consistent retry pattern. `NetInfo` detects offline → banner "You're offline — some features limited".
- **Rate-limit:** Backend maps Anthropic/Supabase rate-limit responses to user-facing copy. Retry-after header respected in client.

### Observability (SC 15-17)

- **Sentry:** `@sentry/react-native` wired; DSN from env; user-correlated session IDs; breadcrumbs on tab switches / scans / cook sessions.
- **Server logs:** Hono middleware for structured JSON logs with request_id/user_id/route/latency/status — pipe to stdout, Fly.io or hosting platform captures.
- **AI telemetry:** Extend existing telemetry pipeline to capture per-call: model, task route, tokens in/out, latency. New `ai_events` table or extend existing `cooking_events`/`shopping_events` pattern.

### Performance (SC 18-21)

- **Startup budget:** Audit current cold-start; defer non-critical work via lazy imports; target < 2s on iPhone 15+. Measure via Sentry performance traces.
- **Transitions:** `expo-router` stack animations already native; verify no JS-thread blocking. Reanimated worklets for gesture anims.
- **Scan latency:** Spinner within 100ms; streaming feedback during AI call (reuse SSE pattern from Phase 16).
- **Image handling:** Keep existing `quality: 0.4` cap (documented in CLAUDE.md). Use `expo-image-manipulator` for resize when needed.

### Security (SC 22-25)

- **Keychain audit:** Verify all Supabase tokens go through `expo-secure-store` (CLAUDE.md notes simulator fallback to AsyncStorage — expected). Instacart has no stored tokens (anonymous link).
- **HTTPS-only:** ATS configuration in `app.json`/Info.plist to reject HTTP; server redirects to HTTPS.
- **Deep link allowlist:** Router-level filter on incoming URLs; reject anything outside `/recipes/*`, `/scan/*`, `/auth/reset-password/*`, `/plan/*`.
- **PII hygiene:** Audit `console.log` calls; wrap with `__DEV__` guards; Sentry beforeSend strips emails/names from payloads.

### App Store Readiness (SC 26-29)

- **Privacy nutrition label:** Draft JSON manifest listing collected data (email, photos (local-only), recipe titles, cook history).
- **Screenshots & description:** Drafts committed to `.planning/app-store/` — user finalizes on App Store Connect.
- **Legal pages:** Placeholder `PRIVACY.md` and `TERMS.md` in repo; link from Settings using `WebBrowser.openBrowserAsync`.
- **Support contact:** `mailto:support@dinnertime.app` in Settings + in error-report flow.

### Claude's Discretion

- Exact Sentry DSN/env-var pattern (planner decides)
- Biometric fallback copy
- Whether `ai_events` is new table or extension of existing telemetry
- Error-boundary UI polish level
- Privacy/terms text draft (use generic SaaS template)

</decisions>

<code_context>
## Existing Code Insights

### Phase 1 Auth Infrastructure
- `apps/mobile/src/app/(auth)/` — login, signup screens
- `apps/mobile/src/stores/authStore.ts` — Supabase auth state
- `apps/mobile/src/lib/supabase.ts` — client with AsyncStorage/SecureStore adapter

### Phase 2 Preferences + Settings
- `apps/mobile/src/app/(tabs)/settings.tsx` (already extended in Phase 16 cooking section + Phase 20 shopping section + Phase 22 plan section)

### Phase 19 Design
- All new Settings rows use Phase 19 tokens + patterns established.

### Backend
- `packages/server/src/routes/*` — existing routes
- Auth middleware pattern at `packages/server/src/middleware/auth.ts`

### Integration Points
- Error boundary wraps `_layout.tsx` root Stack
- Sentry init in `app/_layout.tsx` before any other code
- Deep link handler in `app/_layout.tsx` via `Linking`
- Deep link allowlist in `app.json` scheme config

</code_context>

<specifics>
## Specific Ideas

- **Settings info architecture:** Account / Preferences / Connected Services / Cooking / Shopping / Plan / About — use section grouping with section headers (Phase 19 list pattern).
- **Delete account UX:** Two-step confirm (type "DELETE" + tap red button) to prevent fat-finger loss.
- **ReAuthModal:** Minimal modal with password input + "Sign in" button; preserves current navigation state.
- **Global error boundary fallback:** App logo + "Something went wrong" + "Restart app" + "Report issue" CTAs.

</specifics>

<deferred>
## Deferred Ideas

- Apple Sign-In / Google OAuth
- Web dashboard for account management
- Phone-based 2FA
- A/B testing framework
- User analytics (mixpanel/amplitude — separate from error reporting)
- Localization / i18n beyond English
- Accessibility audit (deferred — Phase 19 established token foundation)

</deferred>
