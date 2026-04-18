import { describe, it, expect } from 'vitest';
import { variantStyles } from './buttonStyles';
import { colors } from '../../design/tokens';

describe('Button variantStyles', () => {
  it('has all 5 variants (primary, secondary, ghost, destructive, iconOnly)', () => {
    expect(Object.keys(variantStyles).sort()).toEqual([
      'destructive',
      'ghost',
      'iconOnly',
      'primary',
      'secondary',
    ]);
  });

  it('every variant uses h-11 (44pt tap target)', () => {
    for (const [name, s] of Object.entries(variantStyles)) {
      expect(s.container, `${name} missing h-11`).toContain('h-11');
    }
  });

  it('primary uses bg-brand + text-white + bg-brand-pressed + rounded-button', () => {
    expect(variantStyles.primary.container).toContain('bg-brand');
    expect(variantStyles.primary.container).toContain('rounded-button');
    expect(variantStyles.primary.text).toContain('text-white');
    expect(variantStyles.primary.text).toContain('text-body');
    expect(variantStyles.primary.text).toContain('font-semibold');
    expect(variantStyles.primary.pressed).toContain('bg-brand-pressed');
  });

  it('secondary uses bg-surface + border + border-border', () => {
    expect(variantStyles.secondary.container).toMatch(/bg-surface\b/);
    expect(variantStyles.secondary.container).toContain('border-border');
    expect(variantStyles.secondary.container).toContain('border ');
  });

  it('ghost is transparent + text-brand', () => {
    expect(variantStyles.ghost.container).toContain('bg-transparent');
    expect(variantStyles.ghost.container).toContain('h-11');
    expect(variantStyles.ghost.text).toContain('text-brand');
  });

  it('destructive uses bg-destructive', () => {
    expect(variantStyles.destructive.container).toContain('bg-destructive');
    expect(variantStyles.destructive.text).toContain('text-white');
  });

  it('iconOnly is square (h-11 w-11) with bg-transparent and empty text', () => {
    expect(variantStyles.iconOnly.container).toContain('h-11');
    expect(variantStyles.iconOnly.container).toContain('w-11');
    expect(variantStyles.iconOnly.container).toContain('bg-transparent');
    expect(variantStyles.iconOnly.text).toBe('');
  });

  it('no variant references orange or #F97316', () => {
    for (const s of Object.values(variantStyles)) {
      for (const v of Object.values(s)) {
        if (typeof v !== 'string') continue;
        expect(v).not.toMatch(/orange-\d+/);
        expect(v).not.toMatch(/#F97316/i);
      }
    }
  });

  it('spinner colors are tokenized', () => {
    expect(variantStyles.primary.spinnerColor).toBe('#FFFFFF');
    expect(variantStyles.secondary.spinnerColor).toBe(colors.textPrimary);
    expect(variantStyles.ghost.spinnerColor).toBe(colors.brand);
    expect(variantStyles.destructive.spinnerColor).toBe('#FFFFFF');
    expect(variantStyles.iconOnly.spinnerColor).toBe(colors.textPrimary);
  });

  it('every variant has non-empty container, pressed, spinnerColor', () => {
    for (const [name, s] of Object.entries(variantStyles)) {
      expect(s.container, `${name}.container`).not.toBe('');
      expect(s.pressed, `${name}.pressed`).not.toBe('');
      expect(s.spinnerColor, `${name}.spinnerColor`).not.toBe('');
    }
  });
});
