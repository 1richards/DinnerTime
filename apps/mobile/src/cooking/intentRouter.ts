/**
 * Local intent router — THE latency path for VOIC-07.
 *
 * Pure regex classifier that runs on every final STT transcript BEFORE any
 * Claude roundtrip. A Claude call is 500-2000ms; a regex match is <5ms. The
 * only way to hit VOIC-07 (<1s end-to-end) reliably is to never touch the
 * network for basic nav/timer commands.
 *
 * Ordering (matters):
 *   1. `parseTimerPhrase` runs first so phrases like "set a timer for 5
 *      minutes and continue" don't get miscategorized as `next`.
 *   2. next → back → repeat → pause → resume (Phase 9 shipped order).
 *   3. `show_ingredients` (Phase 16 COOK-UX-05) sits AFTER resume and BEFORE
 *      the ask fallthrough. Without this branch, "show ingredients" would
 *      silently fall through to /cooking/ask and return a text reply instead
 *      of scrolling to the ingredients section. The CONTEXT-locked contract
 *      is a scroll, so the router owns the classification.
 *   4. Fallthrough: `ask` with the ORIGINAL (non-lowercased) transcript so
 *      Claude receives the exact user casing/punctuation.
 */

import type { CookingIntent } from '../types/cooking';
import { parseTimerPhrase } from './timerParser';

const NEXT = /\b(next(?:\s+step)?|continue|move on|go on)\b/i;
const BACK = /\b(go back|back|previous|last step)\b/i;
const REPEAT = /\b(repeat|again|say(?:\s+that)?\s+again|what(?:'s|\s+is)\s+the\s+step)\b/i;
const PAUSE = /\b(pause|stop|wait)\b/i;
const RESUME = /\b(resume)\b/i;
// show_ingredients — matches "show/see/list ingredients", "show me the ingredients",
// "what (are the) ingredients", "what ingredients...". Permits up to 3 intervening
// tokens (e.g. "show me the") between the verb and "ingredients" so natural phrasings
// like "can you show me the ingredients" hit.
// Accepted edge case: "what ingredients are substitutes for butter" ALSO matches and
// routes to show_ingredients (skipping /ask). Users can rephrase ("how do I substitute
// butter?"). If UAT telemetry reveals real friction, tighten the regex in a follow-up.
const SHOW_INGREDIENTS = /\b(show|see|list|what)\b(?:\s+\w+){0,3}\s+ingredients\b/i;

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
  if (SHOW_INGREDIENTS.test(t)) return { type: 'show_ingredients' };

  // Fallthrough: free-form question → Claude. Preserve original casing.
  return { type: 'ask', question: transcript };
}
