import { describe, it, expect } from 'vitest';
import { resolveCardClasses } from './recipeCardStyles';

describe('resolveCardClasses', () => {
  it('grid mode uses rounded-card + bg-surface', () => {
    const c = resolveCardClasses('grid');
    expect(c.container).toContain('rounded-card');
    expect(c.container).toContain('bg-surface');
  });

  it('grid mode uses 4:3 aspect', () => {
    expect(resolveCardClasses('grid').imageContainer).toContain('aspect-[4/3]');
  });

  it('grid mode body is NOT flex-row (stacked vertically)', () => {
    expect(resolveCardClasses('grid').container).not.toContain('flex-row');
  });

  it('list mode is flex-row with fixed square image', () => {
    const c = resolveCardClasses('list');
    expect(c.container).toContain('flex-row');
    expect(c.imageContainer).toMatch(/w-24 h-24|w-20 h-20/);
  });

  it('list mode body uses flex-1 to take remaining width', () => {
    expect(resolveCardClasses('list').body).toContain('flex-1');
  });

  it('grid title is text-title, list title is text-body', () => {
    expect(resolveCardClasses('grid').title).toContain('text-title');
    expect(resolveCardClasses('list').title).toContain('text-body');
  });

  it('both modes use bg-surface + rounded-card', () => {
    for (const m of ['grid', 'list'] as const) {
      const c = resolveCardClasses(m);
      expect(c.container).toContain('bg-surface');
      expect(c.container).toContain('rounded-card');
    }
  });

  it('no orange or hex references in any mode', () => {
    for (const m of ['grid', 'list'] as const) {
      const c = resolveCardClasses(m);
      for (const v of Object.values(c)) {
        expect(v).not.toMatch(/orange-\d+|#[0-9A-Fa-f]{6}/);
      }
    }
  });
});
