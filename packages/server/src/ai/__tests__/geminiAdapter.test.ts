import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
    constructor(_: unknown) {}
  },
  FunctionCallingConfigMode: { ANY: 'ANY' },
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH: 'HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'DANGEROUS_CONTENT',
  },
  HarmBlockThreshold: { BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH' },
}));

import {
  GeminiAdapter,
  GeminiSafetyBlockError,
  MalformedFunctionCallError,
} from '../adapters/geminiAdapter.js';
import type { StructuredTool } from '../types.js';

const schema = {
  type: 'object' as const,
  properties: { x: { type: 'number' as const } },
};
const tool: StructuredTool<{ x: number }> = {
  name: 't',
  description: 'd',
  schema,
};

beforeEach(() => {
  process.env.GOOGLE_API_KEY = 'test';
  mockGenerateContent.mockReset();
});

describe('GeminiAdapter.generateText', () => {
  it('returns res.text and sends systemInstruction + maxOutputTokens', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'hello',
      candidates: [{ content: { parts: [] } }],
    });
    const adapter = new GeminiAdapter('gemini-3-flash-preview');
    const out = await adapter.generateText({ system: 'sys', user: 'prompt' });
    expect(out).toBe('hello');
    const args = mockGenerateContent.mock.calls[0][0];
    expect(args.model).toBe('gemini-3-flash-preview');
    expect(args.config.systemInstruction).toBe('sys');
    expect(args.config.maxOutputTokens).toBe(1024);
    expect(args.contents.parts[0].text).toBe('prompt');
    expect(args.max_tokens).toBeUndefined();
  });
});

describe('GeminiAdapter.generateStructured', () => {
  it('returns functionCall args and sends tools + toolConfig.ANY', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ functionCall: { name: 't', args: { x: 1 } } }] },
        },
      ],
    });
    const adapter = new GeminiAdapter('gemini-3-flash-preview');
    const out = await adapter.generateStructured({ user: 'p', tool });
    expect(out).toEqual({ x: 1 });
    const args = mockGenerateContent.mock.calls[0][0];
    expect(args.config.tools[0].functionDeclarations[0].name).toBe('t');
    expect(args.config.tools[0].functionDeclarations[0].parametersJsonSchema).toBe(
      schema
    );
    expect(args.config.toolConfig.functionCallingConfig.mode).toBe('ANY');
    expect(
      args.config.toolConfig.functionCallingConfig.allowedFunctionNames
    ).toEqual(['t']);
    expect(args.config.maxOutputTokens).toBe(4096);
  });

  it('retries ONCE on MALFORMED_FUNCTION_CALL and returns the valid result', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({
        candidates: [
          {
            finishReason: 'MALFORMED_FUNCTION_CALL',
            content: { parts: [] },
          },
        ],
      })
      .mockResolvedValueOnce({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [{ functionCall: { name: 't', args: { x: 7 } } }],
            },
          },
        ],
      });
    const adapter = new GeminiAdapter('gemini-3-flash-preview');
    const out = await adapter.generateStructured({ user: 'p', tool });
    expect(out).toEqual({ x: 7 });
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('throws MalformedFunctionCallError on second MALFORMED', async () => {
    const malformed = {
      candidates: [
        { finishReason: 'MALFORMED_FUNCTION_CALL', content: { parts: [] } },
      ],
    };
    mockGenerateContent.mockResolvedValue(malformed);
    const adapter = new GeminiAdapter('gemini-3-flash-preview');
    await expect(
      adapter.generateStructured({ user: 'p', tool })
    ).rejects.toBeInstanceOf(MalformedFunctionCallError);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('throws GeminiSafetyBlockError on empty candidates', async () => {
    mockGenerateContent.mockResolvedValue({ candidates: [] });
    const adapter = new GeminiAdapter('gemini-3-flash-preview');
    await expect(
      adapter.generateStructured({ user: 'p', tool })
    ).rejects.toBeInstanceOf(GeminiSafetyBlockError);
  });
});

describe('GeminiAdapter.analyzeImageStructured', () => {
  it('includes inlineData part and text part', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ functionCall: { name: 't', args: { x: 3 } } }] },
        },
      ],
    });
    const adapter = new GeminiAdapter('gemini-3-flash-preview');
    const out = await adapter.analyzeImageStructured({
      user: 'prompt',
      imageBase64: 'BASE64',
      mimeType: 'image/jpeg',
      tool,
    });
    expect(out).toEqual({ x: 3 });
    const args = mockGenerateContent.mock.calls[0][0];
    const parts = args.contents.parts as Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }>;
    const inline = parts.find((p) => p.inlineData);
    expect(inline?.inlineData?.mimeType).toBe('image/jpeg');
    expect(inline?.inlineData?.data).toBe('BASE64');
    const text = parts.find((p) => p.text);
    expect(text?.text).toBe('prompt');
  });
});

describe('GeminiAdapter.analyzeImagesStructured', () => {
  it('throws not implemented error', async () => {
    const adapter = new GeminiAdapter('gemini-3-flash-preview');
    await expect(
      adapter.analyzeImagesStructured({
        user: 'prompt',
        images: [{ base64: 'X', mimeType: 'image/jpeg' }],
        tool,
      })
    ).rejects.toThrow('analyzeImagesStructured not implemented for Gemini');
  });
});

describe('GeminiAdapter safety settings', () => {
  it('passes 4 BLOCK_ONLY_HIGH safety settings on structured calls', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ functionCall: { name: 't', args: { x: 1 } } }] },
        },
      ],
    });
    const adapter = new GeminiAdapter('gemini-3-flash-preview');
    await adapter.generateStructured({ user: 'p', tool });
    const args = mockGenerateContent.mock.calls[0][0];
    expect(args.config.safetySettings).toHaveLength(4);
    for (const entry of args.config.safetySettings) {
      expect(entry.threshold).toBe('BLOCK_ONLY_HIGH');
    }
  });
});
