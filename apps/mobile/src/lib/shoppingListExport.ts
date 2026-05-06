/**
 * Shopping list → plain text or PDF → iOS share sheet.
 *
 * MVP replacement for the Instacart handoff (deferred to post-MVP per
 * the launch finish-line scope cut). Two share paths:
 *   - shareShoppingListAsText: react-native built-in Share.share, opens
 *     iOS share sheet with formatted text. Works for Notes, Messages,
 *     Mail, Reminders, Copy, etc. — the lowest-friction option for a
 *     user who just wants to read the list while at the store.
 *   - shareShoppingListAsPdf: builds an HTML doc + expo-print +
 *     expo-sharing, mirrors the recipePdf.ts pattern. Better for users
 *     who want a printable list or a Files-saved copy.
 *
 * Both filter to UNCHECKED items only — checked rows are already in
 * the cart so exporting them is noise.
 */
import { Share } from 'react-native';
import type { ShoppingList, ShoppingListItem, GroceryCategory } from '../types/shopping';
import { formatQuantity } from './scaleIngredient';

type PrintModule = typeof import('expo-print');
type SharingModule = typeof import('expo-sharing');
type FileSystemModule = typeof import('expo-file-system/legacy');

// Lazy-load native modules so this file stays test-loadable in node and
// degrades gracefully on dev clients predating expo-print.
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

const CATEGORY_ORDER: GroceryCategory[] = [
  'produce',
  'protein',
  'dairy',
  'bakery',
  'frozen',
  'pantry',
  'condiments',
  'spices',
  'beverages',
  'other',
];

const CATEGORY_LABELS: Record<GroceryCategory, string> = {
  produce: 'Produce',
  protein: 'Protein',
  dairy: 'Dairy',
  bakery: 'Bakery',
  frozen: 'Frozen',
  pantry: 'Pantry',
  condiments: 'Condiments',
  spices: 'Spices',
  beverages: 'Beverages',
  other: 'Other',
};

/**
 * Render a single item as "qty unit name". Mirrors the in-app row layout
 * so a user reading the share output sees the same shape they saw in
 * the Shopping tab.
 */
function formatItemLine(item: ShoppingListItem): string {
  const qty = item.quantity != null ? formatQuantity(item.quantity) : '';
  const unit = item.unit?.trim() ?? '';
  const name = item.name?.trim() ?? '';
  const left = [qty, unit].filter((s) => s.length > 0).join(' ');
  return left.length > 0 ? `${left} ${name}` : name;
}

/**
 * Group unchecked items by category, in the same display order as the
 * Shopping tab (CategorySection rendering uses the same ordering).
 */
export function groupUncheckedByCategory(
  items: ShoppingListItem[],
): Array<{ category: GroceryCategory; items: ShoppingListItem[] }> {
  const groups: Partial<Record<GroceryCategory, ShoppingListItem[]>> = {};
  for (const item of items) {
    if (item.checked) continue;
    const cat = item.category ?? 'other';
    (groups[cat] ??= []).push(item);
  }
  return CATEGORY_ORDER.flatMap((cat) =>
    groups[cat] && groups[cat]!.length > 0
      ? [{ category: cat, items: groups[cat]! }]
      : [],
  );
}

/**
 * Build a share-ready plain-text shopping list. Categories as headers,
 * items as bullet lines. Apple Notes auto-converts "- " bullets into
 * the Notes checklist style when pasted, which is exactly the UX a
 * shopper wants.
 */
export function buildShoppingListText(
  list: ShoppingList | null,
  items: ShoppingListItem[],
): string {
  const groups = groupUncheckedByCategory(items);
  if (groups.length === 0) {
    return 'Shopping List\n\n(All items already checked off.)';
  }
  const heading = list?.title?.trim() || 'Shopping List';
  const dateLine = new Date(list?.generated_at ?? Date.now()).toLocaleDateString(
    undefined,
    { weekday: 'short', month: 'short', day: 'numeric' },
  );
  const sections = groups.map(({ category, items: rows }) => {
    const header = CATEGORY_LABELS[category];
    const lines = rows.map((r) => `- ${formatItemLine(r)}`).join('\n');
    return `${header}\n${lines}`;
  });
  return `${heading}\n${dateLine}\n\n${sections.join('\n\n')}\n\n— DinnerTime`;
}

/**
 * Open the iOS share sheet with the plain-text list. Returns true on
 * share success (any recipient), false on dismiss/cancel/error. The
 * built-in react-native Share API routes appropriately for every
 * registered share target — Notes, Messages, Mail, Reminders, Copy,
 * AirDrop, third-party extensions.
 */
export async function shareShoppingListAsText(
  list: ShoppingList | null,
  items: ShoppingListItem[],
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const text = buildShoppingListText(list, items);
    const result = await Share.share({
      message: text,
      title: list?.title || 'Shopping List',
    });
    return result.action === Share.dismissedAction
      ? { ok: false, reason: 'dismissed' }
      : { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'share_failed',
    };
  }
}

/**
 * Build a printable HTML shopping list. Categories as section headers,
 * items as checkbox rows. Inline CSS only, no external assets — same
 * pattern as recipePdf.ts.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildShoppingListHtml(
  list: ShoppingList | null,
  items: ShoppingListItem[],
): string {
  const groups = groupUncheckedByCategory(items);
  const heading = escapeHtml(list?.title?.trim() || 'Shopping List');
  const dateLine = escapeHtml(
    new Date(list?.generated_at ?? Date.now()).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  );

  const body =
    groups.length === 0
      ? `<p class="empty">All items are already checked off.</p>`
      : groups
          .map(({ category, items: rows }) => {
            const header = escapeHtml(CATEGORY_LABELS[category]);
            const lis = rows
              .map(
                (r) =>
                  `<li><span class="checkbox"></span><span class="item">${escapeHtml(formatItemLine(r))}</span></li>`,
              )
              .join('');
            return `<section><h2>${header}</h2><ul>${lis}</ul></section>`;
          })
          .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${heading}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, sans-serif;
      color: #2D2418;
      background: #FAF7F2;
      margin: 0;
      padding: 32px 36px 56px;
      line-height: 1.5;
    }
    h1 {
      font-size: 28px;
      margin: 0 0 4px;
      line-height: 1.2;
    }
    .date {
      font-size: 13px;
      color: #6B5C45;
      margin-bottom: 24px;
    }
    h2 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #C4743C;
      margin: 22px 0 10px;
      font-weight: 800;
      border-bottom: 1px solid #E5DBC9;
      padding-bottom: 6px;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    li {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 0;
      font-size: 14px;
    }
    .checkbox {
      flex-shrink: 0;
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 1.5px solid #6B5C45;
      border-radius: 4px;
    }
    .item { flex: 1; }
    .empty {
      font-size: 14px;
      color: #6B5C45;
      font-style: italic;
      margin-top: 24px;
    }
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
  <h1>${heading}</h1>
  <div class="date">${dateLine}</div>
  ${body}
  <div class="footer">Shared from DinnerTime · dinnertime.app</div>
</body>
</html>`;
}

export type ShareShoppingListPdfResult =
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
 * Build a PDF for the shopping list and open the iOS share sheet.
 * Mirrors shareRecipeAsPdf — same lazy-load + cacheDirectory + share
 * pattern, just without the hero image complication.
 */
export async function shareShoppingListAsPdf(
  list: ShoppingList | null,
  items: ShoppingListItem[],
): Promise<ShareShoppingListPdfResult> {
  const Print = getPrint();
  if (!Print) return { ok: false, reason: 'print_unavailable' };
  const Sharing = getSharing();
  if (!Sharing) return { ok: false, reason: 'sharing_unavailable' };
  const FileSystem = getFileSystem();

  try {
    const html = buildShoppingListHtml(list, items);
    const printed = await Print.printToFileAsync({ html });
    const safeTitle = (list?.title || 'shopping-list')
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'shopping-list';
    const finalName = `DinnerTime-${safeTitle}.pdf`;
    const finalUri = FileSystem
      ? `${FileSystem.cacheDirectory ?? ''}${finalName}`
      : null;

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return { ok: false, reason: 'sharing_disabled' };

    if (FileSystem && finalUri) {
      try {
        await FileSystem.moveAsync({ from: printed.uri, to: finalUri });
        await Sharing.shareAsync(finalUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Share shopping list',
        });
        return { ok: true, uri: finalUri };
      } catch {
        // Fall through to share the raw print uri
      }
    }
    await Sharing.shareAsync(printed.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Share shopping list',
    });
    return { ok: true, uri: printed.uri };
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
