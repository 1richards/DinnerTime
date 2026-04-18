/**
 * Token purity guard — enforces Phase 19 CONTEXT rule:
 *   "Orange -> terracotta migration is a one-pass token swap. Do not leave
 *    mixed orange+terracotta states in the codebase at the end of the phase."
 *
 * STATUS: describe.skip in Plan 19-01.
 *   Plan 05's sweep is what drives this green. Flip `describe.skip` to
 *   `describe` after every #F97316 / orange-[0-9]+ has been replaced with a
 *   semantic brand/* class or colors.brand token.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      // Skip dirs we don't own, and skip design/ itself so the regex literals
      // in this test file can't trigger self-hits.
      if (
        name === 'node_modules' ||
        name === '.expo' ||
        name === 'ios' ||
        name === 'android' ||
        name === 'design'
      ) {
        continue;
      }
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

describe.skip('token purity (Plan 19-05 enables this)', () => {
  const srcRoot = join(__dirname, '..');
  const files = walk(srcRoot);
  const hexRegex = /#F97316/i;
  const classRegex = /\borange-(50|100|200|300|400|500|600|700|800|900)\b/;

  it('no raw #F97316 hex in src/**', () => {
    const offenders = files.filter((f) => hexRegex.test(readFileSync(f, 'utf-8')));
    expect(offenders).toEqual([]);
  });

  it('no orange-[0-9]+ Tailwind classes in src/**', () => {
    const offenders = files.filter((f) => classRegex.test(readFileSync(f, 'utf-8')));
    expect(offenders).toEqual([]);
  });
});
