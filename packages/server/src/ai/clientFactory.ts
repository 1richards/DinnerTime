import { AnthropicAdapter } from './adapters/anthropicAdapter.js';
import { GeminiAdapter } from './adapters/geminiAdapter.js';
import { TASK_ROUTES } from './taskRouting.js';
import type { AIClient, AITask } from './types.js';

/**
 * Resolve the adapter + model for a task. Callers depend only on the AIClient
 * interface; swapping providers is a taskRouting.ts edit.
 */
export function getClientFor(task: AITask): AIClient {
  const route = TASK_ROUTES[task];
  if (!route) {
    throw new Error(`getClientFor: no route registered for task '${task}'`);
  }
  switch (route.provider) {
    case 'anthropic':
      return new AnthropicAdapter(route.model);
    case 'google':
      return new GeminiAdapter(route.model);
    default: {
      const _exhaustive: never = route.provider;
      throw new Error(`getClientFor: unknown provider '${_exhaustive}'`);
    }
  }
}
