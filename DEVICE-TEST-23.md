---
phase: 23
slug: settings-auth-nfr
simulator_signoff: ""
device_signoff: ""
---

# Phase 23 — Device Test Matrix

This file tracks the physical-iPhone-only verifications that cannot be
exercised on the iOS simulator or in Maestro. Downstream plans
(23-01..23-07) land production code; this matrix records human sign-off
after those plans ship.

Each section below has:
- **Setup** — prerequisites to run the test
- **Steps** — exact actions the tester performs
- **Expected** — pass criteria
- **Result** — blank until tester fills in `PASS: <date>` or `FAIL: <notes>`

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

**Result:**

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

**Result:**

## HTTPS-01 — ATS rejects http:// (NFR-23)

**Setup:** Physical iPhone. App installed. Backend deployed behind HTTPS.

**Steps:**
1. Temporarily set `EXPO_PUBLIC_API_URL=http://example.com` in a throwaway
   build of the app.
2. Attempt any API call (e.g., open Pantry tab).

**Expected:** Request fails with an ATS policy error in the console; the
NetworkErrorBanner surfaces "Connection issue — please try again." The
production build (HTTPS tunnel) must NOT fail.

**Result:**

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

**Result:**

## REAUTH-01 — 401 triggers ReAuthModal not full sign-out (NFR-12)

**Setup:** Physical iPhone. Use a dev build where you can force the
backend to return 401 for a specific route (e.g., add a `Authorization:
Bearer invalid` override in a debug menu, or truncate the access_token in
SecureStore via a dev action).

**Steps:**
1. Trigger a backend call that hits 401.
2. Observe app behavior.

**Expected:** ReAuthModal surfaces with "Sign in again" copy. On successful
re-auth, modal dismisses and the original navigation state is preserved
(user returns to whatever screen they were on). User is NOT bounced to the
login screen. On Cancel, user is signed out.

**Result:**

## SENTRY-01 — Test error captured in dev DSN (NFR-15)

**Setup:** Physical iPhone with a dev DSN configured (`EXPO_PUBLIC_SENTRY_DSN=...`).
Dev build running.

**Steps:**
1. Navigate to Settings → About (dev only).
2. Tap hidden "Send test error" button (Wave 2 adds this — may be behind a
   5-tap version gesture).
3. Open Sentry dashboard for the configured project.

**Expected:** A test Error with breadcrumbs (tab-switch, navigation events)
appears in Sentry within 30s. User ID correlates to the signed-in user's
UUID. PII (email, name) has been stripped from the payload.

**Result:**
