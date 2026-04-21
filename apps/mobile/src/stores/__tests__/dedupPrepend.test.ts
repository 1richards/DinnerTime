/**
 * Phase 17 Wave 0 (plan 17-00): Pure helper contract for `dedupPrepend`.
 *
 * Red-by-design. The module `../dedupPrepend` does not yet exist — Plan 17-02
 * creates it. The test fails at import resolution time.
 *
 * Why a separate module (rather than colocating inside suggestionsStore.ts):
 *   The helper is genuinely pure (no zustand coupling, no AsyncStorage) and we
 *   want a cheap unit test that runs without instantiating the store. This
 *   also keeps the store file from growing an untestable side-effect-free
 *   lambda.
 *
 * Behavior (locked by CONTEXT D-05):
 *   - Dedupe by exact string match, keep the most-recent occurrence.
 *   - Cap total length at `max` (default usage: 5).
 *   - Ignore empty / whitespace-only input queries (return list unchanged).
 *   - Trim surrounding whitespace on the incoming query.
 *
 * @see .planning/phases/17-.../17-CONTEXT.md D-05
 */
import { describe, it, expect } from 'vitest';

// @ts-expect-error Phase 17 Wave 0: module created in Plan 02
import { dedupPrepend } from '../dedupPrepend';

describe('dedupPrepend (Phase 17 Wave 0 — pure helper)', () => {
  it('P17-03: prepends new query to empty list', () => {
    expect(dedupPrepend('pasta', [], 5)).toEqual(['pasta']);
  });

  it('P17-03: dedupes duplicates by keeping most-recent', () => {
    expect(dedupPrepend('pasta', ['soup', 'pasta', 'salad'], 5)).toEqual([
      'pasta',
      'soup',
      'salad',
    ]);
  });

  it('P17-03: caps at max length (drops oldest)', () => {
    expect(dedupPrepend('new', ['a', 'b', 'c', 'd', 'e'], 5)).toEqual([
      'new',
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('P17-03: ignores empty query (returns list unchanged)', () => {
    expect(dedupPrepend('', ['a'], 5)).toEqual(['a']);
  });

  it('P17-03: ignores whitespace-only queries', () => {
    expect(dedupPrepend('   ', ['a'], 5)).toEqual(['a']);
  });

  it('P17-03: trims whitespace from the new query before deduping', () => {
    expect(dedupPrepend('  pasta  ', [], 5)).toEqual(['pasta']);
    // Trimmed "pasta" should still dedupe against an untrimmed existing "pasta"
    expect(dedupPrepend('  pasta  ', ['soup', 'pasta'], 5)).toEqual([
      'pasta',
      'soup',
    ]);
  });
});
