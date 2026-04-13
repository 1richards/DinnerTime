#!/usr/bin/env tsx
/**
 * Env-gated smoke test. Does NOT run in CI.
 * Usage: AI_SMOKE=1 ANTHROPIC_API_KEY=... GOOGLE_API_KEY=... npm run ai:smoke
 *
 * Exits 0 on success, non-zero if any task's live call fails.
 * Uses minimal prompts + tiny fake inputs to keep cost < $0.10 per run.
 */
import { ALL_TASKS, TASK_ROUTES } from '../src/ai/taskRouting.js';
import { getClientFor } from '../src/ai/clientFactory.js';
import type { StructuredTool } from '../src/ai/types.js';

if (process.env.AI_SMOKE !== '1') {
  console.log('AI_SMOKE not set; skipping.');
  process.exit(0);
}

const trivialTool: StructuredTool<{ ok: boolean }> = {
  name: 'report_ok',
  description: 'Report ok=true.',
  schema: {
    type: 'object',
    properties: { ok: { type: 'boolean', description: 'Always true' } },
    required: ['ok'],
  },
};

// 1x1 transparent JPEG base64 (for image tasks)
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA//Z';

const IMAGE_TASKS = new Set(['vision.pantryScan', 'recipe.parsePhoto']);
const TEXT_ONLY_TASKS = new Set(['cooking.voiceAsk', 'cooking.tips']);

const results: Array<{ task: string; ok: boolean; error?: string }> = [];

for (const task of ALL_TASKS) {
  const route = TASK_ROUTES[task];
  process.stdout.write(`[${task}] ${route.provider}:${route.model} ... `);
  try {
    const ai = getClientFor(task);
    if (IMAGE_TASKS.has(task)) {
      await ai.analyzeImageStructured({
        user: 'Return ok=true.',
        imageBase64: TINY_JPEG_B64,
        mimeType: 'image/jpeg',
        tool: trivialTool,
        maxTokens: 256,
      });
    } else if (TEXT_ONLY_TASKS.has(task)) {
      const t = await ai.generateText({ user: 'Say "ok"', maxTokens: 16 });
      if (!t) throw new Error('empty text');
    } else {
      await ai.generateStructured({
        user: 'Return ok=true.',
        tool: trivialTool,
        maxTokens: 256,
      });
    }
    console.log('OK');
    results.push({ task, ok: true });
  } catch (e) {
    console.log(`FAIL (${(e as Error).message})`);
    results.push({ task, ok: false, error: (e as Error).message });
  }
}

const failures = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failures.length}/${results.length} passed ===`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f.task}: ${f.error}`);
  process.exit(1);
}
process.exit(0);
