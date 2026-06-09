---
status: diagnosed
trigger: "DIAGNOSE ONLY — Something New / AI suggestion generation latency; can Claude responses be cached / de-duplicated?"
created: 2026-06-09T02:47:42Z
updated: 2026-06-09T02:47:42Z
mode: diagnose_only
---

## Current Focus

hypothesis: CONFIRMED — "Something New" latency is one large blocking single-shot AI call per request with zero caching, zero request coalescing, and no prompt caching. A second per-card AI call (image gen) compounds the perceived slowness, and the mobile side has several unnecessary re-fire paths.
test: Static trace of the full path (mobile trigger → store → route → service → adapter → provider) plus model routing + token config.
expecting: N/A (diagnose-only, no live run)
next_action: Return ranked root causes + recommended (un-applied) fix plan.

## Symptoms

expected: Suggestions appear quickly; identical/near-identical requests don't re-pay full latency; no duplicate concurrent calls.
actual: "Something New" / suggestion generation feels slow and may re-run / re-request unnecessarily.
errors: none specific
reproduction: Kitchen tab → trigger "Something New" / suggestions; re-trigger and observe whether it re-generates from scratch.
started: ongoing

## Eliminated

- hypothesis: "Something New" blocks on hero image generation (the commit 4c27bb5 concern).
  evidence: VERIFIED FIXED. apps/mobile/src/components/suggestions/SomethingNewResults.tsx:384-389 — the blocking skeleton was removed; image gen is now decoupled and fire-and-forget via useGeneratedRecipeImage. The text/recipe payload renders as soon as /recipes/search returns. Image latency no longer gates the cards. (It still contributes to perceived "settling," see RC4, but it is not the recipe-generation blocker.)

- hypothesis: Discovery is a Claude (Anthropic) call (per the objective's "cache Claude responses" framing).
  evidence: FALSE for the main path. ai/taskRouting.ts:37 routes 'recipe.discovery' → Google Gemini Flash (gemini-3-flash-preview), NOT Anthropic. The Anthropic adapter is only used for vision.pantryScan + recipe.parsePhoto. So any "cache the Claude response" work must target the Gemini path (and the legacy /ai/suggest path which is also Gemini Flash via 'suggestions.dinner').

## Evidence

- timestamp: 2026-06-09T02:47:42Z
  checked: Mobile trigger path for "Something New".
  found: search.tsx:70-88 (SomethingNewSearch) → useSuggestionsStore.searchRecipes → POST /api/v1/recipes/search (stores/suggestionsStore.ts:122-165). Post-scan + ellipsis paths also call searchRecipes('', {pantryOnly:true}) (kitchen.tsx:403-407, :674; SomethingNewEllipsis kitchen.tsx:175). A separate legacy surface (recipes/discover.tsx) hits POST /recipes/discover and is NOT the Kitchen "Something New" path.
  implication: The hot path is POST /recipes/search → discoverRecipes(). /discover is a second, near-identical entry point (DRY duplication, same service).

- timestamp: 2026-06-09T02:47:42Z
  checked: Server route POST /recipes/search (routes/recipes.ts:145-268).
  found: Per request it does 3 sequential Supabase round-trips BEFORE any AI call: household_members (:182), profiles (:191), and getRecipes(full library) (:251). For pantryOnly it adds a 4th (pantry_items, :226). Then one awaited discoverRecipes(). No cache, no coalescing.
  implication: 3–4 serial DB hits add fixed latency on every single suggestion request, even on a re-trigger that would return identical recipes.

- timestamp: 2026-06-09T02:47:42Z
  checked: discoverRecipes() + adapter (services/recipeDiscovery.ts:335-378, ai/adapters/geminiAdapter.ts:122-182).
  found: One blocking ai.generateStructured() call, maxTokens: 8192 (recipeDiscovery.ts:377), default 6+ full recipes (each with ingredients, ordered steps, nutrition, skills). Gemini call uses generateContent (NON-streaming) with temperature 0.4 and forced function-calling. On MALFORMED_FUNCTION_CALL it silently retries the ENTIRE call once (geminiAdapter.ts:168-172) — a full second round-trip.
  implication: Latency is dominated by generating ~6 large structured recipes in a single 8192-token completion with no streaming. The single biggest, irreducible-without-redesign cost. The silent full retry can ~2x latency on the flaky-SDK tail.

- timestamp: 2026-06-09T02:47:42Z
  checked: Caching / coalescing across the whole server AI layer.
  found: grep for cache_control / inflight / coalesce / NodeCache / lru across recipeDiscovery.ts, routes/recipes.ts, both adapters → ZERO results. Gemini adapter sets no cachedContent; Anthropic adapter sets no cache_control on system/tools (anthropicAdapter.ts:100-123). GenerateStructuredInput has no cache field. No in-flight de-dup map anywhere on the server.
  implication: (a) No response cache: a re-trigger with the same query/pantry pays the full call again. (b) No prompt caching: the large, near-static system prompt (buildDiscoveryPrompt + suggestRecipesTool schema, ~hundreds of tokens) is re-sent and re-processed every call. (c) No request coalescing: two near-simultaneous triggers = two full AI calls.

- timestamp: 2026-06-09T02:47:42Z
  checked: The ONE real cache in the system — recipeImageGen.ts.
  found: Hero/step image gen IS content-addressed cached in Supabase Storage (cacheKey sha256(title+ingredient-fp), services/recipeImageGen.ts:147-176, cache-hit returns public URL via a cheap list() probe, no Gemini call). Client also dedupes per session + persists to AsyncStorage (hooks/useGeneratedRecipeImage.ts:39-44,116-122,283-284) and caps concurrency at 2 (:57). So image gen already has the cache+coalesce pattern that the RECIPE/text path completely lacks.
  implication: The architecture pattern to copy already exists in-repo. Recipe-text discovery is the gap.

- timestamp: 2026-06-09T02:47:42Z
  checked: Mobile re-fire / churn surface.
  found: (1) recipes/discover.tsx:116-118 — useEffect(fetchDiscover) fires a full /discover AI call on EVERY mount of that screen (no cache, no staleness guard). (2) suggestionsStore is persisted (partialize keeps searchResults, suggestionsStore.ts:249-254) — good, results survive — BUT no result is keyed by query, so the only "cache" is "the last list," and any refresh/regenerate button (SomethingNewResults.tsx:66-69,139-154) re-runs the full AI call by design. (3) Each visible result card mounts useGeneratedRecipeImage → a /generate-image POST per unique title (SomethingNewResults.tsx:253-257); dedup+throttle exist but the FIRST paint of N cards still fires up to N (throttled to 2-at-a-time) Gemini image calls. (4) No React Query here at all — these are hand-rolled fetch + Zustand, so there is no staleTime/refetchOnMount safety net; re-fires are governed only by explicit user taps + the discover.tsx mount effect.
  implication: The biggest avoidable churn is recipes/discover.tsx mount-fetch (RC3) and the absence of any "same query → cached result" short-circuit (RC1).

## Resolution

root_cause: |
  "Something New" feels slow for FOUR compounding reasons, none of which is the previously-fixed image-blocking bug:

  RC1 (HIGHEST IMPACT) — No response cache + no in-flight coalescing on the recipe-generation path.
    POST /recipes/search → discoverRecipes() always makes a fresh blocking AI call. A re-trigger
    with the same query+pantry signature, or two near-simultaneous triggers, each pay full latency.
    Evidence: routes/recipes.ts:254, recipeDiscovery.ts:335-378; zero cache/coalesce in grep.

  RC2 (HIGH IMPACT) — Single large blocking, non-streaming structured call.
    One generateContent for ~6 full recipes at maxTokens 8192, no streaming, plus a silent full-call
    retry on MALFORMED_FUNCTION_CALL. The user stares at a skeleton until the ENTIRE batch is done.
    Evidence: recipeDiscovery.ts:355,377; geminiAdapter.ts:122-182,168-172.

  RC3 (MEDIUM IMPACT) — Mobile re-fire churn.
    recipes/discover.tsx:116-118 fires a full AI discover on every mount. There is no React Query
    layer and no per-query result cache, so nothing short-circuits a repeat request.

  RC4 (MEDIUM/PERCEPTUAL) — Per-card image generation cost on first paint.
    Each result card fires a /generate-image Gemini call (throttled 2-at-a-time). Cards show a
    keyword fallback first (good), but the visual "settling" of N images still reads as slow on a
    cold (uncached) batch. Already cached + coalesced, so this is the smallest lever.

  Note on framing: the objective said "cache Claude responses." The hot discovery path is GEMINI
  Flash, not Claude (taskRouting.ts:37). Recommendations below target the provider-agnostic AIClient
  layer so they apply regardless of which model a task routes to.

fix: |
  RECOMMENDED (NOT APPLIED) — ranked by impact/effort:

  --- FIX 1 (do first): Server-side response cache keyed on request signature. ---
  Target: services/recipeDiscovery.ts (wrap discoverRecipes) OR a thin cache in routes/recipes.ts
          before line 254 (/search) and 333 (/discover).
  Key: sha256 of { userId OR preferences-signature, normalized query, pantryOnly, pantryManifest
       sorted, count }. Deliberately EXCLUDE existingTitles/excludeTitles from the key for the
       base (count-less) request so the initial "Something New" load is cacheable; keep load-more
       (count:2, excludeTitles) uncached or short-TTL since it's meant to be novel.
  Store: in-memory LRU (e.g. a Map with size cap + TTL ~10-15 min) is enough for single-instance
         Fly; if multi-instance, back it with a Supabase table or Redis. Mirror the existing
         content-addressed pattern already proven in recipeImageGen.ts:147-176.
  Expected impact: a re-trigger / "Refresh" with the SAME query+pantry returns in DB-time (~tens of
         ms) instead of a full multi-second Gemini call. Directly kills the "re-runs unnecessarily"
         complaint for repeat queries.

  --- FIX 2 (do with FIX 1): In-flight request coalescing. ---
  Target: same wrapper as FIX 1 — keep a Map<cacheKey, Promise<ParsedRecipe[]>> of in-flight calls;
          a second identical request awaits the existing promise instead of starting a new AI call.
  Pattern already exists client-side in hooks/useGeneratedRecipeImage.ts (Entry.inflight, :39-44,
          :264-288) — port the same idea to the server recipe path.
  Expected impact: double-taps / autoFetch-races (kitchen.tsx:403-407 + an ellipsis tap) collapse to
          one AI call. Eliminates duplicate concurrent generations.

  --- FIX 3 (low effort, broad win): Prompt caching on the static system prompt + tool schema. ---
  Target: ai/adapters/anthropicAdapter.ts:100-123 — add cache_control: { type: 'ephemeral' } to the
          system block and the tools array (Anthropic prompt caching). For Gemini
          (ai/adapters/geminiAdapter.ts:122-182), use the @google/genai cachedContent / context-cache
          API for the systemInstruction + tool declaration.
  Why it helps: buildDiscoveryPrompt + suggestRecipesSchema are large and ~identical across calls for
          a given user; the variable part is just the short user prompt + avoid-list. Caching the
          static prefix cuts input-token processing latency (and cost) on every call, cached or not.
  Caveat: needs live measurement to confirm the cacheable prefix clears each provider's min-token
          threshold — flag as "verify against live token counts."

  --- FIX 4 (UX latency, medium effort): Stream OR shrink the first batch. ---
  Options (pick one):
    (a) Lower the initial batch from 6 to ~3 recipes (recipeDiscovery.ts:355 defaultCount) so first
        results land roughly twice as fast, then lazy-append the rest via the existing
        appendSearchResults load-more path (suggestionsStore.ts:167-231). Lowest risk.
    (b) Stream results: the Anthropic adapter already has generateStream (anthropicAdapter.ts:41-98)
        but it's tool-free; a streaming structured path would be a larger redesign and Gemini is the
        active provider — defer.
  Also: make the silent full-call retry in geminiAdapter.ts:168-172 observable (telemetry) so the
        "sometimes 2x slow" tail is measurable.
  Expected impact: cuts time-to-first-visible-cards materially for the cold (uncached) case.

  --- FIX 5 (kill avoidable re-fires): Guard the discover-screen mount fetch. ---
  Target: apps/mobile/src/app/recipes/discover.tsx:116-118. Don't auto-fetch on every mount if a
          recent result for the same (empty) prompt already exists; reuse the persisted list (as
          SomethingNewResults already does) or gate behind an explicit user action. Optionally adopt
          @tanstack/react-query (already a project dependency) for this screen to get
          staleTime/refetchOnMount semantics for free.
  Expected impact: removes a full AI call every time the legacy Discover screen is opened.

  --- FIX 6 (optional cleanup): De-duplicate /search vs /discover. ---
  routes/recipes.ts:145-268 and :277-344 assemble preferences + library titles near-identically and
  both call discoverRecipes. Collapsing to one handler/helper reduces drift and gives FIX 1/2 a single
  choke point to cache.

verification: |
  NOT VERIFIED (diagnose-only; no app run permitted). Recommendations are static-analysis-grounded.

  CANNOT be determined without running/instrumenting the live app:
  - Actual wall-clock latency split between the 3-4 Supabase round-trips vs the Gemini generateStructured
    call (need ai_events telemetry — the wiring exists in clientFactory.ts wrapWithTelemetry / aiTelemetry.ts
    but is only active when a userId context is passed; confirm discovery call sites pass it).
  - How often MALFORMED_FUNCTION_CALL triggers the silent full retry (geminiAdapter.ts:168) in production.
  - Whether the static system-prompt prefix is large enough to clear each provider's prompt-cache minimum
    token threshold (needed to confirm FIX 3's payoff).
  - Real cache HIT RATE for repeated queries (depends on how often users re-trigger identical
    query+pantry signatures) — needed to size FIX 1's actual benefit.
  - Per-card /generate-image p50/p95 and how many fire on a typical cold batch (RC4 magnitude).

files_changed: []   # diagnose-only — nothing edited
