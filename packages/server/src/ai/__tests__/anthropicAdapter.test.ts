import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_: unknown) {}
  },
}));

import { AnthropicAdapter } from '../adapters/anthropicAdapter.js';
import type { StructuredTool } from '../types.js';

const schema = {
  type: 'object' as const,
  properties: { a: { type: 'number' as const } },
};
const tool: StructuredTool<{ a: number }> = {
  name: 't',
  description: 'd',
  schema,
};

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test';
  mockCreate.mockReset();
});

describe('AnthropicAdapter.generateText', () => {
  it('returns the text block and sends correct payload', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'hi' }] });
    const adapter = new AnthropicAdapter('claude-sonnet-4-6');
    const out = await adapter.generateText({ system: 'sys', user: 'prompt' });
    expect(out).toBe('hi');
    const args = mockCreate.mock.calls[0][0];
    expect(args.model).toBe('claude-sonnet-4-6');
    expect(args.system).toBe('sys');
    expect(args.messages).toEqual([{ role: 'user', content: 'prompt' }]);
    expect(args.max_tokens).toBe(1024);
  });

  it('returns empty string when no text block present', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'tool_use', input: {} }] });
    const adapter = new AnthropicAdapter('claude-sonnet-4-6');
    expect(await adapter.generateText({ user: 'x' })).toBe('');
  });
});

describe('AnthropicAdapter.generateStructured', () => {
  it('returns the tool_use input and sends tools + tool_choice', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 't', input: { a: 1 } }],
    });
    const adapter = new AnthropicAdapter('claude-sonnet-4-6');
    const out = await adapter.generateStructured({ user: 'p', tool });
    expect(out).toEqual({ a: 1 });
    const args = mockCreate.mock.calls[0][0];
    expect(args.tools[0].name).toBe('t');
    expect(args.tools[0].description).toBe('d');
    expect(args.tools[0].input_schema).toBe(schema);
    expect(args.tool_choice).toEqual({ type: 'tool', name: 't' });
    expect(args.max_tokens).toBe(4096);
  });

  it('throws when no tool_use block in response', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'nope' }] });
    const adapter = new AnthropicAdapter('claude-sonnet-4-6');
    await expect(adapter.generateStructured({ user: 'p', tool })).rejects.toThrow(
      /no tool_use/
    );
  });
});

describe('AnthropicAdapter.analyzeImageStructured', () => {
  it('sends image block + text block and returns tool_use input', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 't', input: { a: 2 } }],
    });
    const adapter = new AnthropicAdapter('claude-sonnet-4-6');
    const out = await adapter.analyzeImageStructured({
      user: 'prompt',
      imageBase64: 'BASE64',
      mimeType: 'image/jpeg',
      tool,
    });
    expect(out).toEqual({ a: 2 });
    const args = mockCreate.mock.calls[0][0];
    const content = args.messages[0].content as Array<{
      type: string;
      source?: { media_type: string; data: string };
    }>;
    const image = content.find((b) => b.type === 'image');
    expect(image?.source?.media_type).toBe('image/jpeg');
    expect(image?.source?.data).toBe('BASE64');
    const text = content.find((b) => b.type === 'text') as unknown as { text: string };
    expect(text.text).toBe('prompt');
  });
});

describe('AnthropicAdapter.analyzeImagesStructured', () => {
  it('sends multiple image content blocks followed by text and returns tool_use input', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 't', input: { a: 3 } }],
    });
    const adapter = new AnthropicAdapter('claude-sonnet-4-6');
    const out = await adapter.analyzeImagesStructured({
      user: 'multi prompt',
      images: [
        { base64: 'IMG1', mimeType: 'image/jpeg' },
        { base64: 'IMG2', mimeType: 'image/png' },
      ],
      tool,
    });
    expect(out).toEqual({ a: 3 });

    const args = mockCreate.mock.calls[0][0];
    expect(args.model).toBe('claude-sonnet-4-6');
    expect(args.tool_choice).toEqual({ type: 'tool', name: 't' });
    expect(args.tools[0].name).toBe('t');

    const content = args.messages[0].content as Array<{
      type: string;
      source?: { type: string; media_type: string; data: string };
      text?: string;
    }>;

    // Should have 2 image blocks + 1 text block = 3 total
    expect(content).toHaveLength(3);

    // First two are images
    expect(content[0].type).toBe('image');
    expect(content[0].source?.media_type).toBe('image/jpeg');
    expect(content[0].source?.data).toBe('IMG1');
    expect(content[1].type).toBe('image');
    expect(content[1].source?.media_type).toBe('image/png');
    expect(content[1].source?.data).toBe('IMG2');

    // Last is text
    expect(content[2].type).toBe('text');
    expect(content[2].text).toBe('multi prompt');
  });

  it('returns parsed tool_use input from the response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 't', input: { a: 42 } }],
    });
    const adapter = new AnthropicAdapter('claude-sonnet-4-6');
    const result = await adapter.analyzeImagesStructured({
      user: 'test',
      images: [{ base64: 'X', mimeType: 'image/webp' }],
      tool,
    });
    expect(result).toEqual({ a: 42 });
  });

  it('throws when no tool_use block in response', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'nope' }] });
    const adapter = new AnthropicAdapter('claude-sonnet-4-6');
    await expect(
      adapter.analyzeImagesStructured({
        user: 'p',
        images: [{ base64: 'X', mimeType: 'image/jpeg' }],
        tool,
      })
    ).rejects.toThrow(/no tool_use/);
  });
});
