import type { InstacartLineItem } from '../types/shopping.js';

export interface InstacartCreatePageParams {
  title: string;
  line_items: InstacartLineItem[];
  expires_in?: number; // days, max 365
  partner_linkback_url?: string;
}

export interface InstacartClient {
  createShoppingListPage(
    params: InstacartCreatePageParams,
  ): Promise<{ products_link_url: string }>;
}

export class StubInstacartClient implements InstacartClient {
  async createShoppingListPage({ title }: InstacartCreatePageParams) {
    const slug = encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'));
    return { products_link_url: `https://example.com/stub-instacart/${slug}` };
  }
}

export class RealInstacartClient implements InstacartClient {
  constructor(
    private apiKey: string,
    private baseUrl: string,
  ) {}

  async createShoppingListPage(
    params: InstacartCreatePageParams,
  ): Promise<{ products_link_url: string }> {
    const {
      title,
      line_items,
      expires_in = 30,
      partner_linkback_url,
    } = params;
    const body: Record<string, unknown> = {
      title,
      link_type: 'shopping_list',
      expires_in,
      line_items,
    };
    if (partner_linkback_url) {
      body.landing_page_configuration = { partner_linkback_url };
    }
    const res = await fetch(
      `${this.baseUrl}/idp/v1/products/products_link`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Instacart API ${res.status}: ${text}`);
    }
    return (await res.json()) as { products_link_url: string };
  }
}

export function getInstacartClient(): InstacartClient {
  const apiKey = process.env.INSTACART_API_KEY;
  if (!apiKey) return new StubInstacartClient();
  const baseUrl =
    process.env.INSTACART_BASE_URL ?? 'https://connect.dev.instacart.tools';
  return new RealInstacartClient(apiKey, baseUrl);
}
