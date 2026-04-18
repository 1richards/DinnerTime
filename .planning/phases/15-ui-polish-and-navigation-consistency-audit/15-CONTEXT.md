# Phase 15: UI Polish & Navigation Consistency - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Systematic audit across every screen (5 tabs, scan flow, recipes flow, cooking, onboarding, auth, settings subflows) that rationalizes iconography, navigation headers, back-button affordances, and the presentation model for pushed vs. modal screens. Establishes a clean, iOS-native baseline that Phase 19 (Design Professionalization) layers premium aesthetic on top of.

**NOT in scope:** premium aesthetic pass (color palette, typography hierarchy, button variants, chip language, search bars, design-system components) — that's Phase 19.

</domain>

<decisions>
## Implementation Decisions

### Icon system
- **Switch from Ionicons to SF Symbols** via `expo-symbols` for iOS-native feel
- **iOS-only app** — no cross-platform fallback layer needed; `sf-symbols` without Ionicons bridge
- **Decorative food emojis** (📸, 🍝, 🍳 in empty states/placeholders) **replaced with real food photography** from the existing `FOOD_IMAGES` constants (already used for hero images on Home)
- **Icon sizes match SF Symbol weights** (body / title / largeTitle) — leverages Dynamic Type scaling automatically; avoid hard-coded `size={N}` pixels

### Navigation headers
- **Stack screens use native stack headers** from `expo-router` — auto back button, centered title, right-side action slot. Removes the custom-header boilerplate currently scattered across scan/, recipes/, etc.
- **Tab screens keep the existing collapsing large-title + compact-header pattern** established in Phase 14 — no churn there
- **Pushed screens (recipe detail, plan day detail, settings subsections) use compact titles, NOT collapsing large titles** — large-title is a tab-root convention
- **Back button is a chevron only**, no text label — matches modern iOS (Photos, Notes, Messages)

### Modal vs push presentation
- **Push** = destinations: recipe detail, recipe list, pantry items, plan day detail
- **Modal** = interruptions/tasks: scan camera flow (scan/index, receipt, instacart, review), recipe import flows (import, import-url, import-photo, import-manual, review), filter sheets, settings editors
- **Scan camera flow moves to modal presentation** with "X" close affordance — reinforces "this is a self-contained task" mental model

### Right-side action slots
- **Max 2 inline icon actions + overflow ellipsis menu** for screens with more actions — matches iOS Mail/Notes pattern
- Text buttons for primary actions ("Save", "Done") are allowed in Phase 19's button-system work, but for Phase 15's polish pass icons + ellipsis is sufficient

### Swipe-back gesture
- **Enabled on every pushed screen by default**
- **Suspended on screens with dirty forms** (import review with unsaved edits, recipe edit form) — show an "Unsaved changes" confirmation dialog instead of allowing accidental dismissal

### Claude's Discretion
- Empty state wording (keep current copy or refresh) — Claude decides per screen
- Error state retry affordances (inline banner vs full-screen) — Claude picks; likely inline banner for transient, full-screen for auth/server-down
- Loading state primitives (skeleton vs spinner) — Claude picks per screen density; probably spinner for short waits, skeleton for list content
- Which overflow menu library to use (expo-router's built-in, custom ActionSheet, react-native-popup-menu) — Claude researches and picks

</decisions>

<specifics>
## Specific Ideas

- Apple apps as north-star reference: Photos, Notes, Messages, Mail — they set the bar for back-button behavior, modal presentation, and iconography
- The FOOD_IMAGES constants already exist (used for Home hero) — reuse them for empty states instead of adding custom illustrations
- Phase 14 collapsing-header pattern is proven and tested — do not disturb it on tab roots
- Post-v1 polish already replaced several Ionicons usages; SF Symbols migration should be done in one pass, not trickled

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FOOD_IMAGES` (apps/mobile/src/constants/foodImages.ts) — hero and category food photography; candidates for empty-state illustrations
- `useCollapsingHeader` hook + `collapsingHeaderStyles` (apps/mobile/src/components/ui/useCollapsingHeader.ts) — tab-root header pattern, preserve unchanged
- `Button` component (apps/mobile/src/components/ui/Button.tsx) — will get variant system in Phase 19; for now just preserve
- Ionicons usages across ~20+ files — candidates for SF Symbols migration

### Established Patterns
- NativeWind for styling (CLAUDE.md mandate) — unchanged
- Orange FAB pattern (#F97316, 60×60, shadow) — preserve
- `router.push` for destinations, `router.replace` for post-action lands — respect in modal/push decision

### Integration Points
- `apps/mobile/src/app/(tabs)/_layout.tsx` — 5 tab screens registered, keep
- `apps/mobile/src/app/scan/_layout.tsx` — currently a plain Stack; switch to Modal presentation
- `apps/mobile/src/app/recipes/_layout.tsx` — check stack vs modal for import/review sub-flows
- Every pushed screen outside `(tabs)/` group needs audit for back-button presence

</code_context>

<deferred>
## Deferred Ideas

- Premium design system (color palette, typography hierarchy, button variants, chip language, search bars) — Phase 19
- Empty-state custom illustrations — Phase 19 can revisit if FOOD_IMAGES feels dated
- Text button support in action slots — Phase 19's button-system work
- Haptic feedback on back-button / action presses — future polish phase
- Cross-platform Android support — project decision already punted

</deferred>

---

*Phase: 15-ui-polish-and-navigation-consistency-audit*
*Context gathered: 2026-04-18*
