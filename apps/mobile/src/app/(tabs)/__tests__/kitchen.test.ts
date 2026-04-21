/**
 * Phase 17 Wave 0 (plan 17-00): Source-contract tests for kitchen.tsx.
 *
 * kitchen.tsx today renders:
 *   - Segment label "Suggestions" (line ~163)
 *   - accessibilityLabel="Suggestions segment" (line ~154)
 *   - <RegenerateFab /> JSX mount (line ~468)
 * Plan 17-03 rewires these per CONTEXT D-01 + D-06:
 *   - Label flips to "Something New" (cosmetic only — segment KEY stays
 *     'suggestions' for persisted-state continuity)
 *   - <RegenerateFab /> is removed from JSX; Regenerate + Clear History
 *     move into a HeaderEllipsis overflow menu on the Something New segment
 *
 * Source-contract (fs.readFileSync) — no RN renderer. Path computed via
 * `path.join(__dirname, '..', 'kitchen.tsx')` so the parenthesized (tabs)
 * directory doesn't break import-resolution.
 *
 * @see .planning/phases/17-.../17-CONTEXT.md D-01, D-06
 * @see .planning/phases/17-.../17-VALIDATION.md § Per-Task Verification Map
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'kitchen.tsx'),
  'utf8',
);

describe('kitchen.tsx source contract (Phase 17 Wave 0)', () => {
  it('P17-01: segment label reads "Something New" (JSX text)', () => {
    // Matches >Something New< in the JSX text slot or a string literal
    // passed to a SegmentedControl <Text> child.
    const hasLabel =
      SOURCE.includes('>Something New<') ||
      SOURCE.includes("'Something New'") ||
      SOURCE.includes('"Something New"');
    expect(hasLabel).toBe(true);
  });

  it('P17-01: no bare "Suggestions" label remains in the segment control (cosmetic rename complete)', () => {
    // The segmented control renders label text inside a <Text>. JSX currently:
    //   <Text ...>
    //     Suggestions
    //   </Text>
    // We forbid that JSX text child. Contextual mentions (comments, variable
    // names like SuggestionsHeader, useSuggestionsStore, the persisted
    // 'suggestions' key) remain fine — we only block the user-visible label.
    //
    // Pattern matches whitespace/newlines before the bare word and a
    // closing `</Text>` on the next non-whitespace run.
    expect(SOURCE).not.toMatch(/^\s+Suggestions\s*$/m);
  });

  it('P17-01: accessibilityLabel is "Something New segment"', () => {
    expect(SOURCE).toContain('accessibilityLabel="Something New segment"');
  });

  it('P17-06: RegenerateFab JSX mount is removed', () => {
    // JSX usage form (not a declaration / comment). We assert the JSX tag
    // is absent; the declaration itself may still exist as dead code until
    // a cleanup pass, but the visible behavior (floating sparkles FAB) must
    // be gone.
    expect(SOURCE).not.toMatch(/<RegenerateFab\s*\/?>/);
  });

  it('P17-06: HeaderEllipsis is mounted with Regenerate + Clear History actions', () => {
    expect(SOURCE).toContain('HeaderEllipsis');
    expect(SOURCE).toMatch(/Regenerate from pantry/);
    expect(SOURCE).toMatch(/Clear search history/);
  });

  it('P17-01 (D-01 lock): persisted Zustand segment key stays as "suggestions"', () => {
    // The label change is cosmetic. The gating logic must still check
    // segment === 'suggestions' — otherwise migration breaks for users with
    // persisted state pointing at the old key.
    expect(SOURCE).toMatch(/segment\s*===\s*['"]suggestions['"]/);
  });
});
