-- 00031_recipe_images_bucket.sql
-- Supabase Storage bucket for AI-generated recipe hero images.
--
-- Why: Phase 17 suggestions + legacy recipes with image_url=NULL render with
-- title-keyword-matched stock photos today. That still mismatches dishes
-- ("Creamy Salsa Scrambled Eggs" → French-toast hero). We generate title-
-- accurate heroes via Gemini 2.5 Flash Image (nano-banana) and cache them
-- here. Cache key is SHA-256(lower(title)) so popular dishes hit on the
-- second user-visible call.
--
-- Bucket model: public read, service-role write. Mobile loads images via the
-- public URL without an auth round-trip; only the server (using service role
-- on /recipes/generate-image) can insert. Users cannot enumerate — they only
-- load specific URLs returned by the API.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-images',
  'recipe-images',
  true,
  5242880, -- 5 MB cap matches our Anthropic image ceiling
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read policy (anyone with a URL can view)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'recipe_images_public_read'
  ) THEN
    EXECUTE $p$
      CREATE POLICY recipe_images_public_read
        ON storage.objects FOR SELECT
        USING (bucket_id = 'recipe-images')
    $p$;
  END IF;
END $$;
