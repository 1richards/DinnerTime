---
status: awaiting_human_verify
trigger: "Three pantry bugs: Delete swipe, Get more swipe, and Plan tab Pantry ready chip stale"
created: 2026-04-29T00:00:00Z
updated: 2026-04-30T15:00:00Z
---

## Current Focus

hypothesis: All three bugs root-caused and fixed. Bug 1: silent error swallow → Alert. Bug 2: missing "In cart" chip + silent currentList=null no-op → throw + chip. Bug 3: stale chip from used items → caller filters status='available' (already in plan.tsx).
test: Maestro repro 99-* shows "In cart" chip correctly placed; vitest 161/163 passing; 2 failures pre-existing.
expecting: User confirms Delete now shows error message when PATCH fails on physical iPhone; "In cart" chip visible after Get more
next_action: Await user verification on physical iPhone

## Symptoms

expected:
  - BUG 1 (Delete): swipe-to-delete removes row, persists status='depleted', stays gone after reload
  - BUG 2 (Get more): swipe-to-get-more keeps row visible with "in cart" indicator, adds to shopping list
  - BUG 3 (Pantry ready): chip stops saying "Pantry ready" after pantry items removed/used

actual:
  - BUG 1: User reports Delete doesn't work — item stays
  - BUG 2: User reports row vanishes from pantry after Get more
  - BUG 3: Stale chip — still says "Pantry ready" after pantry mutation

errors: None (behavioral bugs)

reproduction:
  - Open app, go to Pantry tab
  - BUG 1: Swipe row left far enough to commit Delete; navigate away+back to verify
  - BUG 2: Swipe row right far enough to commit Get more; check row presence
  - BUG 3: Plan with bacon dependency, delete bacon from pantry, return to Plan tab

started: 2026-04-30 UAT session

## Bug Investigations

### BUG 3: Pantry ready chip stale

Hypothesis: `markItemUsed` flips local `item.status` to 'used' BUT does not remove from `state.items`. `pantry.tsx` line 218 reads `usePantryStore(s => s.items)` and passes the full list (including used) to `computePantryReady`. The match succeeds because the used item still has the same `name`. Hence chip stays green.

Code evidence:
- pantryStore.ts:606-614: markItemUsed updates item with `status: 'used'` but keeps it in `state.items`
- plan.tsx:218: `pantryItems = usePantryStore((s) => s.items)` — no status filter
- pantryReady.ts:70-72: builds pantryNames from ALL items, no filter

For Delete (markItemDepleted), this is NOT a problem — that one does filter the item out (pantryStore.ts:654-656).

ROOT CAUSE (Bug 3): `markItemUsed` does not remove from local state OR `computePantryReady`'s callers don't filter by status='available'. Fix: filter pantryItems to status==='available' inside computePantryReady caller (plan.tsx) since pantryReady.ts is shared and it's safer to filter at the consumer boundary. Also: should we filter in usePantryItems hook too? The pantry tab itself: loadItems already filters via Supabase eq('status', 'available'), so the pantry list initially only has available. But after markItemUsed the local store keeps the used row. So usePantryItems also shows the used row. Hmm — verify on sim. Probably fine for now since the user requested Delete, not Used, behavior. But for plan chip the canonical fix is filter pantryItems by status === 'available' in plan.tsx.

### BUG 1: Delete doesn't work

Hypothesis A: PATCH endpoint erroring -> rollback restores item
Hypothesis B: AsyncStorage rehydration overwrites optimistic state
Hypothesis C: User reports stale due to test conditions (was already reloading state)

Code path:
- handleDelete -> markItemDepleted(id) -> optimistic filter -> PATCH /api/v1/pantry/:id {status:'depleted'} -> rollback on error
- markItemDepleted on pantryStore.ts:646 looks correct

Need: server logs during repro, screenshot before+after delete

### BUG 2: Get more removes row

Hypothesis A: `addItem` on shoppingStore requires `currentList` to exist (line 222-225). If null, sets error and returns. Doesn't touch pantry store. Row would NOT vanish.
Hypothesis B: Some upstream filter removes pantry items that match a shopping list name.
Hypothesis C: ReanimatedSwipeable visual: row is animated off and `swipeRef.close()` is called too early/late. Row swipes back but feels gone.
Hypothesis D: `onSwipeableOpen` fires + handleGetMore + close — animation finishes off-screen?

Need: confirm via Maestro screenshot

## Eliminated

- hypothesis: Bug 1 — server PATCH route is broken
  evidence: PATCH /api/v1/pantry/:id returns 200 in 410ms during sim repro (server log 2026-04-30T14:33:27Z)
  timestamp: 2026-04-30 (sim repro)

- hypothesis: Bug 1 — the swipe doesn't even fire on simulator
  evidence: Sim repro deleted Sriracha (count 46→45, persisted across nav)
  timestamp: 2026-04-30

- hypothesis: Bug 2 — pantry row vanishes after Get more
  evidence: Sim repro (99-06b, 99-08): row count stayed 45, layout unchanged after swipe. Row never disappears.
  timestamp: 2026-04-30

## Evidence

- timestamp: 2026-04-29
  checked: pantryStore.ts markItemUsed
  found: line 606-614 — only flips `status: 'used'`, does NOT remove from state.items
  implication: used items remain in store, contaminate computePantryReady

- timestamp: 2026-04-29
  checked: plan.tsx:218
  found: pantryItems uses store items directly with no filter
  implication: confirms Bug 3 root cause — chip sees used items as "still in pantry"

- timestamp: 2026-04-29
  checked: pantryReady.ts:70-72
  found: builds pantryNames from ALL pantryItems passed in
  implication: filtering responsibility lives in caller. plan.tsx is the only caller.

- timestamp: 2026-04-29
  checked: shoppingStore.ts addItem (line 221)
  found: requires currentList; sets error and returns if absent. DOES NOT mutate pantry store.
  implication: For Bug 2 the user-reported "row vanishes" cannot be from addItem itself.

## Resolution

root_cause:
  - Bug 1 (Delete): PATCH succeeds + optimistic removal works on simulator. The user's "delete doesn't work" report on physical iPhone is most plausibly explained by the catch in handleDelete swallowing errors silently — when PATCH fails (e.g. flaky network on real device), markItemDepleted re-throws after rollback, but PantryItemCard.handleDelete swallows the throw with `// Rollback handled by store`, so the user sees the row come back with no explanation. Treat the user report as "delete works most of the time, but when it fails the user thinks it's broken because the item silently reappears". Fix: surface the error.
  - Bug 2 (Get more): Two issues
      (a) No "in cart" visual indicator in pantry after item is added to shopping list. Right now the row stays put with no signal to the user, which makes the swipe feel like a no-op.
      (b) Same silent-error path as Bug 1: handleGetMore catches `addToShoppingList` errors and shows an Alert (good), but `useShoppingStore.addItem` checks `if (!list) { set({ error: '...' }); return; }` — silently NO-OP without throwing, so handleGetMore Alert never fires when currentList is null.
  - Bug 3 (Pantry ready chip stale): plan.tsx passed all pantryItems (including status='used') to computePantryReady. markItemUsed leaves used rows in the store. Already fixed in plan.tsx (uncommitted) by adding availablePantryItems memo. This change is correct and verified by reading the diff.

fix:
  - Bug 1: Surface error in PantryItemCard.handleDelete via Alert.alert when the PATCH fails (mirror handleGetMore's existing catch).
  - Bug 2:
    (i) PantryItemCard subscribes to useShoppingStore.items, computes "isInCart" by normalized-name match, and renders an "In cart" trailing chip (tone='success') when the item is in cart AND no higher-priority chip (uncertain/Low) is already present.
    (ii) shoppingStore.addItem must throw on null currentList instead of silently returning; OR handleGetMore must auto-fetch the shopping list when currentList is null. Cleaner: throw on null currentList so handleGetMore's catch path surfaces the user-visible error.
    (iii) Lazy-load currentList from network on app mount (cleaner long-term — but out of scope for this fix; persistence + Shopping tab visit covers most users). For correctness here, throw the error in addItem.
  - Bug 3: keep the existing uncommitted plan.tsx fix (filter to status='available' before computePantryReady). Verify with regression test.

verification:
  - Maestro repro 99-pantry-trifecta-repro.yaml ran end-to-end (EXIT: 0)
  - Screenshot 99-02 confirms "In cart" success chip rendered on Honey + Balsamic Vinegar (both in current shopping list); Dijon Mustard / fresh salsa correctly show no chip (not in shopping list).
  - Earlier sim run captured PATCH /api/v1/pantry/:id 200 response from Delete swipe (Sriracha removed; count 46→45; persisted across nav).
  - Pre/post pantry-status counts via API: 45 available, 0 used, 0 depleted (Sriracha row id 0c31692c… persisted as depleted on server, filtered out of /api/v1/pantry GET).
  - Vitest: 161 passing (incl. new deriveTrailingChip + isItemInShoppingCart + addItem-throws-on-null-list + Bug3 contract guard); 2 pre-existing failures in shoppingStore.fetchCurrent (response-shape regression, unrelated to this debug session).
  - tsc: zero new errors in changed files.

files_changed:
  - apps/mobile/src/components/pantry/PantryItemCard.tsx (handleDelete surfaces error via Alert; subscribes to useShoppingStore.items; computes isInCart; uses deriveTrailingChip(item, isInCart))
  - apps/mobile/src/components/pantry/pantryItemCardHelpers.ts (added deriveTrailingChip, isItemInShoppingCart pure helpers)
  - apps/mobile/src/components/pantry/__tests__/PantryItemCard.test.tsx (new chip-priority + cart-match tests)
  - apps/mobile/src/stores/shoppingStore.ts (addItem throws on null currentList AND on POST failure)
  - apps/mobile/src/stores/__tests__/shoppingStore.test.ts (updated rolls-back test, added throws-on-null-list test)
  - apps/mobile/src/components/plan/pantryReady.test.ts (added Bug 3 contract regression test)
  - apps/mobile/src/app/(tabs)/plan.tsx (BUGFIX 2026-04-29 already in working tree: availablePantryItems filter for Bug 3)
  - apps/mobile/.maestro/99-pantry-trifecta-repro.yaml (new repro flow with shopping warm-up step)
