---
phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions
verified: 2026-06-08T21:50:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Save a recipe in Recipe Box; wait for its hero image to generate. Kill and reopen the app. Confirm the hero image loads instantly without POST /generate-image firing again."
    expected: "No POST /generate-image request on cold start for a recipe that already has image_url set; image loads from URL without re-requesting."
    why_human: "Requires a live iOS build, live backend (Fly deploy needed), and a real cold-start cycle. Code path verified but end-to-end network behavior cannot be checked without a running app + server."
  - test: "Open Recipe Box with 20+ recipes. Scroll to the bottom. Confirm no generate-image requests fire for off-screen cards on initial load — only the first ~6 visible cards should trigger generation."
    expected: "At most 6 POST /generate-image requests on initial Recipe Box mount. Additional requests fire as cards scroll into view, not on mount."
    why_human: "FlatList windowing (windowSize=5, initialNumToRender=6) is in place but effect requires on-device confirmation with network monitoring. This needs an EAS build."
  - test: "Open Recipe Box. Confirm no AI/URL/cuisine label appears in the corner of any recipe card."
    expected: "Zero corner badges on recipe cards across all source types."
    why_human: "SOURCE_LABELS and sourceBadge JSX are definitively removed from code, but visual confirmation requires an on-device EAS build."
  - test: "Navigate away from the Something New / Discover screen, then return within 10 minutes. Confirm no POST /discover request fires on the second visit."
    expected: "Second mount within the 10-min TTL window reuses the module-scoped discoverCache; no AI call or network request."
    why_human: "Module-scoped cache logic is verified in code; end-to-end behavior on device needs a running app build."
  - test: "Trigger two rapid identical /search or /discover calls (e.g., double-tap or fast re-navigation). Confirm only one upstream Gemini/AI call is made — the second is coalesced."
    expected: "Server logs show one AI call; second caller resolves with the same result via the in-flight Map."
    why_human: "Coalescing logic is unit-tested and verified but observing it in production requires server logs on Fly after deploy."
---

# Phase 27: Performance & Caching Fixes Verification Report

**Phase Goal:** Eliminate redundant image generation and AI re-computation that make Recipe Box load slowly and "Something New" feel sluggish — persist generated hero images so cold starts stop re-requesting them, cache + coalesce discovery responses, window the recipe list, remove the source-type ("AI") corner badge, and apply prompt caching.
**Verified:** 2026-06-08T21:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Generated hero image URL written back to recipes.image_url; cold starts never re-request POST /generate-image for a saved recipe | ✓ VERIFIED | `update({ image_url: url })` at line 618 with `.eq('id', body.recipeId).eq('profile_id', user.id)` guard at lines 619-620; guarded by `typeof body.recipeId === 'string' && url non-null` check; 5/5 unit tests passing |
| 2   | Repeat identical discovery requests return from server cache; concurrent identical requests coalesce | ✓ VERIFIED | `discoveryCache.ts` exports `discoveryCacheKey` + `getOrComputeDiscovery` with Map-based coalescing; both `/search` (line 271) and `/discover` (line 361) wired; 6/6 cache unit tests + 13/13 route tests passing |
| 3   | Recipe Box FlatList uses windowing; off-screen cards do not trigger generation on mount | ✓ VERIFIED | `kitchen.tsx` lines 708-711: `initialNumToRender={6}`, `maxToRenderPerBatch={6}`, `windowSize={5}`, `removeClippedSubviews`; hoisted `renderRecipeCard` useCallback at line 552 |
| 4   | Source-type ("AI"/"URL") corner badge no longer renders on any recipe card | ✓ VERIFIED | `grep -c SOURCE_LABELS RecipeCard.tsx` = 0; `grep -c sourceBadge RecipeCard.tsx` = 0; `cuisineLabel` prop retained in interface (SuggestionList passes it) but no longer rendered |
| 5   | Prompt caching (cache_control: ephemeral) applied to Anthropic static discovery system prompt + tools; Gemini guard documented | ✓ VERIFIED | `anthropicAdapter.ts` lines 120, 129: two `cache_control: { type: 'ephemeral' as const }` marks on `system` block and `tools` entry; `geminiAdapter.ts` lines 126-138: documented threshold-guard comment explaining cachedContent omission |
| 6   | No regression in existing recipe/discovery test suites | ✓ VERIFIED | All unit suites green: `recipes.generate-image.test.ts` 5/5, `discoveryCache.test.ts` 6/6, `recipeDiscovery.test.ts` 16/16, `recipes.search.test.ts` + `recipes.discover.test.ts` 13/13, `src/ai` adapters 29/29 |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/server/src/routes/recipes.ts` | POST /generate-image with recipeId write-back + ownership guard; /search + /discover wired to discovery cache | ✓ VERIFIED | `update({ image_url })` at line 618; `getOrComputeDiscovery` at lines 271 and 361; import confirmed at line 23-25 |
| `packages/server/src/routes/__tests__/recipes.generate-image.test.ts` | 4+ tests: write-back, no-recipeId, null-url, ownership | ✓ VERIFIED | File exists; 5 test cases; 5/5 passing |
| `packages/server/src/services/discoveryCache.ts` | TTL LRU cache + in-flight coalescing; exports `discoveryCacheKey` + `getOrComputeDiscovery` | ✓ VERIFIED | Both functions exported; Map-based coalescing at lines 114-125; sha256 keying; 200-entry LRU; injectable `nowMs` |
| `packages/server/src/services/__tests__/discoveryCache.test.ts` | 6 tests: key stability, excludeTitles exclusion, cache hit, TTL expiry, coalescing, load-more bypass | ✓ VERIFIED | 6 tests; 6/6 passing |
| `apps/mobile/src/app/(tabs)/kitchen.tsx` | FlatList windowing props + useCallback renderItem | ✓ VERIFIED | `windowSize={5}`, `initialNumToRender={6}`, `maxToRenderPerBatch={6}`, `removeClippedSubviews` at lines 708-711; `renderRecipeCard` useCallback at line 552 |
| `apps/mobile/src/components/recipes/RecipeCard.tsx` | React.memo export; no source badge; recipeId forwarded | ✓ VERIFIED | `React.memo(RecipeCardBase, comparator)` at line 475; `recipeId: recipe.id ?? undefined` at line 120; zero SOURCE_LABELS/sourceBadge occurrences |
| `apps/mobile/src/hooks/useGeneratedRecipeImage.ts` | recipeId in HookOptions, ImageRequest, POST body | ✓ VERIFIED | `recipeId?: string \| null` in `HookOptions` (line 229) and `ImageRequest` (line 134); threaded to `recipeId: req.recipeId ?? null` in POST body at lines 155, 294, 351 |
| `packages/server/src/ai/adapters/anthropicAdapter.ts` | cache_control: ephemeral on system + tools in generateStructured | ✓ VERIFIED | Two `cache_control: { type: 'ephemeral' as const }` marks at lines 120 and 129 inside generateStructured |
| `packages/server/src/ai/adapters/geminiAdapter.ts` | Gemini guard comment OR cachedContent applied; 27-04 retry warn preserved | ✓ VERIFIED | Threshold-guard comment at lines 126-138; `MALFORMED_FUNCTION_CALL retry` warn preserved at line 187 |
| `apps/mobile/src/app/recipes/discover.tsx` | Module-scoped discoverCache with TTL guard on mount effect | ✓ VERIFIED | `let discoverCache` at line 60; `DISCOVER_CACHE_TTL_MS` at line 59; freshness check at line 128; cache populated at line 112 |
| `packages/server/src/services/recipeDiscovery.ts` | defaultCount floor 3 (not 6) | ✓ VERIFIED | `Math.max(3, cuisineCount + 2)` at line 359; zero occurrences of `Math.max(6, cuisineCount` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `POST /generate-image handler` | `recipes.image_url (Supabase)` | `supabaseAdmin.update({ image_url }).eq('id', recipeId).eq('profile_id', user.id)` | ✓ WIRED | Lines 616-620 in recipes.ts |
| `RecipeCard.tsx` | `POST /generate-image recipeId` | `useGeneratedRecipeImage options.recipeId = recipe.id ?? undefined` | ✓ WIRED | Line 120 RecipeCard.tsx; threaded through HookOptions → ImageRequest → POST body |
| `/search route` | `discoverRecipes() AI call` | `getOrComputeDiscovery(cacheKey, () => discoverRecipes(...), { cacheable: !isLoadMore })` | ✓ WIRED | Lines 264-282 in recipes.ts |
| `/discover route` | `discoverRecipes() AI call` | `getOrComputeDiscovery(cacheKey, () => discoverRecipes(...))` | ✓ WIRED | Lines 356-365 in recipes.ts |
| `kitchen.tsx FlatList` | `RecipeCard mount fan-out` | `initialNumToRender/maxToRenderPerBatch/windowSize/removeClippedSubviews` | ✓ WIRED | Lines 708-711 kitchen.tsx |
| `anthropicAdapter generateStructured` | `Anthropic prompt cache` | `cache_control: { type: 'ephemeral' }` on system block + tools entry | ✓ WIRED | Lines 120, 129 anthropicAdapter.ts |
| `geminiAdapter callStructured` | `Gemini context cache` | Documented threshold guard (path b — no cachedContent, intentional) | ✓ WIRED (documented omission) | Lines 126-138 geminiAdapter.ts |

### Data-Flow Trace (Level 4)

Data-flow tracing not applicable as a distinct pass — criterion 1 (write-back) and criterion 2 (cache) are the data flows, and both are verified end-to-end: the write-back is verified from POST body through `supabaseAdmin.update()` call, and the cache is verified from request key through `getOrComputeDiscovery` to the route response.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| generate-image unit tests pass (write-back, no-recipeId, null-url, ownership) | `pnpm vitest run src/routes/__tests__/recipes.generate-image.test.ts` | 5/5 passed | ✓ PASS |
| discoveryCache unit tests pass (key stability, TTL, coalescing, load-more bypass) | `pnpm vitest run src/services/__tests__/discoveryCache.test.ts` | 6/6 passed | ✓ PASS |
| recipeDiscovery service tests (no regression, defaultCount = 3) | `pnpm vitest run src/services/__tests__/recipeDiscovery.test.ts` | 16/16 passed | ✓ PASS |
| /search + /discover route tests (cache wiring doesn't break existing mocks) | `pnpm vitest run src/routes/__tests__/recipes.search.test.ts src/routes/__tests__/recipes.discover.test.ts` | 13/13 passed | ✓ PASS |
| AI adapter suites (anthropicAdapter + geminiAdapter, no regression) | `pnpm vitest run src/ai` | 29/29 passed | ✓ PASS |
| Cold-start image re-request prevention | Requires live Fly deploy + iOS device | N/A — no live server | ? SKIP |
| FlatList windowing on-device effect | Requires EAS build | N/A — no device | ? SKIP |

### Requirements Coverage

No explicit requirement IDs — this is a fix/performance phase. Verified against the 6 ROADMAP Phase 27 success criteria, all satisfied.

### Anti-Patterns Found

No blockers or warnings found.

A search for TODO/FIXME/placeholder patterns across the 10 modified files returned zero hits affecting user-visible behavior. The only "deferred" comment is the Gemini cachedContent guard (geminiAdapter.ts lines 126-138) which is intentional, traceable, and documented per the plan spec.

The `cuisineLabel` prop in `RecipeCardProps` is accepted but not rendered — confirmed intentional per 27-02 plan (SuggestionList.tsx passes `item.cuisine_type`; removing the prop would produce a TS excess-property error at that call site). Not a stub.

### Human Verification Required

**Note on deployment gate:** Criteria 1-2 (server-side image write-back + discovery cache) only take effect for testers after a Fly deploy (`fly deploy` in `packages/server`). Criteria 3-4 (FlatList windowing + badge removal) and the `recipeId` forwarding only ship in the next EAS build. All 5 items below are deployment/on-device confirmations of code that is fully verified at the source level.

#### 1. Cold-Start Image Persistence (after Fly deploy)

**Test:** Save a recipe, wait for its hero image to generate. Force-close the app, reopen it, navigate to Recipe Box.
**Expected:** The hero image loads instantly from the persisted `image_url`; no POST /generate-image request fires in server logs.
**Why human:** Requires a live Fly deployment + physical iPhone/simulator. Code path is verified (write-back at recipes.ts:618-620, `skip: !!recipe.image_url` guard in hook).

#### 2. FlatList Windowing Effect (after EAS build)

**Test:** Open Recipe Box with 20+ saved recipes. Monitor network traffic on first load.
**Expected:** At most ~6 POST /generate-image requests fire on initial mount; additional requests fire as cards scroll into view, not all at once.
**Why human:** Windowing props verified in code (lines 708-711 kitchen.tsx) but actual mount-count reduction requires on-device observation.

#### 3. Recipe Card Badge Absence (after EAS build)

**Test:** Browse Recipe Box and the Something New / Suggestions lists. Check all card corners.
**Expected:** No AI/URL/cuisine/Photo corner badge appears on any recipe card.
**Why human:** SOURCE_LABELS and sourceBadge JSX definitively absent in code; visual confirmation on a real build is the final check.

#### 4. Discover Screen Mount Guard (after EAS build)

**Test:** Open the Discover/Something New screen, let it load. Navigate to another tab and return within 10 minutes.
**Expected:** Second mount shows results immediately; no network request to POST /discover fires.
**Why human:** Module-scoped `discoverCache` verified in code (discover.tsx lines 59-60, 112, 128-129); behavior on-device needs confirmation.

#### 5. Discovery Cache Coalescing (after Fly deploy)

**Test:** Trigger two rapid identical discovery requests (double-tap "Something New" or rapid tab switch).
**Expected:** Server logs show only one upstream AI call; both callers resolve with the same result.
**Why human:** Coalescing is unit-tested (6/6 passing) but real-traffic coalescing requires Fly server logs to observe.

### Gaps Summary

No gaps. All 6 ROADMAP success criteria are fully implemented and verified at the code level. The 5 human-verification items are deployment/on-device confirmations, not code gaps — the code is correct and ready to ship.

---

_Verified: 2026-06-08T21:50:00Z_
_Verifier: Claude (gsd-verifier)_
