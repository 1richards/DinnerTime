/**
 * Provider-agnostic AI client interface.
 *
 * Services must depend on this module only — never import @anthropic-ai/sdk
 * or @google/genai directly. The concrete adapters (AnthropicAdapter,
 * GeminiAdapter) translate these shapes into vendor SDK calls.
 */

export type AITask =
  | 'vision.pantryScan'
  | 'recipe.parsePhoto'
  | 'recipe.parseUrl'
  | 'recipe.parseText'
  | 'suggestions.dinner'
  | 'mealPlanner.week'
  | 'recipe.discovery'
  | 'progression.ambition'
  | 'progression.variations'
  | 'shoppingList.variations'
  | 'cooking.voiceAsk'
  | 'cooking.tips'
  | 'ingredient.categorize';

export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: string[];
  description?: string;
}

export interface StructuredTool<T> {
  name: string;
  description: string;
  schema: JsonSchema;
  // Phantom type marker so TypeScript preserves T through the call chain.
  readonly __output?: T;
}

export interface GenerateTextInput {
  system?: string;
  user: string;
  maxTokens?: number;
}

export interface GenerateStructuredInput<T> {
  system?: string;
  user: string;
  tool: StructuredTool<T>;
  maxTokens?: number;
}

export interface AnalyzeImageStructuredInput<T> {
  system?: string;
  user: string;
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  tool: StructuredTool<T>;
  maxTokens?: number;
}

export interface AnalyzeImagesStructuredInput<T> {
  system?: string;
  user: string;
  images: Array<{ base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }>;
  tool: StructuredTool<T>;
  maxTokens?: number;
}

export interface AIClient {
  generateText(input: GenerateTextInput): Promise<string>;
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T>;
  analyzeImageStructured<T>(input: AnalyzeImageStructuredInput<T>): Promise<T>;
  analyzeImagesStructured<T>(input: AnalyzeImagesStructuredInput<T>): Promise<T>;
}
