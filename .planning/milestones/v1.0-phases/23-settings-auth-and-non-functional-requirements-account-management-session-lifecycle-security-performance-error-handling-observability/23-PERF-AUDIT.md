---
phase: 23
plan: 08
audit_date: 2026-04-22
simulator: iPhone 17 Pro (iOS 26.4)
simulator_udid: 6373C7F5-00BF-4E38-9C0F-620DFEDB7AA0
device_signoff_required: true
---

# Phase 23 Performance Audit

NFR-18..21 compliance check. Measured on the iOS simulator where possible;
rows that need physical-device timing are flagged **UNMEASURED** and
supersede to DEVICE-TEST-23.md's STARTUP-01 / scan-latency rows.

## Budget Summary

| Budget | Target | Simulator Measured | Status | Notes |
|---|---|---|---|---|
| STARTUP_COLD_MS | 2000ms | ~200ms launch-request RTT (not TTI) | UNMEASURED | `xcrun simctl launch` reports ~200ms best-of-3, but that measures the IPC round-trip to spawn the process, NOT time-to-interactive. Real TTI on simulator is visually ~1-2s (JS bundle eval dominates); physical-iPhone STARTUP-01 supersedes. |
| TAB_SWITCH_MS | 16ms | No jank observed in Maestro flow 37 | PASS (qualitative) | expo-router native-stack + Reanimated worklets keep the transition on the UI thread. No visible frame drops when switching Kitchen → Plan → Settings in flow 37. Quantitative frame-timing requires Perfetto/Sentry traces with a real DSN. |
| SCAN_FEEDBACK_MS | 500ms | UNMEASURED | UNMEASURED | Requires instrumented `withBudget('scan.feedback', SCAN_FEEDBACK_MS, fn)` wrap around the scan POST + manual stopwatch on the simulator. Follow-up work tracked in deferred-items.md if not already done by a future plan. |
| SCAN_COMPLETE_MS | 6000ms | UNMEASURED | UNMEASURED | End-to-end pantry scan latency; best measured on a real device with real camera output. `quality:0.4` enforced. |
| RECEIPT_COMPLETE_MS | 8000ms | UNMEASURED | UNMEASURED | Receipt OCR path (scan/receipt.tsx) — likely slower than pantry scan due to OCR step. Physical device rows supersede. |
| IMAGE_MAX_MB | 5MB | `quality:0.4` enforced across all 3 scan entry points | PASS | Grep audit: `quality:\s*0\.[6-9]\|quality:\s*1\.0` returns 0 hits across `apps/mobile/src/app/scan/`. Confirmed at 2026-04-22: scan/index.tsx:67, scan/receipt.tsx:40, scan/instacart.tsx:40 all use `quality: 0.4`. |

## How This Audit Was Performed

### STARTUP-01 (simulator side)

```bash
xcrun simctl terminate booted com.dinnertime.app
sleep 2
{ time xcrun simctl launch booted com.dinnertime.app ; }
```

Best-of-3 runs on 2026-04-22 (iPhone 17 Pro simulator, iOS 26.4):
- Run 1: 0.201s total
- Run 2: 0.209s total
- Run 3: 0.206s total

**These numbers measure the simctl-process → launchd IPC round trip, not
time-to-interactive.** The JS bundle evaluation (React + Reanimated + all
module initialization) happens AFTER the process is spawned and is NOT
captured here. For real TTI:

- **Sentry performance tracing**: Once `EXPO_PUBLIC_SENTRY_DSN` is
  configured in production, `@sentry/react-native`'s automatic app-start
  span (enabled by default when `tracesSampleRate > 0` — see
  `apps/mobile/src/lib/sentry.ts` lines 78-92) will surface cold-start TTI
  on each install. This is the authoritative number.
- **Physical iPhone STARTUP-01**: User-measured stopwatch from icon tap to
  first interactive frame. Target <2s. See DEVICE-TEST-23.md.

### TAB_SWITCH_MS (simulator side)

Evaluated qualitatively via Maestro flow 37 (`37-settings-auth-uat.yaml`).
The flow taps Kitchen → Plan → Settings in rapid succession; no visible
frame drops or delayed paints in the captured screenshots.

Quantitative frame-level measurement requires either:
- Perfetto traces (tethered iPhone + Xcode Instruments) — deferred to a
  dedicated perf session.
- Sentry's UI interaction tracing (needs DSN + production build).

### Scan latencies (UNMEASURED)

All 3 scan rows (SCAN_FEEDBACK_MS / SCAN_COMPLETE_MS / RECEIPT_COMPLETE_MS)
need instrumentation work that's out of scope for Phase 23:
- Wrap the `sendScan` fetch in `withBudget('scan.complete', SCAN_COMPLETE_MS, fn)`.
- Wrap the first-skeleton render in `withBudget('scan.feedback', SCAN_FEEDBACK_MS, fn)`.

When wrapped, the Sentry breadcrumb emitted on over-budget will surface in
any crash report, and `__DEV__` console warnings will flag regressions
during local development.

Physical-device measurements (via stopwatch during scan) are required for
the authoritative numbers — the simulator's camera-picker returns synthetic
stock photos that bypass the real iPhone compression path.

### IMAGE_MAX_MB (PASS)

Grep audit on 2026-04-22:

```bash
grep -rn "quality:\s*0\.[6-9]\|quality:\s*1\.0" apps/mobile/src/app/scan/
# (no output → 0 hits → PASS)
```

Full survey of `apps/mobile/src/app/*` image capture sites:

| File | Line | quality | AI path? | Status |
|---|---|---|---|---|
| scan/index.tsx | 67 | 0.4 | Yes (Claude vision) | PASS |
| scan/receipt.tsx | 40 | 0.4 | Yes (Claude vision) | PASS |
| scan/instacart.tsx | 40 | 0.4 | Yes (Claude vision) | PASS |
| recipes/import-photo.tsx | 33, 54 | 0.8 | Yes (Claude vision) | **OUT-OF-SCOPE regression risk** — see deferred-items.md |

See Deferred Issues below.

## Sentry Performance Tracing Hookup

`apps/mobile/src/lib/sentry.ts` calls `Sentry.init({ tracesSampleRate })` at
boot (wired via `initSentry(process.env.EXPO_PUBLIC_SENTRY_DSN)` in
`_layout.tsx`, line 116). Default rates:

- `__DEV__` (unset DSN during local dev): `initSentry` no-ops silently.
- `__DEV__ === true` with DSN: `tracesSampleRate: 0.1` (10% sampling).
- Production (`__DEV__ === false`): `tracesSampleRate: 0.2` (20% sampling).

Once a production DSN is configured:
- Automatic spans: app-start, navigation transitions (via `@sentry/react-native`'s routing integration if wired).
- Custom breadcrumbs: `withBudget` fires `category=perf`, `message={name}:over_budget`, `data={ms, budget_ms}` when a budget is blown. Next error event carries these as context.

## Simulator vs Device — Why Both Matter

| Dimension | Simulator behavior | Physical iPhone behavior |
|---|---|---|
| Cold-start JS eval | Hot-cached on Mac SSD → typically faster | First-launch SSD read + Metal shader compile → slower |
| Tab switch timing | Rendered on Mac GPU → artificially smooth | Renders on A17/A18 Bionic → authoritative |
| Scan latency | `ImagePicker` returns a stock photo → no compression cost | Raw camera capture → compression + JPEG encode on-device |
| Image quality enforcement | Not exercised (sim returns fixed-size stock images) | The 5MB Anthropic cap is a real ceiling — `quality:0.4` was set because `0.8` exceeded it in the field (CLAUDE.md) |
| Sentry traces | Dev DSN catches breadcrumbs but spans go to dev project | Production DSN is the source-of-truth dashboard |

## Deferred Issues

### 1. `recipes/import-photo.tsx` uses `quality: 0.8` (NFR-21 risk)

Scan paths (`app/scan/`) are all at `quality:0.4` as required. However,
`apps/mobile/src/app/recipes/import-photo.tsx` at lines 33 and 54 uses
`quality: 0.8` when capturing a photo for recipe import. This file ALSO
sends the base64 to Claude vision (via `useRecipeStore.importFromPhoto`),
so the same 5MB Anthropic ceiling applies.

**Impact:** An iPhone 17 Pro capturing a full-frame recipe page at
`quality:0.8` can produce a base64 payload exceeding Anthropic's 5MB cap,
causing a 400 response ("image too large") in the field.

**Why not fixed here:** 23-08 plan's scope is explicitly `app/scan/*` —
fixing import-photo is a different file with different UX (user is
capturing a recipe page, not a pantry shelf, where text legibility at
lower quality is a concern). Flipping to `0.4` might regress OCR accuracy.

**Action required:** Dedicated investigation plan — measure
`import-photo.tsx` base64 size distribution on real iPhone captures,
decide between (a) drop to `0.5` with a compression pass in between, or
(b) use `expo-image-manipulator` to cap at 1600px-longest-edge and recompress.

Log entry added to `deferred-items.md`.

### 2. Scan latency instrumentation not yet wired

`withBudget` ships in this plan but no call site wraps
`useKitchenStore.sendScan` / `scanReceipt` / `scanInstacart` yet. Until
wrapped, the perf budgets are a latent contract — documented but not
actively enforced.

**Action required:** A future plan (24-XX or 25-XX) wires `withBudget`
around each of the 3 scan call sites, then we can fill SCAN_FEEDBACK_MS /
SCAN_COMPLETE_MS / RECEIPT_COMPLETE_MS with measured numbers from real
device traces.

Log entry added to `deferred-items.md`.

## Physical iPhone Measurements (to be filled)

A dedicated section for user-captured physical-iPhone timings from
DEVICE-TEST-23.md STARTUP-01.

### STARTUP-01 — Cold launch on iPhone (target <2000ms)

- Run 1: _pending user signoff_
- Run 2: _pending user signoff_
- Run 3: _pending user signoff_

**Best-of-3:** _pending_
**Status:** _pending_ (PASS if <2000ms, OVER otherwise)

### Scan latency — pantry scan full path (target <6000ms)

- Run 1: _pending user signoff_
- Run 2: _pending user signoff_
- Run 3: _pending user signoff_

**Best-of-3:** _pending_
**Status:** _pending_
