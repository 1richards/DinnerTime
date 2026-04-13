/**
 * askAssistant — HTTP client for the /api/v1/cooking/ask Claude Q&A endpoint
 * (VOIC-04). Mirrors the authedFetch pattern used by mealPlanStore and
 * shoppingStore (Decision [Phase 07-04]) so auth/base-url behavior stays
 * consistent across the mobile app.
 *
 * Kept in its own tiny module — and exported separately from the hook
 * surface — so the cooking screen test in 09-05 can mock just this function
 * without touching any native modules.
 */
import { supabase } from '../lib/supabase';

const getApiBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
};

const getAuthToken = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Not authenticated');
  }
  return data.session.access_token;
};

export async function askAssistant(
  recipeId: string,
  currentStepIndex: number,
  question: string,
): Promise<string> {
  const token = await getAuthToken();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/cooking/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      recipe_id: recipeId,
      current_step_index: currentStepIndex,
      question,
    }),
  });

  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      code = body.code ?? body.error ?? code;
    } catch {
      // Non-JSON error body — fall through with HTTP_* code.
    }
    throw new Error(code);
  }

  const body = (await res.json()) as { answer?: string };
  return body.answer ?? '';
}
