import { FOOD_IMAGES } from './foodImages';

/**
 * Keys for photographic empty states across the app.
 *
 * SF-Symbol-only empty states bypass this map entirely — they pass
 * `visual={ kind: 'symbol', name: '...' }` to EmptyState directly.
 *
 * See 15-RESEARCH.md "FOOD_IMAGES reuse mapping" for the decision log.
 */
export type EmptyStateImageKey =
  | 'scanReady' //          FOOD_IMAGES.hero[1] (farmers market)
  | 'emptyPantry' //        FOOD_IMAGES.hero[1]
  | 'shoppingListEmpty' //  FOOD_IMAGES.hero[0] (plated dinner)
  | 'planEmpty'; //         FOOD_IMAGES.hero[2] (hands cooking)

export const EMPTY_STATE_IMAGES: Record<EmptyStateImageKey, string> = {
  scanReady: FOOD_IMAGES.hero[1],
  emptyPantry: FOOD_IMAGES.hero[1],
  shoppingListEmpty: FOOD_IMAGES.hero[0],
  planEmpty: FOOD_IMAGES.hero[2],
};
