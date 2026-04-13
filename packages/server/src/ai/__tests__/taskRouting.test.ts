import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock adapters so the factory does not attempt to construct real SDK clients.
const { AnthropicAdapterMock, GeminiAdapterMock } = vi.hoisted(() => ({
  AnthropicAdapterMock: vi.fn(function (this: { __kind: string; model: string }, model: string) {
    this.__kind = 'anthropic';
    this.model = model;
  }),
  GeminiAdapterMock: vi.fn(function (this: { __kind: string; model: string }, model: string) {
    this.__kind = 'gemini';
    this.model = model;
  }),
}));

vi.mock('../adapters/anthropicAdapter.js', () => ({
  AnthropicAdapter: AnthropicAdapterMock,
}));
vi.mock('../adapters/geminiAdapter.js', () => ({
  GeminiAdapter: GeminiAdapterMock,
}));

import { getClientFor } from '../clientFactory.js';
import { ALL_TASKS, TASK_ROUTES } from '../taskRouting.js';
import type { AITask } from '../types.js';

describe('taskRouting', () => {
  beforeEach(() => {
    AnthropicAdapterMock.mockClear();
    GeminiAdapterMock.mockClear();
  });

  it('has a route entry for every AITask in ALL_TASKS', () => {
    for (const task of ALL_TASKS) {
      expect(TASK_ROUTES[task]).toBeDefined();
      expect(TASK_ROUTES[task].provider).toMatch(/^(anthropic|google)$/);
      expect(TASK_ROUTES[task].model.length).toBeGreaterThan(0);
    }
    expect(ALL_TASKS.length).toBe(Object.keys(TASK_ROUTES).length);
  });

  it('every anthropic-routed task uses claude-sonnet-4-6', () => {
    const anthropicRoutes = (Object.entries(TASK_ROUTES) as [AITask, { provider: string; model: string }][])
      .filter(([, r]) => r.provider === 'anthropic');
    expect(anthropicRoutes.length).toBeGreaterThan(0);
    for (const [, route] of anthropicRoutes) {
      expect(route.model).toBe('claude-sonnet-4-6');
    }
  });

  it('getClientFor(vision.pantryScan) returns AnthropicAdapter with claude-sonnet-4-6', () => {
    const client = getClientFor('vision.pantryScan') as unknown as {
      __kind: string;
      model: string;
    };
    expect(client.__kind).toBe('anthropic');
    expect(client.model).toBe('claude-sonnet-4-6');
    expect(AnthropicAdapterMock).toHaveBeenCalledWith('claude-sonnet-4-6');
  });

  it('getClientFor(suggestions.dinner) returns GeminiAdapter with gemini-3-flash-preview', () => {
    const client = getClientFor('suggestions.dinner') as unknown as {
      __kind: string;
      model: string;
    };
    expect(client.__kind).toBe('gemini');
    expect(client.model).toBe('gemini-3-flash-preview');
  });

  it('getClientFor(mealPlanner.week) returns GeminiAdapter with gemini-3.1-pro-preview', () => {
    const client = getClientFor('mealPlanner.week') as unknown as {
      __kind: string;
      model: string;
    };
    expect(client.__kind).toBe('gemini');
    expect(client.model).toBe('gemini-3.1-pro-preview');
  });

  it('getClientFor(cooking.tips) returns GeminiAdapter with gemini-3.1-flash-lite-preview', () => {
    const client = getClientFor('cooking.tips') as unknown as {
      __kind: string;
      model: string;
    };
    expect(client.__kind).toBe('gemini');
    expect(client.model).toBe('gemini-3.1-flash-lite-preview');
  });

  it('env.GOOGLE_API_KEY throws when unset and returns value when set', async () => {
    const prior = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    const { env } = await import('../../config/env.js');
    expect(() => env.GOOGLE_API_KEY).toThrow(/GOOGLE_API_KEY/);
    process.env.GOOGLE_API_KEY = 'test-key';
    expect(env.GOOGLE_API_KEY).toBe('test-key');
    if (prior === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = prior;
  });
});
