import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import type {
  AIClient,
  AnalyzeImageStructuredInput,
  AnalyzeImagesStructuredInput,
  GenerateStructuredInput,
  GenerateTextInput,
} from '../types.js';

/**
 * Wraps @anthropic-ai/sdk behind the AIClient interface. No Anthropic types
 * are re-exported — consumers see only AIClient.
 */
export class AnthropicAdapter implements AIClient {
  private client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  constructor(private model: string) {}

  async generateText(i: GenerateTextInput): Promise<string> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: i.maxTokens ?? 1024,
      system: i.system,
      messages: [{ role: 'user', content: i.user }],
    });
    const block = (res.content as Array<{ type: string; text?: string }>).find(
      (b) => b.type === 'text'
    );
    return block?.text ?? '';
  }

  /**
   * Stream text deltas. Bridges @anthropic-ai/sdk's `.messages.stream(...)` to
   * a plain async iterable so route handlers never touch vendor types.
   *
   * Pitfall 2 guard: tool calls break the `.on('text')` event — keep this
   * adapter path tool-free. Structured outputs continue to go through
   * `generateStructured`.
   */
  async *generateStream(i: GenerateTextInput): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: i.maxTokens ?? 1024,
      system: i.system,
      messages: [{ role: 'user', content: i.user }],
    });

    // Collect deltas via the SDK's event emitter and drain them via a queue
    // so we can expose them as an AsyncIterable (decouples consumer backpressure
    // from Anthropic's internal timing).
    const queue: string[] = [];
    let resolveNext: ((v: void) => void) | null = null;
    let done = false;
    let streamErr: unknown = null;

    stream.on('text', (text: string) => {
      queue.push(text);
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    });

    stream.on('error', (err: unknown) => {
      streamErr = err;
      done = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    });

    stream.on('end', () => {
      done = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    });

    while (true) {
      if (queue.length > 0) {
        yield queue.shift() as string;
        continue;
      }
      if (streamErr) {
        throw streamErr instanceof Error ? streamErr : new Error(String(streamErr));
      }
      if (done) return;
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });
    }
  }

  async generateStructured<T>(i: GenerateStructuredInput<T>): Promise<T> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: i.maxTokens ?? 4096,
      // Decision 6 / Fix 3: cache the large static discovery system prefix.
      // ephemeral = ~5 min provider-side prompt cache; cuts input-token
      // processing (and cost) on every call. Anthropic caches the longest
      // matching prefix that ends at a cache_control breakpoint, so we mark
      // BOTH the system block and the tool schema (the static prefix) — the
      // variable user prompt (`i.user`) below stays uncached on purpose.
      // Payoff requires the static prefix to clear Anthropic's ~1024-token
      // cache minimum; verify against live token counts (perf-ai-suggestions-
      // latency.md Fix 3 — no live run in this phase).
      system: [
        {
          type: 'text' as const,
          // `i.system` is optional in the AIClient contract; the text-block
          // `text` field requires a definite string, so coalesce (an absent
          // system was already an empty prefix).
          text: i.system ?? '',
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      tools: [
        {
          name: i.tool.name,
          description: i.tool.description,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input_schema: i.tool.schema as any,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      tool_choice: { type: 'tool', name: i.tool.name },
      messages: [{ role: 'user', content: i.user }],
    });
    const block = (
      res.content as Array<{ type: string; input?: unknown }>
    ).find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      throw new Error('anthropic: no tool_use block in response');
    }
    return block.input as T;
  }

  async analyzeImageStructured<T>(
    i: AnalyzeImageStructuredInput<T>
  ): Promise<T> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: i.maxTokens ?? 4096,
      system: i.system,
      tools: [
        {
          name: i.tool.name,
          description: i.tool.description,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input_schema: i.tool.schema as any,
        },
      ],
      tool_choice: { type: 'tool', name: i.tool.name },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: i.mimeType,
                data: i.imageBase64,
              },
            },
            { type: 'text', text: i.user },
          ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
    });
    const block = (
      res.content as Array<{ type: string; input?: unknown }>
    ).find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      throw new Error('anthropic: no tool_use block in response');
    }
    return block.input as T;
  }

  async analyzeImagesStructured<T>(
    i: AnalyzeImagesStructuredInput<T>
  ): Promise<T> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: i.maxTokens ?? 4096,
      system: i.system,
      tools: [
        {
          name: i.tool.name,
          description: i.tool.description,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input_schema: i.tool.schema as any,
        },
      ],
      tool_choice: { type: 'tool', name: i.tool.name },
      messages: [
        {
          role: 'user',
          content: [
            ...i.images.map((img) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: img.mimeType,
                data: img.base64,
              },
            })),
            { type: 'text' as const, text: i.user },
          ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
    });
    const block = (
      res.content as Array<{ type: string; input?: unknown }>
    ).find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      throw new Error('anthropic: no tool_use block in response');
    }
    return block.input as T;
  }
}
