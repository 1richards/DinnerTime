import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/genai';
import { env } from '../../config/env.js';
import type {
  AIClient,
  AnalyzeImageStructuredInput,
  GenerateStructuredInput,
  GenerateTextInput,
  StructuredTool,
} from '../types.js';

export class MalformedFunctionCallError extends Error {
  constructor(message = 'gemini: MALFORMED_FUNCTION_CALL after retry') {
    super(message);
    this.name = 'MalformedFunctionCallError';
  }
}

export class GeminiSafetyBlockError extends Error {
  constructor(message = 'gemini: safety block, no candidates') {
    super(message);
    this.name = 'GeminiSafetyBlockError';
  }
}

interface StructuredCallOpts<T> {
  system?: string;
  tool: StructuredTool<T>;
  maxTokens?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: any[];
}

/**
 * Wraps @google/genai behind the AIClient interface.
 *
 * Notes:
 *  - Uses `config.maxOutputTokens` (NOT `max_tokens` — that's Anthropic).
 *  - Forces function calling via toolConfig when structured output is needed.
 *  - Retries ONCE on MALFORMED_FUNCTION_CALL (SDK known flaky in 1.48+).
 */
export class GeminiAdapter implements AIClient {
  private ai = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });

  constructor(private model: string) {}

  /**
   * Cooking domain: relax safety to avoid recipe text with alcohol / sharp
   * knives / raw meat tripping medium thresholds. We keep BLOCK_ONLY_HIGH
   * across all four categories.
   */
  private buildSafetySettings() {
    return [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
    ];
  }

  async generateText(i: GenerateTextInput): Promise<string> {
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: { parts: [{ text: i.user }] },
      config: {
        systemInstruction: i.system,
        maxOutputTokens: i.maxTokens ?? 1024,
        safetySettings: this.buildSafetySettings(),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((res as any).text as string | undefined) ?? '';
  }

  async generateStructured<T>(i: GenerateStructuredInput<T>): Promise<T> {
    return this.callStructured<T>({
      system: i.system,
      tool: i.tool,
      maxTokens: i.maxTokens,
      parts: [{ text: i.user }],
    });
  }

  async analyzeImageStructured<T>(
    i: AnalyzeImageStructuredInput<T>
  ): Promise<T> {
    return this.callStructured<T>({
      system: i.system,
      tool: i.tool,
      maxTokens: i.maxTokens,
      parts: [
        { text: i.user },
        { inlineData: { mimeType: i.mimeType, data: i.imageBase64 } },
      ],
    });
  }

  private async callStructured<T>(
    opts: StructuredCallOpts<T>,
    attempt = 0
  ): Promise<T> {
    const req = {
      model: this.model,
      contents: { parts: opts.parts },
      config: {
        systemInstruction: opts.system,
        maxOutputTokens: opts.maxTokens ?? 4096,
        tools: [
          {
            functionDeclarations: [
              {
                name: opts.tool.name,
                description: opts.tool.description,
                parametersJsonSchema: opts.tool.schema,
              },
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: [opts.tool.name],
          },
        },
        safetySettings: this.buildSafetySettings(),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await this.ai.models.generateContent(req as any);

    if (!res.candidates || res.candidates.length === 0) {
      throw new GeminiSafetyBlockError();
    }

    if (res.candidates[0].finishReason === 'MALFORMED_FUNCTION_CALL') {
      if (attempt === 0) {
        return this.callStructured<T>(opts, 1);
      }
      throw new MalformedFunctionCallError();
    }

    const parts = res.candidates[0].content?.parts ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = parts.find((p: any) => p.functionCall)?.functionCall;
    if (!call) {
      throw new Error('gemini: no functionCall part in response');
    }
    return call.args as T;
  }
}
