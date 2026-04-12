import type { SupabaseClient } from '@supabase/supabase-js';
import { anthropic } from '../config/anthropic.js';

// ---------- Types ----------

export interface DinnerSuggestion {
  title: string;
  description: string;
  ingredients_used: string[];
  ingredients_needed: string[];
  estimated_time_minutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  kid_friendly: boolean;
  cuisine_type: string;
  why_suggested: string;
}

export interface SuggestionsResponse {
  suggestions: DinnerSuggestion[];
  pantry_item_count: number;
  generated_at: string;
}

// ---------- Pantry item shape (from DB) ----------

interface PantryItemRow {
  id: string;
  profile_id: string;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  category: string;
  source_location: string;
  confidence: number;
  status: string;
  last_seen_at: string;
}

// ---------- Household member shape (from DB) ----------

interface HouseholdMemberRow {
  id: string;
  profile_id: string;
  name: string;
  member_type: 'adult' | 'kid';
  age_range: string | null;
  dietary_restrictions: string[];
  dietary_allergies: string[];
  disliked_ingredients: string[];
}

// ---------- Profile shape (from DB) ----------

interface ProfileRow {
  cuisine_preferences: string[];
  skill_level: string;
}

// ---------- Tool Definition ----------

const suggestDinnersTool = {
  name: 'suggest_dinners' as const,
  description: 'Suggest dinner recipes based on available ingredients and preferences',
  input_schema: {
    type: 'object' as const,
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Recipe title' },
            description: { type: 'string', description: '1-2 sentence description' },
            ingredients_used: {
              type: 'array',
              items: { type: 'string' },
              description: 'Pantry items this recipe uses',
            },
            ingredients_needed: {
              type: 'array',
              items: { type: 'string' },
              description: 'Items not in pantry (may need to buy)',
            },
            estimated_time_minutes: { type: 'number' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            kid_friendly: { type: 'boolean' },
            cuisine_type: { type: 'string' },
            why_suggested: {
              type: 'string',
              description: 'Brief reason this was suggested',
            },
          },
          required: [
            'title',
            'description',
            'ingredients_used',
            'ingredients_needed',
            'estimated_time_minutes',
            'difficulty',
            'kid_friendly',
            'cuisine_type',
            'why_suggested',
          ],
        },
      },
    },
    required: ['suggestions'],
  },
};

// ---------- Confidence Decay ----------

/**
 * Replicate confidence decay logic from mobile usePantryItems.ts:
 * - 7-day grace period (no decay)
 * - After 7 days, linear 0.05/day reduction
 * - Floor at 0.1
 */
function getEffectiveConfidence(item: PantryItemRow): number {
  const lastSeen = new Date(item.last_seen_at).getTime();
  const now = Date.now();
  const daysSinceLastSeen = (now - lastSeen) / (1000 * 60 * 60 * 24);

  if (daysSinceLastSeen <= 7) {
    return item.confidence;
  }

  const decayFactor = Math.max(0.1, 1 - (daysSinceLastSeen - 7) * 0.05);
  const effective = item.confidence * decayFactor;
  return Math.max(0.1, effective);
}

// ---------- Prompt Assembly ----------

/**
 * Build a structured prompt for Claude with pantry items, household context,
 * and dietary needs. Pure function, exported for testing.
 */
export function buildSuggestionPrompt(
  pantryItems: PantryItemRow[],
  members: HouseholdMemberRow[],
  profile: ProfileRow
): string {
  // Format ingredients with confidence annotation
  const ingredients = pantryItems
    .map((item) => {
      const effectiveConf = getEffectiveConfidence(item);
      const uncertain = effectiveConf < 0.5 ? ' [uncertain - may not be available]' : '';
      return `- ${item.name} (${item.quantity} ${item.unit}, ${item.category})${uncertain}`;
    })
    .join('\n');

  const hasKids = members.some((m) => m.member_type === 'kid');
  const kidAges = members
    .filter((m) => m.member_type === 'kid')
    .map((m) => m.age_range)
    .filter(Boolean)
    .join(', ');

  // Hard blocks (allergies) across ALL members -- deduplicated
  const allergies = [...new Set(members.flatMap((m) => m.dietary_allergies ?? []))];

  // Soft preferences across ALL members -- deduplicated
  const restrictions = [...new Set(members.flatMap((m) => m.dietary_restrictions ?? []))];

  // Disliked ingredients across ALL members -- deduplicated
  const dislikes = [...new Set(members.flatMap((m) => m.disliked_ingredients ?? []))];

  const adultsCount = members.filter((m) => m.member_type === 'adult').length;
  const kidsCount = members.filter((m) => m.member_type === 'kid').length;

  return `Suggest 3-5 dinner recipes I can make tonight.

AVAILABLE INGREDIENTS:
${ingredients}

HOUSEHOLD:
- ${members.length} members (${adultsCount} adults, ${kidsCount} kids)
${hasKids ? `- Children ages: ${kidAges}` : ''}
- Cooking skill: ${profile.skill_level}

HARD CONSTRAINTS (NEVER violate):
${allergies.length > 0 ? `- Allergies: ${allergies.join(', ')} -- absolutely no recipes with these` : '- No allergies'}
${dislikes.length > 0 ? `- Disliked ingredients: ${dislikes.join(', ')} -- avoid these` : ''}

SOFT PREFERENCES:
${restrictions.length > 0 ? `- Dietary preferences: ${restrictions.join(', ')}` : '- No specific dietary preferences'}
${profile.cuisine_preferences.length > 0 ? `- Preferred cuisines: ${profile.cuisine_preferences.join(', ')}` : '- Open to any cuisine'}

GUIDELINES:
- Prioritize recipes using ingredients already available
- OK to suggest recipes needing 1-3 additional common items
- Match difficulty to skill level (${profile.skill_level})
${hasKids ? '- Include at least 1-2 kid-friendly options (familiar flavors, simple textures)' : ''}
- Vary the cuisines and cooking methods across suggestions
- Include estimated cooking time`;
}

// ---------- Main Service ----------

/**
 * Fetch user context from Supabase, assemble prompt, call Claude,
 * and return structured dinner suggestions.
 */
export async function getSuggestions(
  supabase: SupabaseClient,
  profileId: string
): Promise<SuggestionsResponse> {
  // 1. Fetch pantry items (available only)
  const { data: pantryItems, error: pantryError } = await supabase
    .from('pantry_items')
    .select()
    .eq('profile_id', profileId)
    .eq('status', 'available');

  if (pantryError) {
    throw new Error(`Failed to fetch pantry items: ${pantryError.message}`);
  }

  // Guard: minimum 3 items
  if (!pantryItems || pantryItems.length < 3) {
    throw new Error('Not enough pantry items. Scan your fridge first!');
  }

  // 2. Fetch household members
  const { data: members, error: membersError } = await supabase
    .from('household_members')
    .select()
    .eq('profile_id', profileId);

  if (membersError) {
    throw new Error(`Failed to fetch household members: ${membersError.message}`);
  }

  // 3. Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('cuisine_preferences, skill_level')
    .eq('id', profileId)
    .single();

  if (profileError) {
    throw new Error(`Failed to fetch profile: ${profileError.message}`);
  }

  // 4. Assemble prompt and call Claude
  const promptText = buildSuggestionPrompt(
    pantryItems as PantryItemRow[],
    (members ?? []) as HouseholdMemberRow[],
    profile as ProfileRow
  );

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    tools: [suggestDinnersTool],
    tool_choice: { type: 'tool', name: 'suggest_dinners' },
    messages: [{ role: 'user', content: promptText }],
  });

  // 5. Parse tool_use response
  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Claude did not return a tool_use response');
  }

  const { suggestions } = toolBlock.input as { suggestions: DinnerSuggestion[] };

  return {
    suggestions,
    pantry_item_count: pantryItems.length,
    generated_at: new Date().toISOString(),
  };
}
