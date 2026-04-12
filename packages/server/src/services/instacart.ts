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

// RealInstacartClient implemented in Task 2 — minimal stub so tests can reference it.
export class RealInstacartClient implements InstacartClient {
  constructor(
    private apiKey: string,
    private baseUrl: string,
  ) {}

  async createShoppingListPage(
    _params: InstacartCreatePageParams,
  ): Promise<{ products_link_url: string }> {
    throw new Error('RealInstacartClient not yet implemented');
  }
}

export function getInstacartClient(): InstacartClient {
  const apiKey = process.env.INSTACART_API_KEY;
  if (!apiKey) return new StubInstacartClient();
  const baseUrl =
    process.env.INSTACART_BASE_URL ?? 'https://connect.dev.instacart.tools';
  return new RealInstacartClient(apiKey, baseUrl);
}
