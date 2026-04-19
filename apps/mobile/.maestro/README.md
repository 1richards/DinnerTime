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

| File | What it covers | Requires |
| --- | --- | --- |
| `smoke.yaml` | App launches, auth store hydrates. Cheapest sanity check. | — |
| `01-login.yaml` | Existing UAT user signs in, lands on home tab. | network |
| `02-signup-onboarding.yaml` | Fresh user registers, completes 3-step onboarding wizard. | network + `MAESTRO_NEW_EMAIL` |
| `03-import-url.yaml` | Paste a recipe URL, AI parses it, review screen, save. | network + AI |
| `04-import-manual.yaml` | Type freeform recipe text, AI parses, review, save. | network + AI |
| `05-recipe-detail-edit.yaml` | Open first recipe, view detail, edit title, save changes. | ≥1 recipe in library |
| `06-recipe-discover.yaml` | AI-powered recipe discovery, save one suggestion. | network + AI |
| `07-pantry-add.yaml` | Pantry tab renders, filter tabs work (manual add requires scan). | — |
| `08-home-suggestions.yaml` | Home screen loads, settings screen opens and saves. | — |
| `09-meal-plan-generate.yaml` | Generate (or verify) a 7-day meal plan on the Plan tab. | network + AI |
| `10-meal-plan-swap.yaml` | Swap one day's meal via the SwapSheet. | existing plan + AI |
| `11-shopping-list-generate.yaml` | Generate shopping list from plan, add manual item. | existing plan + AI |
| `12-shopping-orders.yaml` | Navigate to order history screen. | — |
| `13-settings.yaml` | Update skill level, toggle cuisine, add family member modal. | — |
| `14-cook-tab.yaml` | Cook tab renders, "Open Recipes" navigates, "Start Cooking" visible. | ≥1 recipe |
| `15-cook-voice-mode-stub.yaml` | **STUB — SKIPPED** Voice cooking mode requires VOICE/STT. | physical device |
| `16-pantry-scan-stub.yaml` | **STUB — SKIPPED** Pantry photo scan requires CAMERA. | physical device |
| `17-recipe-import-photo-stub.yaml` | **STUB — SKIPPED** Recipe photo import requires CAMERA. | physical device |
| `18-recipe-search-favorite.yaml` | Search recipes, toggle Favorites filter, toggle favorite on detail. | ≥1 recipe |
| `19-receipt-scan-stub.yaml` | Deep-link into receipt scan + Instacart import modals (Phase 13-02). | — |
| `20-kitchen-segment-toggle.yaml` | Kitchen tab segment toggle preserves search-query state (Phase 12). | — |
| `21-modal-dismiss.yaml` | Scan modal presents from pantry FAB and dismisses via swipe-down (Phase 15). | — |
| `22-dirty-form-guard.yaml` | Edit recipe + attempt back swipe triggers Unsaved changes Alert (Phase 15). **Manual-only if flaky** (see below). | ≥1 recipe |
| `23-design-buttons-visual.yaml` | Phase 19 visual regression — tours every FAB + primary CTA + destructive button surface capturing screenshots for Gate A. | — |
| `24-pantry-staples.yaml` | PantryItemCard ellipsis → "Mark as staple" → Staples filter chip (Phase 21-04/05). | ≥1 pantry item |
| `25-pantry-search-pill.yaml` | Pantry tab sticky search pill → /search modal → query → dismiss (Phase 21-04). | — |
| `26-pantry-rules.yaml` | Settings → Pantry Rules → Add Rule FAB → canonical pick → 30-day preview → save → delete (Phase 21-05). | network + canonical_ingredients seeded |

## Phase 15 note — manual-only flows

`22-dirty-form-guard.yaml` asserts on an iOS Alert, which XCUITest reaches
through a separate UIWindow. This selector is occasionally flaky on simulator
CI runs. If the flow fails but manual UAT confirms the Alert appears and
Keep editing / Discard work correctly, exclude `22-dirty-form-guard.yaml`
from the `uat.sh all` target and mark it as a manual-only gate.

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
