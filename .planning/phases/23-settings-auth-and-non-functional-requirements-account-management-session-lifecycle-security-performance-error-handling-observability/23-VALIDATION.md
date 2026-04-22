---
phase: 23
slug: settings-auth-nfr
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 23 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Frameworks | vitest (mobile), jest (server), maestro (iOS UAT), Sentry test mode |
| Quick run | `cd apps/mobile && pnpm test --run src/stores src/components/settings src/lib` |
| Full suite | `pnpm -r test --run` |
| Runtime | ~30s unit |

## Sampling Rate

- After task commit: scoped unit tests.
- After wave: full suite + Maestro 37 (settings + auth).
- Before verify-work: all green + manual physical-iPhone runs (biometric + app-store flows).

## Manual-Only Verifications

| Behavior | SC | Reason | Instructions |
|----------|-----|--------|--------------|
| Face ID prompt feels native | SC-7 | Simulator can't do real Face ID | Physical iPhone: enable biometric, bg→fg, verify prompt |
| Password-reset deep link opens app | SC-9 | Requires real email + universal link config | Physical iPhone: send reset, tap email link, verify app opens to reset screen |
| App Store Connect privacy label audit | SC-26 | Manual form filling on ASC | User fills privacy-nutrition form matching `.planning/app-store/privacy-manifest.json` |
| App Store submission | SC-27 | Requires App Store Connect credentials | User uploads via EAS Submit or Xcode after Phase 25 TestFlight |

## Wave 0 Requirements

- [ ] Install `@sentry/react-native` + `expo-local-authentication` via `npx expo install`
- [ ] Red stubs for Waves 1-4 test files (Settings screens, auth store extensions, error boundary, telemetry schema)
- [ ] `ai_events` migration (either new table or extension to existing telemetry)
- [ ] DEVICE-TEST-23 skeleton

## Validation Sign-Off

- [ ] Every plan has `<automated>` verify or W0 dep
- [ ] Sentry captures a test error in dev
- [ ] Maestro flow 37 green on simulator
- [ ] Physical-iPhone biometric & deep-link tests (user-action)

**Approval:** pending
