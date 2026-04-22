/**
 * Phase 23-08 (NFR-18..21): Performance budgets + timing helper.
 *
 * Single source of truth for the budgets that drive the perf audit:
 *   - STARTUP_COLD_MS (NFR-18): cold-launch → interactive.
 *   - TAB_SWITCH_MS    (NFR-19): per-frame budget when swapping root screens.
 *   - SCAN_FEEDBACK_MS (NFR-20): tap → first skeleton/spinner on scan flows.
 *   - SCAN_COMPLETE_MS (NFR-20): tap → results on pantry/fridge scan.
 *   - RECEIPT_COMPLETE_MS (NFR-20): tap → results on receipt scan (OCR path).
 *   - IMAGE_MAX_MB      (NFR-21): hard cap per Anthropic vision contract
 *     (see CLAUDE.md — iPhone raw photos exceed this at quality:0.8+;
 *     scan paths must stay at quality:0.4).
 *
 * `withBudget(name, budgetMs, fn)` is the instrumentation primitive: times
 * fn(), logs a dev-only warning when the budget is blown, and fires a Sentry
 * breadcrumb so production crashes have perf context. The sentry import is
 * lazy (require) so this module is safe to import from the cold-start path
 * without dragging the native bridge in.
 *
 * Measured numbers live in `23-PERF-AUDIT.md` (same phase directory).
 */

export const STARTUP_COLD_MS = 2000;
export const TAB_SWITCH_MS = 16;
export const SCAN_FEEDBACK_MS = 500;
export const SCAN_COMPLETE_MS = 6000;
export const RECEIPT_COMPLETE_MS = 8000;
export const IMAGE_MAX_MB = 5;

/**
 * Time an async operation against a named budget. Returns the fn's resolved
 * value unchanged so callers can wrap a call site without restructuring:
 *
 *   const result = await withBudget('scan.feedback', SCAN_FEEDBACK_MS, () =>
 *     sendScanRequest(base64),
 *   );
 *
 * Over-budget paths:
 *   - Sentry breadcrumb (category='perf', data={ms, budget_ms}) — picked up
 *     by the next error event for correlation.
 *   - console.warn in __DEV__ — surfaces during development without spamming
 *     production logs.
 *
 * Both paths are best-effort: a missing sentry module (test env, unwired)
 * is swallowed silently, and the warn is __DEV__-gated.
 */
export async function withBudget<T>(
  name: string,
  budgetMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    const ms = Date.now() - t0;
    if (ms > budgetMs) {
      try {
        // Lazy dynamic import — keeps @sentry/react-native out of the
        // cold-start module graph. vi.mock('./sentry') intercepts this at
        // test time; production gets the real breadcrumb. A missing or
        // broken sentry module must NOT surface as an error in the perf
        // path, so this is wrapped in try/catch.
        const mod = (await import('./sentry')) as {
          captureBreadcrumb?: (
            category: string,
            message: string,
            data?: Record<string, unknown>,
          ) => void;
        };
        mod.captureBreadcrumb?.('perf', `${name}:over_budget`, {
          ms,
          budget_ms: budgetMs,
        });
      } catch {
        // Sentry not available (tests without mock, or module failed to
        // load) — swallow. The dev warn below still fires.
      }
      const devFlag =
        typeof (globalThis as { __DEV__?: boolean }).__DEV__ === 'boolean'
          ? (globalThis as { __DEV__?: boolean }).__DEV__
          : false;
      if (devFlag) {
        // eslint-disable-next-line no-console
        console.warn(`[perf] ${name} took ${ms}ms (budget ${budgetMs}ms)`);
      }
    }
  }
}
