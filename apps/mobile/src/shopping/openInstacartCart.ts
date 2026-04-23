/**
 * Phase 20 Wave 1: deep-link-first Instacart handoff opener.
 *
 * Try `Linking.openURL(url)` first — iOS universal-link routing delivers
 * an HTTPS Instacart link to the Instacart app when installed, otherwise
 * Safari. Fall back to `WebBrowser.openBrowserAsync(url)` (Safari View
 * Controller in-app) when Linking throws — happens on simulators without
 * the real app, or if iOS fails to resolve the universal link.
 *
 * Per SHOP-DC-03 (20-RESEARCH.md Pattern 1). Do NOT use `canOpenURL` —
 * see 20-RESEARCH.md Pitfall 2 (LSApplicationQueriesSchemes probe would
 * require an EAS dev-client rebuild; not worth it for CTA label nuance
 * that we're not shipping in v1).
 *
 * The additive `shopping.handoff_opened_{app|web}` telemetry — addresses
 * Pitfall 3 (separate the "server returned a URL" signal from the
 * "user actually tapped through" signal) — fires on each path. The sheet
 * (20-03) is responsible for the dismissed-without-tap case.
 */

import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { logShoppingEvent, sanitizePayload } from './telemetry';

export async function openInstacartCart(
  url: string,
  opts: { sessionId?: string; orderId?: string | null } = {},
): Promise<void> {
  try {
    await Linking.openURL(url);
    logShoppingEvent({
      name: 'shopping.handoff_opened_app',
      session_id: opts.sessionId ?? '',
      shopping_order_id: opts.orderId ?? null,
      payload: sanitizePayload({ order_id: opts.orderId ?? undefined }),
    });
  } catch {
    await WebBrowser.openBrowserAsync(url);
    logShoppingEvent({
      name: 'shopping.handoff_opened_web',
      session_id: opts.sessionId ?? '',
      shopping_order_id: opts.orderId ?? null,
      payload: sanitizePayload({ order_id: opts.orderId ?? undefined }),
    });
  }
}
