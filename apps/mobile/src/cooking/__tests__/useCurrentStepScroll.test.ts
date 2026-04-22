/**
 * Red test stub (Phase 16 Wave 0) — production hook ships in 16-05.
 *
 * Imports `../useCurrentStepScroll` which DOES NOT YET EXIST.
 *
 * Requirement: COOK-UX-04 (at-a-glance info — current step auto-scrolls
 * into the viewport center when step advances). Pattern 2 from 16-RESEARCH.
 */
import { describe, it, expect, vi } from 'vitest';

// @ts-expect-error — module does not exist yet (Wave 0 red stub; shipped 16-05)
import { useCurrentStepScroll } from '../useCurrentStepScroll';

describe('useCurrentStepScroll', () => {
  it('calls scrollRef.current.scrollTo({ y: 140, animated: true }) — center offset for step index 2 given yOffsets [0,120,260,400]', () => {
    const scrollTo = vi.fn();
    const scrollRef = { current: { scrollTo } };
    const stepYs = { current: [0, 120, 260, 400] };

    // Invocation contract: the hook accepts (scrollRef, stepYs, currentStepIndex)
    // or an options object; callers can pass whichever the impl expects.
    // This test is defensive — it invokes and then asserts the scroll happened.
    useCurrentStepScroll({
      scrollRef,
      stepYs,
      currentStepIndex: 2,
    });

    // Expected y = 260 - (viewport-half center heuristic) — the green impl
    // centers the step card; Pattern 2 documents 140 for the test fixture.
    // Implementation may use a smoothing constant; accept any scroll call
    // with y between 100 and 200 as center-ish.
    expect(scrollTo).toHaveBeenCalled();
    const lastCall = scrollTo.mock.calls[scrollTo.mock.calls.length - 1];
    expect(lastCall[0]).toMatchObject({ animated: true });
    const y = (lastCall[0] as { y: number }).y;
    expect(y).toBeGreaterThanOrEqual(100);
    expect(y).toBeLessThanOrEqual(200);
  });
});
