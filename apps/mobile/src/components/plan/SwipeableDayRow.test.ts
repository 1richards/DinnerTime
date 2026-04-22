/**
 * Phase 22-06 — SwipeableDayRow test suite.
 *
 * Strategy: the full swipe gesture lives in Reanimated + native gesture
 * handler code that cannot run under vitest-node. We therefore test the
 * contract at the render-prop boundary by calling the exported
 * `renderRightActionsFor` helper directly. Walk the JSX tree, find the
 * three action Pressables, exercise each `onPress`, and assert:
 *   (1) the correct parent handler fires,
 *   (2) the correct `plan.swipe_action` telemetry event is queued with
 *       `variant` ∈ 'swap' | 'cook' | 'skip'.
 *
 * This mirrors dayRowHelpers / HandoffSheet pattern — JSX-tree inspection
 * without a React renderer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

// ReanimatedSwipeable and SymbolIcon pull native code — stub them so the
// SwipeableDayRow module can import cleanly under node.
vi.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  default: ({ children }: { children: unknown }) => children,
}));

vi.mock('../ui/SymbolIcon', () => ({
  SymbolIcon: (props: unknown) => props,
}));

// Capture telemetry fire-and-forget events for assertion.
const loggedEvents: Array<Record<string, unknown>> = [];
vi.mock('../../plan/telemetry', () => ({
  logPlanEvent: (e: Record<string, unknown>) => {
    loggedEvents.push(e);
  },
  sanitizePayload: (p: Record<string, unknown>) => p,
}));

// Stub DayRow so the module graph is self-contained (DayRow itself pulls
// in expo-image + RemixSheet which we don't need for this test).
vi.mock('./DayRow', () => ({
  DayRow: (props: unknown) => props,
}));

import {
  SwipeableDayRow,
  renderRightActionsFor,
} from './SwipeableDayRow';
import type { MealPlanEntry } from '../../types/mealPlan';
import { colors } from '../../design/tokens';

const makeEntry = (): MealPlanEntry => ({
  id: 'entry-abc',
  meal_plan_id: 'plan-1',
  day_of_week: 2,
  recipe_id: null,
  title: 'Dinner',
  description: null,
  ingredients: [],
  ingredients_needed: [],
  estimated_time_minutes: 30,
  difficulty: 'easy',
  kid_friendly: true,
  why_suggested: null,
  status: 'planned',
  cooked_at: null,
  created_at: '2026-04-20T00:00:00Z',
});

interface PressableLike {
  props: {
    onPress?: () => void;
    accessibilityLabel?: string;
    testID?: string;
    style?: unknown;
  };
}

/**
 * Walk a JSX tree and collect every leaf node whose props carry an
 * `onPress` handler (i.e. the three action Pressables). When a node is a
 * function-component element, invoke it with its props to descend into the
 * body (this is why `Action` → its inner <Pressable> shows up in the
 * collection — without this step, `Action` would be a closed function
 * reference and its accessibilityLabel/style/onPress would be invisible).
 *
 * Order-preserving.
 */
function findPressables(el: ReactElement | unknown): PressableLike[] {
  const found: PressableLike[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as {
      type?: { name?: string } | Function | unknown;
      props?: { children?: unknown; onPress?: unknown };
    };
    const typeName =
      typeof n.type === 'function'
        ? (n.type as { name?: string }).name
        : undefined;

    // Leaf: the Pressable emitted by <Action>. The setup mocks Pressable as
    // `const Pressable = (_props) => null` so its `.name === 'Pressable'`.
    // Stop here and capture the props (accessibilityLabel, style, onPress).
    if (typeName === 'Pressable' && n.props) {
      found.push({ props: n.props as PressableLike['props'] });
      return;
    }
    // Intermediate: any OTHER function component — invoke with its props
    // to expand into the rendered sub-tree. This is how <Action> → <Pressable>
    // becomes visible to the walker.
    //
    // Host-mocked primitives (View, Text) in the vitest setup return `null`
    // from their stub bodies — when invocation returns no tree, fall through
    // to descending into the element's own `children` so the outer <View>
    // container doesn't swallow its child Actions.
    if (typeof n.type === 'function' && n.props) {
      try {
        const rendered = (n.type as (p: unknown) => unknown)(n.props);
        if (rendered) {
          visit(rendered);
          return;
        }
      } catch {
        // Component threw during render (unexpected) — fall through to
        // descend into children anyway.
      }
    }
    // Host element (string type) — descend into children.
    const children = n.props?.children;
    if (Array.isArray(children)) {
      for (const c of children) visit(c);
    } else if (children) {
      visit(children);
    }
  };
  visit(el);
  return found;
}

describe('SwipeableDayRow', () => {
  beforeEach(() => {
    loggedEvents.length = 0;
  });

  it('exports a function-component named SwipeableDayRow', () => {
    expect(typeof SwipeableDayRow).toBe('function');
    expect(SwipeableDayRow.name).toBe('SwipeableDayRow');
  });

  it('renderRightActionsFor returns 3 Pressables with Swap/Cooked/Skip labels', () => {
    const entry = makeEntry();
    const el = renderRightActionsFor({
      entry,
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const pressables = findPressables(el);
    expect(pressables).toHaveLength(3);
    const labels = pressables.map((p) => p.props.accessibilityLabel);
    expect(labels).toEqual(['Swap', 'Cooked', 'Skip']);
  });

  it('tapping the Swap action fires onSwap and plan.swipe_action{variant:swap}', () => {
    const entry = makeEntry();
    const onSwap = vi.fn();
    const onCook = vi.fn();
    const onSkip = vi.fn();
    const el = renderRightActionsFor({ entry, onSwap, onCook, onSkip });
    const pressables = findPressables(el);
    pressables[0]!.props.onPress!();
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onCook).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
    expect(loggedEvents).toHaveLength(1);
    expect(loggedEvents[0]!.name).toBe('plan.swipe_action');
    expect((loggedEvents[0]!.payload as Record<string, unknown>).variant).toBe(
      'swap'
    );
  });

  it('tapping the Cooked action fires onCook and plan.swipe_action{variant:cook}', () => {
    const entry = makeEntry();
    const onSwap = vi.fn();
    const onCook = vi.fn();
    const onSkip = vi.fn();
    const el = renderRightActionsFor({ entry, onSwap, onCook, onSkip });
    const pressables = findPressables(el);
    pressables[1]!.props.onPress!();
    expect(onCook).toHaveBeenCalledTimes(1);
    expect(onSwap).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
    expect((loggedEvents[0]!.payload as Record<string, unknown>).variant).toBe(
      'cook'
    );
  });

  it('tapping the Skip action fires onSkip and plan.swipe_action{variant:skip}', () => {
    const entry = makeEntry();
    const onSwap = vi.fn();
    const onCook = vi.fn();
    const onSkip = vi.fn();
    const el = renderRightActionsFor({ entry, onSwap, onCook, onSkip });
    const pressables = findPressables(el);
    pressables[2]!.props.onPress!();
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSwap).not.toHaveBeenCalled();
    expect(onCook).not.toHaveBeenCalled();
    expect((loggedEvents[0]!.payload as Record<string, unknown>).variant).toBe(
      'skip'
    );
  });

  it('telemetry carries meal_plan_id + meal_plan_entry_id', () => {
    const entry = makeEntry();
    const el = renderRightActionsFor({
      entry,
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const pressables = findPressables(el);
    pressables[0]!.props.onPress!();
    const ev = loggedEvents[0]!;
    expect(ev.meal_plan_id).toBe('plan-1');
    expect(ev.meal_plan_entry_id).toBe('entry-abc');
    expect(ev.session_id).toBe('swipe-entry-abc');
  });

  it('action pill tints use Phase 19 tokens (brand / success / warning) — no raw hex', () => {
    const entry = makeEntry();
    const el = renderRightActionsFor({
      entry,
      onSwap: vi.fn(),
      onCook: vi.fn(),
      onSkip: vi.fn(),
    });
    const pressables = findPressables(el);
    // Style is an array [baseStyle, { backgroundColor }]. Extract the color.
    const extractTint = (p: PressableLike): string | undefined => {
      const style = p.props.style as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(style)) return undefined;
      for (const s of style) {
        if (s && typeof s.backgroundColor === 'string') {
          return s.backgroundColor as string;
        }
      }
      return undefined;
    };
    expect(extractTint(pressables[0]!)).toBe(colors.brand);
    expect(extractTint(pressables[1]!)).toBe(colors.success);
    expect(extractTint(pressables[2]!)).toBe(colors.warning);
  });
});
