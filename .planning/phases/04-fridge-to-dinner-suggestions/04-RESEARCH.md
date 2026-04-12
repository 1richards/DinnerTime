# Phase 4: Fridge-to-Dinner Suggestions - Research

**Researched:** 2026-04-10
**Domain:** AI-powered meal suggestion engine with Claude API, Hono backend, React Native UI
**Confidence:** HIGH

## Summary

Phase 4 implements the core value proposition of DinnerTime: turning pantry inventory into personalized dinner suggestions via Claude AI. The backend already has a stub route at `/api/v1/ai/suggest` (returns 501) and all prerequisite infrastructure exists -- pantry items in Supabase, household member profiles with dietary restrictions/allergies/dislikes, cuisine preferences, and skill level on the user profile.

The implementation requires: (1) a suggestion service that assembles pantry + preferences context and calls Claude with a structured tool-use response, (2) a Hono API endpoint that orchestrates the call, (3) a mobile suggestions UI on the home tab, and (4) a "Get Dinner Ideas" flow triggered from the scan review confirmation screen for the seamless fridge-to-dinner experience.

**Primary recommendation:** Use Claude Sonnet 4 with tool_choice forcing a structured `suggest_dinners` tool response. Assemble all user context server-side (pantry items, household members with dietary needs, cuisine preferences, skill level). Return 3-5 structured suggestion objects. Stream the response for perceived speed on mobile.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MEAL-01 | User can get AI dinner suggestions based on current pantry inventory | Suggestion service reads pantry_items where status='available', sends to Claude with structured tool response. Existing pantry store + API patterns provide inventory data. |
| MEAL-02 | Suggestions respect dietary preferences and disliked ingredients | Household members table has dietary_restrictions (soft), dietary_allergies (hard), and disliked_ingredients per member. Profile has cuisine_preferences. All assembled into prompt context. |
| MEAL-03 | Suggestions account for kid-friendly meals when household has children | household_members with member_type='kid' and age_range detected server-side. Prompt instructs Claude to include kid-friendly options with familiar flavors. |
| MEAL-04 | User can get suggestions immediately after pantry scan ("fridge to dinner ideas" flow) | After scan confirm, navigate to suggestions screen instead of pantry tab. Pass freshly confirmed items as context or trigger suggestion fetch immediately. |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.88.0 | Claude API client | Already used for vision in Phase 3. Same tool_use pattern for structured suggestions. |
| Hono | ^4.7.10 | API framework | Existing backend framework. Stub route already at `/api/v1/ai/suggest`. |
| Zustand | ~5.0 | Client state | Existing state management. New suggestions store follows pantryStore pattern. |
| @tanstack/react-query | ~5.x | Server state | Already in project for data fetching. Use for suggestion caching/refetching. |

### Supporting (new for this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React Native Reanimated | ~3.x (bundled) | Skeleton loading animation | Suggestion cards loading state while Claude processes |

### No New Dependencies Required
This phase uses only existing dependencies. Claude API, Hono, Zustand, NativeWind -- all already installed and configured.

## Architecture Patterns

### Recommended Project Structure
```
packages/server/src/
  services/suggestions.ts         # Claude prompt assembly + API call
  routes/ai.ts                    # Expand existing stub with /suggest endpoint

apps/mobile/src/
  types/suggestions.ts            # Suggestion type definitions
  stores/suggestionsStore.ts      # Zustand store for suggestion state
  hooks/useSuggestions.ts         # React Query hook for fetching suggestions
  components/suggestions/
    SuggestionCard.tsx            # Individual meal suggestion card
    SuggestionList.tsx            # Scrollable list of suggestions
    SuggestionSkeleton.tsx        # Loading placeholder
  app/(tabs)/index.tsx            # Replace placeholder with suggestions UI
```

### Pattern 1: Structured Tool-Use Response from Claude
**What:** Force Claude to return structured JSON via tool_choice, same pattern as vision.ts
**When to use:** Always for suggestion responses -- guarantees parseable output
**Example:**
```typescript
// Follow the exact pattern from packages/server/src/services/vision.ts
const suggestDinnersTool = {
  name: 'suggest_dinners' as const,
  description: 'Suggest dinner recipes based on available ingredients and preferences',
  input_schema: {
    type: 'object' as const,
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Recipe title' },
            description: { type: 'string', description: '1-2 sentence description' },
            ingredients_used: { type: 'array', items: { type: 'string' }, description: 'Pantry items this recipe uses' },
            ingredients_needed: { type: 'array', items: { type: 'string' }, description: 'Items not in pantry (may need to buy)' },
            estimated_time_minutes: { type: 'number' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            kid_friendly: { type: 'boolean' },
            cuisine_type: { type: 'string' },
            why_suggested: { type: 'string', description: 'Brief reason this was suggested' },
          },
          required: ['title', 'description', 'ingredients_used', 'ingredients_needed', 'estimated_time_minutes', 'difficulty', 'kid_friendly', 'cuisine_type', 'why_suggested'],
        },
      },
    },
    required: ['suggestions'],
  },
};

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  tools: [suggestDinnersTool],
  tool_choice: { type: 'tool', name: 'suggest_dinners' },
  messages: [{ role: 'user', content: promptText }],
});
```

### Pattern 2: Server-Side Context Assembly
**What:** Backend fetches ALL user context from Supabase before calling Claude. Mobile sends minimal request.
**When to use:** Always -- keeps prompt engineering server-side, mobile just triggers
**Example:**
```typescript
// In suggestions service -- server assembles everything
async function getSuggestions(supabase: SupabaseClient, profileId: string) {
  // 1. Fetch pantry items (available only)
  const { data: pantryItems } = await supabase
    .from('pantry_items')
    .select()
    .eq('profile_id', profileId)
    .eq('status', 'available');

  // 2. Fetch household members (for dietary needs + kid detection)
  const { data: members } = await supabase
    .from('household_members')
    .select()
    .eq('profile_id', profileId);

  // 3. Fetch profile (cuisine prefs, skill level)
  const { data: profile } = await supabase
    .from('profiles')
    .select('cuisine_preferences, skill_level')
    .eq('id', profileId)
    .single();

  // 4. Assemble prompt and call Claude
  const prompt = buildSuggestionPrompt(pantryItems, members, profile);
  return callClaude(prompt);
}
```

### Pattern 3: Optimistic Mobile Store (follows existing pantryStore pattern)
**What:** Zustand store with loading states, fetch via authenticated API call
**When to use:** For managing suggestion state on mobile
**Example:**
```typescript
// Follow the exact getAuthToken + fetch pattern from pantryStore.ts
const response = await fetch(`${getApiBaseUrl()}/api/v1/ai/suggest`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({}), // No body needed -- server fetches all context
});
```

### Pattern 4: Post-Scan Navigation to Suggestions (MEAL-04)
**What:** After scan confirm, offer "Get Dinner Ideas" instead of always returning to pantry tab
**When to use:** The fridge-to-dinner seamless flow
**Example:**
```typescript
// In scan/review.tsx handleConfirm, after successful confirmScan:
Alert.alert(
  'Items Added!',
  'Want dinner ideas based on your updated pantry?',
  [
    { text: 'Not Now', onPress: () => router.replace('/(tabs)/pantry') },
    { text: 'Get Ideas', onPress: () => router.replace('/(tabs)/') },
  ]
);
// Home tab detects fresh pantry and auto-triggers suggestions
```

### Anti-Patterns to Avoid
- **Sending pantry data from mobile to suggest endpoint:** Server should fetch everything itself using the auth token. Mobile sending data means stale/incomplete context.
- **Unstructured Claude responses:** Never use plain text responses. Always use tool_choice to force structured JSON. Parsing free-form text is fragile.
- **Caching suggestions too aggressively:** Pantry changes frequently (after scans). Suggestions should be fresh per request, not long-cached.
- **Including depleted/used pantry items in suggestions:** Only pass `status='available'` items to Claude. Include confidence decay -- low-confidence items should be flagged in the prompt.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured AI responses | Custom JSON parsing of text | Claude tool_use with tool_choice | Already proven in vision.ts, guaranteed schema |
| Prompt assembly | String concatenation | Template function with typed inputs | Maintainable, testable, prevents injection |
| Loading skeletons | Custom animated views | Reanimated-based skeleton component | Smooth native animation, not JS-thread |
| Dietary filtering logic | Client-side filtering of suggestions | Server-side prompt constraints | Claude handles this in generation, not post-filter |

**Key insight:** The AI does the filtering -- you tell Claude about allergies/restrictions in the prompt, and it respects them during generation. Don't generate suggestions then filter them client-side.

## Common Pitfalls

### Pitfall 1: Prompt Too Long / Token Waste
**What goes wrong:** Sending raw pantry item objects with all fields (id, profile_id, timestamps) to Claude wastes tokens and confuses the model.
**Why it happens:** Lazy serialization of database objects.
**How to avoid:** Map pantry items to minimal format: `{ name, quantity, unit, category }`. Skip IDs, timestamps, normalized_name.
**Warning signs:** Slow response times, high token costs.

### Pitfall 2: Ignoring Confidence Decay in Suggestions
**What goes wrong:** Claude suggests recipes using items the user probably doesn't have anymore (confidence decayed below threshold).
**Why it happens:** Sending all "available" items without considering effective confidence.
**How to avoid:** Apply the same confidence decay logic from `usePantryItems.ts` server-side. Mark items with effectiveConfidence < 0.5 as "uncertain" in the prompt. Tell Claude to prefer high-confidence items but can suggest uncertain ones with a note.
**Warning signs:** Users getting suggestions with ingredients they've already used up.

### Pitfall 3: Not Differentiating Allergies from Preferences
**What goes wrong:** Treating dietary_restrictions (soft) and dietary_allergies (hard) the same in the prompt.
**Why it happens:** Combining them into one list.
**How to avoid:** Prompt must clearly separate: "NEVER include [allergies]" vs "Try to avoid [restrictions]". This is a Phase 2 decision (separate columns for a reason).
**Warning signs:** Suggesting peanut recipes for a household with nut allergies.

### Pitfall 4: Kid-Friendly as Binary
**What goes wrong:** All suggestions become bland when household has kids.
**Why it happens:** Prompt says "make everything kid-friendly."
**How to avoid:** Prompt should say "Include at least 1-2 kid-friendly options" not "make all kid-friendly." Adults want variety too. Use age_range to calibrate -- toddler meals differ from teen meals.
**Warning signs:** All suggestions are mac and cheese variants.

### Pitfall 5: Empty Pantry Edge Case
**What goes wrong:** User requests suggestions with 0 or very few pantry items. Claude generates useless suggestions.
**Why it happens:** No guard for minimum pantry size.
**How to avoid:** If pantry has < 3 available items, show a friendly message encouraging a scan instead of calling Claude. Save API costs and user frustration.
**Warning signs:** Wasted Claude API calls, poor suggestion quality.

## Code Examples

### Suggestion Type Definition
```typescript
// apps/mobile/src/types/suggestions.ts
export interface DinnerSuggestion {
  title: string;
  description: string;
  ingredients_used: string[];    // From pantry
  ingredients_needed: string[];  // Need to buy
  estimated_time_minutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  kid_friendly: boolean;
  cuisine_type: string;
  why_suggested: string;
}

export interface SuggestionsResponse {
  suggestions: DinnerSuggestion[];
  pantry_item_count: number;     // For UI context
  generated_at: string;
}
```

### Prompt Assembly Pattern
```typescript
// packages/server/src/services/suggestions.ts
function buildSuggestionPrompt(
  pantryItems: PantryItem[],
  members: HouseholdMember[],
  profile: { cuisine_preferences: string[]; skill_level: string }
): string {
  const ingredients = pantryItems.map(
    (i) => `- ${i.name} (${i.quantity} ${i.unit}, ${i.category})`
  ).join('\n');

  const hasKids = members.some((m) => m.member_type === 'kid');
  const kidAges = members
    .filter((m) => m.member_type === 'kid')
    .map((m) => m.age_range)
    .join(', ');

  // Hard blocks (allergies) across ALL members
  const allergies = [...new Set(
    members.flatMap((m) => m.dietary_allergies ?? [])
  )];

  // Soft preferences across ALL members
  const restrictions = [...new Set(
    members.flatMap((m) => m.dietary_restrictions ?? [])
  )];

  // Disliked ingredients across ALL members
  const dislikes = [...new Set(
    members.flatMap((m) => m.disliked_ingredients ?? [])
  )];

  return `Suggest 3-5 dinner recipes I can make tonight.

AVAILABLE INGREDIENTS:
${ingredients}

HOUSEHOLD:
- ${members.length} members (${members.filter(m => m.member_type === 'adult').length} adults, ${members.filter(m => m.member_type === 'kid').length} kids)
${hasKids ? `- Children ages: ${kidAges}` : ''}
- Cooking skill: ${profile.skill_level}

HARD CONSTRAINTS (NEVER violate):
${allergies.length > 0 ? `- Allergies: ${allergies.join(', ')} -- absolutely no recipes with these` : '- No allergies'}
${dislikes.length > 0 ? `- Disliked ingredients: ${dislikes.join(', ')} -- avoid these` : ''}

SOFT PREFERENCES:
${restrictions.length > 0 ? `- Dietary preferences: ${restrictions.join(', ')}` : '- No specific dietary preferences'}
${profile.cuisine_preferences.length > 0 ? `- Preferred cuisines: ${profile.cuisine_preferences.join(', ')}` : '- Open to any cuisine'}

GUIDELINES:
- Prioritize recipes using ingredients already available
- OK to suggest recipes needing 1-3 additional common items
- Match difficulty to skill level (${profile.skill_level})
${hasKids ? '- Include at least 1-2 kid-friendly options (familiar flavors, simple textures)' : ''}
- Vary the cuisines and cooking methods across suggestions
- Include estimated cooking time`;
}
```

### Post-Scan Navigation (MEAL-04)
```typescript
// Modified flow in scan/review.tsx handleConfirm
const handleConfirm = async () => {
  // ... existing confirm logic ...
  await confirmScan(profile.id, sourceLocation);

  // MEAL-04: Offer dinner ideas after scan
  Alert.alert(
    'Pantry Updated!',
    `${acceptedCount} items added. Want dinner ideas?`,
    [
      { text: 'Later', style: 'cancel', onPress: () => router.replace('/(tabs)/pantry') },
      { text: 'Get Dinner Ideas', onPress: () => router.replace('/(tabs)/') },
    ]
  );
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-form text Claude responses | tool_choice forced structured output | Claude 3.5+ (2024) | Guaranteed JSON schema compliance |
| Claude Sonnet 3.5 | Claude Sonnet 4 | 2025 | Better reasoning, same cost tier |
| Single prompt, no context | Full household context in prompt | This phase | Personalized suggestions vs generic recipes |

**Model choice:** Claude Sonnet 4 (`claude-sonnet-4-20250514`) is already used in vision.ts. Use the same model for suggestions -- good balance of quality and cost for structured recipe generation. Haiku would be too terse for quality recipe suggestions.

## Open Questions

1. **Suggestion count: 3 vs 5?**
   - What we know: More suggestions = more tokens = higher cost + slower response
   - What's unclear: User preference for number of options
   - Recommendation: Default to 3-5 (let Claude decide based on pantry variety). Start with asking for 3-5 and adjust based on user feedback.

2. **Should suggestions be saveable/favoritable?**
   - What we know: Phase 5-6 adds recipe library with favorites
   - What's unclear: Whether to persist suggestions in this phase
   - Recommendation: Do NOT persist suggestions to database in Phase 4. Keep them ephemeral (in Zustand store only). Recipe persistence comes in Phase 5-6.

3. **Streaming vs non-streaming response?**
   - What we know: Streaming improves perceived speed for long responses
   - What's unclear: Whether suggestion generation is slow enough to warrant streaming complexity
   - Recommendation: Start with non-streaming (simpler). Typical Claude tool_use responses complete in 2-5 seconds. Add streaming later if needed. Show a skeleton/loading state during the wait.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file (server) | `packages/server/vitest.config.ts` (implicit) |
| Config file (mobile) | `apps/mobile/vitest.config.ts` |
| Quick run command | `cd packages/server && pnpm test` |
| Full suite command | `pnpm -r test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEAL-01 | Suggestion service returns structured suggestions from pantry data | unit | `cd packages/server && pnpm vitest run src/services/__tests__/suggestions.test.ts -x` | No -- Wave 0 |
| MEAL-02 | Prompt includes dietary restrictions and allergies correctly | unit | `cd packages/server && pnpm vitest run src/services/__tests__/suggestions.test.ts -x` | No -- Wave 0 |
| MEAL-03 | Kid-friendly flag included when household has children | unit | `cd packages/server && pnpm vitest run src/services/__tests__/suggestions.test.ts -x` | No -- Wave 0 |
| MEAL-04 | Post-scan navigation offers suggestion flow | unit | `cd apps/mobile && pnpm vitest run src/stores/__tests__/suggestionsStore.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/server && pnpm test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] `packages/server/src/services/__tests__/suggestions.test.ts` -- covers MEAL-01, MEAL-02, MEAL-03 (mock Claude API, test prompt assembly and response parsing)
- [ ] `apps/mobile/src/stores/__tests__/suggestionsStore.test.ts` -- covers MEAL-04 (store state management)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/server/src/services/vision.ts` -- proven Claude tool_use pattern
- Existing codebase: `packages/server/src/routes/ai.ts` -- stub endpoint ready
- Existing codebase: `apps/mobile/src/stores/pantryStore.ts` -- authenticated fetch pattern
- Existing codebase: `apps/mobile/src/types/preferences.ts` -- household member schema
- Existing codebase: `supabase/migrations/00002_household_preferences.sql` -- dietary data model
- Existing codebase: `supabase/migrations/00003_pantry_items.sql` -- pantry data model
- Anthropic SDK docs: tool_use with tool_choice for structured responses

### Secondary (MEDIUM confidence)
- Claude Sonnet 4 model performance for recipe generation -- based on general model capabilities, not food-specific benchmarks

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- follows exact patterns from Phase 3 (vision service, pantry store, authenticated fetch)
- Pitfalls: HIGH -- directly derived from existing data model and codebase analysis
- Prompt engineering: MEDIUM -- prompt template is well-reasoned but needs empirical tuning

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- all patterns already proven in codebase)
