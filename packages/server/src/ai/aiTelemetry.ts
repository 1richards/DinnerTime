import { supabaseAdmin } from '../config/supabase.js';

/**
 * Phase 23 Wave 2 (plan 23-06): server-side AI-call telemetry writer.
 *
 * Invoked by the AIClient wrapper (clientFactory.ts) after every AI request
 * completes (success OR failure). Writes one row to the `ai_events` table
 * via the service-role supabase admin client — the row carries metadata
 * only (task, model, tokens, latency, success/error), never raw prompts or
 * raw responses.
 *
 * Fire-and-forget — never blocks the response. Never throws — errors are
 * logged to stderr only so AI request paths stay instrumentation-agnostic.
 *
 * Requirement: NFR-17 (AI cost + latency + model per call, persisted for
 * offline analysis — Phase 25 beta-cohort cost attribution and router
 * tuning in Phase 24).
 */

export interface AiCallRecord {
  /** Profile id from authMiddleware's c.get('user').id. Unauthenticated
   * calls (e.g. public routes, if any) skip the write — we cannot attribute. */
  userId?: string;
  /** Request correlation id from requestLoggingMiddleware. Optional. */
  sessionId?: string;
  /** AITask key (vision.pantryScan, recipe.parseText, etc.). */
  task: string;
  /** Model name (e.g. claude-sonnet-4-20250514, 'unknown' on error). */
  model: string;
  /** Request input token count, if known. */
  tokensIn?: number;
  /** Response output token count, if known. */
  tokensOut?: number;
  /** Wall-clock latency (ms) around the adapter's complete() call. */
  latencyMs: number;
  /** true on happy-path, false on thrown error. */
  success: boolean;
  /** Truncated error message when success=false. Max 64 chars to avoid
   * persisting stack traces that may contain PII from upstream errors. */
  errorCode?: string;
}

/**
 * Fire-and-forget writer. Awaits the insert so callers have a handle to the
 * promise if they want to (e.g. tests), but swallows ALL errors to keep
 * instrumentation invisible to production code paths.
 *
 * Callers should NOT await this in the request path — spawn it via
 * `void recordAiCall(...)` or `Promise.resolve().then(() => recordAiCall(...))`
 * so latency is unaffected.
 */
export async function recordAiCall(record: AiCallRecord): Promise<void> {
  // No userId → cannot attribute → skip. We intentionally swallow here so
  // callers don't need to check.
  if (!record.userId) return;

  const row = {
    profile_id: record.userId,
    session_id: record.sessionId ?? null,
    event_type: record.success ? 'ai.request_succeeded' : 'ai.request_failed',
    task_name: record.task,
    model: record.model,
    payload: {
      tokens_in: record.tokensIn ?? null,
      tokens_out: record.tokensOut ?? null,
      latency_ms: record.latencyMs,
      success: record.success,
      ...(record.errorCode ? { error_code: record.errorCode } : {}),
    },
    client_ts: new Date().toISOString(),
  };

  try {
    const { error } = await supabaseAdmin.from('ai_events').insert([row]);
    if (error) {
      // Log once to stderr; never throw. A failing telemetry write must not
      // break a user-facing AI call.
      console.error(
        '[aiTelemetry] insert failed:',
        (error as { message?: string }).message ?? String(error),
      );
    }
  } catch (err) {
    console.error(
      '[aiTelemetry] insert threw:',
      err instanceof Error ? err.message : String(err),
    );
  }
}
