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
 * Native module loaded lazily: this module is imported by `cook.tsx` on
 * cold-start. Dev clients built before expo-haptics shipped (this session)
 * don't have the native pod — importing it at module-top would crash the
 * app. The lazy require + try/catch degrades to silent no-op on those builds
 * while still firing real haptics on properly-built clients.
 */
type HapticsModule = typeof import('expo-haptics');
let _Haptics: HapticsModule | null = null;
let _loadFailed = false;

function getHaptics(): HapticsModule | null {
  if (_Haptics) return _Haptics;
  if (_loadFailed) return null;
  try {
    _Haptics = require('expo-haptics');
    return _Haptics;
  } catch {
    _loadFailed = true;
    return null;
  }
}

// Enum values for ImpactFeedbackStyle + NotificationFeedbackType are mirrored
// here so TypeScript still compiles even when expo-haptics isn't resolvable
// at build-time in some environments. These values match the upstream enum.
const IMPACT_MEDIUM = 'medium';
const IMPACT_LIGHT = 'light';
const NOTIF_SUCCESS = 'success';
const NOTIF_WARNING = 'warning';

async function safeImpact(style: string): Promise<void> {
  const H = getHaptics();
  if (!H) return;
  try {
    await H.impactAsync(style as unknown as Parameters<HapticsModule['impactAsync']>[0]);
  } catch {
    // Intentionally swallowed — haptics are a best-effort UX channel.
  }
}

async function safeNotification(type: string): Promise<void> {
  const H = getHaptics();
  if (!H) return;
  try {
    await H.notificationAsync(
      type as unknown as Parameters<HapticsModule['notificationAsync']>[0],
    );
  } catch {
    // Intentionally swallowed — haptics are a best-effort UX channel.
  }
}

/** Voice command recognised (Next / Back / Repeat / Timer). Medium impact. */
export async function fireCommandHaptic(): Promise<void> {
  await safeImpact(IMPACT_MEDIUM);
}

/** Ingredient tap-to-check acknowledgement. Light impact. */
export async function fireIngredientHaptic(): Promise<void> {
  await safeImpact(IMPACT_LIGHT);
}

/** Timer crossing the T-10s warning boundary. Light impact. */
export async function fireTimerWarnHaptic(): Promise<void> {
  await safeImpact(IMPACT_LIGHT);
}

/** Timer expired. Success notification (three-part success pattern). */
export async function fireTimerExpireHaptic(): Promise<void> {
  await safeNotification(NOTIF_SUCCESS);
}

/** Exit-cooking destructive confirmation. Warning notification. */
export async function fireExitConfirmHaptic(): Promise<void> {
  await safeNotification(NOTIF_WARNING);
}

/** Stop-TTS button pressed. Medium impact (identical feel to command ack). */
export async function fireStopTTSHaptic(): Promise<void> {
  await safeImpact(IMPACT_MEDIUM);
}
