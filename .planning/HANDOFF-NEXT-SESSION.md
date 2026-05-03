# Handoff — Pre-Launch Finish Line

**Generated:** 2026-05-04
**Author of pre-launch session:** Claude Opus 4.7 (1M context)
**Goal:** ship DinnerTime to TestFlight + App Store. This doc is everything a fresh Claude Code session needs to pick up cleanly.

---

## TL;DR — what's left

Five buckets, in execution order. Total estimate: half a day to a day if nothing in #2 turns out to be a multi-hour rabbit hole.

1. 🐛 **Fix Month-view scroll bug** (15 min — diagnose & fix)
2. 🛒 **Verify + fix Instacart integration end-to-end** (1–3 hr — biggest unknown)
3. 🧪 **In-app UAT of all recent UX changes** (30 min — punch-list run-through)
4. ⚙️ **Settings screen UAT** (15 min)
5. 🧹 **Comprehensive validation + bug fixes** (open-ended; tighten until launch-ready)

Then ship to TestFlight per `.planning/LAUNCH-HANDOFF.md`.

---

## 1. 🐛 Critical: Month view doesn't scroll

**Symptom:** On the Plan tab, tap **Month** segment. The Cuisine section + Repeats section are below the fold but the ScrollView won't scroll to reveal them. User reported twice — paddingBottom bump alone (140 → 220 in `5e00b79`) didn't fix it.

**Suspected causes (ranked):**

1. **Parallel-mounted Week view's `DraggableFlatList` capturing touches** — `apps/mobile/src/app/(tabs)/plan.tsx:887` mounts both Week and Month views as flex:1 siblings with `display: 'none'` toggle. RN's `display: 'none'` should remove from layout, but `pointerEvents={'none'}` may still let touch events ambiguously route. The DraggableFlatList might be intercepting via gesture handler even when display:none.
2. **Nested ScrollView contention with the collapsing-header `onScroll`** — `apps/mobile/src/app/(tabs)/plan.tsx:998` wires `onScroll={onScroll}` to the Month ScrollView. The collapsing-header hook (`useCollapsingHeader`) may set translateY on a parent that disrupts gesture flow.
3. **SafeAreaView height calc** — outer `SafeAreaView` at line 844 has `className="flex-1 bg-warmWhite" edges={['bottom']}`. If the bottom safe-area insertion is fighting the explicit paddingBottom, content could clip without enabling scroll.

**First diagnostic to try:** wrap the Month view's ScrollView in a plain `<View style={{flex:1}}>` and remove the parallel Week view temporarily — does scrolling work then? If yes → cause is #1. If no → cause is #2 or #3.

**Fix path candidates:**
- `keyboardShouldPersistTaps="handled"` and `nestedScrollEnabled` on the ScrollView
- Replace parallel-mount with conditional render (`scale === 'month' ? <Month/> : <Week/>`) — loses scroll-position memory across toggles but unblocks scroll
- Move `monthHeader` out of the ScrollView's children and into a sibling sticky View so the ScrollView only scrolls MonthGrid + MonthPatterns

**Files:**
- `apps/mobile/src/app/(tabs)/plan.tsx:990-1024` — Month view container + ScrollView
- `apps/mobile/src/components/plan/MonthPatterns.tsx` — content (Protein / Cuisine / Repeats sections)
- `apps/mobile/src/components/ui/useCollapsingHeader.ts` — header animation that consumes `onScroll`

**Validation:**
- Reload Metro, switch to Month view, verify two-finger scroll reaches Repeats section
- Maestro: extend `apps/mobile/.maestro/31-month-view.yaml` (if it exists) with a swipe-up + screenshot to lock in regression coverage

---

## 2. 🛒 Instacart integration

**Status:** Wired end-to-end but never verified live.

**What's already built:**

| Layer | File | Purpose |
|---|---|---|
| Server | `packages/server/src/services/instacart.ts` | API client wrapper |
| Server | `packages/server/src/routes/shopping.ts` | `POST /api/v1/shopping/order` creates Instacart hosted page |
| Mobile | `apps/mobile/src/shopping/openInstacartCart.ts` | Opens the hosted page via `WebBrowser` |
| Mobile | `apps/mobile/src/shopping/classifyHandoffError.ts` | Error → user-facing copy mapping |
| Mobile | `apps/mobile/src/components/shopping/HandoffSheet.tsx` | Modal that polls + surfaces success/error states |
| Mobile | `apps/mobile/src/app/shopping/handoffs.tsx` | History view of past handoffs |
| Mobile | `apps/mobile/src/app/scan/instacart.tsx` | Pantry-scan → shopping list path |

**Entry point:** Plan tab → 🛒 cart icon (top of "This Week" card) → `handleShoppingHandoff` → `mealPlanStore.generateList(currentPlan.id)` → `createOrder()` → `HandoffSheet` modal.

**Two scoping questions the user needs to answer first** (don't run this blindly):

1. **What's failing today?** Has Patrick tested it in this build? If yes — what's the exact failure mode (hangs / 4xx / cart empty / wrong items / Instacart denies redirect)? If no — schedule a 5-minute live walk-through before changing code.
2. **Sandbox vs. live?** `.env` has `INSTACART_API_KEY`. Is that pointed at Instacart Developer Platform's sandbox or production? Sandbox docs: https://docs.instacart.com/developer_platform_api/

**Likely failure surfaces (when you do find issues):**

- **API key authorization scope** — Instacart issues different keys for "Recipe" page generation vs. "Shopping List" generation. Server uses `/v1/products/products_link` per `services/instacart.ts`; verify Patrick's key has scope for that endpoint.
- **Tunnel + `WebBrowser.openBrowserAsync`** — when on Tailscale, `EXPO_PUBLIC_API_URL=https://clawdaddy.taile16aae.ts.net:8443` is the *backend* URL, but the URL the user opens in their phone browser is Instacart's own hosted page (`https://www.instacart.com/store/...`). No Tailscale dependency for the actual cart open.
- **Pantry subtraction over-aggressive** — `services/shopping.ts:subtractPantry` may zero-out items the user actually needs to buy if pantry quantities are stale. Check Maestro flow `29-shopping-draft-cart-handoff.yaml` for known-good fixtures.
- **Schema-cache style errors** — if any recent migration added shopping columns and PostgREST hasn't refreshed, the create-order route may 500. Run `NOTIFY pgrst, 'reload schema';` if you see "Could not find column ... in the schema cache."

**Approach:** schedule this as `/gsd:debug` rather than `/gsd:quick` — debugging an integration is investigation work, not a known-shape implementation. Persistent state under `.planning/debug/instacart/` lets work resume across context resets.

---

## 3. 🧪 In-app UAT — recent changes that haven't been visually verified

A lot of UX shipped in the pre-launch session. Run through this once on the iPhone before declaring "done":

### Plan tab (Week view)
- [ ] **"This Week" card consolidated** — focus row + Veg-forward chip + cart all in one warm-cream card (commit `377e57d`)
- [ ] **Day cards**: 16:9 hero image, big day name on overlay, date as subtitle (commits `b320147` + `bc1f069`)
- [ ] **Skill chips** use `target` glyph not `sparkles` (commit `5f2b8d5`)
- [ ] **Plant-forward / Veg-forward dedup** — only one of those chips on plant-heavy recipes (commit `fca2e8e`)
- [ ] **Floating cluster** top-right of hero: Cook Now · Remix · Swap · Cooked · Clear (5 icons, rgba 0.20 capsule, 26pt glyphs, ordered Cook Now → Remix → Swap → Cooked → Clear) (commits `ac131c2` + `95fa1a4`)
- [ ] **Tap day** → preview popup. Save Recipe button is gone; "Remix" is the prominent CTA. Picking a variation auto-replaces the day (commit `360704e`)
- [ ] **Tap Swap** (cluster icon) → modal shows Recipe Box recipes alphabetical; "Generate ideas" button at bottom (commit `cb3e248`)
- [ ] **Tap Remix** (cluster icon) → opens RemixSheet directly with day's entry as inline source. Variation cards have calendar.badge.checkmark icon → applies to day (commit `360704e`)
- [ ] **Picker visual unification** — focus picker + remix mode picker render through shared PickerSheet + OptionCard, both 2-col grids (commit `73a3389`)
- [ ] **Focus picker** — selecting a card shows checkmark instantly, Regenerate Alert pops on top of the still-visible picker (commit `792e3a0`)

### Plan tab (Month view)
- [ ] **Scroll bug fixed** (see #1 above)
- [ ] Month grid → MonthPatterns (Protein bars / Cuisine chips / Repeats) all reachable
- [ ] Tap month cell → opens preview / drill-down

### Cooking screen
- [ ] **Light palette only** — no dark theme (commit `40c6716`)
- [ ] **"Start" button** instead of "Next" until first tap; first tap → step 1 highlights + reads aloud (commit `c3ea81d`)
- [ ] **Tap-to-exit** — no confirmation sheet; xmark exits immediately (commit `c3ea81d`)
- [ ] **TTS works** — step reads aloud on Start tap and on Next (commit `245cfd2`)
- [ ] **No mic / voice listener** — no permission prompt, no listening banner

### Recipe Box / Something New (RecipeCard)
- [ ] Action overlay icons render in a single rgba 0.20 capsule (not separate dark circles) (commit `95fa1a4`)
- [ ] Icon sizes 26pt; bookmark / cart / etc. all in one capsule top-right of hero

### Pantry
- [ ] Cart-add on pantry items + recipe ingredients works (the `1c4fa2d` stale-list 404 recovery should kick in if user has a stale cached shopping list)

### Settings
- [ ] No "Dark cooking mode" toggle
- [ ] No "Voice control during cooking" toggle
- [ ] Cooking Voice picker (Daniel/Oliver/etc.) preserved (TTS only)
- [ ] Plan card density toggle works (Compact ↔ Detailed)

---

## 4. ⚙️ Settings screen UAT

Walk through every row in Settings:

- [ ] **Account section** — sign-out works; biometric toggle works; change password / change email modals open
- [ ] **Dietary preferences** — modify, save, verify it influences plan generation
- [ ] **Pantry rules** — verify staples list editable
- [ ] **Plan section** — focus banner toggle, card density toggle
- [ ] **Cooking section** — TTS voice picker
- [ ] **About section** — Privacy, Terms, Support email links open in browser/mailto
- [ ] **Feedback** — submit a test feedback message; verify it lands in Supabase `feedback_submissions` table
- [ ] **Delete account** — DON'T actually run this; verify the sheet renders with the cooldown explainer

Maestro flow `apps/mobile/.maestro/37-settings-auth-uat.yaml` is the placeholder skeleton from Phase 23 — extend it to cover the rows above if you want regression lock-in.

---

## 5. 🧹 Comprehensive validation + bug fixes

**Run these in sequence:**

```bash
# Server-side
cd /Users/patrickrichards/DinnerTime/packages/server
pnpm test

# Mobile-side — vitest
cd /Users/patrickrichards/DinnerTime/apps/mobile
npx vitest run

# Mobile-side — typecheck (expect ~30 pre-existing errors in cooking/telemetry tests)
npx tsc --noEmit

# Maestro full sweep
cd /Users/patrickrichards/DinnerTime/apps/mobile
maestro test .maestro/smoke.yaml
maestro test .maestro/qa-remix-grid.yaml
ls .maestro/*.yaml | xargs -n1 maestro test  # full sweep, optional
```

**Known pre-existing issues that aren't blockers:**
- ~30 TS errors in `cooking/telemetry`-related test files (pre-date this session)
- 13 shoppingStore.test.ts failures + EMPTY_PANTRY meal-plans test failures (logged in `.planning/deferred-items.md` per Phase 25)
- vitest sometimes throws `rolldown` parse errors on `node_modules/react-native/index.js` — transient; clear with `rm -rf node_modules/.vite-* node_modules/.rolldown-*` and retry

**Fix anything new:** prefer `/gsd:fast` for trivial inline fixes, `/gsd:quick` for focused multi-file work, `/gsd:debug` for actual bugs that need investigation.

---

## Dev environment quickstart

```bash
# Terminal 1 — server (binds to 0.0.0.0:3000)
cd /Users/patrickrichards/DinnerTime
set -a && source .env && set +a && cd packages/server && pnpm dev

# Terminal 2 — Metro
cd /Users/patrickrichards/DinnerTime/apps/mobile
EXPO_PACKAGER_PROXY_URL=https://clawdaddy.taile16aae.ts.net \
REACT_NATIVE_PACKAGER_HOSTNAME=clawdaddy.taile16aae.ts.net \
  npx expo start --dev-client --lan --clear

# (Tailscale Serve persists across reboots — `tailscale serve status` should show:
#   https://clawdaddy.taile16aae.ts.net  →  localhost:8081  (Metro)
#   https://clawdaddy.taile16aae.ts.net:8443  →  localhost:3000  (API))
```

**Dev client URL on iPhone:** `https://clawdaddy.taile16aae.ts.net` (use plain `https://`, NOT `exp://` or `exps://` — those silently fail).

**Force-clear stale state:** if the app behaves weirdly after type/store changes, force-quit DinnerTime, restart Metro with `--clear`, and on the iPhone re-tap the cached "DinnerTime" entry under Recently Opened.

---

## Locked decisions — don't relitigate

These were debated and settled this session. Re-opening wastes time:

- **Voice STT is parked at backlog 999.1** — on-device `@jamsch/expo-speech-recognition` was unreliable. Will revive post-launch with server-side Whisper / ElevenLabs. Scaffolding files (`useVoiceListener.ts`, `useVoiceAmplitude.ts`, `VoiceWaveform.tsx`) stay on disk but unwired.
- **TTS playback (expo-speech + ElevenLabs proxy) STAYS** — only user voice INPUT was removed.
- **Cooking dark mode is gone permanently** — not coming back.
- **`sparkles` glyph is reserved for Remix only**. Skill chips + focus banner use `target`. Stretch chip keeps `sparkles` (different semantic, separate concern).
- **`rgba(0,0,0,0.20)` is THE action-overlay-capsule color** across HeroDayCard / RecipeCard / RemixSheet variation cards.
- **Plan card density default is `detailed`** (every day a hero card). Compact mode is opt-in via Settings.
- **Plan day card cluster icon order:** Cook Now · Remix · Swap · Cooked · Clear (left → right). Top-right of hero, not bottom.
- **Plan day preview popup CTA is "Remix" not "Save Recipe"** — picking a variation auto-replaces the day via `mealPlanStore.applySwap`.
- **Swap modal shows Recipe Box first, AI ideas on demand** — never auto-fetches.
- **Focus picker stays open through the Regenerate Alert** — parent (FocusBanner) owns close, sheet does not self-dismiss.
- **Picker visual language is `PickerSheet` + `OptionCard` shared primitives** — 2-col grid, no chevrons. Both Focus and Remix mode pickers consume them.

---

## Known gotchas (also in `CLAUDE.md` "Known Gotchas")

- **Server bind**: `serve()` in `packages/server/src/index.ts` uses `hostname: '0.0.0.0'` so the port is reachable on the Tailscale interface. Don't change this.
- **Tailscale CGNAT 100.x is NOT covered by `NSAllowsLocalNetworking`** — always HTTPS via Tailscale Serve, never plain HTTP to a Tailscale IP.
- **PostgREST schema cache**: after applying a Supabase migration, run `NOTIFY pgrst, 'reload schema';` if save errors say "Could not find column X in the schema cache."
- **Stale persisted state on cart-add**: `shoppingStore.addItem` self-recovers (refresh-or-create + retry on 404). Same pattern in `mealPlanStore`. If you add a new lazy-resource flow, replicate it.
- **Persisted Zustand stores rehydrate from AsyncStorage**: cookingStore was bumped v1→v2 in commit `833e126` to drop dropped keys cleanly. If you remove a persisted field, bump version + add migrate fn.
- **Dev client URL scheme**: plain `https://` only (not `exp://` / `exps://`) when entering URL manually.
- **Camera quality**: `scan/index.tsx` uses `quality: 0.4` to keep iPhone photos under Anthropic's 5MB limit. Don't raise.
- **Mac host on Tailscale**: `clawdaddy.taile16aae.ts.net` (`100.90.230.96`); LAN IP usually `192.168.4.43`. iPhone `iphone171` (`100.111.138.61`).
- **Bundle ID**: `com.dinnertime.app` (NOT `com.patrickrrichards.dinnertime`).

---

## Recently shipped (commit log, last → first)

```
377e57d feat(plan): merge focus banner + week stats into one This Week card
5e00b79 fix(plan): unclip Month-view bottom + hide week-actions ellipsis
5f2b8d5 fix(plan): swap skill glyph from sparkles to target
6fcb4d4 docs(state): record quick task 21 — picker visual unification
a984534 docs(quick-8-8): complete visual-unification-of-focuspickersheet-r plan
73a3389 refactor(quick-8-8): unify FocusPickerSheet + RemixSheet via PickerSheet + OptionCard
fd0c0c7 feat(quick-8-8): add PickerSheet + OptionCard primitives
95fa1a4 fix(ui): wrap RecipeCard/Remix actions in single capsule, lower opacity
ac131c2 fix(plan): reorder hero icons + bigger touch targets, unify swap glyph
d0a4ef0 fix(ui): unify action-overlay opacity to rgba(0,0,0,0.30) across surfaces
bc1f069 fix(plan): move hero icon cluster to top-right to avoid title overlap
adf7f55 docs(quick-10): complete plan-day-card-actions-replace-swipe-left
a530d5d feat(quick-10): wire HeroDayCard onCookNow + onRemix in plan tab
3efc809 refactor(quick-10): replace HeroDayCard swipe-left with floating icon cluster
245cfd2 fix(cook): remove duplicate speak on Start to clear TTS race
cb3e248 feat(plan): swap sheet shows Recipe Box first, fresh ideas on demand
360704e feat(plan): replace Save Recipe with Remix on day-preview popup
c3ea81d feat(cook): Start affordance + frictionless exit
40c6716 refactor(quick/9-9): strip darkMode + STT wiring from cook.tsx, header, nav buttons, settings
833e126 refactor(quick/9-9): drop darkMode + voiceEnabled from cookingStore + types + tests
998a101 docs: add backlog item 999.1 — hands-free voice control in cooking mode
fca2e8e fix(plan): dedup Plant-forward / Veg-forward chips on day cards
```

---

## Backlog (post-launch)

- **999.1 — Hands-free voice control** (`.planning/phases/999.1-hands-free-voice-control-in-cooking-mode-stt/`). Path: server-side Whisper or ElevenLabs STT through backend proxy. Acceptance: "next/repeat/stop" voice commands work reliably at arm's length in a noisy kitchen.

---

## When you reach launch-ready

Follow `.planning/LAUNCH-HANDOFF.md` for the EAS Build → TestFlight → App Store path. That doc was written for the v1.0 launch and is still the definitive reference.

Good luck. 🍳
