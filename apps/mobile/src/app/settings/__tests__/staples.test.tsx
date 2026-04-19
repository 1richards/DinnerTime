/**
 * Phase 21-05 — staples screen source-level contract coverage.
 *
 * The staples screen is hook-heavy (useState/useEffect) and cannot be invoked
 * as a plain function under vitest node env. Following the pattern from
 * PantryItemCard.test.tsx (21-04), we assert on the screen file's source text
 * to lock the load-bearing contract points (testIDs, store selectors).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(__dirname, '..', 'staples.tsx'), 'utf8');

describe('staples.tsx source-level contract', () => {
  it('wires add-staple-fab testID for Maestro coverage', () => {
    expect(src).toContain('testID="add-staple-fab"');
  });

  it('emits per-row remove testID scoped by canonical name', () => {
    // Pattern: testID={`staple-remove-${…}`}
    expect(src).toContain('staple-remove-');
  });

  it('reads stapleRows from the store (21-04 display projection)', () => {
    expect(src).toContain('stapleRows');
  });

  it('renders EmptyState with the "No staples yet" copy', () => {
    expect(src).toContain('No staples yet');
  });

  it('calls markStaple with the canonical id on pick', () => {
    expect(src).toContain('markStaple(row.id, row.canonical_name)');
  });

  it('delegates loading to the loadStaples store action on mount', () => {
    expect(src).toContain('loadStaples()');
  });
});
