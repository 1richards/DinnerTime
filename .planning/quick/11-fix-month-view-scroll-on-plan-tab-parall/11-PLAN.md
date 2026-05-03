---
phase: quick-11
plan: 11
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/app/(tabs)/plan.tsx
autonomous: false
requirements:
  - QUICK-11-01  # Month view ScrollView responds to vertical swipe gestures
  - QUICK-11-02  # Cuisine + Repeats sections become reachable below the fold
must_haves:
  truths:
    - "On the Plan tab, after tapping Month, the user can swipe up and the page scrolls."
    - "The Cuisine section becomes fully visible after scrolling."
    - "The Repeats section becomes fully visible after scrolling."
    - "Toggling back to Week still shows the day list (functionality preserved)."
    - "Toggling back to Month from Week still shows the grid + patterns (no broken state)."
  artifacts:
    - path: "apps/mobile/src/app/(tabs)/plan.tsx"
      provides: "Month-view scroll fix — parallel-mount replaced with conditional render (or fallback nestedScrollEnabled patch if conditional alone doesn't fix)"
      contains: "scale === 'month'"
  key_links:
    - from: "apps/mobile/src/app/(tabs)/plan.tsx (Month ScrollView)"
      to: "user vertical swipe gestures"
      via: "no parallel-mounted DraggableFlatList intercepting touches"
      pattern: "scale === 'month'"
---

<objective>
Fix the Month-view scroll bug on the Plan tab. The Cuisine and Repeats sections in `<MonthPatterns/>` sit below the fold and the ScrollView at `apps/mobile/src/app/(tabs)/plan.tsx:995` won't reveal them when the user swipes. The handoff (.planning/HANDOFF-NEXT-SESSION.md item #1) ranks the parallel-mounted Week DraggableFlatList (line ~887) intercepting touches as the most likely cause. A 140→220 paddingBottom bump (commit 5e00b79) didn't help, confirming this is a gesture/touch issue, not a content-height issue.

Purpose: Unblock month-view exploration so the user can actually see protein/cuisine/repeats — those sections are the entire reason Month view exists.

Output: Updated `plan.tsx` where Month and Week views are conditionally rendered (not parallel-mounted with `display: 'none'`), allowing Month's ScrollView to receive gestures cleanly. Loses scroll-position memory across Week↔Month toggles, which is acceptable for v1 per the constraints.
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/HANDOFF-NEXT-SESSION.md

# Source files this plan modifies / depends on
@apps/mobile/src/app/(tabs)/plan.tsx
@apps/mobile/src/components/plan/MonthPatterns.tsx
@apps/mobile/src/components/ui/useCollapsingHeader.ts

# Maestro flow that already exercises the Week↔Month toggle (use as UAT base)
@apps/mobile/.maestro/31-month-view.yaml

<interfaces>
<!-- Key shape of the parallel-mount block we're replacing — extracted from plan.tsx so the executor doesn't have to re-explore. -->

Current structure in plan.tsx (~lines 884–1026):
```tsx
{/* Week — stays mounted via display:none */}
<View
  style={[{ flex: 1 }, scale !== 'week' && { display: 'none' }]}
  pointerEvents={scale === 'week' ? 'auto' : 'none'}
>
  <DraggableFlatList ... />
</View>

{/* Month — parallel mount */}
<View
  style={[{ flex: 1 }, scale !== 'month' && { display: 'none' }]}
  pointerEvents={scale === 'month' ? 'auto' : 'none'}
>
  <ScrollView
    contentContainerStyle={{ paddingBottom: 220 }}
    scrollEventThrottle={16}
    onScroll={onScroll}
  >
    {monthHeader}
    <MonthGrid ... />
    <MonthPatterns ... />
  </ScrollView>
</View>
```

`useCollapsingHeader()` (apps/mobile/src/components/ui/useCollapsingHeader.ts) returns:
```ts
{ scrollY, onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity }
```
`onScroll` is `Animated.event([{ nativeEvent: { contentOffset: { y: scrollY }}}], { useNativeDriver: true })` — driving translateY/opacity on `monthHeader`'s `<Animated.View>`. This is the rendered child, not a parent of the ScrollView, so it should NOT block scroll. (Documenting so the executor doesn't chase cause #2 prematurely.)

Scale state declaration is in plan.tsx — search for `const [scale, setScale]` or `scale === 'week'` to locate.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Diagnostic — confirm parallel-mounted Week DraggableFlatList is the culprit</name>
  <files>apps/mobile/src/app/(tabs)/plan.tsx</files>
  <action>
Before applying the real fix, prove cause #1 from the handoff. This is a 5-minute confirmation step — if it fails, we know to try cause #2 or #3 instead, saving a wasted round-trip.

Edit `apps/mobile/src/app/(tabs)/plan.tsx`:

1. Locate the Week-view `<View>` wrapper at ~line 887: `<View style={[{ flex: 1 }, scale !== 'week' && { display: 'none' }]} ...>`

2. **Temporarily** wrap the entire Week-view block (the `<View>...{...DraggableFlatList...}</View>` at lines ~887–986) in a conditional:
```tsx
{scale === 'week' && (
  <View style={{ flex: 1 }}>
    <DraggableFlatList ... />
  </View>
)}
```
This unmounts the Week list entirely when on Month — eliminating any chance it's intercepting touches.

3. Leave the Month-view block exactly as-is for this diagnostic step.

4. Save, reload the dev client (Metro is running on port 8081 per CLAUDE.md). If Metro isn't running, start it: `cd apps/mobile && npx expo start --dev-client --lan`.

5. On the iOS simulator (iPhone 17 Pro per CLAUDE.md UAT section): boot if needed (`xcrun simctl boot "iPhone 17 Pro" || true`), open the app, navigate to Plan tab, tap Month, swipe up.

6. **Decision branch:**
   - **If scrolling NOW WORKS** → cause #1 confirmed. Proceed to Task 2 (apply the proper fix and clean up).
   - **If scrolling STILL DOES NOT WORK** → cause #1 is wrong. STOP and add a checkpoint comment in the file: `// QUICK-11 DIAGNOSTIC: Week unmount did not fix scroll. Try cause #2: add nestedScrollEnabled + keyboardShouldPersistTaps="handled" to Month ScrollView, OR cause #3: remove edges={['bottom']} from outer SafeAreaView (line 842). Re-test after each.` Then proceed to Task 2 with the alternate fix path noted in the checkpoint.

This task does NOT need to leave the codebase in a clean state — Task 2 will replace this diagnostic with the proper conditional-render structure for both views.
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "plan\.tsx" | head -5</automated>
    Manual: Reload sim, tap Plan → Month, swipe up. Cuisine + Repeats sections should scroll into view.
  </verify>
  <done>
The diagnostic edit compiles. The user (on the sim) has confirmed whether scroll works (cause #1) or does not (cause #2/#3 needed). The decision is recorded as a comment in `plan.tsx` so Task 2 has the correct fix path.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Diagnostic Week-unmount in plan.tsx — confirms whether parallel DraggableFlatList is intercepting Month-view scroll gestures.</what-built>
  <how-to-verify>
1. Confirm Metro is running (`cd apps/mobile && npx expo start --dev-client --lan` if not).
2. Boot the iPhone 17 Pro simulator and open DinnerTime.
3. Sign in, tap the **Plan** tab.
4. Tap the **Month** segment.
5. **Swipe up** on the grid area, then on the Protein bars area.
6. Report one of:
   - "scroll works, Cuisine + Repeats visible" → executor proceeds to Task 2 with conditional-render fix
   - "still no scroll" → executor proceeds to Task 2 with cause #2 (`nestedScrollEnabled` + `keyboardShouldPersistTaps="handled"`) AND cause #3 (drop `edges={['bottom']}` from outer SafeAreaView) layered on top of conditional render
  </how-to-verify>
  <resume-signal>Reply with "scroll works" or "still broken" (plus any extra observations).</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Apply conditional-render fix (and fallback patches if Task 1 indicated cause #2/#3)</name>
  <files>apps/mobile/src/app/(tabs)/plan.tsx</files>
  <action>
Now apply the production fix. The path depends on the Task 1 outcome that the user reported in the checkpoint.

**Path A — cause #1 confirmed (scroll worked after diagnostic):**

1. Replace BOTH the Week and Month parallel-mount blocks (`<View style={[{ flex: 1 }, scale !== 'week' && { display: 'none' }]}>` and the symmetric Month one) with conditional renders:

```tsx
{scale === 'week' ? (
  <View style={{ flex: 1 }}>
    <DraggableFlatList
      data={days}
      keyExtractor={(item) => `day-${item.day}`}
      ListHeaderComponent={listHeader}
      containerStyle={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 140 }}
      activationDistance={8}
      onDragEnd={...}              // unchanged
      renderItem={...}              // unchanged
    />
  </View>
) : (
  <View style={{ flex: 1 }}>
    <ScrollView
      contentContainerStyle={{ paddingBottom: 220 }}
      scrollEventThrottle={16}
      onScroll={onScroll}
    >
      {monthHeader}
      <MonthGrid ... />              // unchanged props
      <MonthPatterns entries={Array.from(monthPlans.values())} />
    </ScrollView>
  </View>
)}
```

2. Remove the now-stale `pointerEvents` props (no longer needed — the unmount handles it).

3. Update the comment block above the Week view from "stays mounted when scale='month' via display:none" to: `// Week / Month conditional-render. Switched from parallel display:none mount in quick-11 because the parallel DraggableFlatList intercepted Month-view scroll gestures. Trade-off: scroll position is reset on each toggle, acceptable for v1.`

4. Remove the diagnostic comment from Task 1 if it was added.

**Path B — cause #1 NOT confirmed (scroll still broken after diagnostic):**

Apply Path A's conditional-render structure (it's still the right move per constraints) AND layer on the cause-#2 + cause-#3 patches:

1. Add `nestedScrollEnabled` and `keyboardShouldPersistTaps="handled"` to the Month ScrollView:
```tsx
<ScrollView
  contentContainerStyle={{ paddingBottom: 220 }}
  scrollEventThrottle={16}
  onScroll={onScroll}
  nestedScrollEnabled
  keyboardShouldPersistTaps="handled"
>
```

2. Drop the `edges={['bottom']}` from the outer SafeAreaView (line 842) — change `<SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>` to `<SafeAreaView className="flex-1 bg-warmWhite">` (or `edges={[]}` if total removal causes header overlap; test both). The bottom paddingBottom: 220 already clears the home indicator.

3. If after these changes scroll STILL fails, the most likely remaining culprit is the `Animated.event` `onScroll` with `useNativeDriver: true` competing with the ScrollView's native scroll. Replace the Month ScrollView's `onScroll={onScroll}` with `onScroll={undefined}` and `scrollEventThrottle={undefined}` as a temporary hack — this disables the collapsing-header animation on Month view (acceptable since the large title isn't crucial there) but proves whether the Animated.event is the blocker. Add a code comment: `// Collapsing-header onScroll disabled on Month — quick-11 found Animated.event with useNativeDriver was blocking scroll. Re-enable when migrating to Reanimated 3 useAnimatedScrollHandler.`

**Both paths:** Run typecheck and unit tests after edits.

**Both paths:** Run the existing maestro flow `apps/mobile/.maestro/31-month-view.yaml` (already toggles Week↔Month) to confirm the toggle still works end-to-end.
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && npx tsc --noEmit -p tsconfig.json 2>&1 | tee /tmp/qq11-tsc.log | tail -20 && pnpm -C /Users/patrickrichards/DinnerTime test --filter mobile 2>&1 | tail -10</automated>
    Manual sim: Plan tab → tap Month → swipe up → see Cuisine + Repeats. Tap Week → day list visible. Tap Month again → grid + patterns visible. No crashes.
    Maestro: `cd apps/mobile && maestro test .maestro/31-month-view.yaml` — flow passes (3 screenshots produced, no failures).
  </automated>
  </verify>
  <done>
- `plan.tsx` typechecks cleanly (no new errors related to scale/scope/JSX from this change).
- Month view scrolls vertically on the iPhone 17 Pro simulator; Cuisine and Repeats sections are reachable.
- Week → Month → Week toggle still works (no white flash beyond the expected re-mount; no crash).
- Maestro flow `31-month-view.yaml` passes.
- A code comment documents the trade-off (scroll-position memory loss on toggle) and the reason (parallel-mount gesture interception).
  </done>
</task>

</tasks>

<verification>
1. **Typecheck:** `cd apps/mobile && npx tsc --noEmit -p tsconfig.json` reports no NEW errors in `src/app/(tabs)/plan.tsx`.
2. **Unit tests:** `pnpm -C /Users/patrickrichards/DinnerTime test --filter mobile` — all currently-passing tests still pass (no regression).
3. **Sim manual:** Plan tab → Month → swipe up → Cuisine + Repeats visible.
4. **Maestro:** `cd apps/mobile && maestro test .maestro/31-month-view.yaml` passes (existing Week↔Month toggle flow). Screenshots `01-week-view`, `02-month-view`, `03-back-to-week` produced.
5. **Visual:** Take an extra screenshot mid-scroll on Month view (`xcrun simctl io booted screenshot /tmp/quick-11-month-scrolled.png` after manually scrolling) to confirm the fix visually.
</verification>

<success_criteria>
- User can swipe up on the Month view and see Cuisine + Repeats sections that were previously below the fold.
- Week ↔ Month toggle still functions; no broken state on either side.
- Trade-off (scroll-position not preserved across Week↔Month toggle) is acknowledged in a code comment.
- Existing Maestro flow `31-month-view.yaml` still passes.
- Typecheck + mobile tests are green.
</success_criteria>

<output>
After completion, create `.planning/quick/11-fix-month-view-scroll-on-plan-tab-parall/11-SUMMARY.md` documenting:
- Which cause was confirmed (diagnostic outcome from Task 1's checkpoint)
- The final fix shape (Path A conditional-render alone, OR Path B with cause-#2/#3 layered)
- Any side effects observed (e.g., header animation behavior change if onScroll was disabled)
- Maestro screenshot paths for the before/after Month-view state
</output>
