import type { SupabaseClient } from '@supabase/supabase-js';
import { getClientFor } from '../ai/clientFactory.js';

// Phase 10-03 / 11-04: Per-step cooking tips with AI-backed cache.
//
// Lazy, per-step generation gated by a Supabase cache table
// (recipe_step_tips, composite PK on recipe_id + step_index, RLS scoped
// via the parent recipe). Cost control: cache hit short-circuits the AI
// call; uncertainty produces an empty string that we explicitly do NOT
// cache so future model improvements can fill the gap.
//
// As of Phase 11-04, this service routes through the AIClient abstraction
// (taskRouting.ts -> Gemini 3.1 flash-lite preview). The cache semantics,
// uncertainty guard, and system prompt are unchanged from Phase 10-03.
//
// Pitfall 5 (uncertainty hedging): the system prompt forbids hedging
// language and instructs the model to return an empty string instead of
// fabricating a tip it isn't sure about.
// Pitfall 6 (cost): bounded maxTokens (120) plus cache mean a recipe is
// generally a one-time cost no matter how many times the user revisits it.

const TIP_SYSTEM_PROMPT = [
  'You are a cooking coach. Given a single recipe step, return ONE short tip',
  '(max 2 sentences) that explains technique, timing, or sensory cues.',
  "If you're uncertain about the technique in the step, return an empty string",
  '— never hedge with "traditionally", "some say", or "might".',
  'Return plain text only, no preamble.',
].join(' ');

interface CachedTipRow {
  tip: string;
}

/**
 * Get a cached cooking tip for (recipe_id, step_index), or generate one
 * on a cache miss using the AIClient abstraction (routed to Gemini flash-lite).
 *
 * Behaviour matrix:
 * - Cache hit         -> return stored tip, no AI call.
 * - Cache miss + tip  -> call AI, INSERT row, return generated tip.
 * - Cache miss + ''   -> return '', do NOT insert (don't cache uncertainty).
 * - AI throws         -> propagate; the route layer maps to 502.
 */
export async function getOrGenerateTip(
  supabase: SupabaseClient,
  recipeId: string,
  stepIndex: number,
  stepText: string
): Promise<string> {
  // 1. Cache lookup
  const { data: cached } = await supabase
    .from('recipe_step_tips')
    .select('tip')
    .eq('recipe_id', recipeId)
    .eq('step_index', stepIndex)
    .maybeSingle();

  if (cached && typeof (cached as CachedTipRow).tip === 'string') {
    return (cached as CachedTipRow).tip;
  }

  // 2. Cache miss -> call AI via the provider-agnostic client
  const ai = getClientFor('cooking.tips');
  const raw = await ai.generateText({
    system: TIP_SYSTEM_PROMPT,
    user: `Recipe step:\n${stepText}`,
    maxTokens: 120,
  });
  const trimmed = raw.trim();

  // 3. Don't cache uncertainty — empty/whitespace responses are never inserted.
  if (trimmed.length === 0) {
    return '';
  }

  // 4. Cache the new tip. Insert errors are intentionally non-fatal:
  //    we still want to return the tip even if the cache write races
  //    with another request and fails on the composite PK.
  await supabase.from('recipe_step_tips').insert({
    recipe_id: recipeId,
    step_index: stepIndex,
    tip: trimmed,
  });

  return trimmed;
}
