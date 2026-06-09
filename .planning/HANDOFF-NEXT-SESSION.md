# Handoff — Pre-Launch Finish Line

**Updated:** 2026-05-06 09:05 (App Store screenshots captured)
**Goal:** ship DinnerTime to TestFlight + App Store. This is everything a fresh Claude Code session needs to pick up cleanly.

---

## TL;DR — what's left

1. ✅ **App Store screenshots captured** — 10 PNGs (5 per device) at correct ASC dimensions in `.planning/app-store/screenshots/`. QA review recommended before upload (notes below).
2. 🍎 **Apple Developer + ASC record + EAS submit + TestFlight** ← **NEXT**, ~1–2 hr, requires user — Patrick has to approve in the Apple Developer portal

Everything else (backend deploy, Supabase migrations, Instacart removal, version bumps, UAT bugs) is done.

---

## What landed in this session

### Major changes
- **Replaced Instacart handoff with native iOS share** (commit `904c129`). New module `apps/mobile/src/lib/shoppingListExport.ts` exports `shareShoppingListAsText` (uses RN `Share.share()`) and `shareShoppingListAsPdf` (lazy-loaded `expo-print` + `expo-sharing`). Apple Notes auto-converts "- " bullets to checklists. Modified: `(tabs)/shopping.tsx` (button now "Share Shopping List"), `(tabs)/plan.tsx` (cart icon now triggers share). 38/38 shopping tests still pass.
- **Backend deployed to Fly.io.** Live at `https://dinnertime-api.fly.dev`. Health check returns 200. Auth-protected route returns proper 401. Files: `Dockerfile`, `fly.toml`, `.dockerignore` (commit `0915297`). App: `dinnertime-api`, region `sjc`, shared-cpu-1x / 512mb, Depot remote builder. Image: `registry.fly.io/dinnertime-api:deployment-01KQYQYEF1VVYWB5GV6NNH3NG9` (~66 MB). Secrets imported via `flyctl secrets import < .env` (Supabase + Anthropic + Google + Instacart keys all set). `EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json` points at the Fly URL for production builds.
- **Supabase migrations 00001–00036 verified in sync** between local and remote project `rsgxnyiltmagvwhyvakp`. Nothing to apply.
- **tsx promoted to prod dep** (`packages/server/package.json`). Lockfile regenerated (commit `e50d00c`). Required because the Dockerfile installs `--prod` only.

### UAT-driven fixes (earlier in the session, all shipped)
- Remix variation tap-no-op (triple-stacked Modal pageSheets) — fullScreen + collapsed siblings + SafeAreaView wrap (`348e60f`, `4e841c9`, `48229a8`)
- Vegetarian remix returning chorizo/beef — bulletproof guard with retry loop, mode-aware HARD CONSTRAINTS, MEAT_WORD_REGEX (`e8d182d`, supersedes `906f3c7`/`226857d`)
- Skeleton/shimmer pulse on remix variation hero — switched from Reanimated to RN Animated, then to exact SuggestionSkeleton pattern, then explicit "Generating image…" caption (`400bf7b`, `a78ecf0`)
- Recipe detail couldn't exit — X close + canGoBack fallback (`d28b361`)
- Remix preview heart save+favorite + Cook Later button (`2402799`, `ebaf5d1`)
- Removed buried "..." overflow on recipe detail (`f151b3b`)
- Cook Later created duplicate non-favorited recipe (`a660831`)
- Swap modal cards look like Plan hero cards (`18d8137`)

---

## Completed — App Store screenshots (this session)

**10 PNGs captured at ASC-correct dimensions:**
- 6.9" (iPhone 17 Pro Max, 1320×2868): `6_9_shot_{1..5}_*.png`
- 6.5" (iPhone 11 Pro Max, 1242×2688): `6_5_shot_{1..5}_*.png`

All five shots per device: Kitchen (Something New with cards), Pantry, Plan/Month, Shopping, Recipe/Cook mode.

**Notable changes that landed in this session to make the captures clean:**
- `apps/mobile/.env`: switched `EXPO_PUBLIC_API_URL` to `https://dinnertime-api.fly.dev` (Fly prod URL — same as production builds will use). Added `EXPO_PUBLIC_HIDE_DEV_UI=1`.
- `apps/mobile/src/app/_layout.tsx`: `AuthStateBanner` now renders a 60pt `colors.bg`-colored spacer when `EXPO_PUBLIC_HIDE_DEV_UI=1`, AND calls `LogBox.ignoreAllLogs(true)` at module init. The spacer is needed because the dev sentinel banner had been doubling as the status-bar safe-area inset; removing it caused the iOS clock to overlap the "Hey, Jessi!" greeting on Pro/Pro Max devices.
- `.planning/app-store/screenshots-shotlist.md`: fixed device label — 6.9" is iPhone 17 Pro Max, not iPhone 17 Pro (the 17 Pro is 6.3"). Capture commands updated.

**Known issues to QA before uploading to ASC:**
- **Shopping list is sparse**: Only 4 items, all in OTHER category. The seed data doesn't categorize items into Produce/Protein/Pantry/Dairy. Cosmetic — Patrick can either accept or seed richer data + reshoot.
- **Plan/Month patterns**: On 6.9" (Pro Max) capture, the Protein/Cuisine/Repeats panels say "No data yet" because the UAT account has planned meals but no completed cooks. The 6.5" capture happens to show populated panels (different test data state). Acceptable — both views show the calendar grid + dots correctly.
- **Cook Later modal**: Recipe detail still has the "Cook this on..." calendar quirk (visible during navigation but not in any final shot).
- The `38-screenshot-capture.yaml` Maestro flow uses tab-bar text selectors that occasionally fail with `kAXErrorInvalidUIElement`. The captures in this session were driven by hand-rolled coordinate-based taps in `/tmp/tap-tab.yaml` — see commit log if reproducing.

**6.3" backup set** (1206×2622, iPhone 17 Pro): saved to `.planning/app-store/screenshots-6_3-backup/` in case Apple ever adds a 6.3" bucket.

**Next steps (in order):**

1. **Verify the app loaded.** `xcrun simctl io booted screenshot /tmp/sim-check.png` and Read it. Should show the populated Kitchen tab with suggestion cards. If it shows the dev menu, dismiss with `xcrun simctl ui booted appearance` — actually just tap "Continue" via Maestro. If signed-out, sign in with seed credentials (check `apps/mobile/.maestro/scripts/uat.sh` for the helper).

2. **Run the 6.9" capture:**
   ```bash
   cd /Users/patrickrichards/DinnerTime/apps/mobile
   maestro test .maestro/38-screenshot-capture.yaml
   ```
   On success, captures land at `~/.maestro/tests/<run-id>/screenshots/shot-{1..5}-*.png`.

3. **Move to final location with proper naming:**
   ```bash
   mkdir -p .planning/app-store/screenshots
   RUN=$(ls -1t ~/.maestro/tests/ | head -1)
   cp ~/.maestro/tests/$RUN/screenshots/shot-1-*.png .planning/app-store/screenshots/6_9_shot_1_kitchen.png
   cp ~/.maestro/tests/$RUN/screenshots/shot-2-*.png .planning/app-store/screenshots/6_9_shot_2_pantry.png
   cp ~/.maestro/tests/$RUN/screenshots/shot-3-*.png .planning/app-store/screenshots/6_9_shot_3_plan.png
   cp ~/.maestro/tests/$RUN/screenshots/shot-4-*.png .planning/app-store/screenshots/6_9_shot_4_shopping.png
   cp ~/.maestro/tests/$RUN/screenshots/shot-5-*.png .planning/app-store/screenshots/6_9_shot_5_cook.png
   ```

4. **Boot 6.5" sim, re-run, save as `6_5_shot_*`:**
   ```bash
   xcrun simctl shutdown booted
   xcrun simctl boot "iPhone 11 Pro Max"
   xcrun simctl install booted apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app
   # (the existing Metro can serve both — no restart needed)
   maestro test apps/mobile/.maestro/38-screenshot-capture.yaml
   # then move with 6_5_shot_*_<screen>.png naming
   ```

5. **Visually QA each PNG against the shot-list captions.** No seed-data emails, no debug banners, status bar normalized.

**Pixel dimensions to verify:**
- 6.9" → 1320 × 2868 (iPhone 17 Pro)
- 6.5" → 1242 × 2688 (iPhone 11 Pro Max)

If the iPhone 11 Pro Max simulator runtime isn't installed, the only fallback that satisfies App Store Connect's 6.5" bucket is to swap to a real iPhone 11 Pro Max or use Xcode's "Add Additional Simulators" dialog. A 6.7"/6.9" capture **cannot** be reused — ASC rejects them.

---

## After screenshots — final ship checklist

Reference: `.planning/LAUNCH-HANDOFF.md` (older, pre-Fly).

Patrick has to do these — they require Apple ID auth he can't delegate:

1. **Apple Developer enrollment** ($99/yr) if not already enrolled.
2. **Create app record** in App Store Connect: bundle id `com.dinnertime.app`, name "DinnerTime".
3. **EAS production build:**
   ```bash
   cd apps/mobile
   eas build --platform ios --profile production
   ```
   `eas.json` already points the production profile at `https://dinnertime-api.fly.dev`.
4. **Submit to TestFlight:**
   ```bash
   eas submit --platform ios --latest
   ```
5. **Internal Testing group** in ASC, add Patrick's Apple ID.
6. **Upload screenshots** to ASC → Screenshots tab → both buckets (6.9" and 6.5"), 5 each, with the captions from `screenshots-shotlist.md`.
7. **Fill out App Privacy + App Review notes** in ASC (camera permission for fridge scan, anthropic API usage disclosure if asked).

---

## Backend infra cheat sheet

| Thing | Value |
|---|---|
| Fly app | `dinnertime-api` |
| Region | `sjc` |
| URL | `https://dinnertime-api.fly.dev` |
| Health | `GET /api/v1/health` → `{"status":"ok"}` |
| Image | `registry.fly.io/dinnertime-api:deployment-01KQYQYEF1VVYWB5GV6NNH3NG9` |
| Build | Depot remote builder (via Fly default) |
| Secrets | Imported from root `.env` via `flyctl secrets import` |
| Logs | `flyctl logs -a dinnertime-api` |
| Redeploy | `flyctl deploy` from repo root (Dockerfile + fly.toml are there) |

`EXPO_PUBLIC_API_URL` for production builds = `https://dinnertime-api.fly.dev` (set in `apps/mobile/eas.json` production profile).

---

## Known gotchas the next session needs to remember

- **Metro mode matters.** If you see "Could not connect to development server" in the simulator, check whether Metro was started with `EXPO_PACKAGER_PROXY_URL=...` (Tailscale config for physical iPhone). The simulator needs plain `--lan`. Kill the Tailscale-flavored Metro and restart: `nohup npx expo start --dev-client --lan --clear > /tmp/metro.log 2>&1 < /dev/null & disown`.
- **tsx in production is intentional.** The codebase has 289 pre-existing strict-mode TS errors that `tsx watch` was hiding. `tsc -p tsconfig.json` will fail. Don't try to "fix the build" — the Dockerfile runs `tsx src/index.ts` directly. Cleaning up the TS errors is post-MVP.
- **Server bind is `0.0.0.0` on purpose** (`packages/server/src/index.ts`). Don't change to default — breaks Tailscale Serve and Fly health checks.
- **Apple Notes share format.** `shoppingListExport.ts` uses "- " bullets specifically because Apple Notes auto-converts them to interactive checklists. Don't reformat.
- **iPhone camera quality cap is 0.4** in `scan/index.tsx`. Higher quality exceeds Anthropic's 5MB image limit on real devices.
- **PostgREST schema cache.** After Supabase migrations, if you see "Could not find the 'X' column of 'Y' in the schema cache", run `NOTIFY pgrst, 'reload schema';` in the Supabase SQL editor or wait ~30s.

---

## Recent commits (most recent first)

```
3f1e74f chore: retrigger Fly deploy on lockfile fix
e50d00c chore(deploy): regenerate lockfile for tsx promotion to prod dep
0915297 chore(deploy): Dockerfile + fly.toml + .dockerignore for Fly.io
904c129 feat(shopping): replace Instacart handoff with native iOS share sheet for v1.0
e8d182d fix(remix): vegetarian guard now bulletproof — never returns meat
f151b3b fix(recipe): un-bury "..." overflow on recipe detail — surface inline
a78ecf0 fix(remix): explicit "Generating image…" affordance on variation hero
2402799 feat(remix): heart save+favorite + Cook Later on variation preview
226857d fix(remix): mode-aware HARD CONSTRAINTS + post-gen meat-word retry for vegetarian
d28b361 fix(recipe): swap back-chevron for X close on recipe detail + safe fallback
b8da8d7 fix(remix): give skeleton flow-space height so hero doesn't collapse
400bf7b fix(remix): match Something New skeleton pulse exactly
8ece31f fix(remix): swap shimmer to RN Animated + onLayout + pulse + brighter band
4cc92f0 fix(remix): real animated shimmer on variation hero skeleton
ebaf5d1 feat(kitchen): heart save+favorite on Something New PreviewSheet
```

---

## Uncommitted changes at handoff

```
M apps/mobile/.maestro/40-share-recipe-pdf.yaml   (cleanup from Instacart removal — ready to commit)
M apps/mobile/eas.json                             (Fly URL — should be committed)
M packages/server/src/routes/telemetry.ts          (older, pre-this-session — review before committing)
?? .planning/debug/pantry-trifecta.resolved.md
?? .planning/quick/10-plan-day-card-actions-replace-swipe-left/10-PLAN.md
?? .planning/quick/12-extend-mealplanner-to-populate-per-servi/12-PLAN.md
?? .planning/quick/7-plan-tab-density-redesign-plancarddensit/7-PLAN.md
?? app.json
?? apps/mobile/quick-4-a-skeleton.png
?? apps/mobile/quick-4-b-remix-buttons.png
?? packages/server/app.json
?? sylvia-02-preview.png
```

The `eas.json` and Maestro `40` updates should be committed before the next session does anything else — they're trivial and clean.

---

## How to resume cleanly next session

1. Read this doc.
2. Check Metro is alive: `lsof -ti :8081` and `curl -s http://localhost:8081/status` (expect `packager-status:running`). If dead, restart: `cd apps/mobile && nohup npx expo start --dev-client --lan --clear > /tmp/metro.log 2>&1 < /dev/null & disown`.
3. Check Fly is alive: `curl -s -o /dev/null -w "%{http_code}\n" https://dinnertime-api.fly.dev/api/v1/health` (expect `200`).
4. Take a fresh sim screenshot to see current app state: `xcrun simctl io booted screenshot /tmp/sim-now.png` and Read it.
5. Pick up at "Current in-progress task — App Store screenshots" → step 1.
