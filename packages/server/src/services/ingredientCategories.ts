import type { GroceryCategory } from '../types/shopping.js';

/**
 * Static map of ~150 common ingredients to grocery categories. O(1) zero-cost
 * classification for the ~80% happy path; unknown items fall through to
 * classifyBatchWithHaiku (see classifyItems for the hybrid entry point).
 *
 * Keys must be normalized (lowercase, singular) to match
 * normalizeIngredientName output so callers can look up directly.
 */
export const STATIC_MAP: Record<string, GroceryCategory> = {
  // --- produce (30) ---
  tomato: 'produce',
  onion: 'produce',
  'red onion': 'produce',
  'green onion': 'produce',
  scallion: 'produce',
  shallot: 'produce',
  garlic: 'produce',
  lettuce: 'produce',
  romaine: 'produce',
  spinach: 'produce',
  kale: 'produce',
  arugula: 'produce',
  carrot: 'produce',
  celery: 'produce',
  potato: 'produce',
  'sweet potato': 'produce',
  pepper: 'produce',
  'bell pepper': 'produce',
  jalapeno: 'produce',
  cucumber: 'produce',
  zucchini: 'produce',
  squash: 'produce',
  broccoli: 'produce',
  cauliflower: 'produce',
  cabbage: 'produce',
  mushroom: 'produce',
  asparagus: 'produce',
  eggplant: 'produce',
  corn: 'produce',
  pea: 'produce',
  'green bean': 'produce',
  lemon: 'produce',
  lime: 'produce',
  orange: 'produce',
  apple: 'produce',
  banana: 'produce',
  avocado: 'produce',
  strawberry: 'produce',
  blueberry: 'produce',
  raspberry: 'produce',
  grape: 'produce',
  pineapple: 'produce',
  mango: 'produce',
  cilantro: 'produce',
  parsley: 'produce',
  mint: 'produce',
  dill: 'produce',
  chive: 'produce',
  radish: 'produce',
  beet: 'produce',

  // --- dairy (16) ---
  milk: 'dairy',
  butter: 'dairy',
  cheese: 'dairy',
  yogurt: 'dairy',
  'greek yogurt': 'dairy',
  cream: 'dairy',
  'heavy cream': 'dairy',
  'sour cream': 'dairy',
  'cream cheese': 'dairy',
  parmesan: 'dairy',
  mozzarella: 'dairy',
  cheddar: 'dairy',
  feta: 'dairy',
  ricotta: 'dairy',
  'cottage cheese': 'dairy',
  'half and half': 'dairy',

  // --- protein (20) ---
  chicken: 'protein',
  'chicken breast': 'protein',
  'chicken thigh': 'protein',
  beef: 'protein',
  steak: 'protein',
  pork: 'protein',
  'pork chop': 'protein',
  tofu: 'protein',
  tempeh: 'protein',
  egg: 'protein',
  shrimp: 'protein',
  salmon: 'protein',
  tuna: 'protein',
  cod: 'protein',
  tilapia: 'protein',
  turkey: 'protein',
  'ground turkey': 'protein',
  bacon: 'protein',
  sausage: 'protein',
  lamb: 'protein',
  ham: 'protein',
  prosciutto: 'protein',

  // --- pantry (22) ---
  rice: 'pantry',
  'brown rice': 'pantry',
  'white rice': 'pantry',
  flour: 'pantry',
  pasta: 'pantry',
  spaghetti: 'pantry',
  penne: 'pantry',
  noodle: 'pantry',
  bean: 'pantry',
  'black bean': 'pantry',
  chickpea: 'pantry',
  lentil: 'pantry',
  oil: 'pantry',
  'olive oil': 'pantry',
  'vegetable oil': 'pantry',
  vinegar: 'pantry',
  'balsamic vinegar': 'pantry',
  sugar: 'pantry',
  'brown sugar': 'pantry',
  salt: 'pantry',
  'soy sauce': 'pantry',
  oat: 'pantry',
  quinoa: 'pantry',
  stock: 'pantry',
  broth: 'pantry',
  'chicken broth': 'pantry',
  honey: 'pantry',
  'maple syrup': 'pantry',
  'peanut butter': 'pantry',
  'baking powder': 'pantry',
  'baking soda': 'pantry',

  // --- bakery (7) ---
  bread: 'bakery',
  bagel: 'bakery',
  tortilla: 'bakery',
  bun: 'bakery',
  croissant: 'bakery',
  pita: 'bakery',
  baguette: 'bakery',

  // --- frozen (6) ---
  'ice cream': 'frozen',
  'frozen pea': 'frozen',
  'frozen corn': 'frozen',
  'frozen berry': 'frozen',
  'frozen pizza': 'frozen',
  'frozen fruit': 'frozen',

  // --- beverages (8) ---
  juice: 'beverages',
  'orange juice': 'beverages',
  soda: 'beverages',
  coffee: 'beverages',
  tea: 'beverages',
  wine: 'beverages',
  beer: 'beverages',
  'sparkling water': 'beverages',

  // --- condiments (12) ---
  ketchup: 'condiments',
  mustard: 'condiments',
  mayo: 'condiments',
  mayonnaise: 'condiments',
  'hot sauce': 'condiments',
  ranch: 'condiments',
  'bbq sauce': 'condiments',
  sriracha: 'condiments',
  pesto: 'condiments',
  jam: 'condiments',
  salsa: 'condiments',
  hummus: 'condiments',

  // --- spices (14) ---
  cumin: 'spices',
  paprika: 'spices',
  'black pepper': 'spices',
  oregano: 'spices',
  basil: 'spices',
  thyme: 'spices',
  cinnamon: 'spices',
  'chili powder': 'spices',
  turmeric: 'spices',
  ginger: 'spices',
  nutmeg: 'spices',
  rosemary: 'spices',
  bay: 'spices',
  'garlic powder': 'spices',
  'onion powder': 'spices',
};

/**
 * Classify a single normalized ingredient name via STATIC_MAP with token fallback.
 *
 * Strategy (research Pattern 3):
 *   1. Full string lookup in STATIC_MAP.
 *   2. If miss, split on whitespace and try each token as a fallback.
 *   3. Return null on all-miss (caller should route to Haiku).
 *
 * Caller is expected to pass a name already normalized via
 * normalizeIngredientName (lowercase, depluralized), so this function does
 * NOT re-normalize.
 */
export function classifyStatic(normName: string): GroceryCategory | null {
  const direct = STATIC_MAP[normName];
  if (direct) return direct;

  const tokens = normName.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return null;

  for (const token of tokens) {
    const hit = STATIC_MAP[token];
    if (hit) return hit;
  }
  return null;
}
