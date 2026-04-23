import { AnthropicAdapter } from './adapters/anthropicAdapter.js';
import { GeminiAdapter } from './adapters/geminiAdapter.js';
import { recordAiCall } from './aiTelemetry.js';
import { TASK_ROUTES } from './taskRouting.js';
import type {
  AIClient,
  AITask,
  AnalyzeImageStructuredInput,
  AnalyzeImagesStructuredInput,
  GenerateStructuredInput,
  GenerateTextInput,
} from './types.js';

/**
 * Phase 23 Wave 2 (plan 23-06): optional per-request context for telemetry
 * correlation. Routes pass `{ userId: c.get('user')?.id, sessionId:
 * c.get('request_id') }` to attribute AI calls to a user + request. Default
 * `{}` keeps every existing getClientFor() call site compiling unchanged
 * (telemetry becomes a no-op when userId is missing).
 */
export interface AiCallContext {
  userId?: string;
  sessionId?: string;
}

/**
 * Resolve the adapter + model for a task. Callers depend only on the AIClient
 * interface; swapping providers is a taskRouting.ts edit.
 *
 * When a second arg is passed, every method on the returned client is wrapped
 * with fire-and-forget telemetry that records { task, model, tokensIn?,
 * tokensOut?, latencyMs, success, errorCode? } into ai_events. The wrapper
 * NEVER swallows errors — it re-throws anything the adapter threw so callers
 * see the same behavior they did before instrumentation.
 */
export function getClientFor(
  task: AITask,
  context: AiCallContext = {},
): AIClient {
  const route = TASK_ROUTES[task];
  if (!route) {
    throw new Error(`getClientFor: no route registered for task '${task}'`);
  }

  let base: AIClient;
  switch (route.provider) {
    case 'anthropic':
      base = new AnthropicAdapter(route.model);
      break;
    case 'google':
      base = new GeminiAdapter(route.model);
      break;
    default: {
      const _exhaustive: never = route.provider;
      throw new Error(`getClientFor: unknown provider '${_exhaustive}'`);
    }
  }

  // Backward-compat path: when called without a context (or with an empty
  // context), return the raw adapter so existing call sites AND the
  // taskRouting tests that inspect adapter internals (__kind, model) see
  // the original instance unchanged. Telemetry is only activated when a
  // caller explicitly opts in with `{ userId }`.
  if (!context.userId) return base;

  return wrapWithTelemetry(base, task, route.model, context);
}

/**
 * Decorator that wraps every AIClient method with timing + success/failure
 * telemetry. Telemetry writes are fire-and-forget — they await in the
 * background via setImmediate so the caller's response latency is
 * unaffected.
 *
 * Token counts are not available from the current adapters (they return
 * just strings / structured outputs, not full SDK responses). We record
 * latency + outcome for now; tokens can be wired in a later pass by
 * extending the adapters to return usage metadata.
 */
function wrapWithTelemetry(
  base: AIClient,
  task: string,
  model: string,
  context: AiCallContext,
): AIClient {
  function emit(success: boolean, latencyMs: number, errorCode?: string) {
    // Fire-and-forget — never awaited in the hot path, never throws.
    setImmediate(() => {
      void recordAiCall({
        userId: context.userId,
        sessionId: context.sessionId,
        task,
        model: success ? model : 'unknown',
        latencyMs,
        success,
        errorCode,
      });
    });
  }

  function truncateErr(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.slice(0, 64);
  }

  const wrapped: AIClient = {
    async generateText(i: GenerateTextInput): Promise<string> {
      const t0 = Date.now();
      try {
        const res = await base.generateText(i);
        emit(true, Date.now() - t0);
        return res;
      } catch (err) {
        emit(false, Date.now() - t0, truncateErr(err));
        throw err;
      }
    },
    async generateStructured<T>(i: GenerateStructuredInput<T>): Promise<T> {
      const t0 = Date.now();
      try {
        const res = await base.generateStructured<T>(i);
        emit(true, Date.now() - t0);
        return res;
      } catch (err) {
        emit(false, Date.now() - t0, truncateErr(err));
        throw err;
      }
    },
    async analyzeImageStructured<T>(
      i: AnalyzeImageStructuredInput<T>,
    ): Promise<T> {
      const t0 = Date.now();
      try {
        const res = await base.analyzeImageStructured<T>(i);
        emit(true, Date.now() - t0);
        return res;
      } catch (err) {
        emit(false, Date.now() - t0, truncateErr(err));
        throw err;
      }
    },
    async analyzeImagesStructured<T>(
      i: AnalyzeImagesStructuredInput<T>,
    ): Promise<T> {
      const t0 = Date.now();
      try {
        const res = await base.analyzeImagesStructured<T>(i);
        emit(true, Date.now() - t0);
        return res;
      } catch (err) {
        emit(false, Date.now() - t0, truncateErr(err));
        throw err;
      }
    },
  };

  // Only expose generateStream if the adapter supports it. The wrapper
  // records latency around the FULL stream — if granular first-chunk
  // telemetry is needed later, it can be added by the streaming call sites
  // directly.
  if (typeof base.generateStream === 'function') {
    const baseStream = base.generateStream.bind(base);
    wrapped.generateStream = async function* (i: GenerateTextInput) {
      const t0 = Date.now();
      try {
        for await (const chunk of baseStream(i)) {
          yield chunk;
        }
        emit(true, Date.now() - t0);
      } catch (err) {
        emit(false, Date.now() - t0, truncateErr(err));
        throw err;
      }
    };
  }

  return wrapped;
}
