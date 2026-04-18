# Phase 19: Design Professionalization - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Establishes the premium visual design system that every screen inherits: color palette, typography scale, button variants, chip language, search-bar pattern, card treatments, and spacing grid. Builds on Phase 15's structural baseline (SF Symbols icon family, native stack headers, chevron-only back button, modal-vs-push rules, tab-root collapsing large-title pattern) and layers aesthetic polish + density on top.

**NOT in scope:**
- New features or capabilities (those are their own phases — e.g., Something New, Shopping refactor, Plan refactor).
- Dark mode implementation (tokens must be structured to allow it later, but no dark UI ships in this phase).
- App-level navigation or modal-vs-push changes (locked in Phase 15).
- Icon family choice (SF Symbols via `expo-symbols`, locked in Phase 15).
- Custom display font / serif typography layer.
- App icon + splash screen redesign (defer to Phase 25 launch prep unless it naturally falls out of palette work).

</domain>

<decisions>
## Implementation Decisions

### Aesthetic direction
- **Lead references: Hybrid Spotify + DoorDash.** Spotify contributes premium typographic feel, hero imagery treatment, and editorial card aesthetic on content surfaces (recipe cards, suggestions, hero areas). DoorDash contributes sticky-pill top search, filter-chip patterns, and commerce-style CTA prominence on search/shop surfaces. Strava contributes chip density only — no full Strava-styling pass.
- **Light mode only in this phase.** Design tokens must be structured so dark mode is a drop-in palette swap later (semantic token names, not raw hex references in components). No dark mode UI ships in Phase 19.
- **Visual vibe: crisp + confident + dense.** iOS-native polish sharpened to premium, strong typographic hierarchy, Strava-level info density on dense screens (Plan day cards, Shopping/Pantry rows). Food photography leads on content surfaces; data-dense surfaces favor info-first layout.

### Color palette
- **Brand anchor shifts from pure orange (#F97316) to Terracotta (~#C65D3A).** Replaces orange-500 as primary CTA / brand color across Button primary variant, FAB, active chip, link color. Existing orange usages get swapped via token replacement, not component rewrite.
- **Neutrals: cream + near-black.**
  - Background: ~#FAF7F2 (warm off-white)
  - Surface (cards): #FFFFFF
  - Primary text: ~#1C1917 (warm near-black, not pure black)
  - Text scale: 900 / 700 / 500 / 300 derived from that anchor
- **Semantic roles documented as named tokens**, not raw hex in components: `brand`, `brand-pressed`, `surface`, `surface-subtle`, `text-primary`, `text-secondary`, `text-tertiary`, `success`, `warning`, `destructive`, `info`, `border`, `border-subtle`. Specific hex values for success/warning/destructive/info are Claude's Discretion during planning.
- **Orange -> terracotta migration is a one-pass token swap.** Do not leave mixed orange+terracotta states in the codebase at the end of the phase.

### Typography
- **SF Pro everywhere.** No custom display font, no serif layer. Zero font-loading overhead, full Dynamic Type support, maximum iOS-native feel. Premium feel comes from weight/size discipline, not font choice.
- **5-step scale** with explicit size / line-height / weight per step:
  - `display` — 34pt / 41pt line / bold (hero titles, onboarding, recipe hero)
  - `title` — 22pt / 28pt line / semibold (section headers, card titles, screen titles)
  - `body` — 17pt / 22pt line / regular (default copy, list rows, recipe steps)
  - `caption` — 13pt / 18pt line / regular (metadata, helper text, chip labels)
  - `label` — 11pt / 16pt line / semibold, uppercase, tracked (section dividers, category headers)
- **Numerics**: Claude's Discretion whether to opt into SF Pro Rounded for numeric-heavy surfaces (timers, servings, cook count) during planning.

### Button system
- **5 variants**: `primary` (filled terracotta), `secondary` (filled neutral/cream with border), `ghost` (transparent, terracotta text), `destructive` (filled red from semantic `destructive` token), `icon-only` (square, 44pt, transparent background, SF Symbol content).
- **Single size: 44pt height** (iOS-standard minimum tap target). No sm/md/lg split. Dense contexts use ghost or icon-only buttons instead of smaller primary buttons.
- **Rounded-xl (12pt) corner radius** preserved from current Button.tsx.
- **Current `Button` component is rewritten** to support the full variant set; existing `primary | outline | ghost` surface migrates (`outline` → `secondary`).

### Search bar
- **Pattern: DoorDash-style sticky pill at top of the tab/screen**, elevated with subtle shadow. Tapping expands to a focused search modal/screen with keyboard.
- **Applied consistently across:** Kitchen (Library segment), Something New (Phase 17), future Pantry search (Phase 21). One component, one behavior.
- **Replaces** the current collapsing-under-large-title pattern on Library (Phase 14) for search specifically; the large-title collapsing header itself (Phase 15 decision) is preserved.

### Chip system
- **Two chip families:**
  - **Filter chips** — interactive, have active/inactive states. Active = filled terracotta with white text. Inactive = outlined with warm-gray border. Used on Library filter sheet, Something New "from pantry" toggle, any multi-select or toggle surface.
  - **Display/category chips** — read-only, muted surface. Used for recipe tags (difficulty, cook time, cuisine), day-card status chips (cooked / pantry-ready / stretch), pantry category labels. Lower visual weight so they don't compete with interactive elements.
- **Shape: rounded-full pill**, ~32pt height, caption-sized label.
- **Both families live in one component file** with a `kind: 'filter' | 'display'` prop to keep the API small.

### Card + row treatments
- **Recipe card: mode-aware.**
  - Library browse: grid layout (2-col), image-forward, 4:3 food photo on top with title + metadata below. Spotify album-card feel.
  - Something New / search results: horizontal list row, smaller square image (80–96pt) left, title + metadata stack right. Dense scan.
- **Day card (Plan tab): medium density.** Day label + meal name + small recipe thumbnail (48–56pt) + status chips (cooked / pantry-ready / stretch-meal). All 7 days visible without scroll on iPhone 15 Pro / 17 Pro.
- **Shopping list item + Pantry item: shared `ItemRow` component**, category-grouped with section headers. Shopping variant shows a checkbox + strike-through on check; pantry variant shows a quantity stepper + stale/low-confidence chip. Single component file, variant prop.

### Spacing
- **8pt grid, moderate density.** Canonical steps: 4 / 8 / 12 / 16 / 24 / 32 / 48. Card padding, row padding, section gaps, chip gaps all align. No ad-hoc pixel values in components.

### Claude's Discretion
- Exact hex values for semantic tokens (`success`, `warning`, `destructive`, `info`, text scale shades, warm-gray borders).
- Button state visuals (pressed, disabled, loading spinner color per variant).
- Whether to opt into SF Pro Rounded for numeric surfaces.
- Input field styling (borders, focus state, error state) — keep conventions consistent with button system.
- FAB treatment: restyle in terracotta + token swap vs evolve toward a stationary CTA pattern. Claude proposes during planning; default is token-swap preserving current 60x60 shadow FAB.
- Tab bar treatment: translucent vs solid, active-state indicator style. Default: preserve current iOS translucent tab bar with terracotta active tint.
- Loading state primitive (skeleton vs spinner) per screen density — Phase 15 already delegated this to Claude; reaffirmed.
- Shadow / elevation token scale.
- `@shopify/flash-list` vs current FlatList for any dense list we touch — keep unless measured cause to swap.
- Whether to introduce a design-token file (e.g., `src/design/tokens.ts`) vs extend `tailwind.config.js` vs both. Default: extend `tailwind.config.js` so NativeWind class names map to tokens, plus a thin `tokens.ts` re-export for non-className consumers.
- `@shopify/restyle` or similar framework adoption — NOT recommended; NativeWind stays. Claude may propose a small typed wrapper around typography/color tokens if needed.
- Whether to add `expo-glass-effect` usage to any surface (already in deps at `~55.0.10`) — optional premium touch, Claude proposes if it falls out naturally.

</decisions>

<specifics>
## Specific Ideas

- **Reference-app decomposition:** Spotify drives recipe card hero treatment, typography confidence, imagery-forward content surfaces. DoorDash drives search bar prominence, filter-chip patterns, and CTA weight on commerce surfaces (Shopping, Something New results). Strava's contribution is narrow — chip density and status-indicator style on data-dense rows (Plan day card, Pantry staleness).
- **Warmer palette is intentional** — terracotta + cream signals "food / craft / warmth" where pure orange + white reads as generic SaaS. This is the single most identity-defining change in the phase.
- **SF Pro over custom display font** is a deliberate constraint: premium feel must come from hierarchy + color + imagery, not from being the one app that ships Fraunces.
- **Every orange reference swaps in one pass.** Mixed orange/terracotta during the migration is a code smell, not an acceptable interim state.
- **The cards get most of the visual personality.** Buttons, chips, and inputs are deliberately understated so content (recipes, food photos, meal plans) carries the premium feel.
- **Token-first component authoring:** No component should hardcode `#F97316`, `#FAF7F2`, or `17pt` after this phase. Everything resolves to a named token.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Button.tsx` (apps/mobile/src/components/ui/Button.tsx) — 3-variant surface; rewritten to 5-variant system with new variant names and terracotta palette.
- `ChipToggle.tsx` (apps/mobile/src/components/ui/ChipToggle.tsx) — subsumed into new two-family chip system; call sites migrate.
- `Input.tsx` — extended to match new button visual language (borders, focus ring, text styles from type scale).
- `HeroImage.tsx` — already image-forward; verify it uses new spacing + radius tokens.
- `Toast.tsx` — inherits new colors + typography; minimal structural change.
- `useCollapsingHeader.ts` / `collapsingHeaderStyles` — Phase 14 + 15 pattern, preserved unchanged. Sticky search pill layers above this on applicable tabs.
- `FOOD_IMAGES` (apps/mobile/src/constants/foodImages.ts) — continues to anchor empty states and hero surfaces (Phase 15 decision).

### Established Patterns
- **NativeWind** for all styling (CLAUDE.md mandate). Design tokens extend `tailwind.config.js` theme so class names map to tokens (e.g., `bg-brand`, `text-primary`, `font-title`).
- **SF Symbols via `expo-symbols`** (Phase 15). Icon-only button variant renders SF Symbols at sizes tied to the type scale.
- **Orange `#F97316` is referenced in 20+ files** (FAB, Button, tab active tint, link color). All swap to terracotta via token replacement, not per-file rewrites.
- **`expo-glass-effect` `~55.0.10` is in deps** — available for premium surface treatments if a natural fit emerges.
- **`router.push` / `router.replace` conventions** from prior phases are preserved; Phase 19 is visual-only.

### Integration Points
- `apps/mobile/tailwind.config.js` — theme extension is the primary token surface.
- Proposed new file: `apps/mobile/src/design/tokens.ts` — typed re-export of tokens for non-className consumers (e.g., `ActivityIndicator` color, native header styles).
- `apps/mobile/src/components/ui/*` — Button, ChipToggle, Input, HeroImage, Toast all rewritten against tokens.
- `apps/mobile/src/components/recipes/RecipeCard.tsx` and suggestion/plan/shopping/pantry card components — migrate to card treatment decisions above.
- `apps/mobile/src/app/(tabs)/_layout.tsx` — tab bar active tint + any translucency treatment.
- Every screen referencing `#F97316`, hardcoded text sizes, or hardcoded pixel spacing — audited and migrated.

</code_context>

<deferred>
## Deferred Ideas

- **Dark mode UI implementation.** Tokens must be dark-mode-ready structurally (semantic names, no hardcoded hex in components). Actual dark mode ships in a later phase. Cooking Mode dark-by-default variant was considered and deferred.
- **Custom display font / serif layer** (Fraunces, Source Serif, etc.). Reconsider post-beta if SF Pro feels flat.
- **App icon + splash screen redesign.** Defer to Phase 25 (Private Beta Launch) unless palette work surfaces an obvious misalignment.
- **Haptic feedback on primary actions** (selection chips, primary CTAs) — future polish.
- **Motion system / animation tokens** (transition timing, spring presets) — visual focus here, not animation.
- **Android/cross-platform** — iOS-only per project decision.
- **SF Pro Rounded opt-in for numeric surfaces** — Claude's Discretion to propose during planning; can defer if not obviously needed.
- **`expo-glass-effect` pervasive adoption** — apply tactically during this phase if natural, otherwise defer.

</deferred>

---

*Phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash*
*Context gathered: 2026-04-18*
