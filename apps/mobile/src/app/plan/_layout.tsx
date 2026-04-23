/**
 * Phase 22-04 — Plan section stack.
 *
 * File-based expo-router layout for `/plan/*`. Currently owns a single
 * dynamic route `[date]` (the day drill-down screen); future plans can
 * register sibling screens here (e.g. a future `/plan/month` route if we
 * pull the Month view out of the Plan tab).
 *
 * Stack-level nav back to the Plan tab uses the native default gesture +
 * "Plan" back title. The Plan tab itself (`(tabs)/plan.tsx`) is the
 * parent; pushing here preserves the tab's scroll position (expo-router
 * native stack behavior — see 22-CONTEXT D-28).
 */
import { Stack } from 'expo-router';

export default function PlanLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Plan',
        headerLargeTitle: false,
      }}
    />
  );
}
