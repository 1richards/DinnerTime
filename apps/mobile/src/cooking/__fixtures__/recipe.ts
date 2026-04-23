/**
 * Shared Phase 16 test recipe fixture.
 *
 * 8 ingredients + 6 steps — matches the ScrollableRecipe / StepCard /
 * IngredientRow / StickyCookingHeader test contracts described in
 * 16-00-PLAN.md. Shape mirrors `Recipe` exactly (do NOT invent fields).
 */
import type { Recipe } from '../../types/recipe';

export const TEST_RECIPE: Recipe = {
  id: 'recipe-test-16',
  profile_id: 'user-test-16',
  title: 'Garlic Butter Rice with Chicken',
  description:
    'A fast weeknight one-pan dinner — fragrant garlic-butter jasmine rice topped with seared chicken breast.',
  ingredients: [
    { name: 'jasmine rice', quantity: 1.5, unit: 'cup', notes: null },
    { name: 'chicken breast', quantity: 1, unit: 'lb', notes: 'boneless, skinless' },
    { name: 'garlic', quantity: 4, unit: 'clove', notes: 'minced' },
    { name: 'unsalted butter', quantity: 3, unit: 'tbsp', notes: null },
    { name: 'olive oil', quantity: 2, unit: 'tbsp', notes: null },
    { name: 'kosher salt', quantity: 1, unit: 'tsp', notes: null },
    { name: 'black pepper', quantity: 0.5, unit: 'tsp', notes: 'freshly ground' },
    { name: 'fresh parsley', quantity: 2, unit: 'tbsp', notes: 'chopped, for garnish' },
  ],
  steps: [
    'Rinse the rice under cold water until it runs clear, then drain well.',
    'Pat the chicken breasts dry and season both sides with salt and pepper.',
    'Heat the olive oil in a large skillet over medium-high heat and sear the chicken 5 minutes per side until golden. Transfer to a plate and tent with foil.',
    'Reduce heat to medium, add the butter and minced garlic, and cook for 30 seconds until fragrant.',
    'Stir in the rinsed rice and 3 cups of water, bring to a boil, then cover and simmer on low for 15 minutes.',
    'Slice the rested chicken, fluff the rice with a fork, plate the chicken over the rice, and garnish with chopped parsley.',
  ],
  prep_time_minutes: 10,
  cook_time_minutes: 25,
  total_time_minutes: 35,
  servings: 4,
  source_type: 'manual',
  source_url: null,
  image_url: null,
  is_favorite: false,
  created_at: '2026-04-20T00:00:00Z',
  updated_at: '2026-04-20T00:00:00Z',
};
