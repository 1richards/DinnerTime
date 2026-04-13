import { describe, it, expect } from 'vitest';
import { routeIntent } from '../intentRouter';

describe('routeIntent — navigation', () => {
  it.each(['next', 'next step', 'continue', 'move on', 'go on'])(
    'routes %p to { type: "next" }',
    (t) => {
      expect(routeIntent(t)).toEqual({ type: 'next' });
    },
  );

  it.each(['back', 'go back', 'previous', 'last step'])(
    'routes %p to { type: "back" }',
    (t) => {
      expect(routeIntent(t)).toEqual({ type: 'back' });
    },
  );

  it.each(['repeat', 'again', 'say that again', "what's the step"])(
    'routes %p to { type: "repeat" }',
    (t) => {
      expect(routeIntent(t)).toEqual({ type: 'repeat' });
    },
  );

  it.each(['pause', 'stop', 'wait'])('routes %p to { type: "pause" }', (t) => {
    expect(routeIntent(t)).toEqual({ type: 'pause' });
  });

  it('routes "resume" to { type: "resume" }', () => {
    expect(routeIntent('resume')).toEqual({ type: 'resume' });
  });
});

describe('routeIntent — timers', () => {
  it('routes "set a timer for 10 minutes" to { type: "timer", ms: 600000 }', () => {
    expect(routeIntent('set a timer for 10 minutes')).toEqual({
      type: 'timer',
      ms: 600_000,
    });
  });

  it('prefers timer over nav when phrase has both "continue" and a duration', () => {
    // The timer must be checked first so navigation verbs don't steal it.
    expect(routeIntent('set a timer for 5 minutes and continue')).toEqual({
      type: 'timer',
      ms: 300_000,
    });
  });
});

describe('routeIntent — ask fallthrough', () => {
  it('falls through to ask with original (non-lowercased) transcript', () => {
    const q = "What's a Substitute for Buttermilk?";
    expect(routeIntent(q)).toEqual({ type: 'ask', question: q });
  });

  it('returns { type: "ask", question: "" } for empty/whitespace input', () => {
    expect(routeIntent('')).toEqual({ type: 'ask', question: '' });
    expect(routeIntent('   ')).toEqual({ type: 'ask', question: '   ' });
  });
});

describe('routeIntent — case insensitivity', () => {
  it('matches nav verbs regardless of case', () => {
    expect(routeIntent('NEXT STEP')).toEqual({ type: 'next' });
    expect(routeIntent('Go Back')).toEqual({ type: 'back' });
  });
});
