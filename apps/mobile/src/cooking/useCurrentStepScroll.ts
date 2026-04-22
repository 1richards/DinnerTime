/**
 * useCurrentStepScroll — Phase 16 Wave 2 (16-04).
 *
 * Scrolls a ScrollView to roughly center the current step card in the
 * viewport whenever `currentStepIndex` changes. Pattern 2 from 16-RESEARCH
 * "Claude.ai-Artifact Scrollable Recipe" locks the `-120pt` center offset.
 *
 * Design note — "hook" is a misnomer:
 *   The Wave 0 red stub (src/cooking/__tests__/useCurrentStepScroll.test.ts)
 *   invokes this API as a plain function from vitest's node environment,
 *   with no React renderer in scope. That rules out `useEffect` /
 *   `useLayoutEffect` inside this module — any React-hook call would throw
 *   "cannot call hook outside render". So this file exports a synchronous
 *   function that performs the scroll imperatively every time it's called
 *   with the current scrollRef + step-y array + index.
 *
 *   Real React callers (ScrollableRecipe) invoke this function on every
 *   render; React's diffing only re-renders ScrollableRecipe when props
 *   actually change, so the practical firing cadence matches the
 *   "useEffect on currentStepIndex" contract described in 16-04-PLAN.md.
 *
 * Pitfall 4 (UI-SPEC §Interaction Contract): unconditional autoscroll may
 * fight a user's manual scroll. Wave 2 ships the simple version; if UAT
 * surfaces the conflict, gate on an isScrolling ref in a follow-up patch.
 */
import type { MutableRefObject, RefObject } from 'react';
import type { ScrollView } from 'react-native';

/** Vertical offset (in pt) subtracted from the step card's y so the card */
/** sits roughly 1/3 down the viewport — counter-distance reading comfort. */
export const STEP_SCROLL_CENTER_OFFSET = 120;

type ScrollRefLike =
  | RefObject<ScrollView | null>
  | MutableRefObject<ScrollView | null>
  | { current: ScrollView | null | { scrollTo: (opts: { y: number; animated: boolean }) => void } | undefined };

type StepYsRefLike =
  | RefObject<number[]>
  | MutableRefObject<number[]>
  | { current: number[] | undefined };

export interface UseCurrentStepScrollArgs {
  scrollRef: ScrollRefLike;
  stepYs: StepYsRefLike;
  currentStepIndex: number;
}

export function useCurrentStepScroll({
  scrollRef,
  stepYs,
  currentStepIndex,
}: UseCurrentStepScrollArgs): void {
  const ys = stepYs.current;
  if (!ys) return;
  const y = ys[currentStepIndex];
  if (y === undefined || y === null) return;
  const scroller = scrollRef.current as
    | { scrollTo?: (opts: { y: number; animated: boolean }) => void }
    | null
    | undefined;
  if (!scroller || typeof scroller.scrollTo !== 'function') return;
  scroller.scrollTo({
    y: Math.max(0, y - STEP_SCROLL_CENTER_OFFSET),
    animated: true,
  });
}
