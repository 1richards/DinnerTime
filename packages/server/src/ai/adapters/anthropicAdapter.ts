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

  async generateStructured<T>(i: GenerateStructuredInput<T>): Promise<T> {
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
