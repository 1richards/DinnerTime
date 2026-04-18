/** @type {import('tailwindcss').Config} */
// Phase 19 Wave 1 — design-token foundation.
//   - `colors` entries reference CSS variables defined in src/global.css via
//     rgb(var(--color-NAME) / <alpha-value>). Space-separated RGB channels in
//     global.css (NOT hex) are required for `<alpha-value>` opacity modifiers
//     (e.g., `bg-brand/15`). See 19-RESEARCH.md Pitfall 1.
//   - `warmWhite` + `warmGray` are PRESERVED for migration safety. Plan 19-05
//     owns their removal once every call site has been swept.
//   - Keep shape in sync with src/design/tokens.ts — tokens.test.ts text-parses
//     this file and will fail on drift.
//   - After editing this file, flush the Metro cache:
//       rm -rf apps/mobile/.expo && (cd apps/mobile && npx expo start --dev-client --lan --clear)
//     Expo inlines these at bundle time; a running Metro will not pick changes up.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // --- Phase 19 semantic tokens (backed by --color-* in global.css) ---
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

        // --- Legacy palette (preserved for migration safety; removed in Plan 19-05) ---
        warmWhite: '#FFFBF5',
        warmGray: {
          50: '#FAF7F2',
          100: '#F1EAE0',
          200: '#E5D9CA',
          300: '#D1BFA8',
          400: '#A89178',
          500: '#7A6651',
          600: '#5C4D3D',
          700: '#3F3429',
          800: '#2A221A',
          900: '#1A140F',
        },
      },
      fontSize: {
        // 5-step type scale — see 19-CONTEXT "Typography" decisions and
        // src/design/tokens.ts `typography` map (values must match exactly).
        display: ['34px', { lineHeight: '41px', fontWeight: '700', letterSpacing: '-0.8px' }],
        title: ['22px', { lineHeight: '28px', fontWeight: '600', letterSpacing: '-0.3px' }],
        body: ['17px', { lineHeight: '22px', fontWeight: '400' }],
        caption: ['13px', { lineHeight: '18px', fontWeight: '400' }],
        label: ['11px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.6px' }],
      },
      borderRadius: {
        button: '12px',
        card: '16px',
        chip: '16px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
};
