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
} as const;

// Flat pool for pure-hash fallback (used when a recipe has no title AND no image URL)
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

// Keyword → category mapping. First matching keyword wins. Order matters:
// more-specific dishes appear before generic ingredients (a "chicken stir-fry"
// should pick stirFry, not chicken). Matching is case-insensitive substring
// on the recipe title.
const CATEGORY_KEYWORDS: Array<[string, keyof typeof FOOD_IMAGES]> = [
  // Specific dishes first (most discriminating)
  ['stir-fry', 'stirFry'],
  ['stir fry', 'stirFry'],
  ['stirfry', 'stirFry'],
  ['taco', 'taco'],
  ['burrito', 'taco'],
  ['quesadilla', 'taco'],
  ['enchilada', 'taco'],
  ['fajita', 'taco'],
  ['sushi', 'sushi'],
  ['sashimi', 'sushi'],
  ['maki', 'sushi'],
  ['poke', 'sushi'],
  ['burger', 'burger'],
  ['cheeseburger', 'burger'],
  ['hamburger', 'burger'],
  ['pasta', 'pasta'],
  ['spaghetti', 'pasta'],
  ['fettuccine', 'pasta'],
  ['linguine', 'pasta'],
  ['penne', 'pasta'],
  ['rigatoni', 'pasta'],
  ['lasagna', 'pasta'],
  ['lasagne', 'pasta'],
  ['ravioli', 'pasta'],
  ['carbonara', 'pasta'],
  ['bolognese', 'pasta'],
  ['alfredo', 'pasta'],
  ['noodle', 'pasta'], // after specific pastas so "rice noodle" doesn't misfire
  ['salad', 'salad'],
  ['slaw', 'salad'],
  ['soup', 'soup'],
  ['stew', 'soup'],
  ['chowder', 'soup'],
  ['chili', 'soup'],
  ['ramen', 'soup'],
  ['pho', 'soup'],
  ['bisque', 'soup'],
  // Breakfast indicators
  ['scrambled egg', 'breakfast'],
  ['scrambled-egg', 'breakfast'],
  ['fried egg', 'breakfast'],
  ['omelet', 'breakfast'],
  ['omelette', 'breakfast'],
  ['pancake', 'breakfast'],
  ['waffle', 'breakfast'],
  ['french toast', 'breakfast'],
  ['frittata', 'breakfast'],
  ['quiche', 'breakfast'],
  ['granola', 'breakfast'],
  ['oatmeal', 'breakfast'],
  ['breakfast', 'breakfast'],
  // Baked goods (dessert/bread — rare for dinner but present)
  ['bread', 'bakedGoods'],
  ['muffin', 'bakedGoods'],
  ['scone', 'bakedGoods'],
  ['cookie', 'bakedGoods'],
  // Proteins (most generic — last so a "chicken pasta" lands on pasta above)
  ['chicken', 'chicken'],
  ['poultry', 'chicken'],
  ['turkey', 'chicken'],
  // Egg on its own (after scrambled-egg specifics) falls to breakfast
  ['egg', 'breakfast'],
];

function hash32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h);
}

/**
 * Deterministically pick a category for a recipe based on title keywords.
 * Returns null if no keyword matches.
 */
function categoryForTitle(title: string | undefined): keyof typeof FOOD_IMAGES | null {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const [keyword, category] of CATEGORY_KEYWORDS) {
    if (lower.includes(keyword)) return category;
  }
  return null;
}

/**
 * Deterministically pick an image for a recipe.
 *
 * Priority:
 *   1. If `imageUrl` is non-empty, use it verbatim (imported-recipe hero).
 *   2. If `title` matches a cuisine-category keyword, pick deterministically
 *      from that category's image pool.
 *   3. Otherwise, hash `recipeId` into the full pool (legacy behavior).
 *
 * Same recipe always gets the same image — no randomness at render time.
 *
 * `title` is optional to preserve the two-arg callsites that existed before
 * the title-aware matcher landed. New callers should pass `title` so meals
 * at least loosely visually match what they are.
 */
export function getRecipeImage(
  recipeId: string,
  imageUrl?: string | null,
  title?: string | null,
): string {
  if (imageUrl) return imageUrl;
  const category = categoryForTitle(title ?? undefined);
  if (category) {
    const pool = FOOD_IMAGES[category];
    // Use the title (not id) as the hash seed so renaming a recipe via edit
    // doesn't change the image within the same category.
    const seed = title ?? recipeId;
    return pool[hash32(seed) % pool.length];
  }
  return ALL_FOOD_IMAGES[hash32(recipeId) % ALL_FOOD_IMAGES.length];
}
