/**
 * Local intent router — THE latency path for VOIC-07.
 *
 * Pure regex classifier that runs on every final STT transcript BEFORE any
 * Claude roundtrip. A Claude call is 500-2000ms; a regex match is <5ms. The
 * only way to hit VOIC-07 (<1s end-to-end) reliably is to never touch the
 * network for basic nav/timer commands.
 *
 * Design notes:
 *   1. `parseTimerPhrase` MUST run before nav matching so that phrases like
 *      "set a timer for 5 minutes and continue" don't get miscategorized as
 *      `next` (NEXT regex matches "continue").
 *   2. The ORIGINAL transcript (not lowercased) is preserved inside
 *      `ask.question` so the Claude prompt can include it verbatim.
 */

import type { CookingIntent } from '../types/cooking';
import { parseTimerPhrase } from './timerParser';

const NEXT = /\b(next(?:\s+step)?|continue|move on|go on)\b/i;
const BACK = /\b(go back|back|previous|last step)\b/i;
const REPEAT = /\b(repeat|again|say(?:\s+that)?\s+again|what(?:'s|\s+is)\s+the\s+step)\b/i;
const PAUSE = /\b(pause|stop|wait)\b/i;
const RESUME = /\b(resume)\b/i;

export function routeIntent(transcript: string): CookingIntent {
  const t = transcript.trim().toLowerCase();

  // 1. Timer first — regex for navigation verbs would otherwise steal phrases
  //    containing "continue" or "go" alongside a duration.
  const timerMs = parseTimerPhrase(t);
  if (timerMs !== null) return { type: 'timer', ms: timerMs };

  if (NEXT.test(t)) return { type: 'next' };
  if (BACK.test(t)) return { type: 'back' };
  if (REPEAT.test(t)) return { type: 'repeat' };
  if (PAUSE.test(t)) return { type: 'pause' };
  if (RESUME.test(t)) return { type: 'resume' };

  // Fallthrough: free-form question → Claude. Preserve original casing.
  return { type: 'ask', question: transcript };
}
