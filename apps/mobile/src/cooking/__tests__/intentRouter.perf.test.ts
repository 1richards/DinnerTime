import { describe, it, expect } from 'vitest';
import { routeIntent } from '../intentRouter';

describe('routeIntent — perf sanity (VOIC-07 latency budget)', () => {
  it('routes 1000 iterations across mixed phrases in under 200ms', () => {
    const phrases = [
      'next step',
      'go back',
      'repeat',
      'pause',
      'resume',
      'set a timer for 10 minutes',
      'timer 5 min',
      'remind me in 30 seconds',
      "what's a substitute for buttermilk",
      'how do I know when the onions are done',
    ];

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      routeIntent(phrases[i % phrases.length]);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });
});
