/**
 * Curated Unsplash food photography for DinnerTime UI.
 * All URLs use stable photo IDs with consistent crop/quality settings.
 * Format: images.unsplash.com/photo-<id>?auto=format&fit=crop&w=800&q=80
 */

export const FOOD_IMAGES = {
  // Hero / full-bleed backgrounds
  hero: [
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80', // plated dinner
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80', // farmers market
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80', // hands cooking
    'https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=800&q=80', // steam rising from pot
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80', // restaurant plating
  ],

  // Cuisine categories
  pasta: [
    'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=800&q=80',
  ],
  salad: [
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80',
  ],
  burger: [
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=800&q=80',
  ],
  chicken: [
    'https://images.unsplash.com/photo-1598103442097-8b74394b95c3?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1604908177453-7462950a6a3b?auto=format&fit=crop&w=800&q=80',
  ],
  stirFry: [
    'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80',
  ],
  taco: [
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=800&q=80',
  ],
  soup: [
    'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1607116703670-c8a8e89e4fde?auto=format&fit=crop&w=800&q=80',
  ],
  sushi: [
    'https://images.unsplash.com/photo-1559410545-0bdcd187e0a6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1617196034183-421b4040ed20?auto=format&fit=crop&w=800&q=80',
  ],
  bakedGoods: [
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=800&q=80',
  ],
  breakfast: [
    'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=800&q=80',
  ],
};

// Flat pool for random assignment (used when a recipe has no image)
export const ALL_FOOD_IMAGES: string[] = [
  ...FOOD_IMAGES.hero,
  ...FOOD_IMAGES.pasta,
  ...FOOD_IMAGES.salad,
  ...FOOD_IMAGES.burger,
  ...FOOD_IMAGES.chicken,
  ...FOOD_IMAGES.stirFry,
  ...FOOD_IMAGES.taco,
  ...FOOD_IMAGES.soup,
  ...FOOD_IMAGES.sushi,
  ...FOOD_IMAGES.bakedGoods,
  ...FOOD_IMAGES.breakfast,
];

/**
 * Deterministically pick an image for a recipe by hashing its ID.
 * Same recipe always gets the same image, no randomness at render time.
 */
export function getRecipeImage(recipeId: string, imageUrl?: string | null): string {
  if (imageUrl) return imageUrl;
  let hash = 0;
  for (let i = 0; i < recipeId.length; i++) {
    hash = (hash * 31 + recipeId.charCodeAt(i)) & 0xffffffff;
  }
  const idx = Math.abs(hash) % ALL_FOOD_IMAGES.length;
  return ALL_FOOD_IMAGES[idx];
}
