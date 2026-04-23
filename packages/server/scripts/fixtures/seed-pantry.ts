// Dev-only pantry seed fixture used by scripts/test-user.ts reset and scripts/generate-test-recipes.ts. Never imported from src/. Category values must match migration 00003 enum: produce|dairy|protein|grain|condiment|beverage|frozen|snack|other.

export type PantryCategory =
  | 'produce'
  | 'dairy'
  | 'protein'
  | 'grain'
  | 'condiment'
  | 'beverage'
  | 'frozen'
  | 'snack'
  | 'other';

export type SourceLocation = 'fridge' | 'pantry' | 'freezer';

export interface SeedPantryItem {
  name: string;
  category: PantryCategory;
  source_location: SourceLocation;
  unit: string;
  quantity: number;
}

/**
 * Richer, categorized pantry used by `test-user.ts reset` and
 * `generate-test-recipes.ts`. Covers 7+ categories so recipe discovery has
 * enough variety to suggest distinct dishes (the previous 15-item inline seed
 * bottlenecked QA to the same 3-4 recipes).
 *
 * Not production data — tweak freely. Just preserve the category enum and the
 * shape consumed by `pantry_items`.
 */
export const seedPantryItems: SeedPantryItem[] = [
  // ── Proteins ────────────────────────────────────────────────────────────
  { name: 'Chicken Breast', category: 'protein', source_location: 'fridge', unit: 'lb', quantity: 2 },
  { name: 'Ground Beef', category: 'protein', source_location: 'freezer', unit: 'lb', quantity: 1 },
  { name: 'Eggs', category: 'protein', source_location: 'fridge', unit: 'dozen', quantity: 1 },
  { name: 'Salmon Filets', category: 'protein', source_location: 'freezer', unit: 'lb', quantity: 1 },
  { name: 'Shrimp', category: 'protein', source_location: 'freezer', unit: 'lb', quantity: 1 },
  { name: 'Bacon', category: 'protein', source_location: 'fridge', unit: 'lb', quantity: 1 },
  { name: 'Tofu', category: 'protein', source_location: 'fridge', unit: 'block', quantity: 1 },

  // ── Grains / starches / legumes ─────────────────────────────────────────
  { name: 'Pasta', category: 'grain', source_location: 'pantry', unit: 'box', quantity: 2 },
  { name: 'Rice', category: 'grain', source_location: 'pantry', unit: 'lb', quantity: 2 },
  { name: 'Quinoa', category: 'grain', source_location: 'pantry', unit: 'lb', quantity: 1 },
  { name: 'Bread', category: 'grain', source_location: 'pantry', unit: 'loaf', quantity: 1 },
  { name: 'Tortillas', category: 'grain', source_location: 'pantry', unit: 'bag', quantity: 1 },
  { name: 'Black Beans', category: 'grain', source_location: 'pantry', unit: 'can', quantity: 2 },
  { name: 'Chickpeas', category: 'grain', source_location: 'pantry', unit: 'can', quantity: 2 },
  { name: 'Rolled Oats', category: 'grain', source_location: 'pantry', unit: 'bag', quantity: 1 },

  // ── Produce ─────────────────────────────────────────────────────────────
  { name: 'Onion', category: 'produce', source_location: 'pantry', unit: 'piece', quantity: 3 },
  { name: 'Garlic', category: 'produce', source_location: 'pantry', unit: 'head', quantity: 2 },
  { name: 'Tomatoes', category: 'produce', source_location: 'fridge', unit: 'piece', quantity: 4 },
  { name: 'Bell Peppers', category: 'produce', source_location: 'fridge', unit: 'piece', quantity: 3 },
  { name: 'Spinach', category: 'produce', source_location: 'fridge', unit: 'bag', quantity: 1 },
  { name: 'Carrots', category: 'produce', source_location: 'fridge', unit: 'lb', quantity: 1 },
  { name: 'Broccoli', category: 'produce', source_location: 'fridge', unit: 'head', quantity: 1 },
  { name: 'Lemons', category: 'produce', source_location: 'fridge', unit: 'piece', quantity: 3 },
  { name: 'Avocado', category: 'produce', source_location: 'fridge', unit: 'piece', quantity: 2 },
  { name: 'Cilantro', category: 'produce', source_location: 'fridge', unit: 'bunch', quantity: 1 },
  { name: 'Ginger Root', category: 'produce', source_location: 'fridge', unit: 'piece', quantity: 1 },
  { name: 'Potatoes', category: 'produce', source_location: 'pantry', unit: 'lb', quantity: 2 },

  // ── Dairy ───────────────────────────────────────────────────────────────
  { name: 'Milk', category: 'dairy', source_location: 'fridge', unit: 'gal', quantity: 1 },
  { name: 'Cheddar Cheese', category: 'dairy', source_location: 'fridge', unit: 'block', quantity: 1 },
  { name: 'Parmesan', category: 'dairy', source_location: 'fridge', unit: 'oz', quantity: 6 },
  { name: 'Butter', category: 'dairy', source_location: 'fridge', unit: 'lb', quantity: 1 },
  { name: 'Greek Yogurt', category: 'dairy', source_location: 'fridge', unit: 'carton', quantity: 1 },
  { name: 'Heavy Cream', category: 'dairy', source_location: 'fridge', unit: 'carton', quantity: 1 },

  // ── Condiments / pantry staples ─────────────────────────────────────────
  { name: 'Olive Oil', category: 'condiment', source_location: 'pantry', unit: 'bottle', quantity: 1 },
  { name: 'Soy Sauce', category: 'condiment', source_location: 'pantry', unit: 'bottle', quantity: 1 },
  { name: 'Sriracha', category: 'condiment', source_location: 'pantry', unit: 'bottle', quantity: 1 },
  { name: 'Dijon Mustard', category: 'condiment', source_location: 'fridge', unit: 'jar', quantity: 1 },
  { name: 'Honey', category: 'condiment', source_location: 'pantry', unit: 'jar', quantity: 1 },
  { name: 'Balsamic Vinegar', category: 'condiment', source_location: 'pantry', unit: 'bottle', quantity: 1 },
  { name: 'Peanut Butter', category: 'condiment', source_location: 'pantry', unit: 'jar', quantity: 1 },
  { name: 'Canned Tomatoes', category: 'condiment', source_location: 'pantry', unit: 'can', quantity: 3 },

  // ── Frozen ──────────────────────────────────────────────────────────────
  { name: 'Frozen Peas', category: 'frozen', source_location: 'freezer', unit: 'bag', quantity: 1 },
  { name: 'Frozen Berries', category: 'frozen', source_location: 'freezer', unit: 'bag', quantity: 1 },
  { name: 'Frozen Dumplings', category: 'frozen', source_location: 'freezer', unit: 'bag', quantity: 1 },

  // ── Snacks ──────────────────────────────────────────────────────────────
  { name: 'Tortilla Chips', category: 'snack', source_location: 'pantry', unit: 'bag', quantity: 1 },
];

/**
 * Hydrate seed records with the columns `pantry_items` requires on insert:
 * `profile_id`, a normalized_name, plus the confidence/status defaults the
 * existing reset flow writes today. Kept tiny and loop-free so callers can
 * inline it without worrying about side effects.
 */
export function buildSeedPantryRows(profileId: string) {
  return seedPantryItems.map((item) => ({
    ...item,
    profile_id: profileId,
    normalized_name: item.name.toLowerCase().trim(),
    confidence: 1,
    status: 'available' as const,
  }));
}
