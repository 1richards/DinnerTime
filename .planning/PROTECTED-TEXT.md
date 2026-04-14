# Protected text selectors

These text strings are referenced by the Maestro UAT flows. Do NOT remove or
significantly alter them — renaming "Sign In" to "Log In", for example, will
break flow 01-login.yaml. If you need to rename, update both the UI and the
flow in the same commit.

## Auth / onboarding
- `Sign In` (button)
- `Sign up` (link)
- `Already have an account`
- `Join DinnerTime`
- `Create Account`
- `Continue with Google`
- `you@example.com` (placeholder)
- `Your password` (placeholder)
- `What should we cook tonight` (home subtitle)
- `Welcome to DinnerTime`
- `Your Household`
- `Your Preferences`
- `Your name` (input placeholder, step 0)
- `Next` / `Get Started` (wizard buttons)
- `Scan your fridge first` / `Go to Pantry` (home empty state)

## Tabs
- `Home` / `Recipes` / `Plan` / `Pantry` / `Shopping` / `Cook` (tab labels)

## Recipes
- `My Recipes` (list heading)
- `Search recipes` (placeholder)
- `Favorites` (filter chip)
- `Discover` (chip)
- `Paste URL` / `Type It In` / `Take Photo` (import chooser buttons)
- `Recipe URL` / `https://example.com/recipe` (import-url placeholder)
- `Paste or type your recipe here` (import-manual placeholder)
- `Import` / `Parse Recipe` (AI-parse button labels)
- `Recipe title` (review input)
- `Ingredients` / `Steps` (section headings)
- `Save Recipe` / `Save Changes` (buttons)
- `Edit` (button)
- `Start Cooking` (recipe detail button)
- `AI-suggested recipes tailored to your household` (discover subtitle)
- `Save to Library` / `Saved to library` (discover button + toast)

## Pantry
- `All` / `Fridge` / `Pantry` / `Freezer` (filter chips)

## Plan
- `This Week` (heading when a plan exists)
- `Generate this week` / `Generate from Meal Plan` (empty-state CTAs)
- `Regenerate` (full-week regen button)
- `Swap this meal` / `Pick something else` (swap sheet)
- `Mon` / `Tue` / `Wed` / `Thu` / `Fri` / `Sat` / `Sun` (day labels)

## Shopping
- `Order on Instacart` (CTA)
- `Add item` / `Add to list` (add sheet)
- `Orders` (header link)
- `e.g. Oranges` (add-item placeholder)
- `Cancel` (sheet button)

## Settings
- `Family Members` (section heading)
- `Dietary` / `Cooking Skill` (section headings)
- `Add Member` (button)
- `Confident` (skill-level label)

## Cook tab placeholder
- `Hands-Free Cooking` (header)
- `Open Recipes` (CTA)
- `Go home` (back button)

## Stub markers (do not remove)
- `STUB_FLOW_DO_NOT_RUN_SEE_COMMENTS_ABOVE` — sentinel in stub flows
