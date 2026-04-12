import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  StubInstacartClient,
  RealInstacartClient,
  getInstacartClient,
} from '../instacart.js';

describe('StubInstacartClient', () => {
  it('returns deterministic example.com URL with slugified title', async () => {
    const client = new StubInstacartClient();
    const result = await client.createShoppingListPage({
      title: 'Week of Apr 13',
      line_items: [{ name: 'Eggs' }],
    });
    expect(result.products_link_url).toBe(
      'https://example.com/stub-instacart/week-of-apr-13',
    );
  });

  it('is deterministic across calls with the same title', async () => {
    const client = new StubInstacartClient();
    const a = await client.createShoppingListPage({
      title: 'My List',
      line_items: [],
    });
    const b = await client.createShoppingListPage({
      title: 'My List',
      line_items: [],
    });
    expect(a.products_link_url).toBe(b.products_link_url);
  });

  it('URL-encodes unusual characters in slug', async () => {
    const client = new StubInstacartClient();
    const result = await client.createShoppingListPage({
      title: 'Fish & Chips',
      line_items: [],
    });
    // lowercased, spaces -> hyphens, then URL-encoded
    expect(result.products_link_url).toBe(
      'https://example.com/stub-instacart/fish-%26-chips',
    );
  });
});

describe('getInstacartClient factory', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns StubInstacartClient when INSTACART_API_KEY is unset', () => {
    vi.stubEnv('INSTACART_API_KEY', '');
    const client = getInstacartClient();
    expect(client).toBeInstanceOf(StubInstacartClient);
  });

  it('returns RealInstacartClient when INSTACART_API_KEY is set', () => {
    vi.stubEnv('INSTACART_API_KEY', 'test-key');
    const client = getInstacartClient();
    expect(client).toBeInstanceOf(RealInstacartClient);
  });
});
