import { describe, it, expect } from 'vitest';
import { deriveStatusChips } from './dayRowHelpers';

describe('deriveStatusChips matrix', () => {
  it('cooked alone -> [Cooked/success]', () => {
    const r = deriveStatusChips({ status: 'cooked' });
    expect(r).toEqual([
      { label: 'Cooked', tone: 'success', leadingIcon: 'checkmark.circle.fill' },
    ]);
  });

  it('planned alone -> []', () => {
    expect(deriveStatusChips({ status: 'planned' })).toEqual([]);
  });

  it('skipped alone -> [Skipped/default]', () => {
    expect(deriveStatusChips({ status: 'skipped' })).toEqual([
      { label: 'Skipped', tone: 'default' },
    ]);
  });

  it('unplanned alone -> []', () => {
    expect(deriveStatusChips({ status: 'unplanned' })).toEqual([]);
  });

  it('stretch flag layers on top of planned status', () => {
    const r = deriveStatusChips({ status: 'planned', isStretch: true });
    expect(r).toEqual([
      { label: 'Stretch', tone: 'warning', leadingIcon: 'sparkles' },
    ]);
  });

  it('pantry-ready flag layers on top of planned status', () => {
    const r = deriveStatusChips({ status: 'planned', pantryReady: true });
    expect(r).toEqual([{ label: 'Pantry ready', tone: 'default' }]);
  });

  it('cooked + stretch + pantry-ready -> three chips in order', () => {
    const r = deriveStatusChips({
      status: 'cooked',
      isStretch: true,
      pantryReady: true,
    });
    expect(r.map((c) => c.label)).toEqual(['Cooked', 'Stretch', 'Pantry ready']);
  });

  it('skipped + stretch (stretch still rendered — user flagged ambition)', () => {
    const r = deriveStatusChips({ status: 'skipped', isStretch: true });
    expect(r.map((c) => c.label)).toEqual(['Skipped', 'Stretch']);
  });

  it('every chip has a valid tone across the full matrix', () => {
    type Args = Parameters<typeof deriveStatusChips>[0];
    const allCombos: Args[] = [];
    for (const status of ['cooked', 'planned', 'skipped', 'unplanned'] as const) {
      for (const isStretch of [true, false]) {
        for (const pantryReady of [true, false]) {
          allCombos.push({ status, isStretch, pantryReady });
        }
      }
    }
    for (const args of allCombos) {
      for (const chip of deriveStatusChips(args)) {
        expect(['default', 'success', 'warning', 'destructive']).toContain(
          chip.tone,
        );
        expect(chip.label).toBeTruthy();
      }
    }
  });
});
