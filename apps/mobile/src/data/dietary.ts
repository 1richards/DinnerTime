/**
 * Constants for dietary options, cuisine preferences, skill levels, and age ranges.
 * These are the canonical lists used throughout the app for preference selection.
 */

import type { DietaryOption, CuisineOption, SkillLevel, AgeRange } from '../types/preferences';

export const DIETARY_OPTIONS: { value: DietaryOption; label: string; isAllergy: boolean }[] = [
  { value: 'Vegetarian', label: 'Vegetarian', isAllergy: false },
  { value: 'Vegan', label: 'Vegan', isAllergy: false },
  { value: 'Gluten-Free', label: 'Gluten-Free', isAllergy: false },
  { value: 'Dairy-Free', label: 'Dairy-Free', isAllergy: false },
  { value: 'Nut Allergy', label: 'Nut Allergy', isAllergy: true },
  { value: 'Keto', label: 'Keto', isAllergy: false },
  { value: 'Paleo', label: 'Paleo', isAllergy: false },
];

export const CUISINE_OPTIONS: { value: CuisineOption; label: string }[] = [
  { value: 'Italian', label: 'Italian' },
  { value: 'Mexican', label: 'Mexican' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Indian', label: 'Indian' },
  { value: 'Thai', label: 'Thai' },
  { value: 'Mediterranean', label: 'Mediterranean' },
  { value: 'American', label: 'American' },
  { value: 'Korean', label: 'Korean' },
  { value: 'French', label: 'French' },
];

export const SKILL_LEVELS: { value: SkillLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'Just getting started' },
  { value: 'intermediate', label: 'Intermediate', description: 'Comfortable with basics' },
  { value: 'confident', label: 'Confident', description: 'Can tackle most recipes' },
  { value: 'adventurous', label: 'Adventurous', description: 'Love trying new techniques' },
];

export const AGE_RANGES: { value: AgeRange; label: string; range: string }[] = [
  { value: 'toddler', label: 'Toddler', range: '1-3' },
  { value: 'young_kid', label: 'Young Kid', range: '4-7' },
  { value: 'older_kid', label: 'Older Kid', range: '8-12' },
  { value: 'teen', label: 'Teen', range: '13+' },
];
