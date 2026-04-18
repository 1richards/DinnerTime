import { describe, it, expect } from 'vitest';
import {
  resolveTitleClasses,
  resolveCheckboxBoxClasses,
  CONTAINER_CLASSES,
  STEPPER_BUTTON_CLASSES,
} from './itemRowHelpers';

describe('resolveTitleClasses', () => {
  it('shopping-unchecked / pantry-staple: no strike-through', () => {
    const cls = resolveTitleClasses({ struck: false });
    expect(cls).toBe('text-body text-text-primary');
    expect(cls).not.toMatch(/line-through/);
  });
  it('shopping-checked: adds line-through + opacity-50', () => {
    const cls = resolveTitleClasses({ struck: true });
    expect(cls).toContain('line-through');
    expect(cls).toContain('opacity-50');
  });
  it('no orange/hex literals', () => {
    for (const struck of [true, false]) {
      expect(resolveTitleClasses({ struck })).not.toMatch(/orange-\d+|#F97316/i);
    }
  });
});

describe('resolveCheckboxBoxClasses', () => {
  it('unchecked uses bg-surface + border-border', () => {
    const cls = resolveCheckboxBoxClasses({ checked: false });
    expect(cls).toContain('bg-surface');
    expect(cls).toContain('border-border');
    expect(cls).not.toContain('bg-brand');
  });
  it('checked uses bg-brand + border-brand', () => {
    const cls = resolveCheckboxBoxClasses({ checked: true });
    expect(cls).toContain('bg-brand');
    expect(cls).toContain('border-brand');
  });
  it('both states use 24pt box (w-6 h-6)', () => {
    for (const checked of [true, false]) {
      const cls = resolveCheckboxBoxClasses({ checked });
      expect(cls).toContain('w-6');
      expect(cls).toContain('h-6');
      expect(cls).toContain('rounded-button');
    }
  });
});

describe('CONTAINER_CLASSES + STEPPER_BUTTON_CLASSES constants', () => {
  it('container ensures 56pt min tap target + border separator', () => {
    expect(CONTAINER_CLASSES).toContain('min-h-[56px]');
    expect(CONTAINER_CLASSES).toContain('border-b');
    expect(CONTAINER_CLASSES).toContain('border-border-subtle');
  });
  it('stepper button uses 32pt + surface-subtle', () => {
    expect(STEPPER_BUTTON_CLASSES).toContain('w-8');
    expect(STEPPER_BUTTON_CLASSES).toContain('h-8');
    expect(STEPPER_BUTTON_CLASSES).toContain('bg-surface-subtle');
  });
  it('no orange/hex in any constant', () => {
    for (const c of [CONTAINER_CLASSES, STEPPER_BUTTON_CLASSES]) {
      expect(c).not.toMatch(/orange-\d+|#F97316/i);
    }
  });
});
