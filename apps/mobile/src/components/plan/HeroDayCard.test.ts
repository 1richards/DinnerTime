/**
 * Quick-task 7 — HeroDayCard test suite.
 *
 * Mirrors SwipeableDayRow.test.ts: vitest-node tree-walk on the rendered
 * JSX. The Reanimated swipe gesture itself can't run under node, so we
 * exercise the same `renderRightActionsFor` helper from SwipeableDayRow
 * (re-used by HeroDayCard) directly to assert telemetry parity.
 *
 * The component IS rendered through findInTree — but expo-image,
 * SymbolIcon, ReanimatedSwipeable, and the recipe store are stubbed so
 * the render stays node-pure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

vi.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  default: ({ children }: { children: unknown }) => children,
}));

vi.mock('../ui/SymbolIcon', () => ({
  SymbolIcon: (props: unknown) => props,
}));

vi.mock('expo-image', () => ({
  Image: (_props: unknown) => null,
}));

// HeroImage internally renders Image + Views. The component itself works
// fine under the stubs above, so do NOT mock HeroImage (we want children
// + style structure visible to the tree walker).

vi.mock('../../hooks/useGeneratedRecipeImage', () => ({
  useGeneratedRecipeImage: () => ({ url: null, status: 'resolved' }),
}));

vi.mock('../../stores/recipeStore', () => ({
  useRecipeStore: <T,>(_sel: (s: { recipes: never[] }) => T): T => {
    return _sel({ recipes: [] });
  },
}));

const loggedEvents: Array<Record<string, unknown>> = [];
vi.mock('../../plan/telemetry', () => ({
  logPlanEvent: (e: Record<string, unknown>) => {
    loggedEvents.push(e);
  },
  sanitizePayload: (p: Record<string, unknown>) => p,
}));

import { HeroDayCard } from './HeroDayCard';
import { renderRightActionsFor } from './SwipeableDayRow';
import type { MealPlanEntry } from '../../types/mealPlan';

const mkEntry = (overrides: Partial<MealPlanEntry> = {}): MealPlanEntry => ({
  id: 'hero-entry',
  meal_plan_id: 'plan-h',
  day_of_week: 0,
  recipe_id: null,
  title: 'Lemon Pan-Sauce Chicken',
  description: 'A quick weeknight chicken with bright pan sauce.',
  ingredients: [],
  ingredients_needed: [],
  steps: [],
  prep_time_minutes: null,
  cook_time_minutes: null,
  servings: 4,
  estimated_time_minutes: 35,
  difficulty: 'medium',
  kid_friendly: false,
  why_suggested: null,
  status: 'planned',
  cooked_at: null,
  created_at: '2026-04-27T00:00:00Z',
  practiced_skills: ['pan sauces', 'knife skills'],
  skill_note: 'Practices fond → reduction → mounted butter.',
  ...overrides,
});

interface NodeProps {
  type?: unknown;
  props?: {
    children?: unknown;
    [key: string]: unknown;
  };
}

/**
 * Walk a JSX tree and collect every node. Function-component nodes are
 * invoked with their props to reveal their rendered subtree (mirrors the
 * pattern from SwipeableDayRow.test.ts).
 */
function walkTree(el: ReactElement | unknown): NodeProps[] {
  const out: NodeProps[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as NodeProps;
    out.push(n);
    if (typeof n.type === 'function' && n.props) {
      try {
        const rendered = (n.type as (p: unknown) => unknown)(n.props);
        if (rendered) {
          visit(rendered);
          return;
        }
      } catch {
        // fall through
      }
    }
    const children = n.props?.children;
    if (Array.isArray(children)) {
      for (const c of children) visit(c);
    } else if (children) {
      visit(children);
    }
  };
  visit(el);
  return out;
}

const collectTextStrings = (nodes: NodeProps[]): string[] => {
  const out: string[] = [];
  for (const n of nodes) {
    const t = n.type as { name?: string } | string | undefined;
    const isText =
      (typeof t === 'function' && (t as { name?: string }).name === 'Text') ||
      t === 'Text';
    if (isText && n.props && n.props.children) {
      const c = n.props.children;
      if (typeof c === 'string') out.push(c);
      else if (typeof c === 'number') out.push(String(c));
      else if (Array.isArray(c)) {
        for (const part of c) {
          if (typeof part === 'string') out.push(part);
          else if (typeof part === 'number') out.push(String(part));
        }
      }
    }
  }
  return out;
};

describe('HeroDayCard', () => {
  beforeEach(() => {
    loggedEvents.length = 0;
  });

  it('exports a function-component named HeroDayCard', () => {
    expect(typeof HeroDayCard).toBe('function');
    expect(HeroDayCard.name).toBe('HeroDayCard');
  });

  it('renders the entry title', () => {
    const el = HeroDayCard({
      entry: mkEntry(),
      dayLabel: 'MON',
      dateLabel: '4/27',
      focusTheme: 'pan sauces',
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const tree = walkTree(el);
    const texts = collectTextStrings(tree);
    expect(texts.some((s) => s.includes('Lemon Pan-Sauce Chicken'))).toBe(true);
  });

  it('renders day label + date label', () => {
    const el = HeroDayCard({
      entry: mkEntry(),
      dayLabel: 'MON',
      dateLabel: '4/27',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const tree = walkTree(el);
    const texts = collectTextStrings(tree).join('|');
    expect(texts).toMatch(/MON/);
    expect(texts).toMatch(/4\/27/);
  });

  it('renders ALL skill chips with matched chip in warning tone first when focusTheme matches', () => {
    const el = HeroDayCard({
      entry: mkEntry({
        practiced_skills: ['knife skills', 'pan sauces'],
      }),
      dayLabel: 'MON',
      focusTheme: 'pan sauces',
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const tree = walkTree(el);
    // Find Chip nodes (function-component .name === 'Chip').
    const chipNodes = tree.filter((n) => {
      const t = n.type as { name?: string } | undefined;
      return typeof t === 'function' && (t as { name?: string }).name === 'Chip';
    });
    const chipLabels = chipNodes.map((n) => (n.props as { label?: string }).label);
    // Both skill chips present.
    expect(chipLabels).toContain('Pan sauces');
    expect(chipLabels).toContain('Knife skills');
    // Matched chip first (before non-matched).
    const panIdx = chipLabels.indexOf('Pan sauces');
    const knifeIdx = chipLabels.indexOf('Knife skills');
    expect(panIdx).toBeLessThan(knifeIdx);
    // Pan sauces chip has warning tone; Knife skills has default.
    const panChip = chipNodes.find(
      (n) => (n.props as { label?: string }).label === 'Pan sauces',
    );
    const knifeChip = chipNodes.find(
      (n) => (n.props as { label?: string }).label === 'Knife skills',
    );
    expect((panChip?.props as { tone?: string })?.tone).toBe('warning');
    expect((knifeChip?.props as { tone?: string })?.tone).toBe('default');
  });

  it('renders difficulty chip when difficulty="medium"', () => {
    const el = HeroDayCard({
      entry: mkEntry({ difficulty: 'medium' }),
      dayLabel: 'MON',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const tree = walkTree(el);
    const chipNodes = tree.filter((n) => {
      const t = n.type as { name?: string } | undefined;
      return typeof t === 'function' && (t as { name?: string }).name === 'Chip';
    });
    const labels = chipNodes.map((n) => (n.props as { label?: string }).label);
    expect(labels).toContain('Medium');
  });

  it('renders time chip when estimated_time_minutes=35', () => {
    const el = HeroDayCard({
      entry: mkEntry({ estimated_time_minutes: 35 }),
      dayLabel: 'MON',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const tree = walkTree(el);
    const texts = collectTextStrings(tree).join('|');
    expect(texts).toMatch(/35\s*m/);
  });

  it('renders servings chip when servings=4', () => {
    const el = HeroDayCard({
      entry: mkEntry({ servings: 4 }),
      dayLabel: 'MON',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const tree = walkTree(el);
    const texts = collectTextStrings(tree).join('|');
    expect(texts).toMatch(/4\s*serv/i);
  });

  it('renders italic skill_note text when non-null', () => {
    const note = 'Practices fond → reduction → mounted butter.';
    const el = HeroDayCard({
      entry: mkEntry({ skill_note: note }),
      dayLabel: 'MON',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const tree = walkTree(el);
    const texts = collectTextStrings(tree);
    expect(texts.some((s) => s.includes('Practices fond'))).toBe(true);
  });

  it('omits skill_note when null', () => {
    const el = HeroDayCard({
      entry: mkEntry({ skill_note: null }),
      dayLabel: 'MON',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const tree = walkTree(el);
    const texts = collectTextStrings(tree);
    expect(texts.some((s) => s.includes('Practices fond'))).toBe(false);
  });

  it('tap on outer Pressable invokes onPress', () => {
    const onPress = vi.fn();
    const el = HeroDayCard({
      entry: mkEntry(),
      dayLabel: 'MON',
      focusTheme: null,
      onPress,
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const tree = walkTree(el);
    // Find the outer Pressable that owns the onPress handler.
    const pressables = tree.filter((n) => {
      const t = n.type as { name?: string } | undefined;
      return typeof t === 'function' && (t as { name?: string }).name === 'Pressable';
    });
    expect(pressables.length).toBeGreaterThanOrEqual(1);
    const onPressFn = (pressables[0]!.props as { onPress?: () => void }).onPress;
    expect(typeof onPressFn).toBe('function');
    onPressFn?.();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renderRightActionsFor wired with handlers — tapping each fires the matching parent handler + plan.swipe_action telemetry', () => {
    const entry = mkEntry();
    const onSwap = vi.fn();
    const onCook = vi.fn();
    const onSkip = vi.fn();
    // The hero card uses the SAME helper as SwipeableDayRow — invoke it
    // directly to verify telemetry + handler dispatch byte-for-byte.
    const actions = renderRightActionsFor({ entry, onSwap, onCook, onSkip });
    const tree = walkTree(actions);
    const pressables = tree.filter((n) => {
      const t = n.type as { name?: string } | undefined;
      return typeof t === 'function' && (t as { name?: string }).name === 'Pressable';
    });
    expect(pressables).toHaveLength(3);
    const labels = pressables.map(
      (p) => (p.props as { accessibilityLabel?: string }).accessibilityLabel,
    );
    expect(labels).toEqual(['Swap', 'Cooked', 'Clear']);

    // Fire each action. Each fire emits one plan.swipe_action telemetry event.
    (pressables[0]!.props as { onPress?: () => void }).onPress?.();
    expect(onSwap).toHaveBeenCalledTimes(1);
    (pressables[1]!.props as { onPress?: () => void }).onPress?.();
    expect(onCook).toHaveBeenCalledTimes(1);
    (pressables[2]!.props as { onPress?: () => void }).onPress?.();
    expect(onSkip).toHaveBeenCalledTimes(1);

    expect(loggedEvents).toHaveLength(3);
    expect(loggedEvents.every((e) => e.name === 'plan.swipe_action')).toBe(true);
    const variants = loggedEvents.map(
      (e) => (e.payload as { variant?: string }).variant,
    );
    expect(variants).toEqual(['swap', 'cook', 'skip']);
  });
});
