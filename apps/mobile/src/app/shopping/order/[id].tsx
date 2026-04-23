/**
 * Phase 20 Wave 4 (plan 20-04) — legacy route redirect.
 *
 * `/shopping/order/[id]` was renamed to `/shopping/handoff/[id]` per
 * 20-RESEARCH.md D-07 (UI rename; DB table unchanged). Preserves the `id`
 * param through to the new route.
 */

import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function OrderDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/shopping/handoff/${id}`} />;
}
