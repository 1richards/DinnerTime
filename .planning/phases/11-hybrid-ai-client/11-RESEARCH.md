# Phase 11: Hybrid AI Client - Research

**Researched:** 2026-04-10
**Domain:** Multi-provider LLM abstraction (Anthropic + Google GenAI)
**Confidence:** HIGH (models, SDKs, API shapes verified against official docs); MEDIUM (open pitfall mitigation details)

## Summary

The DinnerTime server currently wires every AI service directly to `@anthropic-ai/sdk@^0.88.0` via a single shared `anthropic` client in `packages/server/src/config/anthropic.ts`. All 10+ services (vision, suggestions, mealPlanner, recipeParser, recipeDiscovery, progression, shoppingList, cookingTips, ingredientCategories, plus the `routes/cooking.ts` voice Q&A endpoint) call `anthropic.messages.create({...})` with either plain text, tool_use forced calls, or image blocks. Tests mock `@anthropic-ai/sdk` directly via `vi.mock('@anthropic-ai/sdk', ...)` using a `mockCreate` hoist pattern.

The goal is a provider-agnostic `AIClient` abstraction that can route each service to either Anthropic (`claude-sonnet-4-6`) or Google (`gemini-3-*`) without leaking provider types. The ecosystem direction is clear in April 2026: the unified Google SDK is `@google/genai` (NOT the deprecated `@google/generative-ai`), currently at v1.48.x, and exposes a `GoogleGenAI` client whose `models.generateContent({...})` shape is the official counterpart to `anthropic.messages.create({...})`.

**Primary recommendation:** Introduce a thin `AIClient` interface with three methods — `generateText`, `generateStructured<T>`, `analyzeImageStructured<T>` — backed by two adapters (`AnthropicAdapter`, `GeminiAdapter`). Route per service via a `getClientFor(task)` factory keyed to the model map below. Tests mock the `AIClient` interface, NOT provider SDKs, so existing `@anthropic-ai/sdk` mocks get replaced with a single shared mock helper.

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase. Constraints come from the task objective:

### Locked Decisions
- All 10 services + `routes/cooking.ts` voice Q&A must be refactored to go through the abstraction.
- Per-service model routing must match the mapping table in the objective (vision + recipeParser photo path on Anthropic Sonnet 4.6; all others on Gemini 3.x).
- Both providers must be supported simultaneously (hybrid, not replacement).
- The abstraction must not leak provider-specific types into service code.
- Existing test files must not require rewrites of every mock — prefer mocking the abstraction.

### Claude's Discretion
- Exact shape of the `AIClient` interface and adapter internals.
- Whether to use a factory function, DI, or a `clientFor(task)` registry.
- How to implement retry/repair for Gemini `MALFORMED_FUNCTION_CALL`.
- Whether to keep the `anthropic` singleton export for transitional back-compat.

### Deferred Ideas (OUT OF SCOPE)
- Streaming responses (no service currently streams).
- Vertex AI / AWS Bedrock endpoints (direct API only).
- Switching providers based on runtime cost/latency (static routing only).
- Prompt caching optimization.

## Phase Requirements

No formal REQ-IDs provided. Derived requirements from objective:

| ID | Description | Research Support |
|----|-------------|-----------------|
| HYBRID-01 | Unified `AIClient` interface shipping both Anthropic + Gemini adapters | "Recommended Abstraction Shape" section |
| HYBRID-02 | Per-task static model routing per mapping table | "Task → Provider/Model Map" section |
| HYBRID-03 | Refactor all 10 services + `routes/cooking.ts` without leaking provider types | "Services to Refactor" + "Abstraction Shape" |
| HYBRID-04 | Tests continue to pass without per-file SDK mock rewrites | "Testing Strategy" section |
| HYBRID-05 | Add `@google/genai` dependency; keep `@anthropic-ai/sdk` | "Standard Stack" section |
| HYBRID-06 | Support Gemini `MALFORMED_FUNCTION_CALL` retry | "Common Pitfalls" section |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `^0.88.0` (keep) | Claude client | Already in use; supports tool_use, vision, system prompts |
| `@google/genai` | `^1.48.0` | Gemini client (unified SDK) | **Official** Google Gen AI SDK as of 2026. Required for Gemini 2.0+ and all Gemini 3.x models. Node 20+. Supports function calling, inlineData vision, systemInstruction, toolConfig forced-call mode |

**Deprecated — DO NOT USE:**
- `@google/generative-ai` — the old Gemini SDK. Superseded by `@google/genai`. Does not support Gemini 3.x family features and is in maintenance mode.
- `@google-ai/generativelanguage` — low-level gRPC client. Not for app code.

### Installation
```bash
# From packages/server/
npm install @google/genai
```

Add `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) to `packages/server/src/config/env.ts` alongside `ANTHROPIC_API_KEY`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@google/genai` direct | Vercel `@ai-sdk/google` | Adds Vercel AI SDK abstraction layer on top of our own — two abstractions. Reject. |
| Hand-built `fetch` calls | — | Loses typed schemas, retry, streaming; no benefit |
| LangChain `@langchain/google-genai` | — | Heavy dep, indirection, LangChain lock-in |

## Task → Provider/Model Map

Verified exact model identifiers:

| Service / Route | Provider | Exact Model ID | Notes |
|-----------------|----------|----------------|-------|
| `services/vision.ts` (pantry scan, image) | Anthropic | `claude-sonnet-4-6` | Vision + forced tool_use |
| `services/recipeParser.ts` (photo path) | Anthropic | `claude-sonnet-4-6` | Vision + tool_use |
| `services/recipeParser.ts` (URL/text path) | Google | `gemini-3-flash-preview` | Text + function call |
| `services/suggestions.ts` | Google | `gemini-3-flash-preview` | Text + function call |
| `services/mealPlanner.ts` | Google | `gemini-3.1-pro-preview` | Complex structured reasoning |
| `services/recipeDiscovery.ts` | Google | `gemini-3-flash-preview` | Text + function call |
| `services/progression.ts` (ambition + variations) | Google | `gemini-3-flash-preview` | Text + function call |
| `services/shoppingList.ts` (variations) | Google | `gemini-3-flash-preview` | Text + function call |
| `routes/cooking.ts` `/ask` (voice Q&A) | Google | `gemini-3.1-flash-lite-preview` | Plain text, ≤300 chars |
| `services/cookingTips.ts` | Google | `gemini-3.1-flash-lite-preview` | Cached short tips |
| `services/ingredientCategories.ts` | Google | `gemini-3.1-flash-lite-preview` | Classification |

**IMPORTANT — verified model strings (April 2026):**

**Anthropic** (from https://platform.claude.com/docs/en/docs/about-claude/models):
- `claude-opus-4-6` (alias; also the API ID)
- `claude-sonnet-4-6` (alias; also the API ID)
- `claude-haiku-4-5` (alias) or full `claude-haiku-4-5-20251001`

**Google** (from https://ai.google.dev/gemini-api/docs/models):
- `gemini-3.1-pro-preview`
- `gemini-3-flash-preview`
- `gemini-3.1-flash-lite-preview`
- `gemini-3.1-flash-live-preview` (real-time dialogue; not needed here)
- `gemini-3-pro-preview` has been **shut down** per docs — do not use. Use `gemini-3.1-pro-preview` for the mealPlanner "pro" slot.

> ⚠️ The objective uses simplified names like `gemini-3-pro` / `gemini-3-1-pro` / `gemini-3-1-flash-lite`. The actual API strings all carry a `-preview` suffix as of April 2026. Plans MUST use the `-preview` strings above until Google promotes them to GA.
>
> ⚠️ Current code uses `claude-sonnet-4-20250514` (vision.ts, suggestions.ts) and `claude-sonnet-4-latest` (routes/cooking.ts). Both are legacy. The refactor should standardize all Anthropic calls on `claude-sonnet-4-6`.

## Architecture Patterns

### Recommended Project Structure

```
packages/server/src/
├── config/
│   ├── anthropic.ts          # existing; becomes adapter-internal
│   └── google.ts             # NEW: GoogleGenAI client singleton
├── ai/                        # NEW module
│   ├── types.ts               # AIClient interface, request/response types
│   ├── taskRouting.ts         # task → {provider, model} map
│   ├── clientFactory.ts       # getClientFor(task) entry point
│   ├── adapters/
│   │   ├── anthropicAdapter.ts
│   │   └── geminiAdapter.ts
│   └── __tests__/
│       ├── anthropicAdapter.test.ts
│       ├── geminiAdapter.test.ts
│       └── taskRouting.test.ts
└── services/                  # all existing; each imports from ../ai
```

### Recommended Abstraction Shape

```typescript
// packages/server/src/ai/types.ts

/** Logical tasks — used to look up routing. */
export type AITask =
  | 'vision.pantryScan'
  | 'recipe.parsePhoto'
  | 'recipe.parseUrl'
  | 'suggestions.dinner'
  | 'mealPlanner.week'
  | 'recipe.discovery'
  | 'progression.ambition'
  | 'shoppingList.variations'
  | 'cooking.voiceAsk'
  | 'cooking.tips'
  | 'ingredient.categorize';

/** Provider-agnostic JSON schema for forced structured output.
 *  Intentionally a subset of JSON Schema that both providers accept. */
export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: string[];
  description?: string;
}

/** A single tool/function the model is forced to call. */
export interface StructuredTool<T> {
  name: string;
  description: string;
  schema: JsonSchema;                 // maps to Anthropic input_schema / Gemini parametersJsonSchema
  // Caller treats the tool's input as T.
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
  user: string;                       // accompanying text
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  tool: StructuredTool<T>;
  maxTokens?: number;
}

/** The only surface services touch. No provider types leak. */
export interface AIClient {
  generateText(input: GenerateTextInput): Promise<string>;
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T>;
  analyzeImageStructured<T>(input: AnalyzeImageStructuredInput<T>): Promise<T>;
}
```

```typescript
// packages/server/src/ai/taskRouting.ts
export interface Route { provider: 'anthropic' | 'google'; model: string; }

export const TASK_ROUTES: Record<AITask, Route> = {
  'vision.pantryScan':       { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'recipe.parsePhoto':       { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'recipe.parseUrl':         { provider: 'google',    model: 'gemini-3-flash-preview' },
  'suggestions.dinner':      { provider: 'google',    model: 'gemini-3-flash-preview' },
  'mealPlanner.week':        { provider: 'google',    model: 'gemini-3.1-pro-preview' },
  'recipe.discovery':        { provider: 'google',    model: 'gemini-3-flash-preview' },
  'progression.ambition':    { provider: 'google',    model: 'gemini-3-flash-preview' },
  'shoppingList.variations': { provider: 'google',    model: 'gemini-3-flash-preview' },
  'cooking.voiceAsk':        { provider: 'google',    model: 'gemini-3.1-flash-lite-preview' },
  'cooking.tips':            { provider: 'google',    model: 'gemini-3.1-flash-lite-preview' },
  'ingredient.categorize':   { provider: 'google',    model: 'gemini-3.1-flash-lite-preview' },
};
```

```typescript
// packages/server/src/ai/clientFactory.ts
import { AIClient } from './types.js';
import { AnthropicAdapter } from './adapters/anthropicAdapter.js';
import { GeminiAdapter } from './adapters/geminiAdapter.js';
import { TASK_ROUTES, AITask } from './taskRouting.js';

export function getClientFor(task: AITask): AIClient {
  const route = TASK_ROUTES[task];
  return route.provider === 'anthropic'
    ? new AnthropicAdapter(route.model)
    : new GeminiAdapter(route.model);
}
```

Service call sites become:
```typescript
// services/vision.ts
const ai = getClientFor('vision.pantryScan');
const { items } = await ai.analyzeImageStructured<{ items: ScanResult[] }>({
  user: `Identify all visible food items in this ${sourceLocation} photo...`,
  imageBase64: base64Image,
  mimeType: 'image/jpeg',
  tool: { name: 'report_food_items', description: '...', schema: { /* ... */ } },
});
return items;
```

### Pattern: Forced Structured Output (both providers)

**Anthropic (current):**
```typescript
// Source: vision.ts (current code)
await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  system: systemPrompt,                                    // top-level
  tools: [{ name, description, input_schema: schema }],    // input_schema
  tool_choice: { type: 'tool', name },                     // forced
  messages: [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
    { type: 'text', text: '...' },
  ]}],
});
// Response: response.content.find(b => b.type === 'tool_use').input as T
```

**Gemini (`@google/genai` v1.48+):**
```typescript
// Source: https://github.com/googleapis/js-genai README
import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });
const response = await ai.models.generateContent({
  model: 'gemini-3-flash-preview',
  contents: {
    parts: [
      { text: userPrompt },
      { inlineData: { mimeType: 'image/jpeg', data: base64 } },  // vision
    ],
  },
  config: {
    systemInstruction: systemPrompt,                             // NOT top-level
    tools: [{ functionDeclarations: [{
      name,
      description,
      parametersJsonSchema: schema,                              // NOT input_schema
    }]}],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,                     // forced
        allowedFunctionNames: [name],
      },
    },
    maxOutputTokens: 4096,
  },
});
// Response:
const call = response.candidates?.[0]?.content?.parts
  ?.find(p => p.functionCall)?.functionCall;
const args = call?.args as T;   // already a JS object, not a JSON string
```

### API Shape Diff (the canonical translation table)

| Concept | Anthropic | Gemini `@google/genai` |
|---|---|---|
| Top-level call | `anthropic.messages.create({...})` | `ai.models.generateContent({...})` |
| System prompt | top-level `system: string` | `config.systemInstruction: string` |
| User messages | `messages: [{role:'user', content: ...}]` | `contents: { parts: [...] }` |
| Text part | `{ type: 'text', text }` | `{ text }` |
| Image part | `{ type: 'image', source: { type: 'base64', media_type, data } }` | `{ inlineData: { mimeType, data } }` |
| Tools | top-level `tools: [{ name, description, input_schema }]` | `config.tools: [{ functionDeclarations: [{ name, description, parametersJsonSchema }] }]` |
| Force tool call | `tool_choice: { type: 'tool', name }` | `config.toolConfig.functionCallingConfig = { mode: 'ANY', allowedFunctionNames: [name] }` |
| Max tokens | `max_tokens` | `config.maxOutputTokens` |
| Structured result location | `response.content.find(b => b.type === 'tool_use').input` (JS object) | `response.candidates[0].content.parts.find(p => p.functionCall).functionCall.args` (JS object) |
| Plain text result | `response.content.find(b => b.type === 'text').text` | `response.text` (convenience getter) or `candidates[0].content.parts[0].text` |

### Anti-Patterns to Avoid
- **Don't** expose `Anthropic.Messages.Tool` or `FunctionDeclaration` types in service signatures — service code must only see `StructuredTool<T>`.
- **Don't** let adapters share state across requests. Construct per call or per service; these SDKs are cheap to instantiate.
- **Don't** duplicate the task→model map inside services. Only `taskRouting.ts` knows models.
- **Don't** keep the global `anthropic` singleton export as the primary API after refactor — it bypasses routing. Keep it only if `routes/cooking.ts` legacy tests demand it, and mark `@deprecated`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| HTTP client for Gemini | Custom `fetch` wrapper | `@google/genai` | Handles auth, retries, part types, streaming hooks, error taxonomy |
| JSON schema → provider tool schema | Custom transformer | Pass `JsonSchema` through directly | Both providers accept the same JSON-Schema subset; no translation needed for object/array/string/number/boolean/enum/required |
| MALFORMED_FUNCTION_CALL repair | Custom "reparse mangled JSON" | Short retry loop + stricter schema (enums, required) | Gemini returns parsed objects in `functionCall.args`, not strings — the malformed case is a *finish_reason*, not a parse failure |
| Image base64 resizing | Custom logic | Already handled upstream (`routes/scan.ts`) | Out of scope |

**Key insight:** The two SDKs already do the heavy lifting. Our adapter layer is ~50 LOC each — it's pure shape translation, not business logic.

## Common Pitfalls

### Pitfall 1: Using the wrong Google SDK
**What goes wrong:** Installing `@google/generative-ai` (the old SDK) instead of `@google/genai`.
**Why it happens:** Both names show up in npm search; Stack Overflow answers from 2024 reference the old one.
**How to avoid:** Package must be exactly `@google/genai`. Verify with `npm view @google/genai version` — should be 1.48.x or higher.

### Pitfall 2: `MALFORMED_FUNCTION_CALL` finish_reason on Gemini
**What goes wrong:** Gemini returns a response with `candidates[0].finishReason === 'MALFORMED_FUNCTION_CALL'` and no `functionCall` part. More frequent on Gemini 3 Flash/Pro than on Gemini 2.5.
**Why it happens:** Transient "bad generation" where the model emits a function-call start token but can't complete valid args — especially with loose schemas or long system prompts. Known issue tracked in google-gemini/gemini-cli issues #12924 and #13989; also documented in the Vertex AI community forum.
**How to avoid:**
1. Detect `finishReason === 'MALFORMED_FUNCTION_CALL'` explicitly in `GeminiAdapter.generateStructured`; throw a typed `MalformedFunctionCallError`.
2. Retry **once** with the same payload (transient recovery).
3. Harden schemas: use `enum` on string fields where possible, declare `required` exhaustively, give each field a clear `description`.
4. Keep system prompts focused; MALFORMED rate correlates with prompt length.
5. Emit a metric so we can spot regressions.

### Pitfall 3: `systemInstruction` location
**What goes wrong:** Passing `systemInstruction` at top level (mirroring Anthropic's `system`) silently does nothing in Gemini.
**Why it happens:** Must live under `config.systemInstruction`, not alongside `model` and `contents`.
**How to avoid:** Encapsulate in `GeminiAdapter`; unit test verifies it lands in `config`.

### Pitfall 4: `inlineData` casing
**What goes wrong:** Gemini rejects `inline_data` (snake_case) or wrong key names.
**Why it happens:** JSON schema of Anthropic (`snake_case`) vs Gemini (`camelCase` — `mimeType`, `inlineData`).
**How to avoid:** Adapter uses exact camelCase; unit test asserts argument shape.

### Pitfall 5: Gemini `args` is already an object
**What goes wrong:** Code calls `JSON.parse(call.args)` and throws because `args` is already a parsed JS object.
**Why it happens:** Anthropic muscle memory — `tool_use.input` is also already parsed, but some docs show raw JSON strings for other SDKs.
**How to avoid:** Type `functionCall.args` as `Record<string, unknown>` and cast directly.

### Pitfall 6: Empty `candidates` array on safety block
**What goes wrong:** `response.candidates` is `[]` when Gemini safety filter blocks (e.g., overly cautious on recipe text mentioning alcohol).
**Why it happens:** Safety settings default to `BLOCK_MEDIUM_AND_ABOVE` on certain harm categories.
**How to avoid:** Set `config.safetySettings` to `BLOCK_ONLY_HIGH` for all categories in `GeminiAdapter` for a cooking app domain (acceptable risk; document in code). Throw a typed error when candidates is empty so the service layer can surface a friendly message.

### Pitfall 7: Legacy model strings in current code
**What goes wrong:** `vision.ts` and `suggestions.ts` still pass `'claude-sonnet-4-20250514'`; `routes/cooking.ts` passes `'claude-sonnet-4-latest'` (the `-latest` alias has been deprecated for cross-version moves).
**How to avoid:** Refactor must also update these to `claude-sonnet-4-6` as part of the Anthropic adapter default.

### Pitfall 8: `max_tokens` naming
**What goes wrong:** Passing `max_tokens` to Gemini does nothing — it's silently ignored; the config key is `maxOutputTokens`.
**How to avoid:** Adapter normalizes `maxTokens` → provider-specific field.

## Code Examples

### Example: AnthropicAdapter (sketch)
```typescript
// packages/server/src/ai/adapters/anthropicAdapter.ts
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import {
  AIClient, GenerateTextInput, GenerateStructuredInput, AnalyzeImageStructuredInput,
} from '../types.js';

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
    const text = (res.content as Array<{type:string;text?:string}>).find(b => b.type === 'text');
    return text?.text ?? '';
  }

  async generateStructured<T>(i: GenerateStructuredInput<T>): Promise<T> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: i.maxTokens ?? 4096,
      system: i.system,
      tools: [{ name: i.tool.name, description: i.tool.description, input_schema: i.tool.schema as any }],
      tool_choice: { type: 'tool', name: i.tool.name },
      messages: [{ role: 'user', content: i.user }],
    });
    const block = res.content.find(b => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') throw new Error('anthropic: no tool_use block');
    return block.input as T;
  }

  async analyzeImageStructured<T>(i: AnalyzeImageStructuredInput<T>): Promise<T> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: i.maxTokens ?? 4096,
      system: i.system,
      tools: [{ name: i.tool.name, description: i.tool.description, input_schema: i.tool.schema as any }],
      tool_choice: { type: 'tool', name: i.tool.name },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: i.mimeType, data: i.imageBase64 } },
          { type: 'text', text: i.user },
        ],
      }],
    });
    const block = res.content.find(b => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') throw new Error('anthropic: no tool_use block');
    return block.input as T;
  }
}
```

### Example: GeminiAdapter (sketch)
```typescript
// packages/server/src/ai/adapters/geminiAdapter.ts
import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import { env } from '../../config/env.js';
import {
  AIClient, GenerateTextInput, GenerateStructuredInput, AnalyzeImageStructuredInput,
} from '../types.js';

export class MalformedFunctionCallError extends Error {}

export class GeminiAdapter implements AIClient {
  private ai = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });
  constructor(private model: string) {}

  async generateText(i: GenerateTextInput): Promise<string> {
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: { parts: [{ text: i.user }] },
      config: {
        systemInstruction: i.system,
        maxOutputTokens: i.maxTokens ?? 1024,
      },
    });
    return res.text ?? '';
  }

  async generateStructured<T>(i: GenerateStructuredInput<T>): Promise<T> {
    return this.callStructured<T>({ ...i, parts: [{ text: i.user }] });
  }

  async analyzeImageStructured<T>(i: AnalyzeImageStructuredInput<T>): Promise<T> {
    return this.callStructured<T>({
      ...i,
      parts: [
        { text: i.user },
        { inlineData: { mimeType: i.mimeType, data: i.imageBase64 } },
      ],
    });
  }

  private async callStructured<T>(opts: any, attempt = 0): Promise<T> {
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: { parts: opts.parts },
      config: {
        systemInstruction: opts.system,
        maxOutputTokens: opts.maxTokens ?? 4096,
        tools: [{ functionDeclarations: [{
          name: opts.tool.name,
          description: opts.tool.description,
          parametersJsonSchema: opts.tool.schema,
        }]}],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: [opts.tool.name],
          },
        },
      },
    });
    const cand = res.candidates?.[0];
    if (!cand) throw new Error('gemini: no candidate (safety block?)');
    if (cand.finishReason === 'MALFORMED_FUNCTION_CALL') {
      if (attempt === 0) return this.callStructured<T>(opts, 1);   // one retry
      throw new MalformedFunctionCallError('gemini: malformed function call after retry');
    }
    const call = cand.content?.parts?.find(p => (p as any).functionCall);
    const args = (call as any)?.functionCall?.args;
    if (!args) throw new Error('gemini: no functionCall in response');
    return args as T;
  }
}
```

### Example: Service refactor (vision.ts)
```typescript
// services/vision.ts — after
import { getClientFor } from '../ai/clientFactory.js';
import type { JsonSchema } from '../ai/types.js';

const schema: JsonSchema = { /* same shape as before, pure JSON */ };

export async function identifyFoodItems(
  base64Image: string,
  sourceLocation: 'fridge' | 'pantry' | 'freezer',
): Promise<ScanResult[]> {
  const ai = getClientFor('vision.pantryScan');
  const { items } = await ai.analyzeImageStructured<{ items: ScanResult[] }>({
    user: `Identify all visible food items in this ${sourceLocation} photo...`,
    imageBase64: base64Image,
    mimeType: 'image/jpeg',
    tool: {
      name: 'report_food_items',
      description: 'Report all food items visible in the image with confidence scores',
      schema,
    },
  });
  return items ?? [];
}
```

## Testing Strategy

**Key insight:** The existing test pattern mocks `@anthropic-ai/sdk` at the module boundary. Every single test file repeats the `vi.hoisted`/`vi.mock` dance. This is *exactly* the coupling the refactor should eliminate.

### New pattern — mock `getClientFor`, not the SDK

```typescript
// packages/server/src/ai/__tests__/testHelpers.ts
import { vi } from 'vitest';
import type { AIClient } from '../types.js';

export function createMockClient(): AIClient & {
  generateText: ReturnType<typeof vi.fn>;
  generateStructured: ReturnType<typeof vi.fn>;
  analyzeImageStructured: ReturnType<typeof vi.fn>;
} {
  return {
    generateText: vi.fn(),
    generateStructured: vi.fn(),
    analyzeImageStructured: vi.fn(),
  };
}
```

Per-service test:
```typescript
// services/__tests__/vision.test.ts — after
import { vi } from 'vitest';
import { createMockClient } from '../../ai/__tests__/testHelpers.js';

const { mockClient } = vi.hoisted(() => ({ mockClient: createMockClient() }));
vi.mock('../../ai/clientFactory.js', () => ({
  getClientFor: () => mockClient,
}));

import { identifyFoodItems } from '../vision.js';

it('parses structured response', async () => {
  mockClient.analyzeImageStructured.mockResolvedValue({
    items: [{ name: 'milk', quantity: 1, unit: 'gallon', confidence: 0.95, category: 'dairy' }],
  });
  const result = await identifyFoodItems('base64data', 'fridge');
  expect(result).toHaveLength(1);
  expect(mockClient.analyzeImageStructured).toHaveBeenCalledWith(
    expect.objectContaining({ imageBase64: 'base64data', mimeType: 'image/jpeg' }),
  );
});
```

**Migration cost estimate:** Each of the 13 test files needs ~10 lines changed (swap the `vi.mock` target, swap assertions from `mockCreate.mock.calls[0][0].messages...` to `mockClient.generateStructured.mock.calls[0][0]...`). Most assertions become *simpler* because the mock receives the pre-translated shape, not provider-specific nested message arrays.

### Adapter-level tests (NEW)
- `anthropicAdapter.test.ts`: mocks `@anthropic-ai/sdk` (the old pattern, localized to one file) and verifies the adapter produces the correct `messages.create` call and parses `tool_use` responses.
- `geminiAdapter.test.ts`: mocks `@google/genai` and verifies `generateContent` call shape, `functionCall.args` extraction, `MALFORMED_FUNCTION_CALL` retry behavior (tests both "recovers on retry" and "throws after retry"), and empty-candidates handling.

This means **only two files** mock provider SDKs directly — not 13.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Direct `anthropic.messages.create` in services | Adapter + task routing | This phase | Provider swap becomes a one-line route table edit |
| `@google/generative-ai` (old SDK) | `@google/genai` (unified SDK) | 2024 → 2025 migration | Required for Gemini 2.0+; old SDK stuck on 1.x models |
| `tool_use.input` parsing with nested `.find(b => b.type === 'tool_use')` across 10 services | Single adapter extracts once | This phase | ~80 LOC of duplication removed |
| Test files each mock `@anthropic-ai/sdk` | Tests mock `AIClient` interface | This phase | 13× simpler mocks |

**Deprecated/outdated:**
- `@google/generative-ai` npm package — do not install.
- `gemini-3-pro-preview` model — shut down per Google docs. Use `gemini-3.1-pro-preview`.
- `claude-sonnet-4-20250514` / `claude-sonnet-4-latest` — legacy, use `claude-sonnet-4-6`.

## Open Questions

1. **Should `recipeParser.ts` expose two code paths or one?**
   - What we know: photo path needs Anthropic (vision), URL/text path needs Google. They have different schemas today.
   - What's unclear: whether to split into `recipeParser.photo.ts` + `recipeParser.url.ts`, or branch internally.
   - Recommendation: branch internally. Call `getClientFor('recipe.parsePhoto')` or `getClientFor('recipe.parseUrl')` inside the existing exported functions. Minimal surface churn.

2. **Env var name for Google: `GOOGLE_API_KEY` or `GEMINI_API_KEY`?**
   - What we know: `@google/genai` accepts either via environment auto-detection, but explicit `apiKey` in constructor bypasses it.
   - Recommendation: Use `GOOGLE_API_KEY` (matches the SDK's first-class env var) and document it in `.env.example`.

3. **Shared retry/backoff for both providers?**
   - What we know: Anthropic SDK has built-in retry; Gemini SDK has some but not for MALFORMED finishes.
   - Recommendation: Do the minimum — retry-once inside `GeminiAdapter.callStructured` for MALFORMED. Don't build a generic middleware layer yet.

4. **Keep the legacy `config/anthropic.ts` singleton?**
   - What we know: 11 files import `{ anthropic }` from it.
   - Recommendation: Delete the export after refactor; the `AnthropicAdapter` owns the client. Grep for remaining imports in verification.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `packages/server/vitest.config.ts` (inferred; exists per `vitest run` script) |
| Quick run command | `npm --prefix packages/server test -- --run <pattern>` |
| Full suite command | `npm --prefix packages/server test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| HYBRID-01 | `AIClient` interface + two adapters compile and implement all three methods | unit | `npm --prefix packages/server test -- --run ai/adapters` | ❌ Wave 0 |
| HYBRID-01 | `AnthropicAdapter.analyzeImageStructured` builds correct `messages.create` payload | unit | `npm --prefix packages/server test -- --run anthropicAdapter` | ❌ Wave 0 |
| HYBRID-01 | `GeminiAdapter.generateStructured` builds correct `generateContent` payload with forced function call | unit | `npm --prefix packages/server test -- --run geminiAdapter` | ❌ Wave 0 |
| HYBRID-02 | `getClientFor('vision.pantryScan')` returns AnthropicAdapter; `getClientFor('suggestions.dinner')` returns GeminiAdapter | unit | `npm --prefix packages/server test -- --run taskRouting` | ❌ Wave 0 |
| HYBRID-02 | All 11 task keys route to the correct provider+model per mapping table | unit | (same) | ❌ Wave 0 |
| HYBRID-03 | `vision.ts` refactored — uses `getClientFor`, no direct `anthropic` import | unit | `npm --prefix packages/server test -- --run vision.test` | ✅ (rewrite mocks) |
| HYBRID-03 | `suggestions.ts` refactored — calls Gemini via adapter | unit | `npm --prefix packages/server test -- --run suggestions.test` | ✅ (rewrite mocks) |
| HYBRID-03 | `mealPlanner.ts` refactored | unit | `npm --prefix packages/server test -- --run mealPlanner.test` | ✅ (rewrite mocks) |
| HYBRID-03 | `recipeParser.ts` photo path → Anthropic, URL path → Gemini | unit | `npm --prefix packages/server test -- --run recipeParser.test` | ✅ (rewrite mocks) |
| HYBRID-03 | `recipeDiscovery.ts` refactored | unit | `npm --prefix packages/server test -- --run recipeDiscovery.test` | ✅ (rewrite mocks) |
| HYBRID-03 | `progression.ts` refactored | unit | `npm --prefix packages/server test -- --run progression.test` | ✅ (rewrite mocks) |
| HYBRID-03 | `shoppingList.ts` refactored | unit | `npm --prefix packages/server test -- --run shoppingList.test` | ✅ (rewrite mocks) |
| HYBRID-03 | `routes/cooking.ts` `/ask` refactored to Gemini Flash Lite | integration | `npm --prefix packages/server test -- --run cooking.test` | ✅ (rewrite mocks) |
| HYBRID-03 | `cookingTips.ts` refactored | unit | `npm --prefix packages/server test -- --run cookingTips.test` | ✅ (rewrite mocks) |
| HYBRID-03 | `ingredientCategories.ts` refactored | unit | `npm --prefix packages/server test -- --run ingredientCategories.test` | ✅ (rewrite mocks) |
| HYBRID-04 | All existing tests pass after mock migration | unit suite | `npm --prefix packages/server test` | ✅ |
| HYBRID-05 | `@google/genai` installed and importable | build | `npm --prefix packages/server run build` (implicit via tsx typecheck) or `node -e "require('@google/genai')"` | ✅ (package.json check) |
| HYBRID-06 | `GeminiAdapter` retries once on `MALFORMED_FUNCTION_CALL`, throws typed error on second failure | unit | `npm --prefix packages/server test -- --run geminiAdapter` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm --prefix packages/server test -- --run <touched file pattern>`
- **Per wave merge:** `npm --prefix packages/server test` (full server suite)
- **Phase gate:** Full `npm --prefix packages/server test` green + grep confirms zero direct imports of `@anthropic-ai/sdk` or `@google/genai` outside `packages/server/src/ai/adapters/` and `packages/server/src/config/`

### Wave 0 Gaps
- [ ] `packages/server/src/ai/types.ts` — `AIClient` interface, `JsonSchema`, `StructuredTool`, input/output types
- [ ] `packages/server/src/ai/taskRouting.ts` — `AITask` union + `TASK_ROUTES` map
- [ ] `packages/server/src/ai/clientFactory.ts` — `getClientFor(task)`
- [ ] `packages/server/src/ai/adapters/anthropicAdapter.ts`
- [ ] `packages/server/src/ai/adapters/geminiAdapter.ts` — including `MalformedFunctionCallError` + retry
- [ ] `packages/server/src/config/google.ts` — `GoogleGenAI` client singleton, reads `env.GOOGLE_API_KEY`
- [ ] `packages/server/src/config/env.ts` — add `GOOGLE_API_KEY` to schema
- [ ] `packages/server/src/ai/__tests__/testHelpers.ts` — `createMockClient()`
- [ ] `packages/server/src/ai/__tests__/anthropicAdapter.test.ts`
- [ ] `packages/server/src/ai/__tests__/geminiAdapter.test.ts`
- [ ] `packages/server/src/ai/__tests__/taskRouting.test.ts`
- [ ] Package install: `npm --prefix packages/server install @google/genai`

## Sources

### Primary (HIGH confidence)
- [Claude Models Overview (platform.claude.com)](https://platform.claude.com/docs/en/docs/about-claude/models) — exact Anthropic model IDs: `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5`
- [Gemini API Models (ai.google.dev)](https://ai.google.dev/gemini-api/docs/models) — exact Gemini 3.x model IDs with `-preview` suffix; `gemini-3-pro-preview` shutdown notice
- [googleapis/js-genai README (GitHub)](https://github.com/googleapis/js-genai) — canonical `generateContent` call shape, `systemInstruction`, `toolConfig`, `inlineData`, `functionCall.args` response path
- [@google/genai on npm](https://www.npmjs.com/package/@google/genai) — v1.48.0, Node 20+ requirement
- Current codebase (`packages/server/src/services/vision.ts`, `suggestions.ts`, `routes/cooking.ts`, test files) — canonical Anthropic call patterns

### Secondary (MEDIUM confidence)
- [Gemini API troubleshooting guide (blog.laozhang.ai, 2026)](https://blog.laozhang.ai/en/posts/gemini-api-error-troubleshooting) — MALFORMED_FUNCTION_CALL is transient, stricter schemas help
- [Vertex AI forum: MALFORMED_FUNCTION_CALL frequency](https://discuss.ai.google.dev/t/malformed-function-call-finish-reason-happens-too-frequently-with-vertex-ai/93630) — confirms one-retry mitigation
- [Cursor forum: MALFORMED_FUNCTION_CALL on Gemini 3 Pro/Flash](https://forum.cursor.com/t/cursor-throws-malformed-function-call-when-using-gemini-3-pro-or-gemini-3-flash/149890) — confirms issue affects Gemini 3.x specifically
- [gemini-cli #12924](https://github.com/google-gemini/gemini-cli/issues/12924), [#13989](https://github.com/google-gemini/gemini-cli/issues/13989) — ongoing issues

### Tertiary (LOW confidence)
- None — all load-bearing claims verified against at least one HIGH source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package name, version, Node requirement all verified via npm
- Model identifiers: HIGH — pulled verbatim from official Anthropic docs and Google AI docs
- API shapes (Anthropic): HIGH — current codebase is the source of truth
- API shapes (Gemini): HIGH — verified against official js-genai README
- Abstraction shape: HIGH — pure code, no external dependency on unknowns
- Pitfalls: MEDIUM — MALFORMED_FUNCTION_CALL mitigation is based on community guidance; exact retry semantics may need tuning during implementation
- Testing strategy: HIGH — pattern matches existing vitest hoisted-mock conventions in the repo

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (Gemini 3.x is in `-preview`; model strings may graduate to GA and lose the `-preview` suffix — re-verify before phase kickoff if > 30 days old)
