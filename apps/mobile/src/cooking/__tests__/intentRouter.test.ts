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

describe('routeIntent — show_ingredients intent (Phase 16 COOK-UX-05)', () => {
  it('routes "show ingredients" to { type: "show_ingredients" }', () => {
    expect(routeIntent('show ingredients')).toEqual({
      type: 'show_ingredients',
    });
  });

  it('is case-insensitive ("Show ingredients")', () => {
    expect(routeIntent('Show ingredients')).toEqual({
      type: 'show_ingredients',
    });
  });

  it('matches "can you show me the ingredients"', () => {
    expect(routeIntent('can you show me the ingredients')).toEqual({
      type: 'show_ingredients',
    });
  });

  it('matches "see ingredients"', () => {
    expect(routeIntent('see ingredients')).toEqual({
      type: 'show_ingredients',
    });
  });

  it('matches "list ingredients"', () => {
    expect(routeIntent('list ingredients')).toEqual({
      type: 'show_ingredients',
    });
  });

  it('matches "what ingredients do I need"', () => {
    expect(routeIntent('what ingredients do I need')).toEqual({
      type: 'show_ingredients',
    });
  });

  it('matches "what are the ingredients"', () => {
    expect(routeIntent('what are the ingredients')).toEqual({
      type: 'show_ingredients',
    });
  });

  it('ACCEPTED edge case: "what ingredients are substitutes for butter" routes to show_ingredients', () => {
    // The regex broadly matches any "what ... ingredients" phrase. This
    // skips the /ask fallback for substitution questions — users must rephrase
    // ("how do I substitute butter?") to trigger /ask. Locked contract per
    // 16-05 behavior block; tighten the regex if UAT surfaces real friction.
    expect(routeIntent('what ingredients are substitutes for butter')).toEqual({
      type: 'show_ingredients',
    });
  });

  it('regression guard: free-form questions without the trigger still fall through to ask', () => {
    expect(routeIntent('how do I chop an onion?')).toEqual({
      type: 'ask',
      question: 'how do I chop an onion?',
    });
  });

  it('regression guard: "next step" still routes to next (show_ingredients sits after nav)', () => {
    expect(routeIntent('next step')).toEqual({ type: 'next' });
  });
});
