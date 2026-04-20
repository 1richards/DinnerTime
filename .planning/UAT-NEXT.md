# UAT Runbook — Post Block B (Phases 18 + 24a + 21)

**Created:** 2026-04-19
**Scope:** Validate Phase 18 (AI auto-location), Phase 24a (canonical schema + identity dedup), Phase 21 (rules + staples + pantry intelligence) against a live simulator.

---

## 0 · Pre-flight (one-time per session)

```bash
cd /Users/patrickrichards/DinnerTime
git log --oneline -5   # confirm you're at e4ef084 (phase-21 complete) or later
```

---

## 1 · Push Supabase migrations (REQUIRED)

**Migrations 00009–00019 are committed to repo but not yet pushed to hosted Supabase.** Every new route in Phases 18 / 24a / 21 will 500 until these land.

```bash
# If supabase CLI missing
brew install supabase/tap/supabase

# Push all migrations
cd /Users/patrickrichards/DinnerTime
supabase db push
```

Pushes: `00009_item_attributes.sql` · `00010_item_override_events.sql` · `00011_canonical_ingredients.sql` · `00012_ingredient_aliases.sql` · `00013_pantry_items_canonical_link.sql` · `00014_scan_events.sql` · `00015_pantry_items_quantity_jsonb.sql` · `00016_user_staples.sql` · `00017_user_location_rules.sql` · `00018_suggested_rules.sql` · `00019_canonical_scan_counts_and_promote_rpc.sql`

Expect seed inserts for 366 canonical_ingredients + 1587 ingredient_aliases.

---

## 2 · Rebuild the dev client (REQUIRED)

Phase 21 added `react-native-draggable-flatlist@4.0.3` — a new native module. The prebuilt `apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app` was built **before** this install and will either crash on `DraggableFlatList` import or load stale JS.

```bash
cd /Users/patrickrichards/DinnerTime/apps/mobile/ios
pod install

cd ..
# Rebuild for simulator
xcodebuild -workspace ios/DinnerTime.xcworkspace \
  -scheme DinnerTime \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/build \
  build
```

~3-5 min. If signing / team prompts appear, open `ios/DinnerTime.xcworkspace` in Xcode and let it auto-resolve, then re-run CLI build.

---

## 3 · Start the dev stack (3 terminals)

```bash
# Terminal A — backend server
cd /Users/patrickrichards/DinnerTime
set -a && source .env && set +a && cd packages/server && pnpm dev
# confirm: "Server listening on :3000"

# Terminal B — Metro (cache cleared for .env + new native module)
cd /Users/patrickrichards/DinnerTime/apps/mobile
rm -rf .expo
npx expo start --dev-client --lan --clear

# Terminal C — simulator
xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true
open -a Simulator
xcrun simctl install booted apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app
```

---

## 4 · Maestro — fast smoke first

```bash
cd /Users/patrickrichards/DinnerTime/apps/mobile
./.maestro/scripts/uat.sh smoke
```

If smoke fails, stop and triage (likely symptoms: Metro URL mismatch → bundle-error screen; missing DraggableFlatList → stale build; 500 on /pantry → missing migrations).

---

## 5 · Maestro — full suite

```bash
cd /Users/patrickrichards/DinnerTime/apps/mobile
./.maestro/scripts/uat.sh all
```

~15 min. Exit 0 = all flows green.

**Flows of special interest for this block:**
| Flow | What it validates | Phase |
|------|-------------------|-------|
| `07-pantry-add.yaml` | Scan entry (LocationPicker removed) | 18 |
| `16-pantry-scan-stub.yaml` | Batch scan (location-per-session lock removed) | 18 |
| `19-receipt-scan-stub.yaml` | Receipt import (per-item fan-out) | 18 |
| `24-pantry-staples.yaml` | Mark staple via ellipsis + staples filter chip | 21 |
| `25-pantry-search-pill.yaml` | StickySearchPill + 4-way grouping toggle | 21 |
| `26-pantry-rules.yaml` | Settings Rules list + drag-to-reorder + add rule | 21 |

**Likely label-copy drift** (1-line fixes): flows 24/25/26 were written blind against components; if assertions fail on exact chip labels ("All", "Staples", "Fridge"), edit the YAML assertion to match what the component actually renders.

---

## 6 · Subjective UAT on physical iPhone (Cloudflare tunnel)

Per CLAUDE.md "Dev Environment Startup" section. Needed for real-camera validation.

```bash
# Terminal D — tunnel
cloudflared tunnel --url http://localhost:3000
# copy the trycloudflare.com URL

# Update apps/mobile/.env
EXPO_PUBLIC_API_URL=https://<tunnel-url>.trycloudflare.com

# Metro needs --clear to pick up .env change
cd /Users/patrickrichards/DinnerTime/apps/mobile
rm -rf .expo && npx expo start --dev-client --lan --clear
```

Subjective items to verify on physical iPhone:
1. AI auto-location (Phase 18) — scan a real fridge, verify dairy/meat go fridge, frozen goes freezer, shelf-stable goes pantry without user picking location
2. Canonical dedup (Phase 24a) — scan same item twice with different labels ("chicken breast" → "organic chicken breast") and verify they merge into one pantry row
3. Staples aggressive 0.3 auto-accept (Phase 21) — mark "milk" as staple, then scan a blurry/low-confidence milk image, confirm it auto-accepts without review
4. Drag-to-reorder rules feel natural (Phase 21)
5. Stale dashed border reads "uncertain" not "broken" (Phase 21)
6. 30-day rule preview loads fast + is tappable (Phase 21)

---

## 7 · If something regresses

Capture screenshots at `apps/mobile/.maestro/screenshots/` and run:

```bash
/gsd:debug   # opens debug session with full phase context
```

Phase-level verification files (pass/fail rationale):
- `.planning/phases/18-.../18-VERIFICATION.md`
- `.planning/phases/24-.../24-VERIFICATION.md`
- `.planning/phases/21-.../21-VERIFICATION.md`

---

## 8 · Outstanding 24b work (separate session)

Phase 24 was split — 24a (data-model + dedup) shipped this session. 24b (vision quality) is deferred:
- Versioned prompt `.md` files in `packages/server/src/prompts/`
- Eval harness with golden fixtures
- Fixture-based accuracy metric
- Retry/fallback (structured-tool → text parse → clear error)
- Model routing per scan variant

Run `/gsd:plan-phase 24` in a fresh session to pick this up.

---

## Known deferred items (not UAT blockers)

| Item | Scope | Source |
|------|-------|--------|
| 4 pre-existing mobile store test failures (auth-store, progressionStore, shoppingStore) | Phase 23 | Multiple SUMMARYs |
| Multi-pass vision reasoning | Post-beta investigation | 24-CONTEXT descope |
| Admin UI for canonical promotion | Future admin-tooling phase | 21-CONTEXT |
| 24b full scope | Separate plan-phase invocation | 24-CONTEXT |

---

*Session boundary: paused at 78% context after Block B verification passed across all three phases. All code + tests + plans committed. Nothing to recover; resume from Section 1.*
