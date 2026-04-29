/**
 * Phase 17 Wave 0 (plan 17-00): Source-contract tests for discover.tsx.
 *
 * discover.tsx's PreviewSheet today renders a single bottom-bar action:
 *   <Button title="Save to Library" ... />
 * Plan 17-03 adds a second action: `<Button title="Remix" ... />` that opens
 * a RemixSheet with `kind: 'inline'` source. This binds inline variations to
 * discovery results (which have no recipe.id) without saving them first.
 *
 * Source-contract (fs.readFileSync) — these are JSX substring assertions.
 *
 * @see .planning/phases/17-.../17-CONTEXT.md D-03
 * @see apps/mobile/src/components/recipes/RemixSheet.tsx (RemixSource type)
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'discover.tsx'),
  'utf8',
);

describe('discover.tsx source contract (Phase 17 Wave 0)', () => {
  it('P17-05: PreviewSheet renders a Remix button in the bottom bar', () => {
    // Button.title prop with literal "Remix" string.
    expect(SOURCE).toMatch(/title=["']Remix["']/);
  });

  it('P17-05: tapping Remix opens a RemixSheet with inline source kind', () => {
    // RemixSheet JSX mount must exist.
    expect(SOURCE).toContain('<RemixSheet');
    // RemixSource.kind === 'inline' must be passed through (literal form is
    // what appears in source since the object is constructed inline).
    expect(SOURCE).toMatch(/kind:\s*['"]inline['"]/);
  });

  it('P17-05: PreviewSheet still renders a save action (default label "Save Recipe")', () => {
    // The default saveLabel was renamed from "Save to Library" → "Save Recipe"
    // when the bottom-bar layout flipped to Remix-left / Save-right.
    expect(SOURCE).toMatch(/saveLabel\s*=\s*['"]Save Recipe['"]/);
  });

  it('P17-09 (Pitfall 9): saveRecipe is called with source_type: "ai"', () => {
    // Existing behavior; this assertion acts as a regression guard while
    // Plan 17-03 adds the Remix path around it.
    expect(SOURCE).toMatch(/source_type:\s*['"]ai['"]/);
  });
});
