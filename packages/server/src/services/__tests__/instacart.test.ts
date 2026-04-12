import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  StubInstacartClient,
  RealInstacartClient,
  getInstacartClient,
} from '../instacart.js';

function makeResponse(
  ok: boolean,
  status: number,
  body: unknown,
  text = '',
): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => text,
  } as unknown as Response;
}

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

describe('RealInstacartClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to /idp/v1/products/products_link with Bearer auth and correct body', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(true, 200, {
        products_link_url: 'https://customers.dev.instacart.tools/store/xyz',
      }),
    );

    const client = new RealInstacartClient(
      'test-key',
      'https://connect.dev.instacart.tools',
    );
    const result = await client.createShoppingListPage({
      title: 'Week of Apr 13',
      line_items: [
        {
          name: 'Eggs',
          line_item_measurements: [{ quantity: 12, unit: 'each' }],
        },
      ],
    });

    expect(result.products_link_url).toBe(
      'https://customers.dev.instacart.tools/store/xyz',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://connect.dev.instacart.tools/idp/v1/products/products_link',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      title: 'Week of Apr 13',
      link_type: 'shopping_list',
      expires_in: 30,
      line_items: [
        {
          name: 'Eggs',
          line_item_measurements: [{ quantity: 12, unit: 'each' }],
        },
      ],
    });
    expect(body.landing_page_configuration).toBeUndefined();
  });

  it('uses provided expires_in and includes partner_linkback_url when given', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(true, 200, { products_link_url: 'https://x' }),
    );
    const client = new RealInstacartClient('k', 'https://connect.example.com');
    await client.createShoppingListPage({
      title: 't',
      line_items: [],
      expires_in: 7,
      partner_linkback_url: 'https://dinnertime.app/orders/123',
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.expires_in).toBe(7);
    expect(body.landing_page_configuration).toEqual({
      partner_linkback_url: 'https://dinnertime.app/orders/123',
    });
  });

  it('throws an error containing the status code and body text on non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      makeResponse(false, 502, null, 'upstream down'),
    );
    const client = new RealInstacartClient('k', 'https://connect.example.com');
    await expect(
      client.createShoppingListPage({ title: 't', line_items: [] }),
    ).rejects.toThrow(/502.*upstream down/);
  });
});
