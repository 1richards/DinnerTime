# Phase 2: Household Preferences - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can describe their household in detail so the app personalizes all future meal suggestions. This includes named family member profiles with individual dietary needs and food dislikes, cuisine preferences, cooking skill level, and a dedicated preferences screen accessible from the Home tab. The onboarding wizard (Phase 1) stays simple -- detailed household setup happens in settings.

</domain>

<decisions>
## Implementation Decisions

### Family member profiles
- Each family member gets a named profile with: name, adult/kid designation, individual dietary restrictions, individual food dislikes
- Kids have age ranges: Toddler (1-3), Young kid (4-7), Older kid (8-12), Teen (13+)
- Requires a new `household_members` database table (profiles table only has household_size integer)
- Onboarding wizard stays simple (Phase 1 as-is) -- users add individual member profiles in settings after onboarding

### Dietary & allergy model
- Current 7-option dietary list is sufficient (Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut Allergy, Keto, Paleo)
- Allergies and preferences are separate: allergies are hard blocks (never suggest), preferences are soft (prefer to avoid)
- Dietary restrictions are per-member, not just household-wide
- Cuisine preferences stay at the current 10 high-level options (Italian, Mexican, Chinese, etc.)

### Disliked ingredients
- Search/autocomplete input from a curated ingredient list
- Hardcoded starter list of 200-300 common ingredients, with AI suggestions as fallback for anything not in the list
- Dislikes are per-member only (no separate household-wide disliked list -- AI unions all members' dislikes when planning family meals)
- Selected items display as removable chips

### Cooking skill level
- Self-assessed skill level: Beginner / Intermediate / Confident / Adventurous
- Stored on the user profile, helps AI calibrate recipe complexity from the start
- Feeds into skill progression in Phase 10

### Settings screen layout
- Accessible via profile/gear icon in the Home tab header
- Single scrollable page with grouped sections and headers: Family Members, Dietary & Allergies, Cuisine Preferences, Dislikes, Cooking Skill
- Auto-save on every change (no save button) with brief toast confirmation
- Warm visual style consistent with onboarding (orange/amber palette)

### Claude's Discretion
- Exact ingredient list composition and categorization
- Toast notification design and duration
- Family member add/edit modal or inline form design
- Section header styling and spacing
- How to handle the transition from household_size integer to individual member profiles

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button` component (`apps/mobile/src/components/ui/Button.tsx`): Reusable for add member, save actions
- `Input` component (`apps/mobile/src/components/ui/Input.tsx`): Reusable for member name, ingredient search
- `authStore` (`apps/mobile/src/stores/authStore.ts`): Pattern for creating a preferences Zustand store
- `useAuth` hook (`apps/mobile/src/hooks/useAuth.ts`): Pattern for creating a usePreferences hook
- Onboarding chip-toggle pattern: Reusable for dietary and cuisine selection (see `onboarding/index.tsx`)

### Established Patterns
- NativeWind styling with warmGray/orange color palette
- Supabase client in `apps/mobile/src/lib/supabase.ts` for database operations
- JSONB columns for flexible preference storage (dietary_preferences, cuisine_preferences, disliked_ingredients)
- RLS policies pattern from profiles table

### Integration Points
- `profiles` table needs `skill_level` column added
- New `household_members` table with FK to profiles
- Settings route already exists as `apps/mobile/src/app/settings.tsx` (placeholder)
- Home tab header needs gear/profile icon added
- Supabase migration needed: `00002_household_members.sql`

</code_context>

<specifics>
## Specific Ideas

- The chip-toggle pattern from onboarding (cuisine and dietary selection) should be reused in settings for consistency
- Ingredient search should feel fast and responsive -- local filtering on the hardcoded list, AI fallback only when no matches found
- Family member cards should show at-a-glance info: name, type badge (Adult/Toddler/etc.), dietary icon indicators

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 02-household-preferences*
*Context gathered: 2026-04-10*
