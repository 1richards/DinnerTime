# Phase 5: Recipe Import - Research

**Researched:** 2026-04-10
**Domain:** Recipe data extraction (URL scraping, OCR/vision, manual input), structured recipe storage
**Confidence:** HIGH

## Summary

Phase 5 implements recipe import from three sources: URLs (structured data extraction), photos (Claude Vision OCR), and manual entry (AI-assisted structuring). The project already has established patterns for Claude Vision calls (pantry scanning in Phase 3) and Hono route structure that recipe import will follow directly.

The URL import path has two tiers: (1) extract schema.org/Recipe JSON-LD structured data from the page HTML -- this covers the vast majority of recipe websites since Google incentivizes this markup for rich results; (2) fall back to Claude AI extraction when no structured data is found. Photo import reuses the existing Claude Vision pattern from `vision.ts` but with a recipe-extraction prompt instead of food-identification. Manual entry uses Claude to parse freeform text into structured ingredients/steps.

**Primary recommendation:** Build a `recipes` Supabase table with the structured schema (title, ingredients JSONB array, steps JSONB array, times, servings, source_type, source_url), a server-side `recipeParser` service with three extraction methods (URL/photo/manual), and a mobile import flow with three entry points converging on a single recipe review/edit screen.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RECP-01 | User can import a recipe by pasting a URL | URL fetch + JSON-LD extraction with Claude fallback; server-side `parseRecipeFromUrl` service |
| RECP-02 | User can import a recipe by photographing a cookbook page or handwritten card | Claude Vision with recipe-extraction tool; reuses existing `expo-image-picker` + base64 pattern from scan flow |
| RECP-03 | User can import a recipe by photographing a screenshot | Same Claude Vision path as RECP-02; screenshot images are simpler (clean text, no perspective distortion) |
| RECP-04 | User can manually enter a recipe with AI assistance to structure it | Claude text completion with `parse_recipe` tool; parses freeform text into structured ingredients and numbered steps |
| RECP-05 | Imported recipes are parsed into structured format (title, ingredients with quantities/units, steps, times, servings) | Shared `Recipe` type and `recipes` DB table; all three import paths produce the same structured output |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.88.0 | Claude API (vision + text) | Already used for pantry scanning and suggestions; recipe extraction is same pattern |
| Hono | ^4.7.10 | API routes | Existing server framework; recipes route stub already exists |
| Supabase | ^2.103.0 | Database + storage | Existing DB; add `recipes` table + optional Supabase Storage for recipe images |
| expo-image-picker | ^55.0.18 | Photo capture | Already used for pantry scan; same camera flow for recipe photo import |
| Zustand | ~5.0 | Client state | Existing pattern (pantryStore, suggestionsStore); add recipeStore |
| Zod | ^3.25.3 | Schema validation | Already a server dependency; validate parsed recipe structure |

### New (add for this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cheerio | latest | HTML parsing | Extract JSON-LD script tags from fetched recipe URLs server-side |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cheerio + custom JSON-LD extraction | recipe-scrapers npm package | recipe-scrapers has site-specific parsers but low download counts, unclear maintenance; cheerio + JSON-LD is simpler and covers 90%+ of recipe sites since Google requires structured data. Claude fallback handles the rest. |
| Custom URL fetching | Puppeteer/Playwright | Headless browser is overkill; most recipe sites render JSON-LD server-side in script tags. Simple fetch + cheerio is sufficient. |
| Separate OCR service | Tesseract.js | Claude Vision handles OCR natively with superior accuracy for recipe text; no need for a separate OCR pipeline |

**Installation:**
```bash
# Server - add cheerio for HTML parsing
cd packages/server && npm install cheerio
```

## Architecture Patterns

### Recommended Project Structure
```
packages/server/src/
  routes/recipes.ts           # Expand existing stub with import endpoints
  services/recipeParser.ts    # URL extraction, photo extraction, manual parse
  services/recipeStore.ts     # DB CRUD operations for recipes

apps/mobile/src/
  app/(tabs)/recipes.tsx      # Recipe library list (exists, replace placeholder)
  app/recipes/import.tsx      # Import method picker (URL / Photo / Manual)
  app/recipes/import-url.tsx  # URL paste screen
  app/recipes/import-photo.tsx # Photo capture screen
  app/recipes/import-manual.tsx # Manual entry screen
  app/recipes/review.tsx      # Review/edit parsed recipe before saving
  components/recipes/         # Recipe-specific components
  stores/recipeStore.ts       # Recipe state management
  types/recipe.ts             # Shared recipe types
```

### Pattern 1: Three Import Paths, One Output
**What:** All three import methods (URL, photo, manual) produce the same `ParsedRecipe` structure. A shared review screen lets users verify and edit before saving.
**When to use:** Always -- this is the core architecture.
**Example:**
```typescript
// Shared output type from all import paths
interface ParsedRecipe {
  title: string;
  description: string | null;
  ingredients: ParsedIngredient[];
  steps: string[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  servings: number | null;
  source_url: string | null;
  source_type: 'url' | 'photo' | 'manual';
  image_url: string | null;
}

interface ParsedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;  // e.g., "finely chopped", "to taste"
}
```

### Pattern 2: JSON-LD First, Claude Fallback for URL Import
**What:** When importing from URL, first try extracting schema.org/Recipe JSON-LD from the HTML. If not found, send the page text to Claude for extraction.
**When to use:** All URL imports.
**Example:**
```typescript
// Server-side URL import flow
async function parseRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  // 1. Fetch HTML
  const html = await fetch(url).then(r => r.text());

  // 2. Try JSON-LD extraction (fast, free, reliable)
  const jsonLd = extractRecipeJsonLd(html);
  if (jsonLd) {
    return mapJsonLdToRecipe(jsonLd, url);
  }

  // 3. Fallback: extract visible text, send to Claude
  const pageText = extractVisibleText(html);
  return parseRecipeWithClaude(pageText, url);
}

function extractRecipeJsonLd(html: string): SchemaRecipe | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (const script of scripts) {
    try {
      const data = JSON.parse($(script).html() ?? '');
      // Handle @graph arrays and direct objects
      const recipes = findRecipeInJsonLd(data);
      if (recipes) return recipes;
    } catch { /* skip malformed JSON */ }
  }
  return null;
}
```

### Pattern 3: Claude Tool Use for Structured Extraction (Existing Pattern)
**What:** Use Claude's tool_use with forced tool choice to get structured recipe data, exactly like pantry scanning and suggestions already do.
**When to use:** Photo import, manual text parse, URL fallback.
**Example:**
```typescript
// Follows exact same pattern as vision.ts identifyFoodItems
const parseRecipeTool = {
  name: 'parse_recipe' as const,
  description: 'Extract structured recipe data from text or image',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'number' },
            unit: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['name'],
        },
      },
      steps: { type: 'array', items: { type: 'string' } },
      prep_time_minutes: { type: 'number' },
      cook_time_minutes: { type: 'number' },
      total_time_minutes: { type: 'number' },
      servings: { type: 'number' },
    },
    required: ['title', 'ingredients', 'steps'],
  },
};
```

### Pattern 4: Zustand Store Following Existing Conventions
**What:** Recipe store follows same structure as pantryStore and suggestionsStore with local `getApiBaseUrl` and `getAuthToken` helpers.
**When to use:** All mobile state management.
**Example:**
```typescript
// Follows suggestionsStore pattern exactly
export const useRecipeStore = create<RecipeState>((set, get) => ({
  recipes: [],
  isLoading: false,
  isImporting: false,
  error: null,
  importedRecipe: null,  // Parsed recipe pending review

  importFromUrl: async (url: string) => { /* ... */ },
  importFromPhoto: async (base64: string) => { /* ... */ },
  importFromText: async (text: string) => { /* ... */ },
  saveRecipe: async (recipe: ParsedRecipe) => { /* ... */ },
  fetchRecipes: async () => { /* ... */ },
}));
```

### Anti-Patterns to Avoid
- **Client-side URL fetching:** Never fetch recipe URLs from the mobile app -- CORS will block it and API keys would be exposed. All URL fetching happens server-side.
- **Storing raw HTML:** Only store the parsed structured data. Raw HTML is large and useless after extraction.
- **Skipping the review screen:** Always show the parsed recipe for user review before saving. AI extraction is imperfect -- users need to verify and correct.
- **Separate Claude prompts per import type:** Use one `parse_recipe` tool definition shared across photo/manual/URL-fallback. Only the input message content changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML parsing | Custom regex for JSON-LD | cheerio | HTML is irregular; regex breaks on edge cases. cheerio handles malformed HTML gracefully |
| Ingredient parsing (from text) | Custom NLP/regex for "2 cups flour" | Claude tool_use with structured schema | Ingredient text is incredibly varied ("a pinch of salt", "2-3 medium onions, diced"). Claude handles natural language parsing that would take months to build with regex |
| ISO 8601 duration parsing | Custom duration parser for "PT30M" | Simple regex + manual mapping | Schema.org uses ISO 8601 durations (PT1H30M). A simple function handles this; no library needed |
| Image storage | Custom file upload service | Supabase Storage | Already available in the stack; handles CDN, access control, and image optimization |

**Key insight:** The hardest part of recipe import is ingredient parsing -- quantities, units, and item names have extreme variation across cultures and writing styles. Claude handles this naturally through its language understanding. Do not attempt regex-based ingredient parsing.

## Common Pitfalls

### Pitfall 1: Recipe URL Fetching Blocked by Sites
**What goes wrong:** Many recipe sites block server-side fetches (User-Agent checks, Cloudflare protection).
**Why it happens:** Bot protection is universal on popular recipe sites.
**How to avoid:** Set a reasonable User-Agent header on fetch requests. If fetching fails, return a clear error asking the user to copy/paste the recipe text manually instead. Do not attempt to bypass bot protection.
**Warning signs:** 403/503 responses, Cloudflare challenge pages in HTML.

### Pitfall 2: JSON-LD Schema Variations
**What goes wrong:** Some sites nest Recipe inside @graph arrays, others use @type arrays, some have multiple JSON-LD blocks.
**Why it happens:** Schema.org allows multiple valid representations.
**How to avoid:** Write a recursive finder that handles: direct Recipe objects, @graph arrays, nested @type arrays. Test with real URLs from popular sites (AllRecipes, Food Network, Bon Appetit, NYT Cooking).
**Warning signs:** Extraction works on some sites but returns null on others.

### Pitfall 3: Large Images from Photos
**What goes wrong:** Cookbook photos at full resolution create huge base64 strings that exceed API limits or cause timeouts.
**Why it happens:** Camera photos can be 4000x3000+ pixels.
**How to avoid:** Use expo-image-picker's `quality: 0.8` setting (already used in scan flow). Consider adding explicit width/height constraints. Claude Vision accepts images up to 5MB.
**Warning signs:** Slow import times, API timeout errors.

### Pitfall 4: Duplicate Recipe Imports
**What goes wrong:** User imports the same URL twice and gets duplicates.
**Why it happens:** No deduplication check.
**How to avoid:** For URL imports, check if `source_url` already exists in user's recipes before importing. Show "already imported" with option to re-import.
**Warning signs:** Multiple identical recipes in library.

### Pitfall 5: Ingredient Quantity Ambiguity
**What goes wrong:** "1/2 cup" parsed as quantity=1, unit="2 cup" instead of quantity=0.5, unit="cup".
**Why it happens:** Fractions, ranges ("2-3"), and vague amounts ("a pinch") are hard to parse.
**How to avoid:** Let Claude handle this entirely through tool_use. The tool schema should use `number` type for quantity (allowing decimals) and a separate `notes` field for qualifiers. Instruct Claude in the prompt to convert fractions to decimals.
**Warning signs:** Ingredient quantities look wrong in review screen.

## Code Examples

### Database Migration: recipes table
```sql
-- Migration: 00004_recipes.sql
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  total_time_minutes INTEGER,
  servings INTEGER,
  source_type TEXT NOT NULL CHECK (source_type IN ('url', 'photo', 'manual')),
  source_url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recipes_profile ON recipes(profile_id);
CREATE INDEX idx_recipes_profile_title ON recipes(profile_id, title);

-- RLS (follows pantry_items pattern exactly)
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recipes"
  ON recipes FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own recipes"
  ON recipes FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can update own recipes"
  ON recipes FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users can delete own recipes"
  ON recipes FOR DELETE USING (auth.uid() = profile_id);

CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### JSONB Ingredient Structure
```typescript
// Stored as JSONB array in recipes.ingredients column
// Example: [{"name":"flour","quantity":2,"unit":"cup","notes":"all-purpose"},...]
interface StoredIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}
```

### ISO 8601 Duration Parser (for JSON-LD)
```typescript
// Parse "PT1H30M" -> 90 (minutes)
function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  return hours * 60 + minutes || null;
}
```

### Server Route Structure
```typescript
// packages/server/src/routes/recipes.ts
// POST /import/url   - Import from URL
// POST /import/photo - Import from photo (base64 image)
// POST /import/text  - Import from manual text entry
// POST /             - Save reviewed recipe to DB
// GET  /             - List user's recipes
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Site-specific scrapers (per recipe site) | JSON-LD extraction (universal) | ~2020 (Google rich results push) | 90%+ of recipe sites now include schema.org/Recipe JSON-LD for SEO. Universal extraction is now viable. |
| OCR + NLP pipeline for cookbook photos | Multimodal LLM vision (Claude) | 2024-2025 | Single API call replaces complex OCR -> text -> NLP pipeline. Much higher accuracy especially for handwriting. |
| Regex-based ingredient parsing | LLM tool_use with structured output | 2024-2025 | Claude handles the full spectrum of ingredient notation (fractions, ranges, qualifiers) with near-perfect accuracy. |

## Open Questions

1. **Recipe image storage**
   - What we know: Supabase Storage is available and already in the stack. Recipe images could be stored there.
   - What's unclear: Whether to store recipe images at all in Phase 5 (source images from photos are useful; URL-sourced images can be referenced by URL).
   - Recommendation: For URL imports, store the `image` URL from JSON-LD. For photo imports, optionally store the source image in Supabase Storage. Keep it simple -- image storage can be enhanced in Phase 6 (recipe library/editing).

2. **Rate limiting for URL fetches**
   - What we know: Fetching URLs server-side could be abused.
   - What's unclear: Whether rate limiting is needed for v1.
   - Recommendation: Add basic per-user rate limiting (e.g., 10 imports per hour) as a guard. Hono middleware makes this straightforward.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | Inferred from package.json scripts |
| Quick run command | `cd packages/server && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/server && npx vitest run && cd ../../apps/mobile && npx vitest run --passWithNoTests` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECP-01 | URL import extracts recipe from JSON-LD and Claude fallback | unit | `cd packages/server && npx vitest run src/services/__tests__/recipeParser.test.ts -x` | Wave 0 |
| RECP-02 | Photo import sends image to Claude Vision with recipe extraction prompt | unit | `cd packages/server && npx vitest run src/services/__tests__/recipeParser.test.ts -x` | Wave 0 |
| RECP-03 | Screenshot import (same code path as photo) | unit | Covered by RECP-02 tests | Wave 0 |
| RECP-04 | Manual text entry parsed by Claude into structured recipe | unit | `cd packages/server && npx vitest run src/services/__tests__/recipeParser.test.ts -x` | Wave 0 |
| RECP-05 | All import paths produce valid structured recipe with required fields | unit | `cd packages/server && npx vitest run src/services/__tests__/recipeParser.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/server && npx vitest run`
- **Per wave merge:** Full suite (server + mobile)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/services/__tests__/recipeParser.test.ts` -- covers RECP-01 through RECP-05
- [ ] `apps/mobile/src/stores/__tests__/recipeStore.test.ts` -- covers recipe store actions
- [ ] cheerio dependency installation: `cd packages/server && npm install cheerio`

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/server/src/services/vision.ts` -- Claude Vision pattern with tool_use
- Existing codebase: `packages/server/src/services/suggestions.ts` -- Claude tool_use for structured output
- Existing codebase: `supabase/migrations/00003_pantry_items.sql` -- RLS and table patterns
- [Schema.org Recipe](https://schema.org/Recipe) -- Canonical recipe data structure
- [Claude Vision Documentation](https://platform.claude.com/docs/en/build-with-claude/vision) -- Image processing capabilities

### Secondary (MEDIUM confidence)
- [Google Recipe Schema Markup](https://developers.google.com/search/docs/appearance/structured-data/recipe) -- Confirms JSON-LD is standard for recipe sites
- [Scraping Recipes Using Node.js and JSON-LD](https://www.raymondcamden.com/2024/06/12/scraping-recipes-using-nodejs-pipedream-and-json-ld) -- Node.js JSON-LD extraction approach
- [Claude Multimodal Transcription Cookbook](https://platform.claude.com/cookbook/multimodal-how-to-transcribe-text) -- OCR/transcription best practices

### Tertiary (LOW confidence)
- [recipe-scrapers npm](https://www.npmjs.com/package/recipe-scrapers) -- TypeScript recipe scraper library (not recommended due to low adoption, but validates the JSON-LD-first approach)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- entirely uses existing project dependencies plus one new library (cheerio)
- Architecture: HIGH -- follows established patterns from Phase 3 (vision) and Phase 4 (suggestions)
- Pitfalls: HIGH -- well-documented challenges in recipe scraping community
- Database schema: HIGH -- follows exact patterns from existing migrations

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable domain, unlikely to change)
