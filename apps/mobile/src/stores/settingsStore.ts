/**
 * Phase 20 Wave 0: app-wide settings store (persisted).
 *
 * Intentionally minimal — the ONLY key-value shipped in Wave 0 is the
 * `shoppingHandoffMode` feature flag (SHOP-DC-05). Settings surface area will
 * grow in later phases (account, notifications, etc.); keeping a dedicated
 * store separate from `shoppingStore` avoids polluting the shopping list's
 * persist blob with cross-domain toggles.
 *
 * Rollback contract: default is `'draft_cart'` (the new Phase 20 flow). A
 * hidden Settings row (wired in 20-04) flips the mode to `'legacy'`, which
 * causes `app/(tabs)/shopping.tsx` to fall back to the Phase 8 inline
 * WebBrowser.openBrowserAsync behavior without any HandoffSheet mount. The
 * persisted flag survives cold starts so rollback is sticky per device.
 *
 * Pattern: mirrors cookingStore / recipeStore Zustand + persist +
 * AsyncStorage pattern exactly.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ShoppingHandoffMode = 'draft_cart' | 'legacy';
export type PlanCardDensity = 'compact' | 'detailed';

interface SettingsState {
  shoppingHandoffMode: ShoppingHandoffMode;
  setShoppingHandoffMode: (mode: ShoppingHandoffMode) => void;
  /**
   * Phase 22-05: controls whether the Plan-tab FocusBanner renders. Default
   * `true` — users can uncheck the toggle in Settings → Plan to suppress.
   * Persisted alongside shoppingHandoffMode under the same storage blob so
   * rehydration is atomic.
   */
  planFocusBannerEnabled: boolean;
  setPlanFocusBannerEnabled: (enabled: boolean) => void;
  /**
   * Quick-task 7: controls Plan-tab card density. Default `'detailed'` —
   * the active day renders as a HeroDayCard with 16:9 hero image, full
   * skill chips, difficulty/time/servings, and italic skill_note. Setting
   * this to `'compact'` falls back to the SwipeableDayRow rendering for
   * every day (the pre-quick-task-7 layout). Persisted alongside the rest
   * of the settings blob.
   */
  planCardDensity: PlanCardDensity;
  setPlanCardDensity: (density: PlanCardDensity) => void;
  /**
   * Phase 23-03 (NFR-07): opt-in Face ID unlock on app foreground. Default
   * `false` per D-07 — biometric is NEVER on by default; only after the user
   * explicitly toggles it ON AND completes a successful Face ID prompt in the
   * Settings sheet do we persist `true`. When `true`, BiometricGate blocks
   * the UI on background→active transitions until Face ID succeeds or the
   * user chooses "Use password" (which signs out).
   */
  biometricUnlockEnabled: boolean;
  setBiometricUnlockEnabled: (enabled: boolean) => void;
  /**
   * v1.0.2 — selected ElevenLabs voice for cooking-mode read-aloud.
   * `null` means "use the server-side default" (Daniel, British male).
   * The picker writes a voice ID from `apps/mobile/src/cooking/voices.ts`
   * here; `useStepSpeaker` reads it on each fetch and forwards it to
   * `/api/v1/voice/tts` as the `voiceId` body field.
   */
  cookingVoiceId: string | null;
  setCookingVoiceId: (voiceId: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      shoppingHandoffMode: 'draft_cart',
      setShoppingHandoffMode: (mode) => set({ shoppingHandoffMode: mode }),
      planFocusBannerEnabled: true,
      setPlanFocusBannerEnabled: (enabled) => set({ planFocusBannerEnabled: enabled }),
      planCardDensity: 'detailed',
      setPlanCardDensity: (density) => set({ planCardDensity: density }),
      biometricUnlockEnabled: false,
      setBiometricUnlockEnabled: (enabled) =>
        set({ biometricUnlockEnabled: enabled }),
      cookingVoiceId: null,
      setCookingVoiceId: (voiceId) => set({ cookingVoiceId: voiceId }),
    }),
    {
      name: 'dinnertime-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
