/**
 * Phase 17 Wave 0 (plan 17-00): Source-contract tests for the /search modal.
 *
 * search.tsx today is a placeholder (see file header). Plan 17-03 extends it
 * with a `context=something-new` branch that mounts a TextInput + pantry-only
 * Switch and dismisses the modal on submit.
 *
 * These are file-read assertions via `fs.readFileSync`, not react-native
 * renderer tests — they run under the node env without a `.native.test.*`
 * suffix. Precedent: recipeStore.persist.test.ts and other source-contract
 * tests in the repo.
 *
 * Red-by-design: current search.tsx contains none of the asserted strings.
 *
 * @see .planning/phases/17-.../17-CONTEXT.md D-02, D-04, D-09
 * @see .planning/phases/17-.../17-VALIDATION.md § Per-Task Verification Map
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'search.tsx'),
  'utf8',
);

describe('search.tsx source contract (Phase 17 Wave 0)', () => {
  it("P17-03: renders a 'something-new' context branch", () => {
    // Source must contain a branch that detects the something-new context.
    // Matches either `context === 'something-new'` or a switch-case literal.
    const hasBranch =
      SOURCE.includes("'something-new'") || SOURCE.includes('"something-new"');
    expect(hasBranch).toBe(true);
  });

  it('P17-03: mounts a TextInput with autoFocus for the search query', () => {
    expect(SOURCE).toContain('TextInput');
    expect(SOURCE).toMatch(/autoFocus/);
  });

  it('P17-04: mounts a pantry-only toggle (Switch or Pressable with pantryOnly state)', () => {
    // Accept either a Switch import (preferred) or the pantryOnly state name
    // wired to a Pressable — exact UI primitive is Claude's discretion per
    // CONTEXT. The requirement is that the toggle exists and is named.
    expect(SOURCE).toMatch(/pantryOnly/);
    const hasToggleAffordance =
      SOURCE.includes('Switch') || /Pressable[\s\S]*pantryOnly/.test(SOURCE);
    expect(hasToggleAffordance).toBe(true);
  });

  it('P17-03 + D-09: dismisses modal on submit (router.back after searchRecipes)', () => {
    expect(SOURCE).toContain('router.back()');
    expect(SOURCE).toMatch(/searchRecipes\s*\(/);
  });

  it('P17-03: preserves the legacy library/pantry placeholder for unimplemented contexts (Pitfall 6)', () => {
    // Any context other than 'something-new' should still render a fallback
    // — the current "Context: X" echo mode must not be deleted outright.
    // Substring check for either a fallback branch or the placeholder text.
    const hasFallback =
      SOURCE.includes('Context:') ||
      SOURCE.includes('Full search UI') ||
      /context\s*!==\s*['"]something-new['"]/.test(SOURCE) ||
      /default\s*:/.test(SOURCE);
    expect(hasFallback).toBe(true);
  });
});
