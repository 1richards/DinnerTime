# DinnerTime UAT Runbook (Maestro)

End-to-end UI tests for DinnerTime, driven by [Maestro](https://maestro.mobile.dev).
These flows let Claude (or you) validate features without manual taps on a phone.

## One-time setup

1. Install Maestro and a JDK:
   ```
   brew install mobile-dev-inc/tap/maestro openjdk@21
   echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
   ```
2. Install Xcode (App Store) — needed for the iOS Simulator. ~10 GB.
3. Build a dev client for the simulator:
   ```
   cd apps/mobile
   eas build --profile development-simulator --platform ios --local
   ```
   (Or use the EAS cloud build artifact if you have one — drop the `.app` into the simulator with `xcrun simctl install booted path/to/DinnerTime.app`.)

## Running flows

```
cd apps/mobile

# Boot a simulator (one-time per session)
xcrun simctl boot "iPhone 16 Pro" || true
open -a Simulator

# Start Metro (in another tab) — flows talk to whatever Metro is serving
pnpm start

# Run a single flow
MAESTRO_EMAIL=test@example.com MAESTRO_PASSWORD=hunter2 \
  maestro test .maestro/smoke.yaml

# Run everything
maestro test .maestro/
```

Screenshots land in `~/.maestro/tests/<run-id>/` and are also embedded in the run report.

## Flow inventory

| File | What it covers |
| --- | --- |
| `smoke.yaml` | App launches, auth store hydrates. Cheapest sanity check. |
| `login.yaml` | Existing user signs in, lands on home or onboarding. |
| `onboarding.yaml` | Fresh user completes the 3-step wizard. |
| `recipe-import-url.yaml` | Paste a recipe URL, verify it saves. |
| `pantry-add.yaml` | Add a pantry item by hand. |
| `meal-plan-generate.yaml` | Generate a week's meal plan. |
| `shopping-list.yaml` | Shopping tab renders. |

## Sentinel banner

`src/app/_layout.tsx` renders a debug banner showing
`loading=… loggedIn=… onboarded=…`. Flows assert against that text instead of
brittle nav state — keep the banner in dev builds. Strip it before TestFlight.

## Adding a new flow

1. Copy an existing `.yaml` as a starting point.
2. Use `maestro studio` to record taps interactively against a running app:
   ```
   maestro studio
   ```
3. Prefer text/id selectors over coordinates.
4. Add `takeScreenshot:` steps generously — they're free debugging gold.

## Simulator vs real device

- **Simulator (default):** fast, free, no phone needed. Use for everything that
  doesn't need camera / push / biometrics / secure enclave.
- **Real device:** required only for camera (pantry photo scan), push, and
  final pre-TestFlight smoke. To target a real iPhone, plug it in via USB and
  Maestro will auto-detect it.

## Known fragility

- Selectors that depend on dynamic AI-generated copy (recipe titles, meal names)
  are best-effort — wrap them in `optional: true` and rely on screenshots.
- The `MAESTRO_*` env vars must be set in the shell that runs `maestro test` —
  don't commit credentials.
