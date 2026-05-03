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

// Quick-task 6 — difficulty + matching-focus chip derivation.
// The matching-focus chip closes the loop between meal_plans.focus_theme
// (set via FocusPickerSheet) and per-entry practiced_skills (AI-tagged).
// The user FEELS the focus week-by-week when their day cards advertise
// "Pan sauces" alongside the matching-focus banner up top.
describe('deriveStatusChips: difficulty chip', () => {
  it('difficulty="easy" → chip { label: "Easy" }', () => {
    const r = deriveStatusChips({ status: 'planned', difficulty: 'easy' });
    expect(r.find((c) => c.label === 'Easy')).toBeDefined();
  });

  it('difficulty="medium" → chip { label: "Medium" }', () => {
    const r = deriveStatusChips({ status: 'planned', difficulty: 'medium' });
    expect(r.find((c) => c.label === 'Medium')).toBeDefined();
  });

  it('difficulty="hard" → chip { label: "Hard" } with warning tone', () => {
    const r = deriveStatusChips({ status: 'planned', difficulty: 'hard' });
    const chip = r.find((c) => c.label === 'Hard');
    expect(chip).toBeDefined();
    expect(chip!.tone).toBe('warning');
  });

  it('difficulty=null → NO difficulty chip (legacy rendering)', () => {
    const r = deriveStatusChips({ status: 'planned', difficulty: null });
    expect(r.find((c) => ['Easy', 'Medium', 'Hard'].includes(c.label))).toBeUndefined();
  });

  it('difficulty undefined → NO difficulty chip (legacy rendering)', () => {
    const r = deriveStatusChips({ status: 'planned' });
    expect(r.find((c) => ['Easy', 'Medium', 'Hard'].includes(c.label))).toBeUndefined();
  });
});

describe('deriveStatusChips: practiced-skills chips (quick-task 7)', () => {
  it('practiced_skills includes focus_theme → matching chip with warm tone', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['pan sauces'],
      focusTheme: 'pan sauces',
    });
    const chip = r.find((c) => c.label.toLowerCase() === 'pan sauces');
    expect(chip).toBeDefined();
    expect(chip!.tone).toBe('warning');
  });

  it('practiced_skills does NOT include focus_theme → 1 default chip "Pan sauces" (multi-chip rule renders ALL skills)', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['pan sauces'],
      focusTheme: 'knife skills',
    });
    const skill = r.find((c) => c.label.toLowerCase() === 'pan sauces');
    expect(skill).toBeDefined();
    expect(skill!.tone).toBe('default');
    // The non-matching focus theme is NOT itself rendered as a chip.
    expect(r.find((c) => c.label.toLowerCase() === 'knife skills')).toBeUndefined();
  });

  it('case-insensitive compare: practiced_skills="Pan Sauces", focus="pan sauces" → match', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['Pan Sauces'],
      focusTheme: 'pan sauces',
    });
    const chip = r.find((c) => c.label.toLowerCase() === 'pan sauces');
    expect(chip).toBeDefined();
    expect(chip!.tone).toBe('warning');
  });

  it('practiced_skills=null → no skill chips (array is null)', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: null,
      focusTheme: 'pan sauces',
    });
    // Only chips that could appear from other args; no skill chip from null array.
    expect(r.length).toBe(0);
  });

  it('practiced_skills=[] (empty) → no skill chips', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: [],
      focusTheme: 'pan sauces',
    });
    expect(r.length).toBe(0);
  });

  it('focus_theme=null → 1 default chip emitted from practiced_skills (no warning)', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['pan sauces'],
      focusTheme: null,
    });
    const chip = r.find((c) => c.label.toLowerCase() === 'pan sauces');
    expect(chip).toBeDefined();
    expect(chip!.tone).toBe('default');
  });

  it('multiple practiced_skills with focus match → matched chip in WARNING tone, others in DEFAULT tone', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['knife skills', 'pan sauces'],
      focusTheme: 'pan sauces',
    });
    const matched = r.find((c) => c.label.toLowerCase() === 'pan sauces');
    const other = r.find((c) => c.label.toLowerCase() === 'knife skills');
    expect(matched).toBeDefined();
    expect(matched!.tone).toBe('warning');
    expect(other).toBeDefined();
    expect(other!.tone).toBe('default');
  });

  it('whitespace-padded focus theme still matches (trim before compare)', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['pan sauces'],
      focusTheme: '  pan sauces  ',
    });
    const chip = r.find((c) => c.label.toLowerCase() === 'pan sauces');
    expect(chip).toBeDefined();
    expect(chip!.tone).toBe('warning');
  });

  // ---- Quick-task 7 — new multi-chip cases ----

  it('practicedSkills=["pan sauces"], no focusTheme arg at all → 1 default chip "Pan sauces"', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['pan sauces'],
    });
    const chip = r.find((c) => c.label.toLowerCase() === 'pan sauces');
    expect(chip).toBeDefined();
    expect(chip!.tone).toBe('default');
  });

  it('practicedSkills=["knife skills","pan sauces"], focusTheme="pan sauces" → matched chip FIRST, then others in source order', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['knife skills', 'pan sauces'],
      focusTheme: 'pan sauces',
    });
    const labels = r
      .map((c) => c.label)
      .filter((l) => ['Pan sauces', 'Knife skills'].includes(l));
    expect(labels).toEqual(['Pan sauces', 'Knife skills']);
  });

  it('practicedSkills=["knife skills","braising","pan sauces"], focusTheme=null → 3 default chips in source order', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['knife skills', 'braising', 'pan sauces'],
      focusTheme: null,
    });
    const skillChips = r.filter((c) =>
      ['Knife skills', 'Braising', 'Pan sauces'].includes(c.label),
    );
    expect(skillChips.map((c) => c.label)).toEqual([
      'Knife skills',
      'Braising',
      'Pan sauces',
    ]);
    for (const c of skillChips) {
      expect(c.tone).toBe('default');
    }
  });

  it('sentence-case label: "pan sauces" → "Pan sauces" (single capital, no shouting)', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['pan sauces'],
    });
    const chip = r.find((c) => c.label.toLowerCase() === 'pan sauces');
    expect(chip).toBeDefined();
    expect(chip!.label).toBe('Pan sauces');
  });

  it('all skill chips use leadingIcon "sparkles" (matched + default)', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['knife skills', 'pan sauces'],
      focusTheme: 'pan sauces',
    });
    const skillChips = r.filter((c) =>
      ['Pan sauces', 'Knife skills'].includes(c.label),
    );
    expect(skillChips.length).toBe(2);
    for (const c of skillChips) {
      expect(c.leadingIcon).toBe('sparkles');
    }
  });

  it('mixed-case practicedSkills entries normalize to sentence-case in label', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['Pan Sauces'],
      focusTheme: 'pan sauces',
    });
    const chip = r.find((c) => c.label.toLowerCase() === 'pan sauces');
    expect(chip).toBeDefined();
    // Mixed-case input "Pan Sauces" should still render "Pan sauces" (single capital).
    expect(chip!.label).toBe('Pan sauces');
  });
});

describe('deriveStatusChips: difficulty + focus combined', () => {
  it('difficulty + matching focus + planned → 2 chips (difficulty + matching)', () => {
    const r = deriveStatusChips({
      status: 'planned',
      difficulty: 'medium',
      practicedSkills: ['pan sauces'],
      focusTheme: 'pan sauces',
    });
    const labels = r.map((c) => c.label.toLowerCase());
    expect(labels).toContain('medium');
    expect(labels).toContain('pan sauces');
  });
});

describe('deriveStatusChips: health-chip dedup vs practiced_skills', () => {
  // The keyword-based health classifier emits "Veg-forward" when it
  // sees ≥3 vegetable hits. The AI-curated practiced_skills emits
  // "Plant-forward" for the same recipe. They mean the same thing —
  // drop the redundant health chip when both would fire.
  it('practicedSkills includes "plant-forward" → health "Veg-forward" suppressed', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['plant-forward'],
      entry: {
        title: 'Charred Broccoli with Lemon and Almonds',
        description:
          'Heaps of broccoli, kale, peppers, tomatoes, spinach, zucchini, mushrooms, garlic and olive oil.',
        ingredients: [
          { name: 'broccoli' },
          { name: 'kale' },
          { name: 'spinach' },
          { name: 'tomato' },
          { name: 'zucchini' },
          { name: 'mushroom' },
        ],
      },
    });
    const labels = r.map((c) => c.label);
    expect(labels).toContain('Plant-forward');
    expect(labels).not.toContain('Veg-forward');
  });

  it('practicedSkills does NOT include "plant-forward" → health "Veg-forward" still rendered when it would fire', () => {
    const r = deriveStatusChips({
      status: 'planned',
      practicedSkills: ['knife skills'],
      entry: {
        title: 'Charred Broccoli with Lemon and Almonds',
        description:
          'Heaps of broccoli, kale, peppers, tomatoes, spinach, zucchini, mushrooms, garlic and olive oil.',
        ingredients: [
          { name: 'broccoli' },
          { name: 'kale' },
          { name: 'spinach' },
          { name: 'tomato' },
          { name: 'zucchini' },
          { name: 'mushroom' },
        ],
      },
    });
    const labels = r.map((c) => c.label);
    expect(labels).toContain('Knife skills');
    expect(labels).toContain('Veg-forward');
  });
});
