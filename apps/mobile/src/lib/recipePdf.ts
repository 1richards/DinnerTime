/**
 * Recipe → PDF → iOS share sheet.
 *
 * v1.0.2 (#10): generate a clean printable recipe PDF from a saved or
 * discovered recipe and hand it to iOS share. The PDF is the same
 * structure as the in-app detail screen (hero title, time/servings meta,
 * ingredients, steps, optional nutrition, source link) wrapped in print-
 * friendly typography. The iOS share sheet then surfaces Files / Mail /
 * Messages / AirDrop / third-party share extensions.
 *
 * Pattern:
 *   - Lazy require expo-print + expo-sharing so the screen renders even
 *     if the dev client predates these native modules; the share action
 *     surfaces a graceful toast in that case. Mirrors export.tsx.
 *   - Build HTML in JS (no template engine), inline CSS, no external
 *     assets required for layout. The hero image embeds via plain <img>
 *     so expo-print's WKWebView can fetch + paint it before generating
 *     the PDF.
 *   - PDFs land in cacheDirectory so iOS can purge them; durable copies
 *     are whatever the user picks via the share sheet (Files, Mail, etc.).
 */
import type { ParsedIngredient, Recipe } from '../types/recipe';
import { formatQuantity } from './scaleIngredient';

type PrintModule = typeof import('expo-print');
type SharingModule = typeof import('expo-sharing');
type FileSystemModule = typeof import('expo-file-system/legacy');

// Lazy-load every native module so this file stays test-loadable in node
// (vitest's rolldown chokes on react-native's Flow syntax otherwise) AND
// so a dev client predating expo-print degrades gracefully via
// shareRecipeAsPdf's typed result rather than a hard import-time crash.
function getPrint(): PrintModule | null {
  try {
    return require('expo-print');
  } catch {
    return null;
  }
}

function getSharing(): SharingModule | null {
  try {
    return require('expo-sharing');
  } catch {
    return null;
  }
}

function getFileSystem(): FileSystemModule | null {
  try {
    return require('expo-file-system/legacy');
  } catch {
    return null;
  }
}

/**
 * Fetch an image URL and return a `data:image/...;base64,...` URI suitable
 * for inlining in HTML. Returns null on any failure (timeout, non-image
 * content-type, fetch error, oversized payload).
 *
 * Why inline instead of letting WKWebView fetch directly: expo-print's
 * `printToFileAsync` resolves on the WKWebView's `didFinishNavigation`
 * delegate callback, which fires after the main HTML loads but BEFORE
 * remote `<img>` requests resolve. Letting WKWebView fetch the URL
 * produces PDFs without the hero image about half the time. Inlining
 * the bytes makes the image part of the initial document so it's
 * always present in the rendered PDF.
 *
 * Bounded by:
 *   - 5s fetch timeout (network hangs shouldn't block the share)
 *   - 6 MB ceiling (DinnerTime hero images cap ~1-2 MB; anything bigger
 *     is a generated thumbnail edge case we'd rather drop than embed)
 */
async function imageUrlToDataUri(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 6 * 1024 * 1024) return null;
    let base64: string;
    if (typeof Buffer !== 'undefined') {
      base64 = Buffer.from(buf).toString('base64');
    } else {
      let binary = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      base64 = (globalThis as any).btoa(binary);
    }
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Escape user-provided strings for safe HTML insertion. Intentionally
 * strict: ampersand first, then the four other XML-significant chars.
 * Recipe content is user-facing data from Claude/import flows, so we
 * treat all of it as untrusted.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatIngredientLine(ing: ParsedIngredient): string {
  const qty = ing.quantity != null ? formatQuantity(ing.quantity) : '';
  const unit = ing.unit?.trim() ?? '';
  const name = ing.name?.trim() ?? '';
  const notes = ing.notes?.trim() ?? '';
  const left = [qty, unit].filter((s) => s.length > 0).join(' ');
  const main = left.length > 0 ? `${left} ${name}` : name;
  return notes ? `${main} (${notes})` : main;
}

interface RecipeForPdf
  extends Pick<
    Recipe,
    | 'title'
    | 'description'
    | 'ingredients'
    | 'steps'
    | 'prep_time_minutes'
    | 'cook_time_minutes'
    | 'total_time_minutes'
    | 'servings'
    | 'source_url'
    | 'image_url'
    | 'calories_per_serving'
    | 'protein_grams_per_serving'
    | 'fat_grams_per_serving'
  > {}

export function buildRecipeHtml(
  recipe: RecipeForPdf,
  /** Already-resolved preparation-step images (data URIs or URLs). Rendered
      as a gallery so the PDF mirrors the in-app image slider. */
  stepImages: string[] = [],
): string {
  const title = escapeHtml(recipe.title || 'Untitled Recipe');
  const description = recipe.description
    ? `<p class="description">${escapeHtml(recipe.description)}</p>`
    : '';

  const totalTime =
    recipe.total_time_minutes ??
    (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

  const metaParts: string[] = [];
  if (totalTime > 0) metaParts.push(`<span>⏱ ${totalTime} min</span>`);
  if (recipe.servings && recipe.servings > 0) {
    metaParts.push(`<span>🍽 ${recipe.servings} servings</span>`);
  }
  const meta =
    metaParts.length > 0
      ? `<div class="meta">${metaParts.join('')}</div>`
      : '';

  const nutritionParts: string[] = [];
  if (recipe.calories_per_serving != null) {
    nutritionParts.push(
      `<span class="nutrition-pill">${recipe.calories_per_serving} kcal</span>`,
    );
  }
  if (recipe.protein_grams_per_serving != null) {
    nutritionParts.push(
      `<span class="nutrition-pill">${recipe.protein_grams_per_serving}g protein</span>`,
    );
  }
  if (recipe.fat_grams_per_serving != null) {
    nutritionParts.push(
      `<span class="nutrition-pill">${recipe.fat_grams_per_serving}g fat</span>`,
    );
  }
  const nutrition =
    nutritionParts.length > 0
      ? `<div class="nutrition"><span class="nutrition-label">Per serving:</span>${nutritionParts.join('')}</div>`
      : '';

  const heroImg = recipe.image_url
    ? `<img class="hero" src="${escapeHtml(recipe.image_url)}" />`
    : '';

  const ingredients = (recipe.ingredients ?? [])
    .map((ing) => `<li>${escapeHtml(formatIngredientLine(ing))}</li>`)
    .join('');

  const steps = (recipe.steps ?? [])
    .map((step, i) => {
      const text = escapeHtml((step ?? '').trim());
      return `<li><span class="step-num">${i + 1}.</span><span class="step-text">${text}</span></li>`;
    })
    .join('');

  const prepGallery =
    stepImages.length > 0
      ? `<h2>Preparation</h2><div class="prep-gallery">${stepImages
          .map((src) => `<img class="prep-img" src="${escapeHtml(src)}" />`)
          .join('')}</div>`
      : '';

  const sourceLink = recipe.source_url
    ? `<p class="source">Source: <a href="${escapeHtml(recipe.source_url)}">${escapeHtml(recipe.source_url)}</a></p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
      color: #2D2418;
      background: #FAF7F2;
      margin: 0;
      padding: 32px 36px 56px;
      line-height: 1.45;
    }
    h1 { font-size: 28px; margin: 0 0 8px; line-height: 1.2; }
    h2 {
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6B5C45;
      margin: 28px 0 12px;
      font-weight: 700;
    }
    .description { font-size: 14px; color: #5A4F40; margin: 0 0 14px; }
    .meta {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #6B5C45;
      margin-bottom: 14px;
    }
    .nutrition {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #6B5C45;
      margin-bottom: 18px;
    }
    .nutrition-label { font-weight: 600; margin-right: 4px; }
    .nutrition-pill {
      background: rgba(196, 116, 60, 0.12);
      color: #8C4A1F;
      padding: 4px 10px;
      border-radius: 999px;
      font-weight: 600;
    }
    .hero {
      width: 100%;
      max-height: 280px;
      object-fit: cover;
      border-radius: 12px;
      margin-bottom: 18px;
    }
    .prep-gallery {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 4px 0 8px;
    }
    .prep-img {
      width: 48%;
      max-height: 220px;
      object-fit: cover;
      border-radius: 10px;
    }
    ul.ingredients {
      list-style: disc;
      padding-left: 20px;
      margin: 0 0 12px;
    }
    ul.ingredients li {
      font-size: 14px;
      padding: 4px 0;
      color: #2D2418;
    }
    ol.steps {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    ol.steps li {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 6px 0;
      font-size: 14px;
    }
    .step-num {
      flex-shrink: 0;
      font-weight: 700;
      color: #C4743C;
      min-width: 24px;
    }
    .step-text { flex: 1; }
    .source {
      font-size: 11px;
      color: #8A7E6B;
      margin-top: 28px;
      word-break: break-all;
    }
    .source a { color: #8A7E6B; text-decoration: none; }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #E5DBC9;
      font-size: 11px;
      color: #8A7E6B;
      text-align: center;
    }
    @page { margin: 0.5in; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${meta}
  ${heroImg}
  ${description}
  ${nutrition}
  <h2>Ingredients</h2>
  <ul class="ingredients">${ingredients}</ul>
  <h2>Steps</h2>
  <ol class="steps">${steps}</ol>
  ${prepGallery}
  ${sourceLink}
  <div class="footer">Shared from DinnerTime · dinnertime.app</div>
</body>
</html>`;
}

export type ShareRecipePdfResult =
  | { ok: true; uri: string }
  | {
      ok: false;
      reason:
        | 'print_unavailable'
        | 'sharing_unavailable'
        | 'sharing_disabled'
        | 'native_module_missing'
        | 'error';
      message?: string;
    };

/**
 * Recognize the "expo-print native module isn't linked into this dev
 * client" runtime error so the caller can surface a clear "rebuild
 * required" toast instead of the generic fallback. The expo-modules-core
 * error message is stable across SDK 54+.
 */
function isMissingNativeModuleError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes('not available') ||
    m.includes('not installed') ||
    m.includes('cannot find native module') ||
    m.includes('requirenativemodule')
  );
}

/**
 * Build a PDF for the recipe and open the iOS share sheet. Returns a
 * structured result so the caller can route to a toast / log / retry
 * without inspecting Error instances.
 */
export interface ShareRecipePdfOptions {
  /**
   * Resolved hero URI the in-app detail/preview screen is showing, which
   * may differ from `recipe.image_url` (e.g., Gemini-generated fallback
   * for legacy recipes without a stored image). When provided, takes
   * precedence over `recipe.image_url`.
   */
  heroUri?: string | null;
  /**
   * Preparation-step photo URLs shown in the detail-page slider. Inlined
   * and rendered as a gallery so the PDF mirrors what's on screen.
   */
  stepImageUrls?: Array<string | null> | null;
}

export async function shareRecipeAsPdf(
  recipe: RecipeForPdf,
  options?: ShareRecipePdfOptions,
): Promise<ShareRecipePdfResult> {
  const Print = getPrint();
  if (!Print) {
    return { ok: false, reason: 'print_unavailable' };
  }
  const Sharing = getSharing();
  if (!Sharing) {
    return { ok: false, reason: 'sharing_unavailable' };
  }
  const FileSystem = getFileSystem();

  try {
    // Pre-fetch the hero image and inline it as a data URI. WKWebView
    // wouldn't reliably wait for a remote <img> to load before printing.
    const sourceImageUrl = options?.heroUri ?? recipe.image_url ?? null;
    const inlinedImage = sourceImageUrl
      ? await imageUrlToDataUri(sourceImageUrl)
      : null;
    const recipeForHtml: RecipeForPdf = inlinedImage
      ? { ...recipe, image_url: inlinedImage }
      : recipe;

    // Inline the preparation-step photos the same way (data URIs), in
    // parallel. Drop any that fail to fetch so a single bad URL doesn't
    // block the share.
    const stepUrls = (options?.stepImageUrls ?? []).filter(
      (u): u is string => typeof u === 'string' && u.length > 0,
    );
    const inlinedSteps = (
      await Promise.all(stepUrls.map((u) => imageUrlToDataUri(u)))
    ).filter((u): u is string => typeof u === 'string' && u.length > 0);

    const html = buildRecipeHtml(recipeForHtml, inlinedSteps);

    // printToFileAsync returns a uri pointing to a tmp file. We move it
    // to cacheDirectory under a stable filename so the share-sheet
    // preview shows a recognizable name (DinnerTime-Recipe-Title.pdf)
    // instead of an opaque print-uuid.
    const printed = await Print.printToFileAsync({ html });
    const safeTitle = (recipe.title || 'recipe')
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'recipe';
    const finalName = `DinnerTime-${safeTitle}.pdf`;
    const finalUri = FileSystem
      ? `${FileSystem.cacheDirectory ?? ''}${finalName}`
      : null;

    if (FileSystem && finalUri) {
      try {
        // moveAsync clobbers the destination if it exists, which is fine —
        // re-shares of the same recipe should overwrite the cached copy.
        await FileSystem.moveAsync({ from: printed.uri, to: finalUri });
      } catch {
        // If move fails (e.g., the print uri lives outside the sandbox),
        // fall back to the print uri directly. The share sheet still works,
        // just with a less friendly filename.
        const canShareInline = await Sharing.isAvailableAsync();
        if (!canShareInline) {
          return { ok: false, reason: 'sharing_disabled' };
        }
        await Sharing.shareAsync(printed.uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Share recipe',
        });
        return { ok: true, uri: printed.uri };
      }
    } else {
      // Without expo-file-system we can't rename — share the raw print uri.
      const canShareInline = await Sharing.isAvailableAsync();
      if (!canShareInline) {
        return { ok: false, reason: 'sharing_disabled' };
      }
      await Sharing.shareAsync(printed.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Share recipe',
      });
      return { ok: true, uri: printed.uri };
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      return { ok: false, reason: 'sharing_disabled' };
    }
    await Sharing.shareAsync(finalUri!, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Share recipe',
    });
    return { ok: true, uri: finalUri! };
  } catch (err) {
    if (isMissingNativeModuleError(err)) {
      return {
        ok: false,
        reason: 'native_module_missing',
        message: err instanceof Error ? err.message : String(err),
      };
    }
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
