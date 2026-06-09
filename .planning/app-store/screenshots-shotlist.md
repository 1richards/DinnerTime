# App Store Screenshots — Shot List

**Purpose:** Per-device shot list for App Store Connect. Capture on iOS
Simulator using `xcrun simctl io booted screenshot <file>.png`. Upload to
App Store Connect -> DinnerTime -> Screenshots, one bucket per device
size.

**Last revised:** 2026-04-22 (Phase 23-07, NFR-27).

> **Defer recommendation:** Screenshot capture is best done after all UI
> polish is stable. Phase 19 tokens + Phase 22/23 flows must both be
> locked before a shot is taken; otherwise every UI tweak invalidates the
> whole set. Plan to actually capture during Phase 25 launch prep.

## Device sizes required

App Store Connect requires screenshots for two iPhone size classes as of
2026. Submit 5 shots per size.

| Size class | Pixel dimensions | Simulator device | Bucket name in ASC |
|---|---|---|---|
| 6.9" (iPhone 17 Pro Max) | 1320 x 2868 | iPhone 17 Pro Max | "iPhone 6.9" Display" |
| 6.5" (iPhone 11 Pro Max legacy) | 1242 x 2688 | iPhone 11 Pro Max | "iPhone 6.5" Display" |

## The five shots

Each row below is one screenshot to capture per device. The frame content
describes what should be on-screen at capture time; the caption is the
text overlay to paste into App Store Connect's caption editor.

| # | Screen | Frame content | Caption overlay |
|---|---|---|---|
| 1 | Kitchen -> Something New | Four suggestion cards rendered, top one visibly highlighted with "Snap your fridge" empty-state pantry indicator. Metro running against seed data. | "Open the fridge. Get dinner ideas." |
| 2 | Pantry (post-scan) | Populated pantry with 8-12 ingredient rows, including one "running low" indicator. Scan camera button visible at the bottom. | "One photo. Everything you have, listed." |
| 3 | Plan -> Month view | 5x7 month grid with status dots: a mix of cooked (success), planned (brand), and empty cells. Patterns panel below showing Protein + Cuisine + Repeats. | "See the whole month at a glance." |
| 4 | Shopping -> List | Populated shopping list grouped by category (Produce, Protein, Pantry...) with "Share Shopping List" CTA pinned to the bottom. Instacart handoff was parked for post-MVP — see `apps/mobile/src/lib/shoppingListExport.ts`. | "Your week's grocery list, ready to share." |
| 5 | Recipe -> Cook mode | Cook mode active with current step highlighted, hands-free indicator visible, and a voice bubble ("How do I know the chicken is done?"). | "Hands-free guidance while you cook." |

## Capture recipe (per device)

```bash
# 1. Boot the simulator with the right device.
xcrun simctl shutdown all
xcrun simctl boot "iPhone 17 Pro Max"   # size class 6.9"
# or:
xcrun simctl boot "iPhone 11 Pro Max"   # size class 6.5"

# 2. Install and launch the dev build.
cd apps/mobile
xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app
# then Metro with the seed dataset

# 3. Navigate to the target screen (Maestro flows 01-37 can drive this).

# 4. Capture.
xcrun simctl io booted screenshot .planning/app-store/screenshots/6_9_shot_1_kitchen.png
```

## Post-capture checklist

- [x] 5 shots captured at 6.9" (1320 x 2868)
- [x] 5 shots captured at 6.5" (1242 x 2688)
- [ ] No time / battery / signal indicator artifacts (use Simulator -> Toggle In-Call Status Bar to normalize)
- [x] No seed-data email addresses visible in any shot (patrick+dev@dinnertime.app etc.)
- [x] No debug banners (set `EXPO_PUBLIC_HIDE_DEV_UI=1` in `apps/mobile/.env` — the AuthStateBanner becomes a 60pt status-bar spacer; LogBox warnings are suppressed)
- [ ] Captions match the table above character-for-character
- [ ] Uploaded to App Store Connect for both buckets

## File name convention

`<size>_<ordinal>_<screen>.png`, e.g. `6_9_shot_1_kitchen.png`. Commit the
captured PNGs to `.planning/app-store/screenshots/` (this directory is a
draft until launch; real assets ship out-of-band to App Store Connect).
