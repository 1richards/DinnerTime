/**
 * Phase 23 Wave 2 (plan 23-06): server-side AI-call telemetry writer.
 *
 * recordAiCall() is the fire-and-forget writer invoked by the AIClient
 * wrapper on every complete()/generateText()/generateStructured() call.
 * Writes one row to ai_events via the service-role supabase admin client.
 *
 * Must NEVER throw (even on insert failure) — callers (AI adapters) treat
 * this as invisible instrumentation. Errors are logged to stderr only.
 *
 * Requirement: NFR-17 (AI-call cost + latency telemetry).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insertSpy, supabaseAdmin } = vi.hoisted(() => {
  const insertSpy = vi.fn(async (_rows: unknown[]) => ({
    data: null,
    error: null,
  }));
  return {
    insertSpy,
    supabaseAdmin: {
      from: vi.fn(() => ({ insert: insertSpy })),
    },
  };
});

vi.mock('../../config/supabase.js', () => ({
  supabaseAdmin,
}));

const { recordAiCall } = await import('../aiTelemetry.js');

describe('recordAiCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a single row into ai_events with profile_id + task_name + model + latency_ms', async () => {
    await recordAiCall({
      userId: 'user-42',
      sessionId: 'req-xyz',
      task: 'vision.pantryScan',
      model: 'claude-sonnet-4-20250514',
      tokensIn: 400,
      tokensOut: 180,
      latencyMs: 1200,
      success: true,
    });

    // Allow any microtasks scheduled by the fire-and-forget writer to drain.
    await new Promise((r) => setImmediate(r));

    expect(supabaseAdmin.from).toHaveBeenCalledWith('ai_events');
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const rows = insertSpy.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0].profile_id).toBe('user-42');
    expect(rows[0].task_name).toBe('vision.pantryScan');
    expect(rows[0].model).toBe('claude-sonnet-4-20250514');
    expect(rows[0].event_type).toBe('ai.request_succeeded');
    const payload = rows[0].payload as Record<string, unknown>;
    expect(payload.tokens_in).toBe(400);
    expect(payload.tokens_out).toBe(180);
    expect(payload.latency_ms).toBe(1200);
    expect(payload.success).toBe(true);
  });

  it('emits event_type = ai.request_failed when success: false', async () => {
    await recordAiCall({
      userId: 'user-42',
      task: 'vision.pantryScan',
      model: 'unknown',
      latencyMs: 90,
      success: false,
      errorCode: 'anthropic_5xx',
    });
    await new Promise((r) => setImmediate(r));

    const rows = insertSpy.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0].event_type).toBe('ai.request_failed');
    const payload = rows[0].payload as Record<string, unknown>;
    expect(payload.success).toBe(false);
    expect(payload.error_code).toBe('anthropic_5xx');
  });

  it('does NOT throw when the supabase insert returns an error', async () => {
    insertSpy.mockResolvedValueOnce({
      data: null,
      // Cast so TS accepts our narrow mock shape; runtime shape is what
      // recordAiCall reads.
      error: { message: 'insert boom' } as unknown as null,
    });
    await expect(
      recordAiCall({
        userId: 'user-42',
        task: 'vision.pantryScan',
        model: 'claude-sonnet-4-20250514',
        latencyMs: 1,
        success: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('does NOT throw when the supabase insert itself rejects', async () => {
    insertSpy.mockRejectedValueOnce(new Error('network boom'));
    await expect(
      recordAiCall({
        userId: 'user-42',
        task: 'vision.pantryScan',
        model: 'claude-sonnet-4-20250514',
        latencyMs: 1,
        success: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('is a no-op when userId is missing (unauthenticated AI call)', async () => {
    await recordAiCall({
      task: 'vision.pantryScan',
      model: 'claude-sonnet-4-20250514',
      latencyMs: 1,
      success: true,
    });
    await new Promise((r) => setImmediate(r));

    // Writer should skip the insert — we cannot attribute the call.
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('PII keys never appear in the persisted payload (writer is metadata-only)', async () => {
    // The writer's type signature doesn't accept PII, but guard against
    // casting accidents — assert the rendered row only has the structured
    // metadata shape.
    await recordAiCall({
      userId: 'user-42',
      task: 'recipe.parseText',
      model: 'claude-sonnet-4-20250514',
      latencyMs: 42,
      success: true,
    });
    await new Promise((r) => setImmediate(r));

    const rows = insertSpy.mock.calls[0][0] as Array<Record<string, unknown>>;
    // Explicitly forbidden in any AI telemetry row:
    expect(rows[0]).not.toHaveProperty('prompt');
    expect(rows[0]).not.toHaveProperty('raw_query');
    expect(rows[0]).not.toHaveProperty('transcript');
    expect(rows[0]).not.toHaveProperty('email');
    const payload = rows[0].payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty('prompt');
    expect(payload).not.toHaveProperty('raw_query');
    expect(payload).not.toHaveProperty('transcript');
    expect(payload).not.toHaveProperty('email');
  });
});
