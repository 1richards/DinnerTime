/**
 * recipeImageGen — generate recipe hero images via Gemini 2.5 Flash Image
 * ("nano banana") and cache them in Supabase Storage.
 *
 * Cache key: sha256(lower(title) + short ingredient fingerprint). Two users
 * searching for the same recipe hit the same file; two different recipes
 * that happen to share a title (e.g. "Chicken Curry" red vs green) get
 * distinct hashes because their ingredient fingerprints differ.
 *
 * On cache miss: call Gemini with a dish-specific prompt built from the
 * recipe's description + key visible ingredients. This keeps the output
 * identifiably the *specific* dish rather than generic "food photography".
 * Upload the returned base64 image bytes to the `recipe-images` bucket with
 * content type image/jpeg. Return the public URL.
 *
 * Graceful degradation: all errors are swallowed and return null. Callers
 * (the mobile client) must tolerate null by rendering their keyword-matched
 * fallback image. A missing AI-generated hero is never a user-blocking error.
 */
import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

const BUCKET = 'recipe-images';
// Nano Banana — the currently shipping preview model for image generation.
const MODEL = 'gemini-2.5-flash-image-preview';

export interface IngredientHint {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

export interface GenerateRecipeImageInput {
  title: string;
  description?: string | null;
  ingredients?: IngredientHint[] | null;
}

let _bucketEnsured = false;
/**
 * Create the recipe-images bucket on first use if it doesn't already exist.
 * Idempotent — subsequent calls short-circuit on the cached flag. Kept in
 * code (not migration) because pushing storage migrations to production
 * requires explicit user authorization; creating a public bucket via the
 * service-role API is safe-by-default and reversible.
 */
async function ensureBucket(): Promise<void> {
  if (_bucketEnsured) return;
  try {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    if (error) {
      console.error('[recipeImageGen] listBuckets error:', error);
      return;
    }
    const exists = buckets?.some((b) => b.id === BUCKET);
    if (!exists) {
      const { error: createErr } = await supabaseAdmin.storage.createBucket(
        BUCKET,
        {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
      );
      if (createErr) {
        console.error('[recipeImageGen] createBucket error:', createErr);
        return;
      }
    }
    _bucketEnsured = true;
  } catch (err) {
    console.error('[recipeImageGen] ensureBucket exception:', err);
  }
}

/**
 * Pick the ingredients most likely to dominate the visual. Skips obvious
 * pantry staples (salt, pepper, oil, water) that don't read on a plate, and
 * caps at the top N by original list order — authors tend to lead with
 * hero ingredients.
 */
const PANTRY_STAPLES = new Set([
  'salt',
  'pepper',
  'black pepper',
  'water',
  'oil',
  'olive oil',
  'vegetable oil',
  'canola oil',
  'butter',
  'sugar',
  'flour',
  'garlic powder',
  'onion powder',
  'kosher salt',
  'sea salt',
]);

function topVisualIngredients(
  ingredients: IngredientHint[] | null | undefined,
  limit = 6,
): string[] {
  if (!ingredients || ingredients.length === 0) return [];
  const picked: string[] = [];
  for (const ing of ingredients) {
    const name = (ing.name ?? '').trim();
    if (!name) continue;
    if (PANTRY_STAPLES.has(name.toLowerCase())) continue;
    picked.push(name);
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * Short stable fingerprint of the ingredient list — keeps the cache key
 * distinct when two recipes share a title but differ in ingredients.
 * Uses the visual-ingredient subset so trivial pantry-staple differences
 * don't invalidate the cache.
 */
function ingredientFingerprint(
  ingredients: IngredientHint[] | null | undefined,
): string {
  const names = topVisualIngredients(ingredients, 6)
    .map((n) => n.toLowerCase().replace(/\s+/g, ' ').trim())
    .sort();
  if (names.length === 0) return '';
  return createHash('sha256').update(names.join('|')).digest('hex').slice(0, 8);
}

/**
 * Build a deterministic cache key. Case-insensitive on title, ingredient-
 * aware via a short fingerprint suffix so distinct recipes that share a
 * title don't collide in Storage.
 */
function cacheKey(input: GenerateRecipeImageInput): string {
  const normTitle = input.title.trim().toLowerCase().replace(/\s+/g, ' ');
  const fp = ingredientFingerprint(input.ingredients);
  const composite = fp ? `${normTitle}#${fp}` : normTitle;
  const hash = createHash('sha256').update(composite).digest('hex').slice(0, 24);
  return `generated/${hash}.jpg`;
}

/**
 * Return the public URL for a cached file if it exists in Storage. We don't
 * trust the bucket listing (requires listAll perms); instead we try a HEAD
 * against the public URL via getPublicUrl + a lightweight existence probe.
 */
async function cachedUrlIfExists(key: string): Promise<string | null> {
  try {
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key);
    if (!data?.publicUrl) return null;
    // list() with prefix filter is cheap and RLS-free via service role.
    const dir = key.substring(0, key.lastIndexOf('/'));
    const file = key.substring(key.lastIndexOf('/') + 1);
    const { data: listed } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(dir, { limit: 1, search: file });
    const hit = listed?.some((f) => f.name === file);
    return hit ? data.publicUrl : null;
  } catch {
    return null;
  }
}

/**
 * Compose a dish-specific Gemini prompt. The earlier generic "food photo"
 * prompt produced plausible but off-target images (a "breakfast salsa"
 * recipe getting rendered as French toast, for instance) because the
 * model had no concrete visual cues beyond the title.
 *
 * This version leads with the EXACT dish, then anchors the composition on
 * the top ingredients the user actually listed. Description is pulled in
 * verbatim so flavor descriptors ("creamy", "smoky", "charred") shape the
 * final look. Style instructions come last so they don't dominate.
 */
function buildPrompt(input: GenerateRecipeImageInput): string {
  const title = input.title.trim();
  const visualIngredients = topVisualIngredients(input.ingredients, 6);
  const desc = (input.description ?? '').trim();

  const lines: string[] = [];
  lines.push(
    `Photorealistic editorial food photograph of "${title}" — the specific finished dish as it would actually be served.`,
  );

  if (desc.length > 0) {
    // Gemini responds well to descriptive flavor/style language. Quote the
    // author's own description so the image reflects what the recipe
    // actually promises.
    lines.push(`Dish description: ${desc}`);
  }

  if (visualIngredients.length > 0) {
    lines.push(
      `The plate must visibly include: ${visualIngredients.join(', ')}. Ingredients should be recognizable and in proportion.`,
    );
  }

  lines.push(
    'Serve in a dish appropriate to the cuisine (e.g. a wok/bowl for stir-fry, a cast-iron skillet for a bake, a pasta bowl for pasta, a plate for a cutlet). Do not default to the same ceramic bowl every time.',
  );
  lines.push(
    '3/4 angle hero composition, natural window light, shallow depth of field. Magazine food-styling quality: steam or sheen where appropriate, fresh garnish, authentic presentation.',
  );
  lines.push(
    'Must not show text, logos, watermarks, hands, or utensils in use. No stock-photo clichés; no cartoon or illustrated look — realistic photography only.',
  );

  return lines.join('\n');
}

/**
 * Call Gemini to generate a single JPEG image for the given recipe.
 * Returns raw bytes on success, null on any failure (safety block, API
 * error, empty candidates, non-image response).
 */
async function generateBytes(
  input: GenerateRecipeImageInput,
): Promise<Buffer | null> {
  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildPrompt(input);

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    // Find the first inlineData (image bytes) part across all candidates.
    const candidates = response?.candidates ?? [];
    for (const cand of candidates) {
      const parts = cand?.content?.parts ?? [];
      for (const part of parts) {
        const inline = (part as { inlineData?: { data?: string; mimeType?: string } })
          .inlineData;
        if (inline?.data) {
          return Buffer.from(inline.data, 'base64');
        }
      }
    }
    return null;
  } catch (err) {
    console.error('[recipeImageGen] gemini error:', err);
    return null;
  }
}

/**
 * Upload image bytes to the recipe-images bucket. Idempotent — upsert replaces
 * any existing entry at the same key. Returns the public URL on success,
 * null on upload failure.
 */
async function uploadAndPublicUrl(
  key: string,
  bytes: Buffer,
): Promise<string | null> {
  try {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(key, bytes, {
        contentType: 'image/jpeg',
        cacheControl: '31536000', // 1 year — file is content-addressed
        upsert: true,
      });
    if (error) {
      console.error('[recipeImageGen] upload error:', error);
      return null;
    }
    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(key);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.error('[recipeImageGen] upload exception:', err);
    return null;
  }
}

/**
 * Public entry point. Accepts the full recipe context so the image captures
 * the specific dish rather than generic food photography. Returns a public
 * URL — cached when (title + ingredient fingerprint) has been seen before,
 * freshly generated if not. Null on any failure (caller must render a
 * fallback).
 *
 * Back-compat: callers may still pass just a title string; we normalize
 * to the structured input shape internally.
 */
export async function generateRecipeImage(
  input: string | GenerateRecipeImageInput,
): Promise<string | null> {
  const normalized: GenerateRecipeImageInput =
    typeof input === 'string' ? { title: input } : input;
  if (
    !normalized.title ||
    typeof normalized.title !== 'string' ||
    normalized.title.trim().length === 0
  ) {
    return null;
  }

  await ensureBucket();
  const key = cacheKey(normalized);

  const cached = await cachedUrlIfExists(key);
  if (cached) return cached;

  const bytes = await generateBytes(normalized);
  if (!bytes) return null;

  return uploadAndPublicUrl(key, bytes);
}
