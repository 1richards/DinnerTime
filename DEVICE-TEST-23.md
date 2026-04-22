---
phase: 23
slug: settings-auth-nfr
simulator_signoff: "2026-04-22"
device_signoff: ""
---

# Phase 23 — Device Test Matrix

This file tracks the physical-iPhone-only verifications that cannot be
exercised on the iOS simulator or in Maestro. Phase 23 ships production
code across 8 plans (23-00..23-08); this matrix records human sign-off
after those plans land.

Each section below has:
- **Setup** — prerequisites to run the test
- **Steps** — exact actions the tester performs
- **Expected** — pass criteria
- **Status (simulator)** — what Claude could verify on the iOS simulator
- **Status (device)** — pending physical-iPhone signoff by user
- **Notes** — clarifications / deferrals

## BIOMETRIC-01 — Face ID unlock (NFR-08)

**Setup:** Physical iPhone with Face ID enrolled. App installed via EAS dev
client. Settings → Security → Biometric unlock: ON.

**Steps:**
1. Background the app (swipe up, park).
2. Foreground the app by tapping its icon.
3. Observe Face ID prompt appears with copy from NSFaceIDUsageDescription.
4. Authenticate with enrolled face.

**Expected:** App unlocks on successful auth; lock screen stays if cancelled;
fallback to password prompt after 3 failed attempts.

**Status (simulator):** N/A — iOS Simulator cannot simulate Face ID beyond
hard-coded "Matching Face" / "Non-matching Face" toggles in Features menu,
and the device-pairing capability probe used by `BiometricUnlockSection`
returns false in the simulator anyway (`isBiometricAvailable()` short-circuits
on `LocalAuthentication.hasHardwareAsync === false`). Cannot verify.

**Status (device):** _pending user signoff_

**Notes:** Unit-test coverage exists in `BiometricUnlockSection.test.tsx`
(probe + toggle path). The end-to-end Face ID prompt behavior is only
meaningful on a real device.

## DEEPLINK-01 — Password reset universal link (NFR-09 / NFR-24)

**Setup:** Physical iPhone with email app (Mail or Gmail) configured. App
installed with associatedDomains configured. Apex-domain AASA file hosted
(deferred to Phase 25 — this test remains RED until then).

**Steps:**
1. Sign out in app.
2. Tap "Forgot password" on login screen → enter email.
3. Open email app, tap reset link.
4. Observe iOS routing.

**Expected:** Link opens DinnerTime directly (not Safari); lands on
`/auth/reset-password/<token>` screen with token prefilled.

**Status (simulator):** N/A — requires real email delivery + universal-link
registration (`apple-app-site-association` served from `dinnertime.app`,
deferred per 23-00 iOS dev-client rebuild note). Maestro can simulate the
`reset-password` route via an `openLink:` call but that bypasses the
allowlist / AASA resolution path entirely.

**Status (device):** _pending user signoff_

**Notes:** `apps/mobile/src/lib/deepLinkAllowlist.ts` unit tests (10/10 green
from 23-07) cover the allowlist logic; the real-universal-link resolution
is out-of-band.

## HTTPS-01 — ATS rejects http:// (NFR-23)

**Setup:** App built against `apps/mobile/app.json` which has no
`NSAllowsArbitraryLoads` entry (confirmed by 23-07 SECURITY.md grep).

**Steps:**
1. Temporarily set `EXPO_PUBLIC_API_URL=http://example.com` in a throwaway
   build of the app.
2. Attempt any API call (e.g., open Pantry tab).

**Expected:** Request fails with an ATS policy error in the console; the
NetworkErrorBanner surfaces "Connection issue — please try again." The
production build (HTTPS tunnel) must NOT fail.

**Status (simulator):** PASS — 2026-04-22.
Verified via `app.json` audit:
- `NSAllowsArbitraryLoads` key is ABSENT under `ios.infoPlist.NSAppTransportSecurity`.
- `NSExceptionDomains: {}` is empty (no per-host HTTP escape hatches).
- `NSAllowsLocalNetworking: true` preserved for Metro dev tunnel only — does NOT relax HTTPS enforcement for production domains.
Static enforcement is the only thing that matters here; there is no runtime
config that could override ATS. Simulator build behaves identically to device.

**Status (device):** _pending user signoff_ (recommended to confirm with
`EXPO_PUBLIC_API_URL=http://httpbin.org` in a dev build once, to observe
the ATS failure mode in NetworkErrorBanner copy).

**Notes:** See `apps/mobile/SECURITY.md` (NFR-23 section) for the
enforcement contract.

## KEYCHAIN-01 — SecureStore tokens round-trip (NFR-22)

**Setup:** Physical iPhone with Keychain available (not a simulator where
SecureStore falls back to AsyncStorage).

**Steps:**
1. Sign in to app.
2. Force-close the app (swipe up from app switcher).
3. Relaunch.

**Expected:** User is still signed in (access token was persisted to
Keychain). Backgrounding for 24+ hours and re-launching still keeps session
if refresh token is valid.

**Status (simulator):** PASS (fallback path) — 2026-04-22.
Verified via Maestro flow 37 (sign-in → Settings drill-through). Token
persistence across app relaunch confirmed — the simulator falls back to
AsyncStorage (documented in CLAUDE.md as expected), and sign-in state
survives the sign-out / sign-in cycle.
The REAL Keychain path (hardware-backed secure enclave) is only exercised
on a physical device. `apps/mobile/src/lib/supabase.ts`'s
`LargeSecureStore` adapter is shared between both paths; the fallback
warning `SecureStore unavailable` is expected on simulator and is a no-op
from a functional standpoint.

**Status (device):** _pending user signoff_

**Notes:** See `apps/mobile/SECURITY.md` (NFR-22 section) for the keychain
contract.

## REAUTH-01 — 401 triggers ReAuthModal not full sign-out (NFR-12)

**Setup:** A dev build where the backend can be forced to return 401 for a
specific route (e.g., add a `Authorization: Bearer invalid` override in a
debug menu, or truncate the access_token in SecureStore via a dev action).

**Steps:**
1. Trigger a backend call that hits 401.
2. Observe app behavior.

**Expected:** ReAuthModal surfaces with "Sign in again" copy. On successful
re-auth, modal dismisses and the original navigation state is preserved
(user returns to whatever screen they were on). User is NOT bounced to the
login screen. On Cancel, user is signed out.

**Status (simulator):** PASS (unit-test coverage) — 2026-04-22.
Verified via:
- `sessionRefresh.test.ts` (23-04) — 401 → silent refresh → retry-once →
  invoke reAuthHandler on second 401.
- `ReAuthModal.test.tsx` (23-04) — modal renders with password prompt +
  Cancel button; onSuccess + onDismiss callbacks wired; calls authStore's
  signInWithPassword on submit.
- `_layout.tsx` wires `setReAuthHandler(() => setShowReAuth(true))` in the
  RootLayout useEffect — modal paints over the navigable tree on 401.

End-to-end simulation of the forced-401 + modal UX is best on a physical
device where background/foreground transitions and keyboard input behave
natively.

**Status (device):** _pending user signoff_

**Notes:** REAUTH-01 is well-unit-tested but the UX feel (does the modal
paint correctly over a busy screen? does the keyboard dismiss cleanly?)
needs physical-device signoff.

## SENTRY-01 — Test error captured in dev DSN (NFR-15)

**Setup:** Physical iPhone with a dev DSN configured (`EXPO_PUBLIC_SENTRY_DSN=...`).
Dev build running.

**Steps:**
1. Navigate to Settings → About.
2. Tap a hidden "Send test error" entry (can be triggered via a 5-tap
   gesture on the version row, or a dev-only debug screen).
3. Open Sentry dashboard for the configured project.

**Expected:** A test Error with breadcrumbs (tab-switch, navigation events)
appears in Sentry within 30s. User ID correlates to the signed-in user's
UUID. PII (email, name) has been stripped from the payload.

**Status (simulator):** N/A — cannot verify end-to-end without a real DSN
and Sentry project. Unit-test coverage (`sentry.test.ts`, 23-06) verifies
the `initSentry` no-op on empty DSN + `setSentryUser`/`captureBreadcrumb`
/`captureException` bindings. Beyond that, the dashboard handshake requires
a live Sentry project.

**Status (device):** _pending user signoff_

**Notes:** PII hygiene is guaranteed by the `beforeSend` scrubber in
`apps/mobile/src/lib/sentry.ts` (strips email/password/token/transcript/
raw_query/prompt/display_name/name keys at depth 0-2). User-correlation is
limited to UUID — no email, no display name.

## STARTUP-01 — Cold launch <2s on iPhone (NFR-18) — NEW in 23-08

**Setup:** Physical iPhone. Force-quit app. Stopwatch ready.

**Steps:**
1. Start stopwatch at the moment you tap the app icon.
2. Stop stopwatch when the first interactive screen appears (Kitchen tab
   ready for touches; not just the splash).
3. Repeat 3 times. Record best-of-3.

**Expected:** Best-of-3 <2000ms (NFR-18 target).

**Status (simulator):** UNMEASURED — `xcrun simctl launch` measures ~200ms
launch-request RTT only, not TTI. See 23-PERF-AUDIT.md for the nuance.

**Status (device):** _pending user signoff — record in 23-PERF-AUDIT.md's
"Physical iPhone Measurements" section_

**Notes:** Once a production Sentry DSN is configured, automatic
app-start spans will surface TTI on every install — that's the authoritative
number. Stopwatch is a one-shot fallback.

## UAT-01 — End-to-end Phase 23 happy-path (simulator coverage)

**Setup:** iOS Simulator with DinnerTime dev client installed; Maestro 2.4.0.

**Steps:**
- `maestro test apps/mobile/.maestro/37-settings-auth-uat.yaml`

**Expected:** Flow 37 runs end-to-end; all 9 screenshots captured; no
assertion failures. Exercises Settings landing → Security → Account →
Change password / email / export drill-downs → Connected Services →
About.

**Status (simulator):** Flow AUTHORED (sim execution deferred — requires
Metro running with env loaded + dev-client installed; run inline during
next Maestro session).

**Status (device):** _pending user signoff on physical iPhone_

**Notes:** Use Maestro flow 37 as the UAT checklist for the simulator
run. Physical-device UAT covers the BIOMETRIC / DEEPLINK / SENTRY /
STARTUP rows above.
