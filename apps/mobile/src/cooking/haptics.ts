/**
 * haptics — Phase 16 Wave 2 (16-03) — typed wrappers around expo-haptics
 * that cover every UI-SPEC §Haptic contract event.
 *
 * COOK-UX-05 requires a deterministic haptic + visual pairing every time the
 * assistant recognises a voice command, a timer crosses the warn boundary,
 * expires, etc. Keeping the 1:1 map here (event -> Haptics call) means
 * integration call-sites stay declarative and test-friendly — unit tests
 * assert the correct Haptics API was invoked.
 *
 * Pitfall 9 (UI-SPEC §Haptic contract):
 *   iOS Simulator ignores impact/notification calls (no-op). Device-level
 *   verification belongs in DEVICE-TEST-16 §Haptics. Never rely on the
 *   Simulator to confirm a haptic fired.
 *
 * Promise handling: every helper is awaitable (Promise<void>) but also safe
 * to fire-and-forget (`void fireCommandHaptic()`). Errors are swallowed —
 * haptics are a nice-to-have, never a critical path.
 *
 * expo-haptics is now a hard dependency of the mobile app, so we can
 * import it normally instead of going through a lazy require. The
 * earlier require + try/catch dance was a hold-over from a build that
 * predated the native pod; that's no longer the case.
 */
import * as Haptics from 'expo-haptics';

async function safeImpact(style: Haptics.ImpactFeedbackStyle): Promise<void> {
  try {
    await Haptics.impactAsync(style);
  } catch {
    // Intentionally swallowed — haptics are a best-effort UX channel.
  }
}

async function safeNotification(
  type: Haptics.NotificationFeedbackType,
): Promise<void> {
  try {
    await Haptics.notificationAsync(type);
  } catch {
    // Intentionally swallowed — haptics are a best-effort UX channel.
  }
}

/** Voice command recognised (Next / Back / Repeat / Timer). Medium impact. */
export async function fireCommandHaptic(): Promise<void> {
  await safeImpact(Haptics.ImpactFeedbackStyle.Medium);
}

/** Ingredient tap-to-check acknowledgement. Light impact. */
export async function fireIngredientHaptic(): Promise<void> {
  await safeImpact(Haptics.ImpactFeedbackStyle.Light);
}

/** Timer crossing the T-10s warning boundary. Light impact. */
export async function fireTimerWarnHaptic(): Promise<void> {
  await safeImpact(Haptics.ImpactFeedbackStyle.Light);
}

/** Timer expired. Success notification (three-part success pattern). */
export async function fireTimerExpireHaptic(): Promise<void> {
  await safeNotification(Haptics.NotificationFeedbackType.Success);
}

/** Exit-cooking destructive confirmation. Warning notification. */
export async function fireExitConfirmHaptic(): Promise<void> {
  await safeNotification(Haptics.NotificationFeedbackType.Warning);
}

/** Stop-TTS button pressed. Medium impact (identical feel to command ack). */
export async function fireStopTTSHaptic(): Promise<void> {
  await safeImpact(Haptics.ImpactFeedbackStyle.Medium);
}
