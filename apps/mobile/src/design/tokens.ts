/**
 * Design tokens — typed hex/numeric mirror of the CSS variables declared in
 * apps/mobile/src/global.css.
 *
 * CONSUMERS:
 *   - NativeWind className users should NOT import from here — use the Tailwind
 *     classes (e.g., `bg-brand`, `text-title`) which resolve the same tokens at
 *     compile time via tailwind.config.js.
 *   - Non-className consumers (e.g., ActivityIndicator color prop, native tab
 *     bar tintColor, expo-router native header options, StyleSheet.create
 *     objects) import the typed values from here.
 *
 * PARITY:
 *   - Keep `colors` hex values IN SYNC with the `--color-*` RGB channels in
 *     src/global.css. `tokens.test.ts` enforces the invariant — drift will fail
 *     the suite.
 *   - `typography` shape must match the `fontSize` entries in
 *     tailwind.config.js.
 */

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
  display: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.3 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.6,
  },
} as const;

export type TypographyToken = keyof typeof typography;

/** 8pt grid — canonical steps for padding, gaps, section spacing. */
export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 } as const;

/** Corner radii. `pill` uses 9999 (RN treats this as fully rounded). */
export const radius = { button: 12, card: 16, chip: 16, pill: 9999 } as const;
