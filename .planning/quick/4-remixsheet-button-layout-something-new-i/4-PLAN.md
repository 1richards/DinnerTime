---
phase: 4-remixsheet-button-layout-something-new-i
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/hooks/useGeneratedRecipeImage.ts
  - apps/mobile/src/components/recipes/RemixSheet.tsx
  - apps/mobile/src/components/suggestions/SomethingNewResults.tsx
  - apps/mobile/src/components/suggestions/SuggestionCard.tsx
autonomous: false
requirements:
  - A-BTN-LAYOUT
  - B1-HOOK-STATUS
  - B2-SKELETON
  - B3-ASYNCSTORAGE
  - UAT-SCREENSHOT

must_haves:
  truths:
    - "Cook now label + flame icon render centered inside the orange 50pt pill in VariationCard"
    - "More actions pill renders ellipsis icon + 'More actions' label inline on a single horizontal row"
    - "Something New first-paint for a novel query shows a solid gray skeleton hero (NOT a keyword-matched stock photo) while Gemini resolves"
    - "Once Gemini resolves, the skeleton is replaced by the generated hero with no intermediate stock-photo flash"
    - "Failed Gemini attempts do not retry within the same session (sticky failed status)"
    - "Resolved Gemini URLs persist across app relaunches via AsyncStorage (no re-fetch for the same title+fingerprint on next session)"
    - "Typecheck passes: `pnpm --filter mobile tsc --noEmit` exits 0"
  artifacts:
    - path: "apps/mobile/src/hooks/useGeneratedRecipeImage.ts"
      provides: "Hook returning { url, status } with AsyncStorage persistence and sticky-failed semantics"
      contains: "status: 'loading' | 'resolved' | 'failed'"
    - path: "apps/mobile/src/components/recipes/RemixSheet.tsx"
      provides: "Fixed Cook now pill centering + inline More actions layout + updated hook call sites"
      contains: "actionBtnCookFullInner"
    - path: "apps/mobile/src/components/suggestions/SomethingNewResults.tsx"
      provides: "PreviewRecipeCard branching on status to render skeleton instead of keyword-stock flash"
      contains: "status === 'loading'"
    - path: "apps/mobile/src/components/suggestions/SuggestionCard.tsx"
      provides: "Updated destructure to read .url from hook return"
      contains: "const { url: generatedUri"
  key_links:
    - from: "useGeneratedRecipeImage"
      to: "all 4 callers (RemixSheet x2, SomethingNewResults, SuggestionCard)"
      via: "destructured { url, status } return shape"
      pattern: "const \\{ url:.*= useGeneratedRecipeImage"
    - from: "useGeneratedRecipeImage"
      to: "AsyncStorage key 'dinnertime-image-cache'"
      via: "fire-and-forget write on successful resolve, async hydrate on module init"
      pattern: "dinnertime-image-cache"
    - from: "PreviewRecipeCard"
      to: "skeleton view"
      via: "early-return when status==='loading' && recipe.image_url is null"
      pattern: "status === 'loading'"
---

<objective>
Two coordinated UI/hook fixes in a single quick plan:

PART A — RemixSheet button layout: Cook now label + flame icon are top-left-pinned in the orange pill because the outer View has a fixed height but the inner Pressable's `flex: 1` has nothing to stretch into. The "More actions" pill stacks the ellipsis above the label for the same reason (Pressable-as-layout-container is finicky on iOS).

PART B — Something New image flash: `generatedUri` is null on first paint, so the card falls through to a keyword-matched Unsplash stock photo for ~500ms before Gemini resolves. Users see a wrong/stale chicken photo, flash, then the real dish. Fix by exposing loading status from the hook and rendering a skeleton while loading. Also persist resolved URLs to AsyncStorage so the same dish never re-fetches across sessions.

Purpose: Ship the RemixSheet layout bugs and eliminate the Something New first-paint flash — both are user-visible quality issues on currently-shipped flows.

Output:
- Fixed CTA pill rendering in VariationCard (A1, A2)
- New hook return shape `{ url, status }` with AsyncStorage persistence (B1, B3)
- Skeleton fallback in PreviewRecipeCard on status='loading' (B2)
- All 4 call sites updated to the new destructured shape
- Typecheck clean
- Maestro screenshot verifying all three visual outcomes
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/workflows/execute-plan.md
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@apps/mobile/src/hooks/useGeneratedRecipeImage.ts
@apps/mobile/src/components/recipes/RemixSheet.tsx
@apps/mobile/src/components/suggestions/SomethingNewResults.tsx
@apps/mobile/src/components/suggestions/SuggestionCard.tsx

<interfaces>
<!-- Current hook signature (what we are REPLACING) -->
```typescript
// apps/mobile/src/hooks/useGeneratedRecipeImage.ts
export function useGeneratedRecipeImage(
  title: string | null | undefined,
  options: HookOptions = {},
): string | null;

interface HookOptions {
  skip?: boolean;
  description?: string | null;
  ingredients?: ParsedIngredient[] | null;
}

type Entry = { url: string | null; inflight: Promise<string | null> | null };
const cache = new Map<string, Entry>();
```

<!-- NEW hook signature (what we are SHIPPING) -->
```typescript
export type GeneratedImageStatus = 'loading' | 'resolved' | 'failed';

export interface GeneratedImageResult {
  url: string | null;
  status: GeneratedImageStatus;
}

export function useGeneratedRecipeImage(
  title: string | null | undefined,
  options: HookOptions = {},
): GeneratedImageResult;

// Extended cache entry — `attempted: true` means fetch completed (url may be null);
// `inflight != null` means fetch in progress.
type Entry = {
  url: string | null;
  inflight: Promise<string | null> | null;
  attempted: boolean;
};
```

<!-- Status derivation rules (keep this EXACT in the hook) -->
- Hook called with no title OR skip=true           → { url: null, status: 'resolved' }  (nothing to do, not loading)
- Cache hit with url !== null                      → { url, status: 'resolved' }
- Cache hit with attempted=true, url=null          → { url: null, status: 'failed' }
- Cache hit with inflight != null                  → { url: null, status: 'loading' }
- No cache entry yet OR cache entry still hydrating → { url: null, status: 'loading' }

<!-- AsyncStorage persistence -->
- Key:     'dinnertime-image-cache'
- Shape:   Record<string, { url: string | null }>  — only urls that resolved non-null
- Hydrate: fire-and-forget on module load; merge into in-memory `cache` Map, marking each as { url, inflight: null, attempted: true }
- Write:   fire-and-forget on every successful (non-null) resolve; serialize full map, filtering entries where url is non-null
- Never persist failed (null) attempts so retry on next session is possible

<!-- Current call sites (MUST update all 4) -->
```typescript
// 1. apps/mobile/src/components/recipes/RemixSheet.tsx:532 (RemixVariationPreview)
const generatedUri = useGeneratedRecipeImage(full.title, {...});
//    ↓ becomes
const { url: generatedUri } = useGeneratedRecipeImage(full.title, {...});

// 2. apps/mobile/src/components/recipes/RemixSheet.tsx:636 (VariationCard)
const generatedUri = useGeneratedRecipeImage(variation.title, {...});
//    ↓ becomes
const { url: generatedUri } = useGeneratedRecipeImage(variation.title, {...});

// 3. apps/mobile/src/components/suggestions/SomethingNewResults.tsx:266 (PreviewRecipeCard)
const generatedUri = useGeneratedRecipeImage(recipe.title, {...});
//    ↓ becomes — this site needs status
const { url: generatedUri, status } = useGeneratedRecipeImage(recipe.title, {...});

// 4. apps/mobile/src/components/suggestions/SuggestionCard.tsx:139
const generatedUri = useGeneratedRecipeImage(suggestion.title, {...});
//    ↓ becomes
const { url: generatedUri } = useGeneratedRecipeImage(suggestion.title, {...});
```

<!-- AsyncStorage import (already used across stores) -->
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
```

<!-- RemixSheet.tsx — offending styles (lines ~927-963) -->
```typescript
actionBtnCookFull: {           // OUTER View, wraps Pressable
  backgroundColor: '#B85C2E',
  height: 50,                  // fixed height — OK
  borderRadius: 12,
  width: '100%',
  overflow: 'hidden',
  // BUG: no flex/justifyContent here; inner flex:1 has nothing to stretch into
},
actionBtnCookFullInner: {      // INNER Pressable
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  flex: 1,                     // BUG: flex:1 in a non-flex parent does nothing
},
moreActionsPill: {             // Used directly on a Pressable — same iOS quirk
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 40,
  width: '100%',
  // Pressable-as-layout-container sometimes fails to flex children on iOS
},
```

<!-- RemixSheet.tsx — JSX (lines ~710-748) -->
```jsx
<View style={styles.actionBtnCookFull}>        {/* outer fixed-height View */}
  <Pressable
    onPress={onCook}
    style={[styles.actionBtnCookFullInner, ...]}
  >
    {isCooking ? <ActivityIndicator /> : (
      <>
        <SymbolIcon name="flame.fill" ... />
        <Text>Cook now</Text>
      </>
    )}
  </Pressable>
</View>
<Pressable
  onPress={openOverflow}
  style={[styles.moreActionsPill, ...]}
>
  <SymbolIcon name="ellipsis" ... />
  <Text>More actions</Text>
</Pressable>
```

<!-- PreviewRecipeCard current image flow (SomethingNewResults.tsx:266-286) -->
```typescript
const generatedUri = useGeneratedRecipeImage(recipe.title, {...});
const heroUri = recipe.image_url ?? generatedUri ?? null;
// ... heroUri flows into synthetic Recipe as image_url, passed to RecipeCard
// When heroUri is null, RecipeCard falls through getRecipeImage → keyword stock
```

<!-- Skeleton visual spec -->
- Solid background: '#F1EAE0' (matches existing `variationHero.backgroundColor` in RemixSheet and existing skeletonWrap tone in SomethingNewResults)
- Same external dimensions as a RecipeCard in grid/preview mode so the grid layout doesn't shift on resolve
- No shimmer, no animation — just a flat placeholder tile with the card's outer margin/radius preserved
- Must sit in the grid slot unchanged so the resolve is a content swap, not a layout reflow
</interfaces>

<project_conventions>
- AsyncStorage is imported as default export from '@react-native-async-storage/async-storage' (see stores/settingsStore.ts:22)
- Fire-and-forget persistence uses `.catch(() => {})` — precedent in suggestionsStore.ts
- Design tokens in `apps/mobile/src/design/tokens.ts` — DO NOT modify. Color `#F1EAE0` is already used inline (variationHero) so we can hardcode it in the skeleton view too.
- `colors.textSecondary` etc are imported from tokens — keep existing import patterns
- No Biome/lint runs required beyond tsc
</project_conventions>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: RemixSheet button layout fix (Part A)</name>
  <files>apps/mobile/src/components/recipes/RemixSheet.tsx</files>
  <behavior>
    - Cook now flame icon + "Cook now" label render horizontally centered (both axes) inside the 50pt orange pill
    - More actions ellipsis icon + "More actions" label render inline on one row, centered
    - ActivityIndicator during cooking still renders centered in the same pill
    - No change to click handlers, disabled states, or opacity pressed styles
  </behavior>
  <action>
    Fix two button layout bugs in VariationCard's CTA block (addresses requirement A-BTN-LAYOUT).

    1. **Fix Cook now pill centering** (styles around line 934):
       - In `actionBtnCookFullInner`: REMOVE `flex: 1`. ADD `height: '100%'` and `width: '100%'`. Keep `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'center'`, `gap: 8`.
       - Final style:
         ```typescript
         actionBtnCookFullInner: {
           flexDirection: 'row',
           alignItems: 'center',
           justifyContent: 'center',
           gap: 8,
           height: '100%',
           width: '100%',
         },
         ```
       - Rationale: `actionBtnCookFull` outer View has `height: 50` but no flex layout, so `flex: 1` on the inner Pressable does nothing. Setting explicit 100% dimensions makes the Pressable fill the outer View, letting alignItems/justifyContent actually center the row.

    2. **Fix More actions inline layout** (JSX around line 732-747):
       - Pressable-as-layout-container can fail to flex children correctly on iOS. Wrap the `<SymbolIcon>` + `<Text>` inside an explicit `<View>` with `flexDirection: 'row', alignItems: 'center', gap: 6`.
       - New JSX:
         ```jsx
         <Pressable
           onPress={openOverflow}
           disabled={disabled || isWorking}
           style={({ pressed }) => [
             styles.moreActionsPill,
             pressed && !(disabled || isWorking) ? { opacity: 0.7 } : null,
             (disabled || isWorking) ? { opacity: 0.5 } : null,
           ]}
         >
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
             <SymbolIcon
               name="ellipsis"
               size={16}
               tintColor={colors.textSecondary}
             />
             <Text style={styles.moreActionsText}>More actions</Text>
           </View>
         </Pressable>
         ```
       - Leave `styles.moreActionsPill` style definition unchanged — it still provides the pill chrome (height, border, gap on parent is now redundant but harmless).

    3. DO NOT touch any other styles. DO NOT modify `actionBtnCookFull` outer style. DO NOT alter handlers or disabled logic.

    4. DO NOT touch the hook call sites in this task — those move with Task 2 as part of the signature change so typecheck passes atomically.
  </action>
  <verify>
    <automated>cd apps/mobile && npx tsc --noEmit 2>&1 | tail -30</automated>
    Visual verification deferred to Task 3 (Maestro screenshot).
  </verify>
  <done>
    - `actionBtnCookFullInner` has `height: '100%', width: '100%'` and no `flex: 1`
    - More actions Pressable wraps icon+text in an inner View with flexDirection row
    - File still compiles (tsc passes assuming Task 2 has not yet run — if Task 2 pending, tsc will fail only on hook return shape, not on this task's edits)
    - NOTE: Run this task BEFORE Task 2. After Task 1, tsc will still pass because the hook signature hasn't changed yet. After Task 2, tsc must pass with all 4 call sites updated.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Hook return shape + AsyncStorage + skeleton + propagate all 4 call sites (Part B)</name>
  <files>apps/mobile/src/hooks/useGeneratedRecipeImage.ts, apps/mobile/src/components/recipes/RemixSheet.tsx, apps/mobile/src/components/suggestions/SomethingNewResults.tsx, apps/mobile/src/components/suggestions/SuggestionCard.tsx</files>
  <behavior>
    - Hook returns `{ url: string | null, status: 'loading' | 'resolved' | 'failed' }` per the rules in <interfaces>
    - With no title or skip=true, status is 'resolved' (nothing to wait on) and url is null
    - On first mount with a new title, status is 'loading' and url is null
    - On Gemini success, status is 'resolved' and url is the Gemini URL
    - On Gemini null/failure, status is 'failed' and url is null; subsequent re-mounts for the same key within the session short-circuit to 'failed' without re-fetching
    - Resolved non-null URLs are persisted to AsyncStorage key 'dinnertime-image-cache' and hydrated on module init
    - Failed null URLs are NOT persisted (retry allowed on next session)
    - All 4 call sites read `.url` from the destructured return; PreviewRecipeCard additionally reads `.status`
    - When `status === 'loading'` and `recipe.image_url` is null in PreviewRecipeCard, a skeleton view renders instead of RecipeCard (prevents keyword-stock flash)
    - Typecheck across apps/mobile passes
  </behavior>
  <action>
    Single atomic change — hook signature + callers update together to keep tsc green (addresses requirements B1-HOOK-STATUS, B2-SKELETON, B3-ASYNCSTORAGE).

    ## Step 1 — Rewrite `apps/mobile/src/hooks/useGeneratedRecipeImage.ts`

    1. Add import at top (after existing imports):
       ```typescript
       import AsyncStorage from '@react-native-async-storage/async-storage';
       ```

    2. Export new types:
       ```typescript
       export type GeneratedImageStatus = 'loading' | 'resolved' | 'failed';
       export interface GeneratedImageResult {
         url: string | null;
         status: GeneratedImageStatus;
       }
       ```

    3. Extend internal Entry type:
       ```typescript
       type Entry = {
         url: string | null;
         inflight: Promise<string | null> | null;
         attempted: boolean;
       };
       const cache = new Map<string, Entry>();
       ```

    4. Add AsyncStorage hydration + persistence module-level code:
       ```typescript
       const STORAGE_KEY = 'dinnertime-image-cache';
       let hydrated = false;
       // Listeners notified once hydration finishes so mounted hooks can re-evaluate.
       const hydrationListeners = new Set<() => void>();

       async function hydrateFromStorage(): Promise<void> {
         try {
           const raw = await AsyncStorage.getItem(STORAGE_KEY);
           if (raw) {
             const parsed = JSON.parse(raw) as Record<string, { url: string | null }>;
             for (const [key, val] of Object.entries(parsed)) {
               // Only merge if not already populated (in-flight fetch wins over disk).
               if (!cache.has(key) && val && typeof val.url === 'string') {
                 cache.set(key, { url: val.url, inflight: null, attempted: true });
               }
             }
           }
         } catch {
           // Non-critical; cache just stays empty
         } finally {
           hydrated = true;
           hydrationListeners.forEach((l) => l());
           hydrationListeners.clear();
         }
       }
       // Kick off hydration on module load — no await, no blocking
       void hydrateFromStorage();

       function persistToStorage(): void {
         // Fire-and-forget; only persist resolved non-null URLs
         const serializable: Record<string, { url: string }> = {};
         for (const [key, entry] of cache.entries()) {
           if (entry.url !== null) {
             serializable[key] = { url: entry.url };
           }
         }
         AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serializable)).catch(
           () => {
             // Persistence is non-critical
           },
         );
       }
       ```

    5. Rewrite the hook body. Signature changes from `): string | null {` to `): GeneratedImageResult {`. Logic:

       ```typescript
       export function useGeneratedRecipeImage(
         title: string | null | undefined,
         options: HookOptions = {},
       ): GeneratedImageResult {
         const { skip, description, ingredients } = options;

         // Derive initial state from cache synchronously (even if module-level hydration
         // hasn't completed — we still read whatever is in the in-memory Map).
         const initialEntry =
           !title || skip ? null : cache.get(cacheKeyFor(title, ingredients)) ?? null;

         const [result, setResult] = useState<GeneratedImageResult>(() => {
           if (!title || skip) return { url: null, status: 'resolved' };
           if (initialEntry?.url) return { url: initialEntry.url, status: 'resolved' };
           if (initialEntry?.attempted && !initialEntry.url)
             return { url: null, status: 'failed' };
           return { url: null, status: 'loading' };
         });

         const ingredientFp = fingerprintIngredients(ingredients);

         useEffect(() => {
           if (!title || skip) {
             setResult({ url: null, status: 'resolved' });
             return;
           }

           // If hydration hasn't happened yet, wait for it before deciding to fetch —
           // otherwise we'd fire an HTTP request for a title that's about to be found
           // in AsyncStorage.
           let cancelled = false;

           const evaluate = () => {
             if (cancelled) return;
             const key = cacheKeyFor(title, ingredients);
             const hit = cache.get(key);

             if (hit?.url) {
               setResult({ url: hit.url, status: 'resolved' });
               return;
             }
             if (hit?.attempted && !hit.url) {
               setResult({ url: null, status: 'failed' });
               return;
             }
             if (hit?.inflight) {
               setResult({ url: null, status: 'loading' });
               hit.inflight.then((u) => {
                 if (cancelled) return;
                 if (u) setResult({ url: u, status: 'resolved' });
                 else setResult({ url: null, status: 'failed' });
               });
               return;
             }

             // No entry — kick off fetch
             setResult({ url: null, status: 'loading' });
             const inflight = fetchGeneratedUrl({
               title,
               description: description ?? null,
               ingredients: ingredients ?? null,
             });
             cache.set(key, { url: null, inflight, attempted: false });
             inflight.then((u) => {
               cache.set(key, { url: u, inflight: null, attempted: true });
               if (u !== null) persistToStorage();
               if (cancelled) return;
               if (u) setResult({ url: u, status: 'resolved' });
               else setResult({ url: null, status: 'failed' });
             });
           };

           if (hydrated) {
             evaluate();
           } else {
             // Queue evaluation until hydration completes.
             const listener = () => evaluate();
             hydrationListeners.add(listener);
             return () => {
               cancelled = true;
               hydrationListeners.delete(listener);
             };
           }

           return () => {
             cancelled = true;
           };
           // eslint-disable-next-line react-hooks/exhaustive-deps
         }, [title, skip, ingredientFp, description]);

         return result;
       }
       ```

       - DO NOT include `url`/`result` in the dep array (breaks the ingredientFp-only invalidation contract).
       - Keep existing `fetchGeneratedUrl`, `cacheKeyFor`, `fingerprintIngredients`, `norm`, `getApiBaseUrl`, `getAuthToken` functions unchanged.
       - Keep `HookOptions` interface unchanged.

    ## Step 2 — Update call site: `apps/mobile/src/components/recipes/RemixSheet.tsx`

    Two call sites:

    - Line ~532 (RemixVariationPreview):
      ```typescript
      const { url: generatedUri } = useGeneratedRecipeImage(full.title, {
        skip: !!full.image_url,
        description: full.description,
        ingredients: full.ingredients,
      });
      ```

    - Line ~636 (VariationCard):
      ```typescript
      const { url: generatedUri } = useGeneratedRecipeImage(variation.title, {
        description: variation.description,
        ingredients: normalizedBaseIngredients,
      });
      ```

    Everything downstream (`heroUri`, `getRecipeImage`, JSX) is unchanged.

    ## Step 3 — Update call site: `apps/mobile/src/components/suggestions/SuggestionCard.tsx`

    Line ~139:
    ```typescript
    const { url: generatedUri } = useGeneratedRecipeImage(suggestion.title, {
      description: suggestion.description,
      ingredients: (suggestion.ingredients_used ?? []).map((name) => ({
        name,
        quantity: null,
        unit: null,
        notes: null,
      })),
    });
    ```
    Everything downstream (`heroUri = generatedUri ?? fallbackUri`) is unchanged.

    ## Step 4 — Update call site + skeleton: `apps/mobile/src/components/suggestions/SomethingNewResults.tsx`

    Line ~266 (PreviewRecipeCard) — destructure both url AND status:
    ```typescript
    const { url: generatedUri, status } = useGeneratedRecipeImage(recipe.title, {
      skip: !!recipe.image_url,
      description: recipe.description,
      ingredients: recipe.ingredients,
    });
    const heroUri = recipe.image_url ?? generatedUri ?? null;
    ```

    Add skeleton branch BEFORE the `return (<>...</>)` block. If `status === 'loading'` AND `!recipe.image_url`, render a skeleton tile wrapped in the same outer Pressable pattern the real RecipeCard uses (but we're not modifying RecipeCard — just emit a minimal inline skeleton View). Still wrap in `<>` so sibling RemixSheet is preserved:

    ```jsx
    // Skeleton fallback — prevents keyword-stock flash while Gemini resolves.
    // Only engaged on Something New results where recipe.image_url is null
    // (saved recipes always have a valid image and skip the hook entirely).
    if (status === 'loading' && !recipe.image_url) {
      return (
        <>
          <Pressable onPress={() => onPress()} style={previewSkeletonStyles.card}>
            <View style={previewSkeletonStyles.hero} />
            <View style={previewSkeletonStyles.body}>
              <View style={previewSkeletonStyles.titleBar} />
              <View style={previewSkeletonStyles.subtitleBar} />
            </View>
          </Pressable>
          {/* Skip RemixSheet render while loading — user cannot remix a previewless card */}
        </>
      );
    }
    ```

    Add `previewSkeletonStyles` as a second `StyleSheet.create` constant at the bottom of the file (DO NOT modify the existing `styles`). Match RecipeCard grid-mode dimensions approximately — preview mode renders 2-column grid with card height ~220 and hero ~140. Use flat `#F1EAE0` (same tone as `variationHero` in RemixSheet). No animation.

    ```typescript
    const previewSkeletonStyles = StyleSheet.create({
      card: {
        flex: 1,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        shadowColor: '#7A6651',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 1,
      },
      hero: {
        width: '100%',
        height: 140,
        backgroundColor: '#F1EAE0',
      },
      body: {
        padding: 12,
        gap: 8,
      },
      titleBar: {
        height: 14,
        width: '70%',
        borderRadius: 4,
        backgroundColor: '#F1EAE0',
      },
      subtitleBar: {
        height: 10,
        width: '50%',
        borderRadius: 4,
        backgroundColor: '#F1EAE0',
      },
    });
    ```

    NOTE on grid width matching: PreviewRecipeCard sits in the same grid as saved RecipeCards. If the skeleton's marginHorizontal/flex causes grid misalignment on visual inspection, adjust marginHorizontal only — do NOT change the RecipeCard styles.

    ## Step 5 — Typecheck

    After all edits, run `cd apps/mobile && npx tsc --noEmit`. Expect zero errors. Fix any fallout:
    - Any other caller of `useGeneratedRecipeImage` not listed above — grep once more to be sure. The 4 sites listed are the complete set per initial grep.
    - If `status` unused-warning appears in non-PreviewRecipeCard sites, use `const { url: generatedUri } = ...` (not `{ url: generatedUri, status }`) — only destructure what each site uses.
  </action>
  <verify>
    <automated>cd apps/mobile && npx tsc --noEmit 2>&1 | tail -30</automated>
  </verify>
  <done>
    - `useGeneratedRecipeImage` returns `{ url, status }` matching the rules in <interfaces>
    - AsyncStorage hydration kicks off on module load; persistence fires on each non-null resolve
    - Failed attempts set `attempted: true`; subsequent mounts for same key return status='failed' without re-fetching
    - All 4 call sites destructure `.url`; PreviewRecipeCard also destructures `.status`
    - PreviewRecipeCard renders skeleton when status='loading' && !recipe.image_url
    - `npx tsc --noEmit` from apps/mobile exits 0
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Maestro iOS-sim UAT screenshot (single screenshot, 3 visual checks)</name>
  <what-built>
    Coordinated fixes from Tasks 1 + 2: centered Cook now pill, inline More actions, and skeleton-on-loading for Something New.
  </what-built>
  <how-to-verify>
    CLAUDE AUTOMATES FIRST (do not ask human to run these):

    1. Ensure dev stack is running per CLAUDE.md "Dev Environment Startup":
       ```bash
       # Metro (iOS simulator on LAN, with cache clear since hook logic changed)
       cd apps/mobile
       rm -rf .expo
       npx expo start --dev-client --lan --clear
       ```
       Run Metro in background (`run_in_background: true`). No Cloudflare tunnel needed — sim uses localhost.

    2. Boot the simulator + install the prebuilt dev client:
       ```bash
       cd apps/mobile
       xcrun simctl boot "iPhone 17 Pro" || true
       open -a Simulator
       xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app
       ```

    3. Write a new Maestro flow at `apps/mobile/.maestro/21-quick4-button-skeleton-shot.yaml` that:
       - Runs `_ensure-logged-in.yaml` as a subflow (existing helper)
       - Navigates to Home → Something New search
       - Types a novel query that is HIGHLY unlikely to be in cache (include a timestamp or nonce in the query text — e.g. "za'atar eggplant shakshuka {timestamp}") so Gemini cache misses and skeleton state is observable
       - Waits a beat (very short, ~200ms) for loading paint
       - Captures `takeScreenshot "quick4-skeleton-first-paint"` — expect gray skeleton tiles, NOT keyword stock photos
       - Waits for Gemini resolve (~2-3s)
       - Opens the first result's RemixSheet via the preview → remix flow
       - Waits for variations to render (~2-3s)
       - Captures `takeScreenshot "quick4-remix-buttons"` — expect (a) Cook now label + flame centered in orange pill, (b) More actions ellipsis + label inline on one row

       Model after existing flows in `apps/mobile/.maestro/` (see 03-import-url.yaml, 06-recipe-discover.yaml for query-entry patterns).

    4. Run the flow:
       ```bash
       cd apps/mobile
       maestro test .maestro/21-quick4-button-skeleton-shot.yaml
       ```

    5. Claude reviews the screenshots using the Read tool on the Maestro output path (typically `~/.maestro/tests/{timestamp}/`). Verify all three visual criteria:
       - [ ] Screenshot 1 (skeleton): Something New grid shows gray solid tiles (NOT chicken/pasta/random stock photos) immediately after search
       - [ ] Screenshot 2 (Cook now centered): Flame icon + "Cook now" text both vertically AND horizontally centered inside the orange 50pt pill
       - [ ] Screenshot 2 (More actions inline): Ellipsis (•••) icon + "More actions" text on the same horizontal row, centered

    HUMAN VERIFIES AFTER CLAUDE:
    Claude presents the two screenshot paths + its pass/fail assessment per criterion. Human confirms visual correctness or describes what's wrong.

    If any criterion fails: course-correct in a follow-up task. Do NOT merge the fix if any visual check fails.
  </how-to-verify>
  <resume-signal>
    Type "approved" if all 3 visual criteria pass, or describe what's wrong.
  </resume-signal>
</task>

</tasks>

<verification>
- `cd apps/mobile && npx tsc --noEmit` exits 0
- New Maestro flow `.maestro/21-quick4-button-skeleton-shot.yaml` runs end-to-end without errors
- Two screenshots captured: skeleton state + remix buttons
- Human approves visual criteria
- No unintended edits to RecipeCard.tsx, PreviewSheet.tsx, design/tokens.ts, or server code (`git diff --stat` should show only the 4 allowed files + the new Maestro yaml)
</verification>

<success_criteria>
- RemixSheet Cook now CTA label + flame icon render centered in the orange 50pt pill on iOS simulator
- RemixSheet More actions pill renders ellipsis icon + label inline on one row
- Something New first-paint (new query, Gemini cache miss) shows gray skeleton tiles, not keyword-stock photos
- Skeleton replaced by generated hero on Gemini resolve with no intermediate stock flash
- Failed Gemini attempts do not retry within a session (sticky failed state)
- Resolved Gemini URLs persist to AsyncStorage and hydrate on next session
- Typecheck clean
- Human approves screenshot evidence
</success_criteria>

<output>
After completion, create `.planning/quick/4-remixsheet-button-layout-something-new-i/4-SUMMARY.md` documenting:
- Which styles were changed in RemixSheet (actionBtnCookFullInner, More actions JSX wrap)
- New hook return shape + AsyncStorage key + hydration/persistence behavior
- Skeleton rendering strategy in PreviewRecipeCard
- Maestro flow added + screenshot paths
- Any unexpected typecheck fallout resolved
</output>
