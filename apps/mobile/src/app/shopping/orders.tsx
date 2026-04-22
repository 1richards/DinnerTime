/**
 * Phase 20 Wave 4 (plan 20-04) — legacy route redirect.
 *
 * `/shopping/orders` was renamed to `/shopping/handoffs` per
 * 20-RESEARCH.md D-07 (UI rename; DB table unchanged). Any deep links,
 * saved-navigation-state, or Maestro flow taps that still point at the old
 * path are funneled through this stub so nothing 404s while the vocabulary
 * migration settles. Safe migration per Phase 19 redirect pattern.
 */

import React from 'react';
import { Redirect } from 'expo-router';

export default function OrdersRedirect() {
  return <Redirect href="/shopping/handoffs" />;
}
