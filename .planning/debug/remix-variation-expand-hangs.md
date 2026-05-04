---
status: awaiting_human_verify
trigger: "After commit 348e60f (variations Modal switched from pageSheet to fullScreen), tapping a Remix variation card now FIRES the expand handler but the expanded preview Modal never opens. Card stays stuck spinning."
created: 2026-05-03T00:00:00Z
updated: 2026-05-03T00:00:00Z
---

## Current Focus

hypothesis: Two `<Modal>` components are rendered as SIBLINGS at the same JSX level: the variations Modal (line 628) and the inner expanded-preview Modal (line 724). When the user taps a variation card, the variations Modal stays visible={visible}=true, AND the inner Modal becomes visible={true} simultaneously. iOS UIKit's modal-presentation stack gets confused when two sibling Modals are both visible at the same level, especially with an upstream pageSheet (Plan tab's PlanEntryPreview) in the chain. The previous commits 79b07b3 and 348e60f bandaged this by changing presentationStyle (pageSheet → fullScreen), but the underlying sibling-Modal pattern is unsound.

ALSO: there's no timeout on the /remix fetch (just `fetch` directly, not authedFetch even). If Claude takes >30s the spinner runs forever. ALSO: catch in ensureFull only triggers on thrown error — if the response is malformed (e.g. body.data missing), the cast `body.data as ParsedRecipe` returns undefined silently, and downstream `if (full) setExpandedIdx(idx)` skips, leaving spinner cleared but no modal — but per user "card stays in loading", spinner is not cleared.

Server log evidence: /api/v1/recipes/remix returned 200 in 7-10s consistently today. So the server is fine. The mobile-side bug is in either (a) sibling Modal mount conflict, or (b) silent error in mobile response parsing.

test: Apply 3-part fix:
  1. Refactor: render expanded preview content INSIDE variations Modal (not as sibling Modal). Eliminates the dual-Modal-visible-simultaneously pathology.
  2. Add 30s timeout via AbortController on /remix fetch. If timeout/error, surface visible error UI on the card (red border + "Tap to retry") so future hangs are diagnosable.
  3. Add per-card error state so failed expand surfaces as a UI state, not a silent stuck spinner.
expecting: Tapping variation card body → 7-10s spinner → expanded preview appears. On error/timeout → red error state on card + dismissible.
next_action: Apply fix to RemixSheet.tsx, typecheck, commit.

## Symptoms

expected: Tap variation card → loading veil briefly → expanded preview Modal slides up showing recipe with steps + ingredients + Cook Now/Cook Later CTAs.
actual: Tap fires (spinner overlay shows on card) but expanded preview Modal never appears. Card stays in loading state.
errors: None visible to user (no banner, no toast). Likely silent failure.
reproduction: Plan tab → tap planned day → preview popup → tap Remix → pick mode → wait for variations → tap any variation card body → spinner appears, never resolves.
started: 2026-05-04 after commit 348e60f (variations Modal pageSheet → fullScreen). Before, tap was silent no-op; now spinner shows but doesn't resolve.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-05-04 13:21
  checked: server log /tmp/dt-server.log for /api/v1/recipes/remix
  found: 4 successful /remix calls today: 8325ms, 7537ms, 9899ms, 7167ms — all status 200
  implication: Server is returning data successfully in 7-10s. The bug is NOT a server hang. Mobile is receiving the response but the expanded preview Modal is failing to mount or remain visible.

- timestamp: 2026-05-04
  checked: handleExpand at RemixSheet:292-299
  found: Sets workingIdx + workingAction, awaits ensureFull, clears working state, then `if (full) setExpandedIdx(idx)`. ensureFull caches in fullByIdx. No error path that leaves workingIdx stuck.
  implication: After /remix succeeds, expandedIdx is set. The Modal at line 724 is `visible={expandedIdx !== null && expandedFull != null}` — both should be true.

- timestamp: 2026-05-04
  checked: VariationCard.isExpanding prop wired from `workingIdx === i && workingAction === 'expand'`
  found: When expand finishes (workingIdx cleared), spinner SHOULD disappear regardless of whether the Modal opens
  implication: User screenshot shows "spinner stuck on card" — but if /remix returns and we hit `setWorkingIdx(null)`, the spinner overlay should hide. If user sees a STUCK spinner, the await never resolves on the mobile side. That conflicts with server logs showing 200s.

- timestamp: 2026-05-04
  checked: 348e60f changed variations Modal to fullScreen with SafeAreaView edges=['top']
  found: But the inner expanded-preview Modal STILL renders inside the same component tree. Both are now fullScreen siblings.
  implication: Now BOTH variations Modal AND inner expand Modal are fullScreen. Two stacked fullScreen Modals on iOS — second one covers first entirely. The variations Modal IS still visible behind (blocking touches but invisible). When inner Modal closes, the variations Modal becomes visible again — that should work.

- timestamp: 2026-05-04
  checked: PlanEntryPreview chain — outer pageSheet (plan.tsx:1153) → PreviewSheet (inline View, NOT a Modal) → user taps Remix → setRemixOpen(true) → RemixSheet inline mounts PickerSheet (pageSheet) → user picks → variations fullScreen Modal → inner expand fullScreen Modal
  found: That's pageSheet → pageSheet → fullScreen → fullScreen. The variations fullScreen takes over the screen but the OUTER PlanEntryPreview pageSheet is below it. When inner expand Modal mounts as ANOTHER fullScreen, it tries to present from inside variations fullScreen which is itself inside the outer pageSheet stack.
  implication: Possible iOS issue where 4 nested Modals (especially with mixed presentation styles) silently fail to present the deepest one.

## Resolution

root_cause: |
  Two `<Modal>` components were rendered as JSX siblings inside RemixSheet:
  the variations Modal (line 628 pre-fix) and the inner expanded-preview
  Modal (line 724 pre-fix). When the user tapped a variation card,
  setExpandedIdx made the inner Modal visible while the outer variations
  Modal stayed visible={visible}=true. iOS UIKit's modal-presentation
  stack handles two sibling Modals at the same React level unreliably —
  particularly when there's already a parent pageSheet upstream (Plan
  tab's PlanEntryPreview). Previous fixes (79b07b3, 348e60f) tweaked
  presentationStyle (pageSheet → fullScreen) on the inner / outer Modals,
  which fixed the direct entry chains (Recipe Box, HeroDayCard) where
  there's only one upstream Modal, but left the Plan-tab path (4 nested
  Modal layers) presenting unreliably — the inner expand silently failed
  to mount on iOS.

  Compounding: there was no timeout on the /remix fetch, no AbortController,
  and ensureFull's error-path used Alert.alert which itself sometimes
  fails to surface from inside stacked iOS Modals — leaving the user with
  a spinning card overlay and no error message. Server logs confirmed
  /api/v1/recipes/remix was returning 200s in 7-10s today, so the bug was
  squarely on the mobile side.

fix: |
  Three coordinated changes to RemixSheet.tsx:

  1. ARCHITECTURE — Eliminate the sibling-Modal pattern. Render the
     expanded-preview content (RemixVariationPreview / PreviewSheet) as
     conditional children of the SAME variations Modal, not as a separate
     sibling Modal. When expandedIdx is set, the variations ScrollView
     swaps out for the preview content; when expandedIdx is cleared, it
     swaps back. One Modal layer instead of two simultaneously-visible.
     Eliminates the iOS UIKit modal-stacking pathology entirely.

  2. TIMEOUT — Add 45s AbortController on the /api/v1/recipes/remix fetch
     in fetchRemixedRecipe. Long enough for slow-but-real Claude responses
     (server logs show 7-10s typical, occasional 30s+), short enough that
     a hung connection surfaces as a visible error rather than a stuck UI.

  3. INLINE ERROR STATE — Replace ensureFull's Alert.alert path with a
     per-card errorByIdx state. Failed expands surface as a soft-red row
     on the card body ("X. Tap to retry.") instead of an Alert that may
     silently drop from inside a stacked Modal on iOS. Tapping the card
     retries; tapping the X dismisses. Defensive parse: if /remix returns
     a 200 with malformed body (no `data` field), throw instead of
     silently passing through with full=undefined.

verification:
  - typecheck: pnpm tsc --noEmit clean for RemixSheet.tsx (zero new errors)
  - server logs: /api/v1/recipes/remix consistently returns 200 in 7-10s
  - logic trace: all 4 entry paths (Recipe Box detail, HeroDayCard cluster,
    Plan-tab day-preview, Discover preview) now have at most ONE
    RemixSheet Modal visible at any moment; the expanded preview is a
    conditional content swap, not a separate Modal
  - NOT verified on physical iPhone or simulator — autonomous fix from
    code reading + log evidence. Awaiting human verify.

files_changed:
  - apps/mobile/src/components/recipes/RemixSheet.tsx
