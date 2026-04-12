import { anthropic } from '../config/anthropic.js';
import type { MealPlanEntry, MealPlanIngredient } from '../types/mealPlan.js';
import type { ConsolidatedItem, VariationSuggestion } from '../types/shopping.js';
import { normalizeIngredientName } from './ingredientMatching.js';
import type { PantryItem } from './pantry.js';

/**
 * Consolidate ingredients across meal plan entries.
 *
 * Strategy (per research Pattern 2):
 *   - Group by normalizeIngredientName(name) so "Tomatoes" and "tomato" collapse.
 *   - When units match: sum quantities, keep the unit.
 *   - When units conflict: take max(existing, incoming) and null the unit
 *     (we do NOT attempt unit conversion -- see Pitfall 2).
 *   - sources: deduped list of recipe titles contributing to the item.
 *   - Missing quantity defaults to 1. Missing unit is treated as null.
 *
 * Does not mutate input entries.
 */
export function consolidateIngredients(entries: MealPlanEntry[]): ConsolidatedItem[] {
  const map = new Map<string, ConsolidatedItem>();

  for (const entry of entries) {
    const ingredients: MealPlanIngredient[] = entry.ingredients ?? [];
    for (const ing of ingredients) {
      const normalized = normalizeIngredientName(ing.name);
      const incomingQty = ing.quantity ?? 1;
      const incomingUnit = ing.unit ?? null;

      const existing = map.get(normalized);
      if (!existing) {
        map.set(normalized, {
          name: ing.name,
          normalizedName: normalized,
          quantity: incomingQty,
          unit: incomingUnit,
          sources: [entry.title],
        });
        continue;
      }

      // Merge: unit compatibility check
      if (existing.unit !== null && incomingUnit !== null && existing.unit === incomingUnit) {
        existing.quantity = existing.quantity + incomingQty;
      } else if (existing.unit === null && incomingUnit === null) {
        existing.quantity = existing.quantity + incomingQty;
      } else {
        // Unit mismatch -- take max, null the unit per Pitfall 2
        existing.quantity = Math.max(existing.quantity, incomingQty);
        existing.unit = null;
      }

      if (!existing.sources.includes(entry.title)) {
        existing.sources.push(entry.title);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Subtract pantry inventory from a consolidated shopping list.
 *
 * For each needed item:
 *   - Look up pantry by normalizeIngredientName so "Tomatoes" matches "tomato".
 *   - If pantry covers it fully (pantry.quantity >= needed.quantity): drop the item.
 *   - If pantry covers it partially: return item with reduced quantity.
 *   - If no pantry match: pass through unchanged.
 *
 * Does not mutate input arrays.
 */
export function subtractPantry(
  needed: ConsolidatedItem[],
  pantry: PantryItem[],
): ConsolidatedItem[] {
  const pantryByNorm = new Map<string, PantryItem>();
  for (const p of pantry) {
    const norm = normalizeIngredientName(p.name);
    if (!pantryByNorm.has(norm)) {
      pantryByNorm.set(norm, p);
    }
  }

  const result: ConsolidatedItem[] = [];
  for (const item of needed) {
    // Re-normalize defensively so items built outside consolidateIngredients
    // (e.g. with raw plural names) still match pantry entries.
    const lookupKey = normalizeIngredientName(item.name);
    const p = pantryByNorm.get(lookupKey) ?? pantryByNorm.get(item.normalizedName);
    if (!p) {
      result.push({ ...item, sources: [...item.sources] });
      continue;
    }

    const remaining = item.quantity - p.quantity;
    if (remaining <= 0) {
      // Fully stocked -- drop
      continue;
    }

    result.push({
      ...item,
      quantity: remaining,
      sources: [...item.sources],
    });
  }

  return result;
}

/**
 * Suggest 3-5 ingredient swaps via Claude Haiku tool use.
 *
 * Uses a forced tool_choice so Claude must respond with a structured
 * suggest_swaps call. Returns the swaps array from the tool_use block.
 * Throws if no tool_use block is present in the response.
 */
export async function suggestVariations(
  items: ConsolidatedItem[],
): Promise<VariationSuggestion[]> {
  const itemList = items
    .map((i) => `- ${i.name}${i.quantity ? ` (${i.quantity}${i.unit ? ' ' + i.unit : ''})` : ''}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-latest',
    max_tokens: 1024,
    tools: [
      {
        name: 'suggest_swaps',
        description: 'Suggest 3-5 ingredient swaps for a shopping list',
        input_schema: {
          type: 'object' as const,
          properties: {
            swaps: {
              type: 'array',
              minItems: 3,
              maxItems: 5,
              items: {
                type: 'object',
                properties: {
                  instead_of: { type: 'string' },
                  swap: { type: 'string' },
                  rationale: { type: 'string' },
                },
                required: ['instead_of', 'swap', 'rationale'],
              },
            },
          },
          required: ['swaps'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'suggest_swaps' },
    messages: [
      {
        role: 'user',
        content: `Suggest 3-5 ingredient swaps for this shopping list. Consider cost, nutrition, seasonality, and variety.\n\n${itemList}`,
      },
    ],
  } as Parameters<typeof anthropic.messages.create>[0]);

  const toolUse = (response as { content: Array<{ type: string; name?: string; input?: unknown }> }).content.find(
    (b) => b.type === 'tool_use' && b.name === 'suggest_swaps',
  );

  if (!toolUse) {
    throw new Error('no tool_use in response');
  }

  const input = toolUse.input as { swaps: VariationSuggestion[] };
  return input.swaps;
}
