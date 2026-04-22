# Phase 22: Plan Experience Refactor - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode, Claude-selected defaults)

<domain>
## Phase Boundary

Transform the Plan tab from a passive "weekly generator" into the backbone of the cooking workflow. Four integrated clusters:

1. **Cross-flow navigation** — Plan ↔ Recipe ↔ Something New ↔ Shopping all feel like one product, not four silos.
2. **Date pickers & scale** — day / week / month views with appropriate actions at each scale.
3. **Skill progression integration** — plan is a vehicle for growth, not just scheduling.
4. **Information density on Plan tab** — day cards carry rich status at a glance.

**Out of scope:**
- Multi-user household planning (one user = one plan).
- Calendar app integration (iOS Calendar export) — deferred.
- Notifications/reminders for "time to cook" — deferred.
- Importable plan templates from community — deferred.

</domain>

<decisions>
## Implementation Decisions

### Cross-flow Navigation (SC 1-4)

- **Plan → Recipe:** Tap planned meal card → push recipe detail; Back returns to the same Plan day (not week root).
- **Recipe → Plan:** Add existing "Add to Plan" button (already exists from Phase 4/12) to also accept a specific date via native iOS date picker. Default to next available empty day.
- **Plan → Shopping:** "Shopping list" button on each day + week header; aggregates ingredients, passes through Phase 20's HandoffSheet flow.
- **Suggestions → Plan:** "Pin to day" action on each AI suggestion card in Something New → opens date picker.

### Date Pickers & Scale (SC 5-9)

- **Native iOS picker:** `@react-native-community/datetimepicker` or Expo's built-in `DateTimePicker` (auto-detect from codebase).
- **Week view:** Keep current default; add day-drill gesture.
- **Month view:** New overview showing 28-35 cells with compact status indicators (planned/cooked/empty/skipped colors).
- **Day drill-down:** Full-screen detail with ingredients checklist, timer shortcuts, "cook now" → Voice Cooking Mode entry.
- **Week actions:** Regenerate, shift ±1 week, duplicate last week, shopping list.
- **Month actions:** Pattern analysis (protein/cuisine distribution, repeat meals), mark travel/event days.

### Skill Progression Integration (SC 10-13)

- Reuse Phase 10 skill progression store (`progressionStore`).
- **One stretch meal/week:** Plan generation adds a "stretch" recipe (skill level +1) flagged on the card.
- **Completed plan → progression:** On plan completion, credit skills to progressionStore.
- **Weekly skill focus:** User can optionally lock a theme (e.g., "pan sauces this week") — generator prioritizes recipes exercising it.
- **Prerequisite gating:** Generator respects progressionStore.unlockedTechniques before suggesting advanced recipes.

### Plan Tab Information Density (SC 14-16)

- **Day card:** Meal name, cook time, stretch/new indicator, cook status (cooked/scheduled/skipped/empty), pantry-readiness indicator (green dot / orange dot / red dot).
- **Status distinction:** Token-based color/chip system (Phase 19 tokens: success / brand / warning / tertiary).
- **Inline quick edit:** Swipe-to-action on day card (swap, mark cooked, skip) without leaving Plan tab.

### Claude's Discretion (explicitly flagged)

- Exact month-view cell layout (4-5 rows × 7 days; square or portrait cells)
- Pattern-analysis presentation (charts vs text)
- "Weekly skill focus" UI placement (banner vs toggle)
- Stretch-meal visual indicator (chip? icon?)
- Swipe gesture library (Reanimated Swipeable vs custom)
- Whether to split month view into its own screen or tab within Plan

</decisions>

<code_context>
## Existing Code Insights

### Phase 7 + 12 Infrastructure
- `apps/mobile/src/app/(tabs)/plan.tsx` (or plan/ dir) — current Plan tab
- `apps/mobile/src/stores/planStore.ts` — Zustand store for plan state
- Existing "generate week" flow + endpoint
- PlanDay, PlanMeal types

### Phase 10 Progression Store
- `apps/mobile/src/stores/progressionStore.ts` — skill levels, completed techniques
- Research to locate exact shipped API

### Phase 20 Shopping Hooks (to reuse)
- `apps/mobile/src/components/shopping/HandoffSheet.tsx` — draft-cart flow
- `apps/mobile/src/shopping/*` helpers

### Phase 17 Something New (to link)
- AI recipe suggestions UI — needs "Pin to day" CTA

### Phase 19 Tokens + Phase 15 Conventions
- SF Symbols via SymbolIcon
- Phase 19 spacing/typography/color tokens
- Native stack navigation from expo-router

### Integration Points
- Settings for "Weekly Skill Focus" toggle
- Telemetry pipeline (reuse Phase 16/20 pattern) → new `plan_events` table
- Deep linking: plan/recipe/cook flows continue working

</code_context>

<specifics>
## Specific Ideas

- **Day card status chip:** iOS 17+ style compact pill with icon + label (e.g., "Cooked" with checkmark on success bg).
- **Pantry-readiness dot:** tiny color dot computed from current pantry vs recipe ingredients (Phase 3 infra + Phase 14 improvements).
- **Month view "patterns":** minimal bar chart of protein type distribution (chicken/beef/fish/veg), cuisine pie.
- **Skill focus example copy:** "This week: knife skills — Mise en place drills before each recipe."

</specifics>

<deferred>
## Deferred Ideas

- Multi-user/household planning.
- iOS Calendar export (.ics).
- Cooking time-of-day reminders.
- Community-shared plan templates.
- Macro/calorie tracking per plan.

</deferred>
