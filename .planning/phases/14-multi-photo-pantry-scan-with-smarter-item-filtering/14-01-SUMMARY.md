---
phase: 14-multi-photo-pantry-scan-with-smarter-item-filtering
plan: 01
subsystem: api
tags: [anthropic, claude-vision, multi-image, pantry-scan, batch-api]

requires:
  - phase: 11-hybrid-ai-client
    provides: AIClient interface, AnthropicAdapter, getClientFor factory
provides:
  - analyzeImagesStructured method on AIClient interface
  - identifyFoodItemsBatch service function
  - POST /scan-batch endpoint for multi-image pantry scanning
  - Filtering prompt excluding vague/unidentifiable items
affects: [14-02, mobile pantry scan UI]

tech-stack:
  added: []
  patterns:
    - "Multi-image content blocks via analyzeImagesStructured (images array -> N image blocks + text in single API call)"
    - "Shared FILTERING_RULES constant for both single and batch scan prompts"

key-files:
  created:
    - packages/server/src/routes/__tests__/pantry.test.ts
  modified:
    - packages/server/src/ai/types.ts
    - packages/server/src/ai/adapters/anthropicAdapter.ts
    - packages/server/src/ai/adapters/geminiAdapter.ts
    - packages/server/src/services/vision.ts
    - packages/server/src/routes/pantry.ts
    - packages/server/src/ai/__tests__/anthropicAdapter.test.ts
    - packages/server/src/ai/__tests__/geminiAdapter.test.ts
    - packages/server/src/services/__tests__/vision.test.ts

key-decisions:
  - "GeminiAdapter.analyzeImagesStructured throws not-implemented (vision.pantryScan routes to Anthropic only)"
  - "Batch maxTokens doubled to 8192 to accommodate more items from multiple photos"
  - "Single-image identifyFoodItems prompt updated with same filtering rules for consistency"

patterns-established:
  - "FILTERING_RULES shared constant for prompt consistency across single and batch scan"

requirements-completed: ["Pantry UX improvement (post-v1)"]

duration: 4min
completed: 2026-04-17
---

# Phase 14 Plan 01: Multi-Image Batch Scan API Summary

**Multi-image analyzeImagesStructured on AIClient with batch pantry scan endpoint and filtering prompt that excludes vague/unidentifiable items**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-17T05:20:56Z
- **Completed:** 2026-04-17T05:25:12Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Extended AIClient interface with analyzeImagesStructured for sending multiple images in a single API call
- Added identifyFoodItemsBatch service and POST /scan-batch route with input validation (1-5 images, 5MB per image)
- Filtering prompt instructs AI to exclude vague items, deduplicate across photos, and only report specifically identifiable cooking ingredients
- Updated single-image scan prompt with same filtering rules for consistency

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend AIClient with analyzeImagesStructured** - `fbd1d72` (feat)
2. **Task 2: Add identifyFoodItemsBatch and POST /scan-batch** - `469daf9` (feat)

## Files Created/Modified
- `packages/server/src/ai/types.ts` - Added AnalyzeImagesStructuredInput type and method to AIClient
- `packages/server/src/ai/adapters/anthropicAdapter.ts` - Multi-image content blocks implementation
- `packages/server/src/ai/adapters/geminiAdapter.ts` - Not-implemented stub for interface compliance
- `packages/server/src/services/vision.ts` - identifyFoodItemsBatch + shared FILTERING_RULES constant
- `packages/server/src/routes/pantry.ts` - POST /scan-batch endpoint with validation
- `packages/server/src/ai/__tests__/anthropicAdapter.test.ts` - Tests for multi-image content blocks
- `packages/server/src/ai/__tests__/geminiAdapter.test.ts` - Test for not-implemented stub
- `packages/server/src/services/__tests__/vision.test.ts` - Tests for batch service
- `packages/server/src/routes/__tests__/pantry.test.ts` - Tests for scan-batch route validation

## Decisions Made
- GeminiAdapter gets a not-implemented stub since vision.pantryScan always routes to Anthropic
- Batch scan uses maxTokens 8192 (doubled from single-image 4096) to accommodate more items from multiple photos
- Single-image prompt also updated with filtering rules so all scan paths reject vague items

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server-side batch scan infrastructure complete
- Plan 14-02 can build the mobile multi-photo UI that calls POST /scan-batch
- Pre-existing test failure in taskRouting.test.ts (env.GOOGLE_API_KEY) is unrelated to this plan

---
*Phase: 14-multi-photo-pantry-scan-with-smarter-item-filtering*
*Completed: 2026-04-17*
