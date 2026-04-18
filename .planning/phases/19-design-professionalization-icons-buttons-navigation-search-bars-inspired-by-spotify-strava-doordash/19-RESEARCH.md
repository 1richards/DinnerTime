# Phase 19: Design Professionalization - Research

**Researched:** 2026-04-18
**Domain:** Mobile design-system + token architecture (NativeWind 4, React Native 0.83, expo-router 55, expo-symbols)
**Confidence:** HIGH on stack/patterns; MEDIUM on interaction details (sticky pill expansion model, FAB retreatment); LOW on nothing load-bearing.

## Summary

Phase 19 is a one-pass design-system migration on top of Phase 15's structural baseline (SF Symbols, native stack headers, chevron back, modal/push rules, tab collapsing large-title). The substrate is already correct for tokens — NativeWind 4 is installed with the CSS-first pipeline (`src/global.css` imported in `_layout.tsx`, `withNativeWind` in `metro.config.js`), `expo-symbols ~55.0.7` is available, and `expo-glass-effect ~55.0.10` is in deps but unused. Orange is concentrated: 49 files touch `#F97316` or `orange-*` classes, 8 of them are the `Button` component alone. `tailwind.config.js` currently extends only `warmWhite` + `warmGray` scale — zero semantic tokens exist yet.

The work decomposes cleanly: (1) CSS variables + `tailwind.config.js` extension + `tokens.ts` typed re-export as a foundation wave; (2) rewritten `Button` / `ChipToggle` → `Chip` / `Input` / `SearchBar` / `ItemRow` primitives; (3) card rewrites (RecipeCard grid+list modes, DayRow, pantry/shopping rows); (4) sweep across 49 files replacing raw orange + ad-hoc sizes with tokens, plus FAB/tab-bar retint and Maestro flow updates. No bundled-in-transit mixed orange+terracotta states.

**Primary recommendation:** Ship the token architecture in a dedicated first wave as **CSS variables in `src/global.css` + `theme.extend.colors` in `tailwind.config.js` using `rgb(var(--color-x) / <alpha-value>)` references + a thin typed `src/design/tokens.ts` mirror**. This is the NativeWind 4 canonical pattern in 2026 and buys dark mode later for free. Every subsequent wave depends on this landing first.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Aesthetic direction**
- Lead references: **Hybrid Spotify + DoorDash**. Spotify drives typographic feel, hero imagery, editorial card aesthetic (recipe cards, suggestions, hero areas). DoorDash drives sticky-pill top search, filter-chip patterns, commerce-style CTA prominence (search/shop). Strava contributes **chip density only** — no full Strava pass.
- **Light mode only in this phase.** Tokens must be structured for drop-in dark mode later (semantic names, no raw hex in components). No dark UI ships in Phase 19.
- Visual vibe: crisp + confident + dense. iOS-native polish sharpened to premium, strong typographic hierarchy, Strava-level info density on dense screens (Plan day cards, Shopping/Pantry rows).

**Color palette**
- Brand anchor **shifts from pure orange (`#F97316`) to Terracotta ~`#C65D3A`**. Replaces orange-500 as primary CTA / brand color across Button primary, FAB, active chip, link color. One-pass token swap — no mixed orange+terracotta at end of phase.
- Neutrals: background `~#FAF7F2` (warm off-white), surface (cards) `#FFFFFF`, primary text `~#1C1917` (warm near-black, not pure black), text scale 900 / 700 / 500 / 300.
- Semantic roles as named tokens: `brand`, `brand-pressed`, `surface`, `surface-subtle`, `text-primary`, `text-secondary`, `text-tertiary`, `success`, `warning`, `destructive`, `info`, `border`, `border-subtle`. Specific hex for success/warning/destructive/info is **Claude's Discretion**.

**Typography**
- **SF Pro everywhere.** No custom display font, no serif layer. Premium feel comes from weight/size discipline.
- **5-step scale**:
  - `display` — 34pt / 41pt line / bold
  - `title` — 22pt / 28pt line / semibold
  - `body` — 17pt / 22pt line / regular
  - `caption` — 13pt / 18pt line / regular
  - `label` — 11pt / 16pt line / semibold, uppercase, tracked
- SF Pro Rounded opt-in for numeric surfaces: **Claude's Discretion**.

**Button system**
- 5 variants: `primary` (filled terracotta), `secondary` (filled cream + border), `ghost` (transparent + terracotta text), `destructive` (filled red), `icon-only` (square, 44pt, transparent, SF Symbol).
- Single size: **44pt height**. No sm/md/lg split.
- Rounded-xl (12pt) corner radius preserved.
- Current `Button` component is **rewritten** (3-variant `primary | outline | ghost` → 5-variant). `outline` → `secondary`.

**Search bar**
- Pattern: **DoorDash-style sticky pill at top of tab/screen**, elevated with subtle shadow. Tapping expands to focused search modal/screen with keyboard.
- Applied consistently across: Kitchen (Library segment), Something New (Phase 17), future Pantry search (Phase 21). One component, one behavior.
- **Replaces** the current collapsing-under-large-title search pattern on Library; the large-title collapsing header itself (Phase 15) is preserved.

**Chip system**
- **Two families** (both in one component file, `kind: 'filter' | 'display'`):
  - Filter: interactive, active/inactive states. Active = filled terracotta + white text. Inactive = outlined + warm-gray border.
  - Display/category: read-only, muted surface. Recipe tags, day-card status, pantry category labels.
- Shape: rounded-full pill, ~32pt height, caption-sized label.

**Card + row treatments**
- **Recipe card: mode-aware.**
  - Library: grid (2-col), image-forward, 4:3 food photo on top, title + metadata below (Spotify album feel).
  - Something New / search results: horizontal list row, 80–96pt square image left, title + metadata right.
- **Day card (Plan):** medium density. Day label + meal name + 48–56pt thumbnail + status chips. All 7 days visible without scroll on iPhone 15 Pro / 17 Pro.
- **Shopping + Pantry rows: shared `ItemRow` component.** Category-grouped with section headers. Shopping variant = checkbox + strike. Pantry variant = quantity stepper + stale/low-confidence chip. Single component file, variant prop.

**Spacing**
- **8pt grid.** Canonical steps: 4 / 8 / 12 / 16 / 24 / 32 / 48. Card padding, row padding, section gaps, chip gaps align.

### Claude's Discretion
- Exact hex values for semantic tokens (`success`, `warning`, `destructive`, `info`, text scale shades, warm-gray borders).
- Button state visuals (pressed, disabled, loading spinner color per variant).
- SF Pro Rounded opt-in for numeric surfaces.
- Input field styling (borders, focus state, error state) — consistent with button system.
- **FAB treatment:** restyle in terracotta + token swap vs evolve toward stationary CTA. **Default = token-swap preserving current 60x60 shadow FAB.** Claude proposes during planning.
- Tab bar treatment: translucent vs solid, active-state indicator. **Default = preserve current iOS translucent tab bar with terracotta active tint.**
- Loading state primitive (skeleton vs spinner) per screen density.
- Shadow / elevation token scale.
- `@shopify/flash-list` vs current FlatList — keep unless measured cause to swap.
- Token file shape: extend `tailwind.config.js` **plus** thin `tokens.ts` re-export. **NOT** `@shopify/restyle`. NativeWind stays.
- `expo-glass-effect` (already in deps `~55.0.10`) — optional premium touch, Claude proposes if natural.

### Deferred Ideas (OUT OF SCOPE)
- Dark mode UI implementation (structural readiness only).
- Custom display font / serif layer.
- App icon + splash screen redesign (defer to Phase 25).
- Haptic feedback on primary actions.
- Motion system / animation tokens.
- Android / cross-platform.
- `expo-glass-effect` pervasive adoption.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | Coherent icon set, documented scale | `expo-symbols` is installed but **not yet used anywhere** (confirmed: zero `SymbolView` imports in src). Phase 15 is the SF Symbols migration; Phase 19 layers sizing-to-type-scale discipline on top. See "SF Symbols weight/size scale" below. |
| D-02 | Button system: primary/secondary/ghost/destructive/icon-only @ 44pt | Current `Button.tsx` has 3 variants (`primary | outline | ghost`), hard-codes `bg-orange-500` + `py-4 px-6` (not 44pt guaranteed), activity indicator color hard-coded `#F97316`. Full rewrite. See "Button system" in Standard Stack. |
| D-03 | Unified search pattern | Current `SearchBar.tsx` is a `bg-warmGray-100 rounded-xl` inline text input — **not** DoorDash-style sticky pill. Used only on Library segment. See "Sticky-pill search bar" in Architecture Patterns. |
| D-04 | Consistent nav headers | Locked in Phase 15 (native stack headers, chevron-only back, max 2 actions + ellipsis). Phase 19 layers tokens on. |
| D-05 | Chips share one design language | Current `ChipToggle.tsx` is single-family with `colorScheme='orange'|'red'`. Rewrite to two-family (`kind: 'filter' \| 'display'`). Migrate call sites. |
| D-06 | Color palette with semantic roles | Current `tailwind.config.js` extends `warmWhite` + `warmGray` only. Zero semantic tokens. See "Token architecture" below. |
| D-07 | Typography scale (5 step) with line heights | No current typography scale — components hard-code `text-base`, `text-sm`, `text-xs` mixed with inline `fontSize` values. See "Typography tokens" below. |

## Standard Stack

### Core (all already installed, verified against `apps/mobile/package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NativeWind | ~4.2.3 | Styling + design tokens | CLAUDE.md mandated. v4.x supports CSS-first design tokens via `src/global.css` — already wired via `metro.config.js` `withNativeWind({ input: './src/global.css' })`. The canonical 2026 pattern. |
| tailwindcss | ~3.4.19 | CSS compiler backing NativeWind | Dev-dep. v3 theme.extend API is what NativeWind 4 consumes. Do **not** upgrade to Tailwind v4 in this phase — NativeWind 4.2 targets Tailwind 3. |
| expo-symbols | ~55.0.7 | SF Symbols | Installed, **zero current usage** — Phase 15 owns the initial migration, Phase 19 layers typography-scale-tied sizing on top. |
| expo-glass-effect | ~55.0.10 | iOS glass surfaces | Installed, **zero current usage**. Optional per CONTEXT. |
| expo-image | ~55.0.8 | Cached image display | Already in use — RecipeCard, HeroImage. Continue using for mode-aware cards. |
| expo-router | ~55.0.12 | Navigation + tabs | Tab bar `tintColor` plumbing uses raw string values (`'#F97316'` currently). Token re-export via `tokens.ts` feeds this. |
| react-native-reanimated | 4.2.1 | Animations | Bundled. Needed for sticky-pill search expansion if we animate it. |

### Supporting (to ADD this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | **No new dependencies required.** All needs are met by existing stack. |

### Alternatives Considered & Rejected
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS-vars + tokens.ts re-export | `@shopify/restyle` | Explicitly rejected by CONTEXT. Would fork styling stack away from NativeWind. |
| CSS-vars + tokens.ts re-export | Standalone `src/design/tokens.ts` with raw hex, no Tailwind hook | Loses NativeWind className ergonomics (`bg-brand` etc.). CONTEXT default is both. |
| CSS-vars + tokens.ts re-export | `tailwind.config.js` extend with raw hex only | Works short-term but every dark-mode-ready structure is built around CSS variables. Doing it now is the same work and buys dark mode later. |
| expo-symbols (kept) | Native SF Symbols view via `react-native-sfsymbols` (birkir) | Not needed — expo-symbols is already installed and maintained by Expo. |
| Tailwind v4 CSS-first `@theme` directive | (stay on v3) | NativeWind 4.2 targets Tailwind 3. Tailwind v4 jump is out of scope and would thrash the babel preset. |

**Verified versions** against registry (`npm view <pkg> version`):
- `nativewind@4.2.3` — confirmed via installed version in `package.json`; current stable series is 4.x, v5 exists but is not the current shipping release for Expo 55. HIGH confidence.
- `expo-symbols@55.0.7` — bundled version for Expo SDK 55. HIGH confidence.
- `expo-glass-effect@55.0.10` — bundled. HIGH confidence.

**No installation commands required** — every dep is already present.

## Architecture Patterns

### Recommended project structure (additions to existing layout)
```
apps/mobile/src/
├── global.css                 # EXISTS — extend with CSS variables (semantic tokens)
├── design/                    # NEW
│   ├── tokens.ts              # NEW — typed re-export for non-className consumers
│   └── typography.ts          # NEW — typed text style objects for Text components (see below)
├── components/
│   └── ui/
│       ├── Button.tsx         # REWRITE — 5 variants, 44pt, token-driven
│       ├── Chip.tsx           # NEW — replaces ChipToggle.tsx; filter|display kinds
│       ├── SearchBar.tsx      # REWRITE — sticky-pill; (currently at components/recipes/SearchBar.tsx, move)
│       ├── ItemRow.tsx        # NEW — shared Shopping + Pantry row with variant prop
│       ├── Input.tsx          # REWRITE — token-driven focus/error states
│       ├── Toast.tsx          # RETHEME — success/destructive tokens
│       └── SegmentedControl.tsx # OPTIONAL EXTRACT — currently inline in kitchen.tsx
tailwind.config.js             # EXTEND — color + fontSize + spacing tokens from CSS vars
```

### Pattern 1: Token architecture — CSS variables + Tailwind extend + typed re-export

**The canonical NativeWind 4 pattern** ([willcodefor.beer/posts/rntw](https://willcodefor.beer/posts/rntw), [nativewind.dev v4 blog](https://www.nativewind.dev/blog/announcement-nativewind-v4)).

**Step 1 — Define CSS variables in `src/global.css`:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Brand */
    --color-brand: 198 93 58;            /* #C65D3A terracotta */
    --color-brand-pressed: 167 73 44;    /* #A7492C ~15% darker */

    /* Surface */
    --color-bg: 250 247 242;             /* #FAF7F2 cream */
    --color-surface: 255 255 255;        /* #FFFFFF */
    --color-surface-subtle: 241 234 224; /* warmGray-100 */

    /* Text */
    --color-text-primary: 28 25 23;      /* #1C1917 warm near-black */
    --color-text-secondary: 92 77 61;    /* warmGray-600 */
    --color-text-tertiary: 168 145 120;  /* warmGray-400 */

    /* Semantic (Claude's Discretion — suggested starting values) */
    --color-success: 22 163 74;          /* #16A34A (matches current green-600) */
    --color-warning: 217 119 6;          /* #D97706 (amber-600) */
    --color-destructive: 220 38 38;      /* #DC2626 (red-600) */
    --color-info: 37 99 235;             /* #2563EB (blue-600) */

    /* Border */
    --color-border: 229 217 202;         /* warmGray-200 */
    --color-border-subtle: 241 234 224;  /* warmGray-100 */
  }

  /* Dark mode — deferred; block committed for structural readiness only.
     Do NOT enable in Phase 19. */
  /* @media (prefers-color-scheme: dark) {
    :root { --color-bg: 28 25 23; ... }
  } */
}
```

**Step 2 — Reference CSS vars in `tailwind.config.js`:**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        'brand-pressed': 'rgb(var(--color-brand-pressed) / <alpha-value>)',
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-subtle': 'rgb(var(--color-surface-subtle) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        destructive: 'rgb(var(--color-destructive) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'border-subtle': 'rgb(var(--color-border-subtle) / <alpha-value>)',
        // KEEP warmGray for migration-safety — remove in a followup phase once zero refs remain.
        warmWhite: '#FFFBF5',
        warmGray: { /* existing scale */ },
      },
      fontSize: {
        // [size, { lineHeight, letterSpacing, fontWeight }]
        display:  ['34px', { lineHeight: '41px', fontWeight: '700', letterSpacing: '-0.8px' }],
        title:    ['22px', { lineHeight: '28px', fontWeight: '600', letterSpacing: '-0.3px' }],
        body:     ['17px', { lineHeight: '22px', fontWeight: '400' }],
        caption:  ['13px', { lineHeight: '18px', fontWeight: '400' }],
        label:    ['11px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.6px' }],
      },
      spacing: {
        // 8pt grid aliases (keep default Tailwind 1/2/3/4 etc. too — they already align)
        // Canonical steps: 4 / 8 / 12 / 16 / 24 / 32 / 48 already map to 1 / 2 / 3 / 4 / 6 / 8 / 12
      },
      borderRadius: {
        pill: '9999px',
        chip: '16px',     // caption chips
        card: '16px',     // recipe card
        button: '12px',   // rounded-xl preserved
      },
    },
  },
  plugins: [],
};
```
*Source: adapted from [willcodefor.beer NativeWind + design tokens](https://willcodefor.beer/posts/rntw) and [nativewind v4 announcement](https://www.nativewind.dev/blog/announcement-nativewind-v4). HIGH confidence on the RGB-channel syntax — this is the only shape that supports `<alpha-value>` opacity modifiers like `bg-brand/20`.*

**Step 3 — Typed re-export in `src/design/tokens.ts` (for non-className consumers):**
```typescript
// src/design/tokens.ts
//
// Single source of truth for design tokens exposed to non-className code:
//   - react-navigation header/tab tintColor
//   - ActivityIndicator color
//   - Raw Animated.Value / StyleSheet.create consumers
//
// IMPORTANT: keep hex values IN SYNC with CSS variables in src/global.css.
// A unit test (see Validation Architecture) asserts parity so they cannot drift.

export const colors = {
  brand: '#C65D3A',
  brandPressed: '#A7492C',
  bg: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1EAE0',
  textPrimary: '#1C1917',
  textSecondary: '#5C4D3D',
  textTertiary: '#A89178',
  success: '#16A34A',
  warning: '#D97706',
  destructive: '#DC2626',
  info: '#2563EB',
  border: '#E5D9CA',
  borderSubtle: '#F1EAE0',
} as const;

export type ColorToken = keyof typeof colors;

export const typography = {
  display:  { fontSize: 34, lineHeight: 41, fontWeight: '700' as const, letterSpacing: -0.8 },
  title:    { fontSize: 22, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.3 },
  body:     { fontSize: 17, lineHeight: 22, fontWeight: '400' as const },
  caption:  { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label:    { fontSize: 11, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.6 },
} as const;

export type TypographyToken = keyof typeof typography;

export const spacing = {
  1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48,
} as const;

export const radius = {
  button: 12,
  card: 16,
  chip: 16,
  pill: 9999,
} as const;
```

**Usage in navigator options (the reason `tokens.ts` exists):**
```typescript
// apps/mobile/src/app/(tabs)/_layout.tsx
import { colors } from '../../design/tokens';

<Tabs screenOptions={{
  tabBarActiveTintColor: colors.brand,       // was '#F97316'
  tabBarInactiveTintColor: colors.textTertiary,
  tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.borderSubtle },
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.textPrimary,
}} />
```

### Pattern 2: Sticky-pill search bar on top of collapsing header

**The problem:** Phase 14 `useCollapsingHeader` returns `scrollY` + `compactHeaderOpacity`. Phase 19 needs a DoorDash-style sticky pill that (a) sits **always visible** at the top of the scroll area (unlike the current SearchBar which is only on Library), (b) animates elevation/shadow on scroll, (c) on tap expands to a focused search surface.

**Architecture: separate sticky element, NOT inside the header.**

The sticky pill lives as a **separate absolute-positioned layer** in the tab screen, above the collapsing header's compact bar. It responds to the same `scrollY` so its shadow opacity grows as the user scrolls.

Tap-to-expand options:
- **Option A (RECOMMENDED): navigate to a modal route** `/search?context=library` with `presentation: 'modal'` — matches Phase 15's modal=task mental model. Keyboard auto-focuses on mount. Native X close. Results render in the modal.
- Option B: inline expansion via Animated spring — prettier but adds state complexity, and Phase 17 will ship a full search surface anyway. Modal reuses that work.

**Concrete snippet (Option A):**
```typescript
// src/components/ui/SearchBar.tsx
import { Pressable, Text, Animated } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { colors } from '../../design/tokens';

interface StickySearchPillProps {
  placeholder: string;
  onPress?: () => void;              // optional override (modal route by default)
  scrollY: Animated.Value;           // from useCollapsingHeader
}

export function StickySearchPill({ placeholder, onPress, scrollY }: StickySearchPillProps) {
  const shadowOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0.05, 0.18],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 8,                      // below status bar, above compact header
        left: 16,
        right: 16,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity,                // <-- animated
        shadowRadius: 8,
        elevation: 3,
        zIndex: 20,                   // above collapsingHeaderStyles.compactHeader (zIndex:5/10)
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
      }}
    >
      <Pressable
        onPress={onPress ?? (() => router.push('/search?context=library'))}
        className="flex-1 flex-row items-center"
        accessibilityRole="search"
        accessibilityLabel={placeholder}
      >
        <SymbolView name="magnifyingglass" size={16} tintColor={colors.textTertiary} />
        <Text className="ml-2 text-body text-text-tertiary">{placeholder}</Text>
      </Pressable>
    </Animated.View>
  );
}
```

**zIndex coordination:** `collapsingHeaderStyles.compactHeader` uses `zIndex: 5` and `actionRow` uses `zIndex: 10`. The sticky pill must be `zIndex: 20+` to layer above. Alternatively, the pill replaces the compact header's centered title on Library (since CONTEXT says the pill replaces the current collapsing-under-large-title search pattern), but the large-title collapsing behavior is preserved — the pill is additive, the SearchBar-under-title pattern is removed.

**Confidence:** MEDIUM on exact interaction — DoorDash-specific reverse-engineering was not successful via web search ([tryperdiem.com DoorDash integration](https://www.tryperdiem.com/post/how-to-integrate-doordash-delivery-in-your-react-native-ios-app), [Medium: Mastering Sticky Headers](https://medium.com/@ovieiffieu2much/mastering-sticky-headers-in-react-native-the-dynamic-overlay-pattern-05bf8809b641) — neither documents DoorDash's proprietary pattern). The model above is the best synthesis of common sticky-search patterns + the existing collapsing-header hook. **Worth validating visually against a real DoorDash screenshot in Wave 0.**

### Pattern 3: SF Symbols sized to type scale

**expo-symbols** ([docs.expo.dev/versions/latest/sdk/symbols](https://docs.expo.dev/versions/latest/sdk/symbols/)) exposes two sizing dimensions:

| Prop | Values | Use |
|------|--------|-----|
| `size` | numeric px | Primary sizing knob. Match the fontSize of the adjacent text token. |
| `scale` | `'small' \| 'medium' \| 'large' \| 'default'` | Relative optical size tuning within SF Symbols rendering. Keep `'default'` unless a symbol looks off. |
| `weight` | `'regular' \| 'medium' \| 'semibold' \| 'bold' \| ...` | Match the text weight of the adjacent label. |

**Recommended helper in `src/design/icons.ts`:**
```typescript
import { typography } from './tokens';
import type { SymbolViewProps } from 'expo-symbols';

type IconSize = 'caption' | 'body' | 'title' | 'display';

export const iconSize: Record<IconSize, number> = {
  caption: 14,   // pairs with 13pt caption
  body: 18,     // pairs with 17pt body
  title: 22,    // pairs with 22pt title
  display: 28,  // pairs with 34pt display (icons ~80% of display text size)
};

export function iconPropsForText(size: IconSize): Pick<SymbolViewProps, 'size' | 'weight'> {
  return { size: iconSize[size], weight: typography[size].fontWeight as SymbolViewProps['weight'] };
}
```

**Do NOT** tie icon sizing to Dynamic Type — SwiftUI's `Image.imageScale(.small|.medium|.large)` auto-scales with Dynamic Type in SwiftUI but expo-symbols does not expose that binding on the React Native side. Stick to explicit numeric sizes tied to the type scale ([devtechie.com SwiftUI dynamic scaling](https://www.devtechie.com/swiftui_imageview_dynamic_scaling_in_sf_symbol)).

### Pattern 4: Button system (5-variant, 44pt, token-driven)

**Replaces entire `src/components/ui/Button.tsx`.** API preserved: `title`, `variant`, `loading`, `disabled`, `className`, rest-PressableProps.

```typescript
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'iconOnly';

// iconOnly accepts `icon: SymbolViewProps['name']` instead of title.

const variantStyles: Record<ButtonVariant, { container: string; text: string; pressed: string; spinnerColor: string }> = {
  primary:     { container: 'bg-brand rounded-button h-11 px-6 justify-center',      text: 'text-white text-body font-semibold text-center',          pressed: 'bg-brand-pressed',   spinnerColor: '#FFFFFF' },
  secondary:   { container: 'bg-surface border border-border rounded-button h-11 px-6 justify-center', text: 'text-text-primary text-body font-semibold text-center', pressed: 'bg-surface-subtle', spinnerColor: colors.textPrimary },
  ghost:       { container: 'rounded-button h-11 px-6 bg-transparent justify-center', text: 'text-brand text-body font-semibold text-center',        pressed: 'bg-brand/10',         spinnerColor: colors.brand },
  destructive: { container: 'bg-destructive rounded-button h-11 px-6 justify-center', text: 'text-white text-body font-semibold text-center',         pressed: 'opacity-80',          spinnerColor: '#FFFFFF' },
  iconOnly:    { container: 'rounded-button h-11 w-11 bg-transparent items-center justify-center', text: '',                                        pressed: 'bg-surface-subtle',  spinnerColor: colors.textPrimary },
};
```

Key changes vs current (`apps/mobile/src/components/ui/Button.tsx`):
- `py-4 px-6` → `h-11 px-6 justify-center` (guarantees 44pt iOS tap target).
- `text-base` → `text-body` (token-driven).
- `bg-orange-500` / `bg-orange-600` / `text-orange-500` → `bg-brand` / `bg-brand-pressed` / `text-brand`.
- Hard-coded `#FFFFFF` / `#F97316` in `ActivityIndicator` → `colors.brand` / `colors.textPrimary` via token import.
- New `destructive` variant replaces ad-hoc `bg-red-500` + `bg-red-600` uses (grep shows several).
- New `iconOnly` variant is 44×44 square — supersedes the ad-hoc `actionBtn` pattern in `collapsingHeaderStyles` (lines 85–98).

### Pattern 5: Chip component (two families, one file)

**Replaces `src/components/ui/ChipToggle.tsx` + every ad-hoc chip.**

```typescript
type ChipKind = 'filter' | 'display';
interface ChipProps {
  label: string;
  kind: ChipKind;
  selected?: boolean;            // filter only
  onPress?: () => void;          // filter only
  tone?: 'default' | 'success' | 'warning' | 'destructive';  // display only — e.g. day-card status
  leadingIcon?: SymbolViewProps['name'];
}
```

Filter styles:
- Inactive: `bg-surface border border-border px-3 h-8 rounded-pill` + `text-caption text-text-primary`.
- Active: `bg-brand px-3 h-8 rounded-pill` + `text-caption text-white font-semibold`.

Display styles:
- Default: `bg-surface-subtle px-3 h-8 rounded-pill` + `text-caption text-text-secondary`.
- Tonal: background swaps to `bg-success/15`, `bg-warning/15`, `bg-destructive/15` + matching text color.

### Pattern 6: Shared `ItemRow` component (Shopping + Pantry)

**New file: `src/components/ui/ItemRow.tsx`.** Replaces the current `ShoppingItemRow.tsx` interior and `PantryItemCard.tsx` interior with a shared primitive; call sites retain any flow-specific outer behavior (Swipeable wrappers, BulkImportSheet triggers).

```typescript
interface ItemRowProps {
  leading:
    | { kind: 'checkbox'; checked: boolean; onToggle: () => void }          // shopping
    | { kind: 'stepper'; quantity: number; unit: string | null; onInc: () => void; onDec: () => void }  // pantry
    | { kind: 'icon'; name: SymbolViewProps['name']; tint?: string };       // generic
  title: string;
  subtitle?: string;
  trailingChip?: { label: string; tone: 'default' | 'warning' | 'destructive' };
  onPress?: () => void;
  onLongPress?: () => void;
  struck?: boolean;              // shopping checked state
}
```

**Why single primitive:** Shopping strike-through + pantry staleness are both "row with leading affordance, title, optional trailing signal". Mirroring the two creates visual consistency for free.

### Anti-Patterns to Avoid

- **Hardcoded hex in components.** Any `#F97316`, `#FAF7F2`, `#1A140F` after this phase is a bug. Rule enforced by a grep test (see Validation Architecture).
- **Mixing `orange-*` classes with `brand`.** Don't theme in two steps — one sweep, one PR boundary. CONTEXT: "one-pass token swap."
- **Inline StyleSheet.create for typography.** `useCollapsingHeader.ts` currently does this (`fontSize: 34, fontWeight: '900'` etc.). Port those to `typography` tokens.
- **Icon sizes not tied to text tokens.** Don't write `size={20}` next to `text-caption`. Use `iconPropsForText('caption')`.
- **`@shopify/restyle` or parallel styling systems.** Rejected by CONTEXT.
- **Dark mode media query in :root right now.** Tokens structured for dark mode, but leaving the `@media (prefers-color-scheme: dark)` block commented out prevents accidental dark-mode surprises when a tester has system dark mode on.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token provider / theme context | Custom ThemeProvider + useTheme hook | NativeWind CSS variables — they ARE the runtime theming story in v4 | NativeWind compiles className to StyleSheet.create with CSS-var lookups. Parallel ThemeProvider duplicates the runtime, costs re-renders, and confuses the compile-time class model. |
| Icon sizing to Dynamic Type | Reach into native UIKit via custom module | Explicit `iconSize` scale tied to `typography` tokens | expo-symbols does not expose the SwiftUI Dynamic Type binding; custom modules are out of scope. |
| Sticky header with scroll-driven elevation | Yet another scroll-listener hook | Reuse `useCollapsingHeader`'s `scrollY` via `Animated.interpolate` | One scroll listener for the tab = smooth. Two listeners = jank. |
| Segmented control | Install `@react-native-segmented-control` | Keep current inline Pressable pair in kitchen.tsx; reskin against tokens | Phase 12 research explicitly rejected this for dev-client rebuild cost. Still applies. |
| Color-contrast / accessibility | Custom contrast calculator | None — accept the palette curated here. Manual AA check in UAT. | Scope creep. CONTEXT does not list WCAG as a requirement. |
| FAB fancy animation | Reanimated spring + scale tween | **Default: retint current FAB to terracotta, do nothing else.** CONTEXT allows Claude to propose evolution, but default is swap. | Don't rebuild the FAB in this phase. |

**Key insight:** the Phase 19 "design system" is 90% tokens + 10% component rewrites. Anything that looks like "build a theming framework" is almost certainly wrong.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — design tokens are compile-time constants; no user data embeds orange hex. Verified by grep: `orange\|#F97316` across `packages/server/` yields **zero** matches. | No data migration. |
| Live service config | **None** — no external service references the brand color. No Supabase row storing hex. | None. |
| OS-registered state | **None** — no app icon / splash changes in this phase (explicitly deferred). | None. |
| Secrets/env vars | **None** — zero color references in env vars. | None. |
| Build artifacts / installed packages | Metro Babel cache may hold old Tailwind-compiled classnames. `.expo/` dir may cache old class lookups. | **Run `rm -rf .expo && npx expo start --dev-client --lan --clear`** after token swap — per CLAUDE.md "Dev Environment Startup" section, EXPO_PUBLIC_* inlining ALSO applies to NativeWind class compilation. Add to wave checklist. |

**The canonical question — "After every file in the repo is updated, what runtime systems still have the old string cached?":** Metro's dep graph. Fix: documented `--clear` step in the wave checklist.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| NativeWind v4 | Tokens, everything visual | ✓ | 4.2.3 | — |
| tailwindcss 3 | Compiler | ✓ | 3.4.19 | — |
| expo-symbols | Icon-only button variant | ✓ | 55.0.7 | — |
| expo-glass-effect | Optional premium surfaces | ✓ | 55.0.10 | — |
| Xcode / iOS Simulator 26.4 | UAT | ✓ | Per CLAUDE.md | — |
| Maestro | UAT flow update | ✓ | 2.4.0 per CLAUDE.md | — |
| `global.css` + `metro.config.js` wiring | Token pipeline | ✓ | `withNativeWind({ input: './src/global.css' })` — confirmed in `apps/mobile/metro.config.js` | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Common Pitfalls

### Pitfall 1: RGB channel syntax vs hex in CSS variables

**What goes wrong:** `--color-brand: #C65D3A` looks fine but breaks `bg-brand/20` opacity.
**Why:** Tailwind's `<alpha-value>` placeholder only works with space-separated RGB channels, not hex. `rgb(var(--color-brand) / <alpha-value>)` expands to `rgb(198 93 58 / 0.2)`. `rgb(var(#C65D3A) / 0.2)` is garbage.
**How to avoid:** All CSS variables use `R G B` space-separated channels. Document at top of global.css.
**Warning signs:** `bg-brand/15` renders as fully opaque; Tailwind warning in Metro logs.

### Pitfall 2: Metro cache eats token changes

**What goes wrong:** Shipped a token change; simulator still shows old colors.
**Why:** NativeWind 4 compiles CSS vars + className to StyleSheet.create at bundle time. Running Metro won't pick up global.css changes. Same mechanic as `EXPO_PUBLIC_*` env vars (CLAUDE.md gotcha).
**How to avoid:** `rm -rf .expo && npx expo start --dev-client --lan --clear` after every global.css or tailwind.config.js edit. Add this to the Wave 0 completion checklist.
**Warning signs:** Tokens look right in source but wrong on screen; `background-color` on inspected view is the old hex.

### Pitfall 3: Typed tokens drift from CSS variables

**What goes wrong:** Someone edits `global.css` to tweak `--color-brand` but forgets `src/design/tokens.ts`. Tab bar tint and buttons now look different.
**Why:** Two sources of truth. CSS vars drive className-styled components; tokens.ts drives navigator options + ActivityIndicator.
**How to avoid:** Unit test (vitest) parses `global.css`, asserts every `--color-*` variable has a matching `colors.*` entry with equal hex value. Cheap guard, catches drift on CI. (See Validation Architecture.)
**Warning signs:** Tab bar active tint doesn't match button primary background on the same screen.

### Pitfall 4: Sticky pill z-order under native modal

**What goes wrong:** Tapping the pill opens `/search` modal; on dismiss, the pill briefly appears above the modal dismiss animation.
**Why:** `zIndex: 20+` on the pill is an RN style, not a window-level z-order. Modal presentation is window-level and should cover it — but edge-case on animated transitions.
**How to avoid:** Use `presentation: 'modal'` (not `presentation: 'transparentModal'`) so the modal fully owns the screen. Test on physical device — iOS Simulator is sometimes forgiving where real hardware isn't.
**Warning signs:** Brief flash of pill above modal on dismiss.

### Pitfall 5: Maestro regex text selectors break on placeholder changes

**What goes wrong:** Maestro flow asserts `".*Search recipes.*"` — then Phase 19 changes SearchBar placeholder to "Find a recipe" and flows go red.
**Why:** Maestro text matchers run on whatever placeholder/accessibilityLabel is rendered. Visual phases inevitably rename strings.
**How to avoid:** Every text-literal Maestro assertion the phase touches gets a re-audit. Prefer stable accessibilityLabels over placeholder text where possible. See flow 20-kitchen-segment-toggle.yaml, 18-recipe-search-favorite.yaml, 08-home-suggestions.yaml — these are the three most at-risk.
**Warning signs:** Maestro suite goes from 20/21 green to 12/21 after design sweep. Mitigation: include Maestro-flow-update task in the final sweep wave.

### Pitfall 6: NativeWind v4 doesn't support `className` on react-navigation components

**What goes wrong:** `<Tabs screenOptions={{ tabBarStyle: { className: 'bg-bg' } }}>` — doesn't work. React Navigation doesn't accept className.
**Why:** NativeWind's `cssInterop` is what translates className → style; native navigators don't call it on their options objects.
**How to avoid:** Use `tokens.ts` imports for all react-navigation options. Don't even try className in `_layout.tsx`. Pattern already documented above.
**Warning signs:** Tab bar background stays `#FFFBF5` after global.css changes; inspected style shows the literal `#FFFBF5` hex from current code.

### Pitfall 7: `text-brand` doesn't exist on the primary spinner

**What goes wrong:** `<ActivityIndicator color="text-brand" />` — does nothing. ActivityIndicator accepts a hex string.
**Why:** `color` is a native prop, not a className.
**How to avoid:** `<ActivityIndicator color={colors.brand} />` — import from `tokens.ts`. Documented in the rewritten Button snippet.

## Code Examples

### Adding a new semantic color
```css
/* src/global.css */
:root {
  --color-accent: 245 158 11;   /* amber-500 */
}
```
```javascript
// apps/mobile/tailwind.config.js
colors: {
  accent: 'rgb(var(--color-accent) / <alpha-value>)',
}
```
```typescript
// src/design/tokens.ts
export const colors = { ...existing, accent: '#F59E0B' };
```
Test on both `bg-accent` className and `<ActivityIndicator color={colors.accent} />`.

### Rewriting Button.tsx variant
```typescript
// BEFORE (existing)
<Pressable className="bg-orange-500 rounded-xl py-4 px-6">
  <Text className="text-white text-base font-semibold text-center">{title}</Text>
</Pressable>

// AFTER
<Pressable className="bg-brand rounded-button h-11 px-6 justify-center">
  <Text className="text-white text-body font-semibold text-center">{title}</Text>
</Pressable>
```

### Tab bar active tint migration
```typescript
// BEFORE
<Tabs screenOptions={{ tabBarActiveTintColor: '#F97316', ... }} />

// AFTER
import { colors } from '../../design/tokens';
<Tabs screenOptions={{ tabBarActiveTintColor: colors.brand, ... }} />
```

### Sticky pill mount point
```typescript
// apps/mobile/src/app/(tabs)/kitchen.tsx - Library segment
const { scrollY, onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity } = useCollapsingHeader();

return (
  <View className="flex-1 bg-bg">
    <Animated.FlatList onScroll={onScroll} ... />

    {/* large title + compact header as before */}

    {/* NEW: sticky pill above everything */}
    <StickySearchPill
      placeholder="Search recipes"
      scrollY={scrollY}
    />
  </View>
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw hex + `bg-orange-500` in components | CSS variables + semantic token classes | NativeWind 4 (2023+), standard by 2025 | Enables dark mode with zero component edits |
| JS-configured Tailwind theme with fixed hex | CSS-first `@theme` directive (Tailwind v4) | Tailwind v4 (2024) | **Do NOT adopt in this phase** — NativeWind 4.2 targets Tailwind v3 |
| Ionicons | SF Symbols (iOS) | Phase 15 (already locked) | Higher polish, free Dynamic Type |
| Custom header component per screen | Native stack header (expo-router) | Phase 15 | One-line header config per screen |
| Inline StyleSheet.create for typography | `fontSize` token in tailwind.config.js theme.extend | NativeWind 4 | `text-title` beats `fontSize: 22` for consistency |

**Deprecated / outdated for this project:**
- `ChipToggle.tsx` with `colorScheme='orange'|'red'` prop — replaced by `Chip` with `kind: 'filter' \| 'display'` + `tone`.
- `Button` 3-variant API — replaced by 5-variant.
- `SearchBar` in `components/recipes/` — promoted to `components/ui/SearchBar.tsx` as sticky-pill.

## Open Questions

1. **Exact hex values for semantic colors (success/warning/destructive/info/text scale shades/warm-gray borders)**
   - What we know: CONTEXT explicitly defers to Claude's Discretion.
   - What's unclear: Whether to derive from warmGray-* (project continuity) or pick fresh. Suggested values in Pattern 1 use current warmGray + terracotta — should validate in planning.
   - Recommendation: Start with suggested values in Pattern 1; adjust in UAT if any feel off. Don't overthink — tokens are trivially changeable.

2. **SF Pro Rounded for numerics**
   - What we know: CONTEXT says Claude's Discretion.
   - What's unclear: Whether timer/servings/cook-count surfaces in current code are numerous enough to benefit.
   - Recommendation: **Skip in Phase 19.** Reconsider if UAT feedback explicitly flags numerics as looking flat. Adding `--font-rounded` ships in ~5 LOC later.

3. **FAB evolution vs retint**
   - What we know: Default = retint. Two FABs: ImportFab (Library), RegenerateFab (Suggestions), ScanButton variant (Pantry — see grep).
   - What's unclear: Whether the RegenerateFab ("sparkles") still makes sense after Phase 17 replaces Suggestions with "Something New."
   - Recommendation: **Retint all three in Phase 19.** Phase 17 will own RegenerateFab's fate. Don't couple to Phase 17's open design.

4. **Phase 15 sequencing**
   - What we know: Phase 15 has CONTEXT.md but NO plans executed. EXECUTION-PLAN groups 15+19 as Block A with one UAT gate.
   - What's unclear: Order of operations within Block A — does Phase 15 land all plans first, then Phase 19? Or can Phase 19 research assume Phase 15's deliverables (SF Symbols migration, native stack headers, emoji→FOOD_IMAGES) and build on them in parallel?
   - Recommendation: **Phase 15 MUST complete first.** Phase 19's Button component references SF Symbols (icon-only variant). Phase 19's card rewrites assume emoji→image swaps are done. Running in parallel creates merge-conflict churn and double-touch on every screen. **Plan Phase 15 first; plan Phase 19 only after Phase 15 execution is complete or plans are locked.** Flag this to orchestrator.

5. **Sticky pill expand model — modal route vs inline**
   - What we know: CONTEXT says "tap expands to a focused search modal/screen with keyboard."
   - What's unclear: Modal route vs inline animated expansion.
   - Recommendation: **Modal route.** Matches Phase 15 modal=task convention. Phase 17 will build the full search surface inside that modal. Makes Phase 17 work easier.

## Environment Availability

Already covered above under Environment Availability. No missing deps.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ~4.1.4 (mobile — `apps/mobile/vitest.config.ts`), vitest (server — `packages/server/vitest.config.ts`) |
| Config file | `apps/mobile/vitest.config.ts` — environment `node`, excludes `src/components/**` (native-coupled) |
| Quick run command | `cd apps/mobile && pnpm test <pattern>` |
| Full suite command | `cd apps/mobile && pnpm test` (mobile) + `cd packages/server && pnpm test` (server, untouched by this phase) |
| Maestro UAT | Maestro 2.4.0 on iOS Simulator — `cd apps/mobile && maestro test .maestro/<flow>.yaml` |
| Phase gate | Mobile vitest green + all 21 Maestro flows green |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| D-01 (icons) | SF Symbol size helper returns expected sizes per type-scale step | unit | `pnpm test src/design/icons.test.ts` | Wave 0 |
| D-02 (buttons) | Button renders each variant with correct tokenized container/text classes; 44pt height guaranteed | unit | `pnpm test src/components/ui/Button.test.tsx` | Wave 0 — **new**; excluded in vitest.config (`src/components/**`) needs exception or a node-pure snapshot test against generated className string |
| D-02 (buttons) | Button loading state shows ActivityIndicator with variant-correct color | unit | same file | Wave 0 |
| D-03 (search) | StickySearchPill dispatches `router.push('/search?context=...')` on tap | unit | `pnpm test src/components/ui/SearchBar.test.ts` | Wave 0 |
| D-03 (search) | Sticky pill shadow opacity interpolates correctly from scrollY | unit | same file | Wave 0 |
| D-05 (chips) | Chip renders `filter` kind with active/inactive token classes | unit | `pnpm test src/components/ui/Chip.test.ts` | Wave 0 |
| D-05 (chips) | Chip renders `display` kind with each `tone` token class | unit | same file | Wave 0 |
| D-06 (palette) | **Token parity test**: every `--color-*` variable in `global.css` has a matching key in `tokens.ts colors` with equal hex value | unit | `pnpm test src/design/tokens.test.ts` | Wave 0 — **critical**, prevents Pitfall 3 |
| D-06 (palette) | **No raw orange grep**: `#F97316` and `orange-(50\|100\|200\|300\|400\|500\|600\|700)` do not appear in `src/**/*.{ts,tsx}` after migration | unit | `pnpm test src/design/tokens-purity.test.ts` | Wave 0 — simple fs.readdir + regex |
| D-07 (typography) | Every `typography` token has fontSize, lineHeight, fontWeight; ratios match target | unit | `pnpm test src/design/tokens.test.ts` | Wave 0 |
| D-01/D-02 visual | Button primary renders in terracotta on screen | Maestro | `maestro test .maestro/<new>-buttons-visual.yaml` + takeScreenshot | Wave 3 |
| D-03 visual | Sticky pill appears on Kitchen/Library + expands to modal on tap | Maestro | **update** `.maestro/20-kitchen-segment-toggle.yaml` + `18-recipe-search-favorite.yaml` | Wave 3 |
| D-04 visual | Headers consistent across pushed screens — covered by Phase 15 UAT gate | Maestro | existing flows, no change | — |
| D-06 visual | Tab bar active tint is terracotta on every tab | Maestro | `.maestro/20-kitchen-segment-toggle.yaml` screenshot asserts visually | Wave 3 |
| D-02 a11y | Every button variant rendered with accessibilityRole='button' and tap target ≥ 44pt | Maestro | screenshot + manual verification in UAT | Wave 3 |

### Sampling Rate

- **Per task commit:** `pnpm test src/design/tokens.test.ts src/design/tokens-purity.test.ts` — fast, < 2s, guards the two most-likely-to-drift invariants.
- **Per wave merge:** full `pnpm test` in `apps/mobile/` + `packages/server/`. Mobile suite is small (one existing store test); server untouched so should stay fully green.
- **Phase gate:** Maestro full suite on iOS Simulator. Script: `apps/mobile/.maestro/scripts/uat.sh all`. Human visual approval on every updated screenshot.

### Wave 0 Gaps

- [ ] `src/design/tokens.ts` — typed token export (new file; ~40 LOC)
- [ ] `src/design/icons.ts` — SF Symbol size helper (new file; ~20 LOC)
- [ ] `src/design/tokens.test.ts` — token parity test (new file; **prevents Pitfall 3**)
- [ ] `src/design/tokens-purity.test.ts` — grep test for raw orange and hex in components (new file; enforces token discipline)
- [ ] `src/design/icons.test.ts` — unit test for iconPropsForText (new file)
- [ ] `src/components/ui/Button.test.tsx` — variant rendering + loading spinner color
- [ ] `src/components/ui/Chip.test.ts` — kind + tone matrix
- [ ] `src/components/ui/SearchBar.test.ts` — router.push dispatch + shadowOpacity interp
- [ ] **vitest.config.ts edit** — `src/components/**` is currently excluded; either narrow the exclusion to `src/components/**.native.test.*` or mark new component tests `*.test.ts` (node pure, no RNTL) to stay inside the exclusion. **Recommended: write token-level tests that assert the className strings returned by a pure `variantStyles` export — no renderer needed.**
- [ ] **Maestro flow updates** — 20-kitchen-segment-toggle.yaml, 18-recipe-search-favorite.yaml, 08-home-suggestions.yaml, plus any flow asserting on orange-specific UI screenshots. At least re-take baseline screenshots after merge.

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement:** Every file edit goes through a GSD command. This research itself must be followed by `/gsd:plan-phase 19` (not direct edits).
- **NativeWind mandate:** All styling is NativeWind. No StyleSheet.create except where RN unavoidable (animated styles, navigator options).
- **Maestro UAT discipline:** No UI feature is "done" without Maestro green on iOS Simulator. iPhone 17 Pro sim targeted; iOS 26.4 runtime.
- **Metro cache:** EXPO_PUBLIC_* and NativeWind class compilation are bundle-time. Clear cache with `rm -rf .expo && npx expo start --dev-client --lan --clear` after every token edit.
- **iPhone camera quality capped at 0.4** — unrelated to this phase but relevant if any new camera affordance ships.
- **Dev env startup:** Backend + Metro + tunnel must restart each session — no persistence. Simulator uses `localhost:3000`, iPhone needs Cloudflare tunnel.
- **Sim vs device:** Dev client bundle ID `com.dinnertime.app`. `SecureStore unavailable` on sim is expected. Server binds IPv6 by default.

## Sources

### Primary (HIGH confidence)
- [Expo Symbols SDK docs](https://docs.expo.dev/versions/latest/sdk/symbols/) — SymbolView props, weight/size/scale/tintColor API
- [NativeWind v4 announcement](https://www.nativewind.dev/blog/announcement-nativewind-v4) — CSS variable + design token pattern
- [NativeWind themes guide](https://www.nativewind.dev/docs/guides/themes) — theme token idioms for React Native
- Existing code audit — `apps/mobile/tailwind.config.js`, `src/components/ui/Button.tsx`, `src/components/ui/ChipToggle.tsx`, `src/components/ui/useCollapsingHeader.ts`, `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/kitchen.tsx`, `src/global.css`, `metro.config.js`, `babel.config.js`, `package.json`. HIGH confidence.
- Phase 12/14/15 CONTEXT.md + STATE.md decisions — HIGH confidence on upstream constraints.

### Secondary (MEDIUM confidence)
- [willcodefor.beer — NativeWind with design tokens and dark mode](https://willcodefor.beer/posts/rntw) — full pattern for RGB-channel CSS variables, `<alpha-value>` syntax. MEDIUM (blog post; verified against NativeWind official docs).
- [Rich Infante — Tailwind dark mode design tokens](https://www.richinfante.com/2024/10/21/tailwind-dark-mode-design-tokens-themes-css) — semantic token mapping via CSS vars. MEDIUM.
- [Mavik Labs — Design Tokens That Scale (Tailwind v4 + CSS Variables)](https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026/) — Tailwind v4 direction. Relevant for future, not adopted this phase.
- [Medium — System Theme Support with NativeWind v4 and React Native Reusables](https://medium.com/@rachelcantor/system-theme-support-with-nativewind-v4-and-react-native-reusables-08fed7ff4070) — dark mode wiring. MEDIUM.
- [Medium — Mastering Sticky Headers (Dynamic Overlay Pattern)](https://medium.com/@ovieiffieu2much/mastering-sticky-headers-in-react-native-the-dynamic-overlay-pattern-05bf8809b641) — sticky element + Animated interpolate. MEDIUM.
- [react-native-sfsymbols (birkir)](https://github.com/birkir/react-native-sfsymbols) — alternative SF Symbols lib (not adopted; expo-symbols preferred).

### Tertiary (LOW confidence, flagged for validation)
- DoorDash-specific sticky-pill pattern — no authoritative source found. Recommendation built from general sticky-search patterns + visual inspection deferred to UAT.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep is already installed; versions verified against package.json.
- Architecture (tokens, Button, Chip, ItemRow): HIGH — patterns are canonical NativeWind 4 + explicit CONTEXT decisions.
- Sticky-pill search interaction detail: MEDIUM — DoorDash specifics not documented publicly; synthesis from general patterns.
- Phase 15 sequencing: HIGH — confirmed Phase 15 has no plans landed; flagged as open question for orchestrator.
- Pitfalls: HIGH — Metro cache and token parity pitfalls are known-known in the codebase (Metro cache documented in CLAUDE.md, token parity is inherent to dual-source-of-truth).

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — NativeWind 4.2 and Expo 55 are stable; no imminent major version jumps expected in window).
