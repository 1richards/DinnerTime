/**
 * Phase 20 Wave 0 stub — real implementation lands in 20-01.
 *
 * Intentionally minimal so `shopping/__tests__/telemetry.test.ts` imports
 * without "cannot find module" and fails on assertion errors instead. Wave 1
 * (plan 20-01) clones `apps/mobile/src/cooking/telemetry.ts` here (whitelist
 * extended with 5 shopping-specific keys) and flips these tests green.
 *
 * TODO(phase-20-01): replace with batched event queue, sanitizePayload
 * whitelist, wireSupabaseAuth seam, __resetForTests hook. See
 * 20-RESEARCH.md Pattern 2.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

export type ShoppingEventName =
  | 'shopping.draft_cart_started'
  | 'shopping.draft_cart_succeeded'
  | 'shopping.draft_cart_failed'
  | 'shopping.handoff_opened_app'
  | 'shopping.handoff_opened_web'
  | 'shopping.handoff_dismissed'
  | (string & {});

interface LogInput {
  name: ShoppingEventName;
  session_id: string;
  shopping_list_id?: string | null;
  shopping_order_id?: string | null;
  payload?: Record<string, unknown>;
}

type TokenGetter = () => Promise<string | null>;

export function wireSupabaseAuth(_getter: TokenGetter): void {
  throw new Error('Phase 20-01 not implemented');
}

export function sanitizePayload(
  _dirty: Record<string, unknown>,
): Record<string, unknown> {
  // Intentionally wrong: returns the raw input unfiltered. Wave 1 ships
  // the real whitelist (Phase 16 9 keys + 5 shopping-specific).
  return {};
}

export function logShoppingEvent(_e: LogInput): void {
  // No-op stub; Wave 1 batches and flushes.
}

export async function flushShoppingTelemetry(): Promise<void> {
  // No-op stub; Wave 1 POSTs to /api/v1/telemetry/shopping.
}

export const __resetForTests = Object.assign(
  function __resetForTests(): void {
    // No-op in stub.
  },
  {
    getQueueLength: (): number => 0,
    setTokenGetter: (_fn: TokenGetter): void => {
      // No-op in stub.
    },
  },
);
