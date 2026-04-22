# Phase 2: Household Preferences - Research

**Researched:** 2026-04-10
**Domain:** React Native settings UI, Supabase schema migration, Zustand state management
**Confidence:** HIGH

## Summary

Phase 2 extends the existing profile system with detailed household member profiles, per-member dietary restrictions and dislikes, cooking skill level, and a settings screen. The codebase already has the foundation: a `profiles` table with JSONB columns for dietary/cuisine/disliked preferences, a Zustand auth store, reusable chip-toggle UI patterns from onboarding, and `Button`/`Input` components.

The primary work is: (1) a new `household_members` database table with per-member dietary/dislikes, (2) adding `skill_level` column to the existing `profiles` table, (3) a new Zustand preferences store with auto-save, (4) a settings screen with sections for family members, dietary, cuisines, dislikes, and skill level, and (5) routing from the Home tab header to settings.

**Primary recommendation:** Build the database migration first, then the preferences store, then the settings UI. Reuse the chip-toggle pattern from onboarding for dietary/cuisine selections. Use local filtering on a hardcoded ingredient list for the disliked ingredients search.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Each family member gets a named profile with: name, adult/kid designation, individual dietary restrictions, individual food dislikes
- Kids have age ranges: Toddler (1-3), Young kid (4-7), Older kid (8-12), Teen (13+)
- Requires a new `household_members` database table (profiles table only has household_size integer)
- Onboarding wizard stays simple (Phase 1 as-is) -- users add individual member profiles in settings after onboarding
- Current 7-option dietary list is sufficient (Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut Allergy, Keto, Paleo)
- Allergies and preferences are separate: allergies are hard blocks (never suggest), preferences are soft (prefer to avoid)
- Dietary restrictions are per-member, not just household-wide
- Cuisine preferences stay at the current 10 high-level options (Italian, Mexican, Chinese, Japanese, Indian, Thai, Mediterranean, American, Korean, French)
- Dislikes are per-member only (no separate household-wide disliked list -- AI unions all members' dislikes when planning family meals)
- Search/autocomplete input from a curated ingredient list
- Hardcoded starter list of 200-300 common ingredients, with AI suggestions as fallback for anything not in the list
- Selected items display as removable chips
- Self-assessed skill level: Beginner / Intermediate / Confident / Adventurous
- Stored on the user profile, helps AI calibrate recipe complexity from the start
- Settings accessible via profile/gear icon in the Home tab header
- Single scrollable page with grouped sections and headers: Family Members, Dietary & Allergies, Cuisine Preferences, Dislikes, Cooking Skill
- Auto-save on every change (no save button) with brief toast confirmation
- Warm visual style consistent with onboarding (orange/amber palette)

### Claude's Discretion
- Exact ingredient list composition and categorization
- Toast notification design and duration
- Family member add/edit modal or inline form design
- Section header styling and spacing
- How to handle the transition from household_size integer to individual member profiles

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUN-03 | User can set dietary preferences for the household | Per-member dietary restrictions stored in `household_members` table with allergy vs preference distinction; chip-toggle UI reused from onboarding |
| FOUN-04 | User can set household size and family member profiles (adults vs kids) | New `household_members` table with name, member_type (adult/kid), age_range for kids; replaces simple household_size integer |
| FOUN-05 | User can set cuisine preferences and disliked ingredients | Cuisine preferences on profile (existing JSONB column); per-member dislikes with search/autocomplete from hardcoded ingredient list |

</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | 5.0.12 | Preferences store | Already used for authStore; same pattern for preferencesStore |
| @supabase/supabase-js | 2.103.0 | Database operations | Already configured; direct table operations via RLS |
| @tanstack/react-query | 5.97.0 | Server state / auto-save | Already in _layout.tsx QueryClientProvider; useMutation for auto-save |
| expo-router | 55.0.12 | Settings route | File-based routing; add settings.tsx route |
| NativeWind | 4.2.3 | Styling | Already used throughout; warmGray/orange palette established |
| Ionicons | (via @expo/vector-icons) | Icons | Already used in tab bar; gear icon for settings |

### Supporting (no new packages needed)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| React Native ScrollView | Settings screen layout | Single scrollable page with sections |
| React Native Pressable | Chip toggles, member cards | Same pattern as onboarding |
| React Native TextInput | Ingredient search | Via existing Input component |
| React Native Alert | Delete confirmation | Family member deletion |

### No New Dependencies Required
This phase uses only libraries already installed. No `npm install` needed.

## Architecture Patterns

### Database Schema

#### Migration: `00002_household_preferences.sql`

```sql
-- Add skill_level to profiles
ALTER TABLE profiles ADD COLUMN skill_level TEXT DEFAULT 'beginner'
  CHECK (skill_level IN ('beginner', 'intermediate', 'confident', 'adventurous'));

-- Create household_members table
CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  member_type TEXT NOT NULL CHECK (member_type IN ('adult', 'kid')),
  age_range TEXT CHECK (
    age_range IS NULL OR age_range IN ('toddler', 'young_kid', 'older_kid', 'teen')
  ),
  dietary_restrictions JSONB DEFAULT '[]'::jsonb,
  dietary_allergies JSONB DEFAULT '[]'::jsonb,
  disliked_ingredients JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own household members"
  ON household_members FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own household members"
  ON household_members FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own household members"
  ON household_members FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own household members"
  ON household_members FOR DELETE
  USING (profile_id = auth.uid());

-- Updated_at trigger (reuse existing function)
CREATE TRIGGER household_members_updated_at
  BEFORE UPDATE ON household_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

**Key design decisions:**
- `dietary_restrictions` (soft preferences) vs `dietary_allergies` (hard blocks) are separate JSONB arrays
- `age_range` is nullable (only set when member_type = 'kid')
- CHECK constraint on age_range allows NULL for adults
- Reuses the existing `update_updated_at()` trigger function from migration 00001
- `profile_id` references profiles(id), not auth.users(id) -- profiles already cascades from auth.users

#### Handling household_size transition
The existing `profiles.household_size` integer should be kept as-is for backward compatibility with onboarding. It can be treated as a quick-count field. In the settings UI, the actual count comes from `household_members` rows. The AI can use `COUNT(household_members)` when members exist, falling back to `household_size` if no members are added yet.

### Recommended Project Structure

```
apps/mobile/src/
  stores/
    authStore.ts           # existing
    preferencesStore.ts    # NEW: household preferences state
  hooks/
    useAuth.ts             # existing
    usePreferences.ts      # NEW: preferences CRUD operations
  data/
    ingredients.ts         # NEW: hardcoded ingredient list (200-300 items)
    dietary.ts             # NEW: dietary options + allergy options constants
  components/
    ui/
      Button.tsx           # existing
      Input.tsx            # existing
      ChipToggle.tsx       # NEW: extracted reusable chip pattern
      Toast.tsx            # NEW: auto-save confirmation toast
    settings/
      FamilyMembersSection.tsx    # NEW
      DietarySection.tsx          # NEW (household-level for onboarding compat)
      CuisineSection.tsx          # NEW
      DislikesSection.tsx         # NEW
      SkillLevelSection.tsx       # NEW
      MemberCard.tsx              # NEW
      MemberFormModal.tsx         # NEW
      IngredientSearch.tsx        # NEW
  app/
    (tabs)/
      index.tsx            # MODIFY: add gear icon to header
    settings.tsx           # NEW: settings screen route
```

### Pattern 1: Preferences Store (Zustand)
**What:** Centralized store for all household preference data, following authStore pattern
**When to use:** Any component that reads or writes preferences

```typescript
// stores/preferencesStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface HouseholdMember {
  id: string;
  name: string;
  member_type: 'adult' | 'kid';
  age_range: 'toddler' | 'young_kid' | 'older_kid' | 'teen' | null;
  dietary_restrictions: string[];
  dietary_allergies: string[];
  disliked_ingredients: string[];
}

interface PreferencesState {
  members: HouseholdMember[];
  cuisinePreferences: string[];
  skillLevel: string;
  isLoading: boolean;
  loadPreferences: (profileId: string) => Promise<void>;
  // ... mutation methods
}
```

### Pattern 2: Auto-Save with Debounce
**What:** Save on every change with debounce to avoid excessive DB writes
**When to use:** All settings inputs

```typescript
// Use useMutation from @tanstack/react-query for auto-save
// Debounce rapid changes (e.g., typing in search) with a 500ms delay
// Show toast on successful save, error toast on failure
// Optimistic updates in Zustand store, rollback on error
```

### Pattern 3: Ingredient Search with Local Filtering
**What:** Fast search against hardcoded list, no network call
**When to use:** Disliked ingredients input

```typescript
// data/ingredients.ts
export const INGREDIENTS = [
  // Organized by category for maintainability
  // Proteins
  'Chicken', 'Beef', 'Pork', 'Lamb', 'Turkey', 'Salmon', 'Tuna', 'Shrimp', ...
  // Vegetables
  'Broccoli', 'Spinach', 'Kale', 'Brussels Sprouts', 'Mushrooms', ...
  // ... 200-300 total items
];

// Filter locally: items.filter(i => i.toLowerCase().includes(query.toLowerCase()))
// Show top 10 matches in dropdown
// If no matches found, offer AI suggestion fallback (Phase 4+ integration)
```

### Pattern 4: Settings Route
**What:** Settings as a stack screen pushed from tabs, not a tab itself
**When to use:** Navigate from Home header gear icon

```typescript
// app/settings.tsx -- a root-level route, not inside (tabs)
// Access via: router.push('/settings')
// Use Stack.Screen with headerShown: true for back navigation
```

The settings route should be at `app/settings.tsx` (root level, outside tabs), which already has a placeholder noted in CONTEXT.md. This lets it push on top of the tab navigator as a full-screen modal/page with a back button.

### Anti-Patterns to Avoid
- **Don't fetch preferences on every render:** Load once on app init (in authStore.initialize or preferencesStore), cache in Zustand
- **Don't use controlled TextInput for search without debounce:** Will cause janky typing on slower devices
- **Don't save on every keystroke for text fields:** Debounce text inputs (ingredient search, member name); save immediately for toggles/chips
- **Don't store the ingredient master list in the database:** It's static data; keep it in code for instant filtering
- **Don't create a separate navigation stack for settings:** Use a simple route push from the tabs

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auto-save state management | Custom save queue | `useMutation` from @tanstack/react-query | Built-in retry, error handling, loading states |
| Toast notifications | Custom animated view from scratch | Lightweight toast component using Reanimated | Keep it simple -- a 2-second fade-in/fade-out at top of screen |
| Debounced search | setTimeout/clearTimeout manually | `useDeferredValue` from React 19 or simple debounce util | React 19's `useDeferredValue` is built-in and handles concurrent rendering properly |
| Chip toggle component | Inline Pressable logic everywhere | Extract `ChipToggle` component from onboarding pattern | Same chip UI is used in 3+ places (dietary, cuisine, dislikes display) |

## Common Pitfalls

### Pitfall 1: Race Conditions with Auto-Save
**What goes wrong:** Multiple rapid saves cause stale data overwrites or Supabase conflicts
**Why it happens:** User toggles dietary options quickly; each toggle fires a save
**How to avoid:** Debounce saves (300-500ms), use optimistic local updates, let the last write win. For array fields (dietary, dislikes), always send the full array, not a diff.
**Warning signs:** Preferences reverting after toggling quickly

### Pitfall 2: Member Delete Cascade
**What goes wrong:** Deleting a household member doesn't clean up references elsewhere
**Why it happens:** Future phases may reference household_members.id (meal plans, per-member suggestions)
**How to avoid:** Use ON DELETE CASCADE in any future FK references. For Phase 2, the DB cascade from profiles is sufficient. Always confirm deletion with Alert.alert.
**Warning signs:** Orphaned records in future phases

### Pitfall 3: Keyboard Covering Ingredient Search Results
**What goes wrong:** On-screen keyboard covers the search dropdown results
**Why it happens:** ScrollView doesn't automatically adjust for keyboard + inline dropdown
**How to avoid:** Use `KeyboardAvoidingView` wrapping the ScrollView, or position the ingredient search high enough on screen. Consider a bottom-sheet or modal for ingredient search on smaller screens.
**Warning signs:** Users can't see search results on shorter devices

### Pitfall 4: Stale Preferences After Settings Changes
**What goes wrong:** Home screen or other tabs show old preferences after settings update
**Why it happens:** authStore.profile has cached values; preferencesStore and authStore are separate
**How to avoid:** After saving preferences, update both the preferencesStore and invalidate any React Query cache that depends on profile data. Or have a single source of truth.
**Warning signs:** Profile name or dietary info showing outdated values after navigation back

### Pitfall 5: JSONB Array Updates in Supabase
**What goes wrong:** Appending to JSONB arrays using SQL concat instead of replacing
**Why it happens:** Developer tries to do partial array updates at the DB level
**How to avoid:** Always send the complete array from the client. Supabase `.update({ dietary_restrictions: [...] })` replaces the entire JSONB column value. This is correct and simplest.
**Warning signs:** Duplicate items in dietary arrays, items not being removed

## Code Examples

### Settings Screen Navigation from Home Tab

```typescript
// app/(tabs)/index.tsx - Add gear icon to header
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

// In the Tabs.Screen options for index:
headerRight: () => (
  <Pressable onPress={() => router.push('/settings')} className="mr-4">
    <Ionicons name="settings-outline" size={24} color="#1F2937" />
  </Pressable>
),
```

### ChipToggle Component (extracted from onboarding)

```typescript
// components/ui/ChipToggle.tsx
interface ChipToggleProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  variant?: 'default' | 'removable';
}

export function ChipToggle({ label, selected, onToggle, variant = 'default' }: ChipToggleProps) {
  return (
    <Pressable
      onPress={onToggle}
      className={`px-4 py-2 rounded-full ${
        selected ? 'bg-orange-500' : 'bg-warmGray-100 border border-warmGray-200'
      }`}
    >
      <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-warmGray-700'}`}>
        {variant === 'removable' && selected ? `${label} x` : label}
      </Text>
    </Pressable>
  );
}
```

### Auto-Save with useMutation

```typescript
// hooks/usePreferences.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Show toast
    },
    onError: () => {
      // Show error toast, rollback optimistic update
    },
  });
}
```

### Household Member CRUD

```typescript
// hooks/usePreferences.ts
export function useAddMember() {
  return useMutation({
    mutationFn: async (member: Omit<HouseholdMember, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('household_members')
        .insert({ ...member, profile_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single household_size integer | Individual member profiles table | Phase 2 | Enables per-member dietary needs, kid age ranges |
| Household-wide dietary only | Per-member dietary + allergy distinction | Phase 2 | AI can union allergies (hard block) vs preferences (soft) |
| No disliked ingredients input | Search/autocomplete from curated list | Phase 2 | Fast local filtering, no network dependency |
| No skill level | Self-assessed Beginner/Intermediate/Confident/Adventurous | Phase 2 | AI calibrates recipe complexity |

## Open Questions

1. **AI fallback for ingredient search**
   - What we know: Hardcoded list of 200-300 ingredients, AI fallback when no matches
   - What's unclear: Which AI endpoint to call, response time budget, whether to implement in Phase 2 or defer
   - Recommendation: Defer AI fallback to Phase 4 (meal suggestions) when the AI backend is built. For Phase 2, allow free-text entry if nothing matches in the list. The hardcoded list covers the vast majority of common dislikes.

2. **household_size migration strategy**
   - What we know: Existing profiles have household_size integer from onboarding
   - What's unclear: Whether to deprecate it, keep it in sync, or let it diverge
   - Recommendation: Keep household_size as the onboarding quick-count. When household_members exist, downstream features use member count. No need to sync -- they serve different purposes (quick onboarding vs detailed settings).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via apps/mobile/vitest.config.ts) |
| Config file | `apps/mobile/vitest.config.ts` |
| Quick run command | `cd apps/mobile && pnpm test` |
| Full suite command | `cd apps/mobile && pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUN-03 | Dietary preferences per member save/load | unit | `cd apps/mobile && npx vitest run src/stores/__tests__/preferencesStore.test.ts -t "dietary"` | No - Wave 0 |
| FOUN-04 | Household member CRUD (add/edit/delete) | unit | `cd apps/mobile && npx vitest run src/stores/__tests__/preferencesStore.test.ts -t "member"` | No - Wave 0 |
| FOUN-05 | Cuisine prefs and disliked ingredients save/load | unit | `cd apps/mobile && npx vitest run src/stores/__tests__/preferencesStore.test.ts -t "cuisine\|dislike"` | No - Wave 0 |
| FOUN-03 | Allergy vs preference distinction | unit | `cd apps/mobile && npx vitest run src/stores/__tests__/preferencesStore.test.ts -t "allergy"` | No - Wave 0 |
| FOUN-05 | Ingredient search filtering | unit | `cd apps/mobile && npx vitest run src/hooks/__tests__/useIngredientSearch.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/mobile && pnpm test`
- **Per wave merge:** `cd apps/mobile && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/mobile/src/stores/__tests__/preferencesStore.test.ts` -- covers FOUN-03, FOUN-04, FOUN-05
- [ ] `apps/mobile/src/hooks/__tests__/useIngredientSearch.test.ts` -- covers ingredient filtering
- [ ] Note: vitest.config.ts excludes `src/components/**` so component tests are not expected; focus on store and hook logic

## Sources

### Primary (HIGH confidence)
- Existing codebase: `supabase/migrations/00001_profiles.sql` -- current schema and RLS pattern
- Existing codebase: `apps/mobile/src/stores/authStore.ts` -- Zustand store pattern
- Existing codebase: `apps/mobile/src/app/onboarding/index.tsx` -- chip toggle UI pattern, dietary/cuisine constants
- Existing codebase: `apps/mobile/src/app/(tabs)/_layout.tsx` -- tab navigation structure
- Existing codebase: `apps/mobile/vitest.config.ts` -- test configuration

### Secondary (MEDIUM confidence)
- Supabase documentation for JSONB operations and RLS policies (established pattern from Phase 1)
- @tanstack/react-query useMutation pattern for auto-save (established in project via QueryClientProvider)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in Phase 1
- Architecture: HIGH -- database schema follows established patterns, UI reuses existing components
- Pitfalls: HIGH -- common React Native + Supabase patterns well understood

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable stack, no fast-moving dependencies)
