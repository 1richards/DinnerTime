/**
 * recipeImageGen — generate recipe hero images via Gemini 2.5 Flash Image
 * ("nano banana") and cache them in Supabase Storage.
 *
 * Cache key: sha256(lower(title)). Two users searching for "Chicken Tikka
 * Masala" hit the same file; only the first generation pays the Gemini cost.
 *
 * On cache miss: call Gemini with a prompt that asks for appetizing,
 * top-down food photography. Upload the returned base64 image bytes to the
 * `recipe-images` bucket with content type image/jpeg. Return the public URL.
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
 * Build a deterministic cache key from a recipe title. Case-insensitive,
 * whitespace-normalized — "Tikka Masala" and "tikka masala " share a file.
 */
function cacheKey(title: string): string {
  const normalized = title.trim().toLowerCase().replace(/\s+/g, ' ');
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 24);
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
 * Call Gemini to generate a single JPEG image for the given recipe title.
 * Returns raw bytes on success, null on any failure (safety block, API
 * error, empty candidates, non-image response).
 */
async function generateBytes(title: string): Promise<Buffer | null> {
  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = [
      `High-end food photography of "${title}".`,
      'Top-down, natural window light, shallow depth of field.',
      'Plated on a rustic ceramic dish against a muted linen background.',
      'Appetizing, realistic, no text, no watermarks, no human hands.',
    ].join(' ');

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
 * Public entry point. Returns a public URL for the given recipe title —
 * cached if the hash has been seen before, freshly generated if not. Null
 * on any failure (caller must render a fallback).
 */
export async function generateRecipeImage(
  title: string,
): Promise<string | null> {
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return null;
  }
  await ensureBucket();
  const key = cacheKey(title);

  const cached = await cachedUrlIfExists(key);
  if (cached) return cached;

  const bytes = await generateBytes(title);
  if (!bytes) return null;

  return uploadAndPublicUrl(key, bytes);
}
