/**
 * Quick-task 10 — HeroDayCard test suite (post-swipe-replacement).
 *
 * Tree-walks the rendered JSX under vitest-node. Swipe-left has been
 * replaced with a floating 5-icon cluster (Swap / Cook Now / Remix /
 * Cooked / Clear). Each cluster Pressable must:
 *   - Fire its parent handler.
 *   - Call e.stopPropagation() so the card-level onPress does NOT fire.
 *
 * Mocks for ReanimatedSwipeable + plan/telemetry have been removed
 * because HeroDayCard no longer imports either (renderRightActionsFor
 * stays in SwipeableDayRow.tsx untouched).
 */

import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

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

import { HeroDayCard } from './HeroDayCard';
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

const findClusterPressables = (
  el: ReactElement,
): Array<{ label: string; node: NodeProps }> => {
  const tree = walkTree(el);
  const wanted = new Set(['Swap', 'Cook Now', 'Remix', 'Cooked', 'Clear']);
  const out: Array<{ label: string; node: NodeProps }> = [];
  for (const n of tree) {
    const t = n.type as { name?: string } | undefined;
    if (typeof t !== 'function' || (t as { name?: string }).name !== 'Pressable')
      continue;
    const label = (n.props as { accessibilityLabel?: string })
      .accessibilityLabel;
    if (label && wanted.has(label)) {
      out.push({ label, node: n });
    }
  }
  return out;
};

describe('HeroDayCard', () => {
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
      onCookNow: vi.fn(),
      onRemix: vi.fn(),
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
      onCookNow: vi.fn(),
      onRemix: vi.fn(),
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
      onCookNow: vi.fn(),
      onRemix: vi.fn(),
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

  it('renders difficulty in the meta strip when difficulty="medium" (chip suppressed)', () => {
    // Difficulty appears in the meta strip "Medium · 35m · 4 servings" rather
    // than as its own chip — the dedicated chip was suppressed in commit
    // a17fc8c to avoid duplicating what the meta strip already shows.
    const el = HeroDayCard({
      entry: mkEntry({ difficulty: 'medium' }),
      dayLabel: 'MON',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
      onCookNow: vi.fn(),
      onRemix: vi.fn(),
    });
    const tree = walkTree(el);
    const texts = collectTextStrings(tree).join('|');
    expect(texts).toMatch(/Medium/);
    // No Chip should carry 'Medium' as its label.
    const chipNodes = tree.filter((n) => {
      const t = n.type as { name?: string } | undefined;
      return typeof t === 'function' && (t as { name?: string }).name === 'Chip';
    });
    const chipLabels = chipNodes.map((n) => (n.props as { label?: string }).label);
    expect(chipLabels).not.toContain('Medium');
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
      onCookNow: vi.fn(),
      onRemix: vi.fn(),
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
      onCookNow: vi.fn(),
      onRemix: vi.fn(),
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
      onCookNow: vi.fn(),
      onRemix: vi.fn(),
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
      onCookNow: vi.fn(),
      onRemix: vi.fn(),
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
      onCookNow: vi.fn(),
      onRemix: vi.fn(),
    });
    const tree = walkTree(el);
    // Find the outer (card-body) Pressable that owns the onPress handler.
    // Cluster Pressables also live in the tree, so disambiguate by
    // accessibilityLabel — the outer one starts with the dayLabel.
    const pressables = tree.filter((n) => {
      const t = n.type as { name?: string } | undefined;
      return typeof t === 'function' && (t as { name?: string }).name === 'Pressable';
    });
    const outer = pressables.find((p) => {
      const label = (p.props as { accessibilityLabel?: string })
        .accessibilityLabel;
      return typeof label === 'string' && label.startsWith('MON');
    });
    expect(outer).toBeTruthy();
    const onPressFn = (outer!.props as { onPress?: () => void }).onPress;
    expect(typeof onPressFn).toBe('function');
    onPressFn?.();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // ── Cluster tests (Quick-10) ──────────────────────────────────────────

  it('renders 5 cluster Pressables: Swap / Cook Now / Remix / Cooked / Clear', () => {
    const el = HeroDayCard({
      entry: mkEntry({ recipe_id: 'rec-1' }),
      dayLabel: 'MON',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
      onCookNow: vi.fn(),
      onRemix: vi.fn(),
    });
    const cluster = findClusterPressables(el);
    const labels = cluster.map((c) => c.label);
    expect(labels).toEqual(
      expect.arrayContaining(['Swap', 'Cook Now', 'Remix', 'Cooked', 'Clear']),
    );
    expect(cluster).toHaveLength(5);
  });

  it('tapping each cluster Pressable fires its matching parent handler', () => {
    const onSwap = vi.fn();
    const onCookNow = vi.fn();
    const onRemix = vi.fn();
    const onCook = vi.fn();
    const onSkip = vi.fn();
    const el = HeroDayCard({
      entry: mkEntry({ recipe_id: 'rec-1' }),
      dayLabel: 'MON',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap,
      onCook,
      onSkip,
      onCookNow,
      onRemix,
    });
    const cluster = findClusterPressables(el);
    const byLabel: Record<string, NodeProps> = {};
    for (const c of cluster) byLabel[c.label] = c.node;

    const fire = (label: string) => {
      const fn = (byLabel[label]!.props as { onPress?: (e: unknown) => void })
        .onPress;
      fn?.({ stopPropagation: vi.fn() });
    };
    fire('Swap');
    expect(onSwap).toHaveBeenCalledTimes(1);
    fire('Cook Now');
    expect(onCookNow).toHaveBeenCalledTimes(1);
    fire('Remix');
    expect(onRemix).toHaveBeenCalledTimes(1);
    fire('Cooked');
    expect(onCook).toHaveBeenCalledTimes(1);
    fire('Clear');
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('each cluster Pressable calls e.stopPropagation() on its event arg', () => {
    const el = HeroDayCard({
      entry: mkEntry({ recipe_id: 'rec-1' }),
      dayLabel: 'MON',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
      onCookNow: vi.fn(),
      onRemix: vi.fn(),
    });
    const cluster = findClusterPressables(el);
    expect(cluster).toHaveLength(5);
    for (const c of cluster) {
      const stopPropagation = vi.fn();
      const fn = (c.node.props as { onPress?: (e: unknown) => void }).onPress;
      fn?.({ stopPropagation });
      expect(stopPropagation).toHaveBeenCalledTimes(1);
    }
  });

  it('Cook Now disabled (opacity 0.4, no-op) when entry.recipe_id is null', () => {
    const onCookNow = vi.fn();
    const el = HeroDayCard({
      entry: mkEntry({ recipe_id: null }),
      dayLabel: 'MON',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
      onCookNow,
      onRemix: vi.fn(),
    });
    const cluster = findClusterPressables(el);
    const cook = cluster.find((c) => c.label === 'Cook Now')!.node;
    expect(cook).toBeTruthy();
    // disabled prop reflects the lack of recipe_id.
    expect((cook.props as { disabled?: boolean }).disabled).toBe(true);
    // Style resolves an opacity 0.4 entry when invoked with the not-pressed
    // state (Pressable accepts a function-style style prop).
    const styleProp = (cook.props as {
      style?: unknown;
    }).style;
    let resolved: unknown = styleProp;
    if (typeof styleProp === 'function') {
      resolved = (styleProp as (s: { pressed: boolean }) => unknown)({
        pressed: false,
      });
    }
    const flat = Array.isArray(resolved) ? resolved.flat(Infinity) : [resolved];
    const hasOpacity04 = flat.some(
      (s) =>
        s &&
        typeof s === 'object' &&
        (s as { opacity?: number }).opacity === 0.4,
    );
    expect(hasOpacity04).toBe(true);
    // Tapping is a no-op (does not fire onCookNow) — covers both an
    // RN-honored `disabled` flag and the in-handler guard.
    const fn = (cook.props as { onPress?: (e: unknown) => void }).onPress;
    fn?.({ stopPropagation: vi.fn() });
    expect(onCookNow).not.toHaveBeenCalled();
  });

  it('Cook Now enabled and fires onCookNow when entry.recipe_id is set', () => {
    const onCookNow = vi.fn();
    const el = HeroDayCard({
      entry: mkEntry({ recipe_id: 'rec-42' }),
      dayLabel: 'MON',
      focusTheme: null,
      onPress: vi.fn(),
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
      onCookNow,
      onRemix: vi.fn(),
    });
    const cluster = findClusterPressables(el);
    const cook = cluster.find((c) => c.label === 'Cook Now')!.node;
    expect((cook.props as { disabled?: boolean }).disabled).toBe(false);
    const fn = (cook.props as { onPress?: (e: unknown) => void }).onPress;
    fn?.({ stopPropagation: vi.fn() });
    expect(onCookNow).toHaveBeenCalledTimes(1);
  });
});
