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
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      shoppingHandoffMode: 'draft_cart',
      setShoppingHandoffMode: (mode) => set({ shoppingHandoffMode: mode }),
      planFocusBannerEnabled: true,
      setPlanFocusBannerEnabled: (enabled) => set({ planFocusBannerEnabled: enabled }),
    }),
    {
      name: 'dinnertime-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
