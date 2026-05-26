---
status: awaiting_human_verify
trigger: "Tapping bookmark on a recipe from the Kitchen tab shows DIFFERENT UI for two users on the SAME build (14). Wife's account opens a modal with only an 'Add to plan' button."
created: 2026-05-25T00:10:00Z
updated: 2026-05-25T00:30:00Z
---

## Current Focus

hypothesis: CONFIRMED. The Kitchen "Something New" segment renders one of TWO different surfaces depending on per-account session/store state. Account A (dev) has Phase-17 `searchResults` populated → rich `SomethingNewResults` cards whose tap/bookmark opens the full `PreviewSheet` (Save / Cook Now / Cook Later / Remix). Account B (wife) has NO `searchResults` but IS on the legacy fallback path (`autoFetch` post-scan or `legacySuggestions` present) → `SuggestionList` whose tap/bookmark opens `SuggestionPreviewModal`, which has ONLY an "Add to Plan" primary button (plus a "Remix this dish" link). That impoverished modal is the reported wrong UI.
test: trace kitchen.tsx Something New render branch + the two modal components' footers.
expecting: SuggestionPreviewModal footer renders a single "Add to Plan" button; PreviewSheet renders a multi-action footer.
next_action: apply fix routing the legacy Something New surface to the same rich preview, or eliminate the legacy fallback so all accounts converge.

## Symptoms

expected: Tapping "bookmark" produces the same correct UI/behavior for all users
actual: Developer's account shows correct behavior; wife's account opens a modal with just an "Add to plan" button (wrong). Both are on build 14 — identical client code.
errors: None reported
reproduction: From Kitchen tab (Something New segment), tap the bookmark action on a recipe. Behavior diverges by account.
started: Noticed during UAT today (2026-05-25)

## Eliminated

- hypothesis: code-version difference between the two users
  evidence: both on build 14, identical bundle. Divergence must be data/account/session-state driven.
  timestamp: 2026-05-25T00:12:00Z

- hypothesis: SavedRecipeDetail (Recipe Box) modal is the culprit
  evidence: SavedRecipeDetail passes _saved=false and provides onRemove + onCookNow + onCookLater, so PreviewSheet's footer renders Remix/Remove + Cook Now/Cook Later — never a lone "Add to Plan". Not the reported modal.
  timestamp: 2026-05-25T00:15:00Z

- hypothesis: empty steps[] crashes the PreviewSheet render
  evidence: recipe.steps.length === 0 is handled gracefully ("No steps listed."). Empty array does not throw. Not a crash path.
  timestamp: 2026-05-25T00:15:00Z

## Evidence

- timestamp: 2026-05-25T00:16:00Z
  checked: apps/mobile/src/app/(tabs)/kitchen.tsx Something New render branch (lines 357-369, 633-663)
  found: showPhase17Results = searchResults.length>0 || loading. showFirstTimeHint = !results && !history && !loading && !hasLegacySuggestionsPath. hasLegacySuggestionsPath = autoFetchActive || legacySuggestions.length>0. The final `else` renders <SuggestionList />.
  implication: An account with Phase-17 searchResults gets SomethingNewResults. An account on the legacy path (post-scan autoFetch, or legacy suggestions in memory) gets SuggestionList. Two different surfaces for the same segment.

- timestamp: 2026-05-25T00:17:00Z
  checked: apps/mobile/src/components/suggestions/SuggestionList.tsx (lines 159-225, 262-266)
  found: SuggestionList renders RecipeCard in preview mode with ALL previewActions (onSave/onSaveAndFavorite/onCookNow/onRemix) routed to a single `openPreview` → setPreviewSuggestion → opens <SuggestionPreviewModal>. The bookmark icon therefore opens SuggestionPreviewModal.
  implication: On the legacy path, tapping the bookmark = opening SuggestionPreviewModal.

- timestamp: 2026-05-25T00:18:00Z
  checked: apps/mobile/src/components/suggestions/SuggestionPreviewModal.tsx (lines 261-278)
  found: Sticky bottom bar renders a SINGLE primary Button title="Add to Plan" (opens a DatePickerSheet). The only other action is a "Remix this dish" link in the scroll body. No Save-to-library, no Cook Now, no steps section — because DinnerSuggestion carries no steps and the modal never server-expands.
  implication: This is EXACTLY the reported "modal with only an Add to plan button". Confirms the wife's account is on the legacy SuggestionList → SuggestionPreviewModal path.

- timestamp: 2026-05-25T00:19:00Z
  checked: apps/mobile/src/stores/suggestionsStore.ts persist.partialize (lines 240-245) + state defaults
  found: Only searchResults/recentQueries/lastQuery/pantryOnly are persisted. `suggestions` (legacy) and `autoFetch` are NOT persisted (autoFetch deliberately excluded — it's a post-scan signal flag). searchResults defaults to []; suggestions defaults to [].
  implication: Divergence mechanism — Dev (account A) used the Phase-17 search bar, so searchResults is persisted/populated → rich path. Wife (account B) reached Something New via the post-scan autoFetch flow (or had legacy suggestions in memory) and never ran a Phase-17 search → hasLegacySuggestionsPath true / no searchResults → legacy SuggestionList → impoverished SuggestionPreviewModal. Account/session-state-dependent rendering, exactly as predicted.

- timestamp: 2026-05-25T00:19:30Z
  checked: discover.tsx PreviewSheet footer (lines 657-787)
  found: PreviewSheet renders Remix/Save/Remove + Cook Now/Cook Later. This is the rich modal the dev sees via SomethingNewResults. Far more than a lone "Add to Plan".
  implication: Confirms the two surfaces are genuinely different in action affordances, not styling.

## Resolution

root_cause: The Kitchen "Something New" segment has two parallel rendering surfaces. The Phase-17 surface (SomethingNewResults, driven by `searchResults` from /recipes/search) opens the full-featured PreviewSheet (Save / Cook Now / Cook Later / Remix). The legacy D-10 fallback surface (SuggestionList, driven by `suggestions` from /ai/suggest, reached via post-scan `autoFetch` or pre-existing legacy suggestions) opens SuggestionPreviewModal, whose only action is a single "Add to Plan" button. Because `autoFetch`/`suggestions` are session-only and `searchResults` is persisted, two accounts in different states see two different modals for the same bookmark/card tap. The wife reached Something New through the post-scan/legacy path, so she got the impoverished "Add to Plan"-only modal.
fix: Converged the Kitchen "Something New" segment onto a single rich surface so all accounts get identical behavior. (1) The post-scan handoff signal (`autoFetch`, set by scan/review.tsx) now triggers a Phase-17 pantry search (`searchRecipes('', { pantryOnly: true })`) via a new effect in kitchen.tsx instead of routing into the legacy SuggestionList. (2) Removed the legacy SuggestionList fallback render from the Something New segment — the segment now renders only SomethingNewResults (rich PreviewSheet with Save/Cook Now/Cook Later/Remix) or the FirstTimeHint on-ramp. The degraded SuggestionPreviewModal ("Add to Plan" only) is no longer reachable from this screen. The legacy suggestionsStore actions/state are untouched (D-10 lock preserved); only the screen's routing changed.
verification: tsc --noEmit shows no errors in kitchen.tsx (only pre-existing test-file errors remain). suggestionsStore tests pass (14/14, D-10 lock intact). kitchen tests pass (6/6). Manual UAT on both accounts still required to confirm the wife's account now sees the rich PreviewSheet.
files_changed:
  - apps/mobile/src/app/(tabs)/kitchen.tsx (route post-scan autoFetch through Phase-17 search; remove legacy SuggestionList fallback + now-unused imports/state)
</content>
</invoke>
