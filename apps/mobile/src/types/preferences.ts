/**
 * Types for household preferences and member profiles.
 * These types match the database schema in 00002_household_preferences.sql.
 */

/** Self-assessed cooking skill level, stored on user profile */
export type SkillLevel = 'beginner' | 'intermediate' | 'confident' | 'adventurous';

/** Age range for kid-type household members */
export type AgeRange = 'toddler' | 'young_kid' | 'older_kid' | 'teen';

/** Whether a household member is an adult or kid */
export type MemberType = 'adult' | 'kid';

/** Available dietary restriction/allergy options */
export type DietaryOption =
  | 'Vegetarian'
  | 'Vegan'
  | 'Gluten-Free'
  | 'Dairy-Free'
  | 'Nut Allergy'
  | 'Keto'
  | 'Paleo';

/** Available cuisine preference options */
export type CuisineOption =
  | 'Italian'
  | 'Mexican'
  | 'Chinese'
  | 'Japanese'
  | 'Indian'
  | 'Thai'
  | 'Mediterranean'
  | 'American'
  | 'Korean'
  | 'French';

/**
 * A household member profile with per-member dietary needs.
 * dietary_restrictions = soft preferences (prefer to avoid)
 * dietary_allergies = hard blocks (never suggest)
 */
export interface HouseholdMember {
  id: string;
  profile_id: string;
  name: string;
  member_type: MemberType;
  age_range: AgeRange | null;
  dietary_restrictions: DietaryOption[];
  dietary_allergies: DietaryOption[];
  disliked_ingredients: string[];
  created_at: string;
  updated_at: string;
}
