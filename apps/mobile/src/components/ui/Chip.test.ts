import { describe, it, expect } from 'vitest';
import { resolveChipClasses } from './chipStyles';

describe('resolveChipClasses', () => {
  it('filter inactive uses bg-surface + border-border + text-text-primary', () => {
    const r = resolveChipClasses({ kind: 'filter', selected: false });
    expect(r.container).toMatch(/bg-surface\b/);
    expect(r.container).toContain('border-border');
    expect(r.label).toContain('text-text-primary');
  });

  it('filter active uses bg-brand + white semibold label', () => {
    const r = resolveChipClasses({ kind: 'filter', selected: true });
    expect(r.container).toContain('bg-brand');
    expect(r.label).toContain('text-white');
    expect(r.label).toContain('font-semibold');
  });

  it('display default uses bg-surface-subtle + text-text-secondary', () => {
    const r = resolveChipClasses({ kind: 'display', tone: 'default' });
    expect(r.container).toContain('bg-surface-subtle');
    expect(r.label).toContain('text-text-secondary');
  });

  it('display defaults tone to "default" when omitted', () => {
    const r = resolveChipClasses({ kind: 'display' });
    expect(r.container).toContain('bg-surface-subtle');
    expect(r.label).toContain('text-text-secondary');
  });

  it.each(['success', 'warning', 'destructive'] as const)(
    'display tone %s uses bg-%s/15 + text-%s',
    (t) => {
      const r = resolveChipClasses({ kind: 'display', tone: t });
      expect(r.container).toContain(`bg-${t}/15`);
      expect(r.label).toContain(`text-${t}`);
    },
  );

  it('every result uses h-8 + rounded-pill + px-3 and text-caption', () => {
    const variants = [
      { kind: 'filter', selected: false },
      { kind: 'filter', selected: true },
      { kind: 'display', tone: 'default' },
      { kind: 'display', tone: 'success' },
      { kind: 'display', tone: 'warning' },
      { kind: 'display', tone: 'destructive' },
    ] as const;
    for (const v of variants) {
      const r = resolveChipClasses(v);
      expect(r.container, JSON.stringify(v)).toContain('h-8');
      expect(r.container, JSON.stringify(v)).toContain('rounded-pill');
      expect(r.container, JSON.stringify(v)).toContain('px-3');
      expect(r.label, JSON.stringify(v)).toContain('text-caption');
    }
  });

  it('no orange references anywhere', () => {
    const all = [
      { kind: 'filter', selected: false },
      { kind: 'filter', selected: true },
      { kind: 'display', tone: 'default' },
      { kind: 'display', tone: 'success' },
      { kind: 'display', tone: 'warning' },
      { kind: 'display', tone: 'destructive' },
    ] as const;
    for (const v of all) {
      const r = resolveChipClasses(v);
      expect(r.container + r.label).not.toMatch(/orange-\d+/);
      expect(r.container + r.label).not.toMatch(/#F97316/i);
    }
  });
});
