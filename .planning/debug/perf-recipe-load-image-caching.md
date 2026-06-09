---
status: diagnosed
trigger: "Recipe Box / library still feels slow and image generation is costly/redundant — measure what remains after the partial fixes from recipe-slow-load-missing-steps.md"
created: 2026-06-08T00:00:00Z
updated: 2026-06-08T00:00:00Z
mode: diagnose_only
cross_ref: .planning/debug/recipe-slow-load-missing-steps.md
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Partial fixes (MAX_CONCURRENT=2, removed recipes.length dep, autoSeedTemplates) are confirmed present but address SYMPTOMS not the root cost driver. The remaining latency/cost comes from (a) no DB write-back of generated hero URLs → every cold start re-requests generation for every imageless recipe, (b) the concurrency limiter only serializes — it does not bound or viewport-gate the total fan-out, so all 30 cards still enqueue, (c) the server cache check (cachedUrlIfExists) costs a storage list() round-trip per request even on hit, (d) FlatList mounts more cards than visible by default + RecipeCard not memoized.
test: Trace generate-image fan-out, image persistence (AsyncStorage vs DB vs Storage), library fetch select pattern, expo-image config, FlatList windowing. Reason about request counts — do not run app.
expecting: Confirm fan-out is bounded to 30 enqueued (not viewport-gated); confirm no recipes.image_url write-back; confirm server does a list() per call.
next_action: DIAGNOSE ONLY — produce ranked root causes + recommended fix plan in Resolution. Do not edit code.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Recipe Box / library loads in <1-2s; images load from cache and are generated at most once per recipe, never blocking the list UI.
actual: Library load still feels slow; image generation suspected of firing too broadly / regenerating redundantly / not caching durably across sessions.
errors: none specific
reproduction: Open Kitchen → Recipe Box with ~30 seeded recipes; scroll the list and open details.
started: ongoing; partial fixes landed ~2026-05-25 (commits 7c9b049, 248383b, 4c27bb5).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The prior "redundant fetch" fix was not applied
  evidence: kitchen.tsx:385-389 — the fetch effect dep array is now [fetchRecipes, isOnline]; recipes.length is gone, replaced by a derived hasRecipeCache used only in the offline guard. Fix CONFIRMED present.
  timestamp: 2026-06-08T00:00:00Z

- hypothesis: The concurrency limiter was not applied
  evidence: useGeneratedRecipeImage.ts:57 MAX_CONCURRENT=2, acquireSlot/releaseSlot (61-80), both the hook (line 276) and prefetch (line 332) call fetchGeneratedUrlThrottled. Fix CONFIRMED present.
  timestamp: 2026-06-08T00:00:00Z

- hypothesis: autoSeedTemplates was not wired into boot
  evidence: index.ts:72 defines autoSeedTemplates, index.ts:122 calls void autoSeedTemplates() on startup. Fix CONFIRMED present (addresses missing-steps, not perf).
  timestamp: 2026-06-08T00:00:00Z

- hypothesis: Library fetch is an N+1 / over-fetch on the server
  evidence: getRecipes() (recipeStore.ts:133-156) is a single supabase.from('recipes').select().eq(profile_id).order() — one query, all rows. No N+1. Over-fetch is mild (select() returns all columns incl. steps JSONB + step_image_urls), but it's one round-trip. Not the primary driver. (Logged as a minor in Evidence, not a root cause.)
  timestamp: 2026-06-08T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-08T00:00:00Z
  checked: useGeneratedRecipeImage.ts concurrency limiter semantics (57-91, 274-288)
  found: MAX_CONCURRENT=2 caps *simultaneous in-flight HTTP requests* to 2, but does NOT cap *total* requests. Every RecipeCard whose recipe lacks image_url enqueues a fetch via acquireSlot(); when full, requests sit in _waitQueue (FIFO) and drain 2-at-a-time. With 30 imageless seeded recipes, all 30 still get enqueued on mount — the limiter just turns "30 parallel" into "30 sequential, 2 wide." Total work is unchanged; only the concurrency shape changed.
  implication: On a COLD cache (first ever run, or after AsyncStorage cleared), this serializes 30 Gemini round-trips 2-wide. If each generate call is ~3-8s (Gemini image gen), the last cards resolve ~30/2 * ~5s ≈ 75s after mount. The LIST itself is not blocked (cards render fallback immediately), but image churn + server saturation is real and the perceived "slow images filling in" is this queue draining.

- timestamp: 2026-06-08T00:00:00Z
  checked: Image durability — is a generated hero URL ever written back to recipes.image_url?
  found: NO. Searched routes/recipes.ts — the only DB write of an image column is step_image_urls at line 661 (the /:id/step-images route). The hero /generate-image route (538-574) returns the URL but NEVER updates the recipe row. Client RecipeCard.tsx:114-126 consumes generatedUri purely for display; it is never PATCHed back to the recipe. Persistence is only: (1) client AsyncStorage 'dinnertime-image-cache' keyed by title#fingerprint (useGeneratedRecipeImage.ts:189-201), and (2) Supabase Storage content-addressed file (recipeImageGen.ts:298-320).
  implication: This is THE durability gap. A saved recipe with image_url=null stays null in the DB forever. Every cold start where AsyncStorage is empty/cleared re-issues generate-image for all imageless recipes. The server Storage cache (cachedUrlIfExists) prevents *regenerating the bytes*, but it does NOT prevent the HTTP round-trip or the per-call storage list() probe. So "generated at most once per recipe" is FALSE at the request level — only true at the Gemini-billing level. Across reinstalls / AsyncStorage clears / cache-key drift, even Gemini may regenerate (see fingerprint drift below).

- timestamp: 2026-06-08T00:00:00Z
  checked: Server cache hit cost — cachedUrlIfExists (recipeImageGen.ts:167-182) and generateRecipeImage (332-355)
  found: Every generate-image request runs ensureBucket() (cached flag after first call) then cachedUrlIfExists(), which does a supabaseAdmin.storage.from(BUCKET).list(dir, {limit:1, search:file}) — a network round-trip to Supabase Storage — on EVERY call, even cache hits. Only on a miss does it call Gemini. So even a "warm" server cache pays one Storage list() per card per cold client start.
  implication: 30 imageless cards on a fresh client = 30 POSTs = 30 Storage list() probes, throttled 2-wide. Cheap relative to Gemini but still ~30 sequential server round-trips. The fix that actually eliminates this is DB write-back (then the card never calls generate-image at all because recipe.image_url is set → hook skip=true).

- timestamp: 2026-06-08T00:00:00Z
  checked: Cache-key consistency client vs server (fingerprint drift risk)
  found: Client cacheKeyFor (useGeneratedRecipeImage.ts:103-122) fingerprints by lowercasing top-6 ingredient NAMES sorted, joined with '|' (raw string, no hash). Server ingredientFingerprint (recipeImageGen.ts:132-140) takes top-6 *visual* ingredients (PANTRY_STAPLES filtered OUT), sorts, sha256 → 8 hex. These are DIFFERENT algorithms. The client comment (line 99-102) explicitly says exact match isn't required — and indeed the client key only governs the client AsyncStorage/session dedupe, while the server key governs Storage. They never need to match. BUT: the server filters pantry staples before fingerprinting; the client does not. This only matters for client-side dedupe collisions (two distinct recipes sharing a title+top6 but differing only in staples would share a client cache slot). Low impact, noted for completeness.
  implication: Not a primary bug, but the dual-fingerprint design is fragile. The real durability answer is DB write-back, which sidesteps fingerprint matching entirely.

- timestamp: 2026-06-08T00:00:00Z
  checked: RecipeCard memoization + FlatList windowing (RecipeCard.tsx:91, kitchen.tsx:688-720)
  found: RecipeCard is a plain function component — NOT wrapped in React.memo. The FlatList (kitchen.tsx:688) sets data/keyExtractor/renderItem but NO windowing props: initialNumToRender (default 10), windowSize (default 21 → ~10 screens of cells mounted), maxToRenderPerBatch, removeClippedSubviews are all defaults. renderItem creates a fresh inline closure each render. Because RecipeCard isn't memoized, any parent re-render (search query change via useDeferredValue, filter change, fetchRecipes resolving) re-renders ALL mounted cards.
  implication: With windowSize default 21, FlatList mounts well more than the ~4-6 visible cards — likely 10-20 RecipeCards at once, each of which (if imageless) fires a generate-image fetch BEFORE being scrolled into view. So the generate fan-out is NOT viewport-gated to visible cards; it's gated to FlatList's (generous) render window. Combined with no memo, list re-renders are O(mounted cards). Adding React.memo + tighter windowing + removeClippedSubviews would cut both the fan-out and the re-render cost.

- timestamp: 2026-06-08T00:00:00Z
  checked: expo-image config on list cells (RecipeCard.tsx:149-159)
  found: cachePolicy="memory-disk" is set (good — disk cache survives session). transition={300}, placeholder blurhash set. BUT recyclingKey is NOT set. In a FlatList with cell recycling, omitting recyclingKey can cause a recycled cell to briefly show the previous recipe's image until the new source loads, and can interfere with expo-image's internal caching keyed on the view. source is {uri: imageUri} which is fine.
  implication: Minor. memory-disk cachePolicy is correct and durable across sessions for any URL that resolves. Missing recyclingKey causes visual flicker on fast scroll, not a perf/cost root cause. Recommend setting recyclingKey={recipe.id}.

- timestamp: 2026-06-08T00:00:00Z
  checked: Library fetch payload (recipeStore.ts:133-156, getRecipeById 206-224)
  found: getRecipes does select() (all columns) for the list. The list view (RecipeCard) only needs title, description, image_url, times, servings, macros, labels, source_type, is_favorite, ingredients (for the generate fingerprint). It does NOT need steps (JSONB, can be large) or step_image_urls for the LIST. select() pulls full steps arrays for all 30 rows on every list fetch.
  implication: Mild over-fetch. With 30 recipes × multi-step JSONB, payload is bigger than needed but still one round-trip and small in absolute terms (tens of KB). Secondary optimization, not the main latency driver. Note: ingredients ARE needed by the card for the generate-image fingerprint, so can't trim those.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  The perceived slowness + redundant image cost AFTER the partial fixes has ONE dominant root cause and several amplifiers. The prior fixes (MAX_CONCURRENT=2, removed recipes.length dep, autoSeedTemplates) are all confirmed present but only reshaped the symptom — they did not remove the underlying work.

  DOMINANT ROOT CAUSE — No durable write-back of generated hero images to the DB:
  A generated hero URL is persisted only to (a) client AsyncStorage and (b) Supabase Storage (content-addressed bytes). It is NEVER written back to recipes.image_url. So a saved recipe stays image_url=null forever. On any cold client start with an empty/cleared AsyncStorage (fresh install, new device, cache eviction), EVERY imageless recipe re-issues POST /generate-image. The concurrency limiter then serializes these 2-wide, producing the "images slowly fill in" effect and saturating the server with N storage-list() probes (one per card, even on Storage cache hit). "Generated at most once per recipe" is only true at the Gemini-billing layer, never at the request layer. (Evidence: recipes.ts has zero image_url writes; only step_image_urls written at line 661.)

  AMPLIFIER 1 — Limiter serializes but does not bound or viewport-gate fan-out:
  MAX_CONCURRENT=2 caps simultaneous requests, not total. All imageless cards still enqueue on mount. Because the FlatList render window (default windowSize=21) mounts far more than the visible ~4-6 cards, and RecipeCard fires the hook on mount, the fetch fan-out is gated to FlatList's generous window, NOT to what the user can see. Off-screen cards still request. (Evidence: useGeneratedRecipeImage.ts:57-91; kitchen.tsx:688-720 no windowing props.)

  AMPLIFIER 2 — RecipeCard not memoized:
  Plain function component + inline renderItem closure → every parent re-render (search via useDeferredValue, filter change, fetchRecipes resolving) re-renders all mounted cards. (Evidence: RecipeCard.tsx:91 no React.memo.)

  AMPLIFIER 3 — Per-call server Storage probe:
  cachedUrlIfExists does a Storage list() network round-trip on every generate-image call even on cache hit (recipeImageGen.ts:167-182). DB write-back makes most of these calls disappear entirely.

  MINOR — list over-fetch (steps JSONB pulled for list view, recipeStore.ts:138), missing expo-image recyclingKey (RecipeCard.tsx:149), dual client/server fingerprint algorithms (fragile but not currently a correctness bug).

fix: NOT APPLIED — diagnose-only mode. Recommended plan below.

recommended_fix_plan: |
  RANKED BY IMPACT (highest first). Each is independent; #1 is the durable fix.

  === P0 — Write generated hero URL back to recipes.image_url (durability) ===
  Targets:
    - packages/server/src/routes/recipes.ts:538-574 (POST /generate-image)
    - apps/mobile/src/components/recipes/RecipeCard.tsx:114-126
    - apps/mobile/src/stores/recipeStore.ts (add an updateRecipeImage action / PATCH)
  Approach (pick ONE of two):
    (a) Client write-back: when useGeneratedRecipeImage resolves a non-null url for a SAVED recipe (recipe.id present), PATCH /recipes/:id { image_url } so the row is durable. Card already has recipe.id.
    (b) Server-side persist option: extend POST /generate-image to accept an optional recipeId; when present and a url resolves, UPDATE recipes SET image_url=url WHERE id=recipeId AND profile_id. Single round-trip, authoritative.
  Recommended: (b) for saved recipes (authoritative, one place), keep AsyncStorage for unsaved preview (Something New) recipes that have no id yet.
  Expected impact: After first generation, recipe.image_url is set → RecipeCard passes skip=true → hook is a no-op → ZERO generate-image requests on every subsequent cold start, every device, after any cache clear. Eliminates the dominant cost + the "images slowly fill in" latency for returning users. This is the single change that makes "generated at most once per recipe" actually true.

  === P1 — Viewport-gate / bound the generate fan-out ===
  Targets: apps/mobile/src/app/(tabs)/kitchen.tsx:688-720 (FlatList props)
  Approach: Add initialNumToRender={6}, maxToRenderPerBatch={6}, windowSize={5}, removeClippedSubviews={true}. This shrinks the mount window so off-screen cards don't fire generate-image until scrolled near. Optionally pass a `defer`/`enabled` prop into RecipeCard's hook gated on viewport (onViewableItemsChanged) for a hard guarantee that only visible cards generate.
  Expected impact: On a genuinely cold cache (first run after P0 still has imageless rows), fan-out drops from ~all-30 to ~6-12 (visible window), and grows lazily as the user scrolls. Cuts initial server load ~60-80%.

  === P2 — Memoize RecipeCard ===
  Targets: apps/mobile/src/components/recipes/RecipeCard.tsx:91, 476
  Approach: export default React.memo(RecipeCard) with a comparator on recipe.id + recipe.image_url + recipe.is_favorite (+ any prop that affects render). Hoist the renderItem callback in kitchen.tsx with useCallback.
  Expected impact: Search keystrokes / filter toggles / fetch resolution stop re-rendering every mounted card. Smoother scroll, fewer redundant hook evaluations.

  === P3 — Trim list over-fetch ===
  Targets: packages/server/src/services/recipeStore.ts:138 (getRecipes select)
  Approach: Replace select() with an explicit column list excluding steps + step_image_urls for the LIST path (keep ingredients — needed for card fingerprint). Keep getRecipeById full select() for detail.
  Expected impact: Smaller list payload (drops potentially large steps JSONB ×30). Marginal latency win; mainly bandwidth.

  === P4 — expo-image recyclingKey ===
  Targets: apps/mobile/src/components/recipes/RecipeCard.tsx:149-159
  Approach: Add recyclingKey={recipe.id} to the <Image>. cachePolicy="memory-disk" is already correct.
  Expected impact: Eliminates stale-image flicker when FlatList recycles cells on fast scroll. UX polish, not perf.

  === P5 (optional) — Skip server Storage probe when DB has the URL ===
  Once P0 lands, most generate-image calls vanish. The remaining first-generation calls still pay the list() probe, which is acceptable. No change needed unless profiling shows it matters.

verification: |
  NOT performed (diagnose-only). To verify after implementing P0:
  1. Cold-start instrumentation: count POST /generate-image requests on Recipe Box mount with a fully seeded library. Pre-fix (cold AsyncStorage): ~30. Post-P0 second-session: expect 0 (all rows now have image_url).
  2. DB check: after first session, SELECT count(*) FROM recipes WHERE image_url IS NULL for the user → should trend to 0 as images generate.
  3. Network panel: confirm imageless cards no longer POST after image_url is persisted.

files_changed: []

cannot_determine_without_running: |
  - Actual per-call Gemini latency (estimated 3-8s) and therefore the real wall-clock to drain the 2-wide queue. Needs server timing logs.
  - Whether AsyncStorage is actually being cleared between the user's sessions (the user's "feels slow" could be first-ever run, or a cache that IS surviving — only device profiling shows which). If AsyncStorage survives, returning-user slowness is smaller than worst-case; P0 still fixes the cross-device/reinstall case definitively.
  - Real FlatList mounted-card count for THIS screen height (windowSize=21 is an upper bound; actual depends on cell height vs viewport). Needs a render-count log.
  - Whether any generate-image calls are actually hitting Gemini (miss) vs Storage cache (hit) in production — needs server hit/miss logging. cachedUrlIfExists has no logging today.
  - Server payload size for getRecipes with the user's real 30 recipes — needs a response-size measurement.
