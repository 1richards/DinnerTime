---
status: awaiting_human_verify
trigger: "the recipes that are suggested from the remix page still don't open when you select them"
created: 2026-05-03
updated: 2026-05-03
---

## Current Focus

hypothesis: 79b07b3 only fixed the INNER expanded-preview Modal (pageSheet → fullScreen) but missed the OUTER variations-list Modal which is still pageSheet. From Plan tab → tap day → preview popup → Remix CTA, the stack is: PlanEntryPreview pageSheet (outer) + RemixSheet variations pageSheet (inner) + tap-to-expand fullScreen. Even with the inner-most as fullScreen, mounting a 3rd Modal from inside a doubly-stacked pageSheet on iOS is brittle. Switching the variations Modal to fullScreen eliminates the stacked-pageSheets pathology and reduces the chain to: pageSheet (outer) + fullScreen (variations) + fullScreen (expanded), which iOS handles cleanly.
test: Apply fix and verify the chain types via code reading. Cannot run simulator (user is asleep, autonomous mode). Best-judgment fix based on entry-path tracing.
expecting: Tapping variation card body opens the expanded preview (or applies-to-day from the calendar icon, depending on which the user tapped).
next_action: User verification on physical iPhone or simulator.

## Symptoms

expected: Tapping a variation card on the Remix sheet either (a) opens a preview/detail of that variation, OR (b) applies the variation to the source day. Either way produces visible feedback.
actual: Tap does nothing. No banner, no sheet transition, no day-card update. Even after 79b07b3 was supposed to fix it.
errors: None observed (silent no-op)
reproduction: Open RemixSheet -> pick mode -> tap variation card -> nothing happens
started: Recent — pre-launch UAT 2026-05-03

## Eliminated

- hypothesis: handleCardPress doesn't fire (Pressable hitbox blocked by overlay)
  evidence: 79b07b3 commit message confirmed "handleCardPress fired, state updated, but the modal never showed". This was already verified by the dev traces in a25eb3e. The Pressable is wired correctly with stopPropagation on the inner action badges. Hero is a single tap surface.
  timestamp: 2026-05-03 reading code

- hypothesis: handleCardPress fires but onExpand callback is null
  evidence: VariationCard receives `onExpand={() => handleExpand(i, v)}` always (line 681). It's never null.
  timestamp: 2026-05-03 reading code

- hypothesis: ensureFull throws and silently swallows
  evidence: ensureFull has try/catch — returns null on failure, shows Alert.alert. setWorkingIdx(null) always runs after. If fetch failed, user would see "Remix failed" alert.
  timestamp: 2026-05-03 reading code

- hypothesis: 79b07b3 fix is incomplete because the OUTER variations Modal (line 619-700) is still pageSheet
  evidence: 79b07b3 only changed the INNER expand Modal at line 711-735. The OUTER variations Modal at line 619 retained presentationStyle="pageSheet". When entered from Plan tab → tap day → preview popup → Remix CTA, this stacks 2 pageSheets (PlanEntryPreview pageSheet at plan.tsx:1153 + RemixSheet variations pageSheet at RemixSheet:619). Plus PickerSheet which is also pageSheet. iOS only reliably presents 1 pageSheet at a time; nested mounts of inner Modals from within doubly-stacked pageSheets are unstable.
  timestamp: 2026-05-03 reading 79b07b3 diff and tracing entry chain

## Evidence

- timestamp: 2026-05-03
  checked: RemixSheet.tsx line 619-700 (variations Modal)
  found: presentationStyle="pageSheet" — same as the inner expand Modal was BEFORE 79b07b3 fix
  implication: When entered from Plan tab day-preview popup chain, this is stacked under another pageSheet from PlanEntryPreview wrapper Modal at plan.tsx:1153

- timestamp: 2026-05-03
  checked: plan.tsx line 1153-1225 (PlanEntryPreview Modal)
  found: presentationStyle="pageSheet" wraps PreviewSheet which has the Remix CTA at PreviewSheet line 724
  implication: Outer pageSheet → PreviewSheet inline View → user taps Remix → mounts RemixSheet with PickerSheet (pageSheet) then variations (pageSheet) — all stacked

- timestamp: 2026-05-03
  checked: plan.tsx line 1314-1354 (HeroDayCard cluster Remix entry path)
  found: RemixSheet mounted directly without an outer pageSheet wrapper
  implication: This entry path has only 1 pageSheet, the previous fix works for it

- timestamp: 2026-05-03
  checked: recipes/[id]/index.tsx line 336 (Recipe Box detail Remix entry path)
  found: RemixSheet mounted at screen level (not in Modal)
  implication: This entry path has only 1 pageSheet, the previous fix works for it

- timestamp: 2026-05-03
  checked: 79b07b3 diff
  found: Only changed the expanded-preview Modal (line 711-735) from pageSheet to fullScreen. Did not touch the outer variations Modal (line 619-700) or the PickerSheet usage.
  implication: Plan tab → day preview → Remix path is still vulnerable because it has 2+ stacked pageSheets and the new fullScreen mounts as a 3rd-level Modal which is brittle on iOS.

## Resolution

root_cause: |
  iOS limits to one pageSheet Modal at a time. The fix in 79b07b3 changed the
  inner expanded-preview Modal to fullScreen, which solved the
  Recipe-Box / HeroDayCard direct entry chain (1 pageSheet for variations + 1
  fullScreen for expand = OK). But the Plan-tab day-preview path stacks an
  additional pageSheet: plan.tsx:1153 PlanEntryPreview Modal pageSheet wraps
  PreviewSheet, which mounts RemixSheet inline. RemixSheet's variations
  Modal (line 619) is pageSheet, so the chain becomes:
    [Plan-tab pageSheet] → [PickerSheet pageSheet] → [variations pageSheet]
                                                  → [expand fullScreen]
  Three nested Modals, with two adjacent pageSheets. iOS may render the
  variations Modal but reject mounting the inner expand fullScreen from
  inside a doubly-stacked pageSheet view-controller — the user sees no
  visual change after tapping a variation card.

  Note: alternate hypothesis is that the touch routing on the variations
  Modal itself is broken under the same stacking conditions (the inner
  expand Modal works fine when reached, but it is never reached because
  handleCardPress's effect of mounting the fullScreen is suppressed). I
  cannot disambiguate without simulator access; the fix below addresses
  the stacking root cause regardless of which manifestation hit the user.

fix: |
  Switch RemixSheet's variations Modal (line 619) from
  `presentationStyle="pageSheet"` to `presentationStyle="fullScreen"`. Mirror
  pattern to 79b07b3's inner-expand fix. fullScreen takes the whole window
  and stacks cleanly above any parent pageSheet. Wrap content in
  `SafeAreaView` with `edges={['top']}` so the header insets below the
  status bar (pageSheet had its own card-style top inset; fullScreen does
  not).

  This change reduces the worst-case Plan-tab chain to:
    [Plan-tab pageSheet] → [PickerSheet pageSheet] → [variations fullScreen]
                                                  → [expand fullScreen]
  At any moment only ONE pageSheet is visible (PickerSheet hides before
  variations mounts). The outer Plan-tab pageSheet is below and visually
  covered by the fullScreen variations Modal during the remix flow. Inner
  expand fullScreen stacks atop variations fullScreen — both fullScreen,
  no UIKit confusion.

  Recipe-Box / HeroDayCard / Discover entry paths are also unaffected — the
  variations Modal is now fullScreen instead of pageSheet, but it has a
  proper header with REMIX kicker + close X button so the visual change
  is acceptable (slightly larger, slightly less "card" feel).

verification:
  - Code: typecheck on RemixSheet.tsx clean (no new errors).
  - Logic: traced all three entry chains (Plan-tab day-preview popup,
    Plan-tab HeroDayCard cluster Remix, Recipe Box detail). All chains now
    have at most one pageSheet at a time, with fullScreen Modals stacking
    cleanly on top.
  - NOT verified: actual tap behavior in iOS Simulator or physical iPhone
    (user is asleep, autonomous mode). Awaiting human verify.

files_changed:
  - apps/mobile/src/components/recipes/RemixSheet.tsx
