/**
 * Red test stub (Phase 25 Wave 0, plan 25-00) — component ships in 25-01.
 *
 * Nyquist contract: all tests are `.skip` placeholders so the file is
 * syntactically valid and reports `0 passed, N skipped, 0 failed` under
 * vitest. 25-01 flips `.skip` to `()` as it:
 *   1. Creates ../FeedbackSheet.tsx
 *   2. Wires @testing-library/react-native + a fetch mock (mirroring the
 *      ReAuthModal authedFetch plumbing from 23-04).
 *   3. Imports FeedbackSheet here.
 *
 * Not importing @testing-library or the FeedbackSheet module now: doing so
 * would fail module resolution immediately and trip the vitest loader before
 * the skip placeholders can register. Un-skipping is the 25-01 signal.
 *
 * Requirements tracked: BETA-07 (in-app feedback UX), BETA-24 (feedback
 * ingestion end-to-end).
 */
import { describe, it } from 'vitest';

describe('FeedbackSheet', () => {
  it.skip('renders message textarea + submit button when open', () => {
    // 25-01: import from '../FeedbackSheet' — unresolved until component exists.
    // Shape: controlled <Modal visible={open}> with a TextInput multiline
    // and a primary "Send" Pressable gated on message.trim().length > 0.
  });

  it.skip('POSTs to /api/v1/feedback on submit with message + client-inferred app_version', () => {
    // Uses authedFetch from 23-04 ReAuthModal plumbing. Payload shape:
    // { message, email?, app_version, build_number, platform: 'ios' }.
  });

  it.skip('closes + clears textarea on 201, shows inline error on 4xx/5xx', () => {
    // Success path → onClose(). Error path renders a token-aware error
    // Text beneath the textarea; does NOT toast (matches 23-05 pattern).
  });

  it.skip('prevents submit when message.trim() is empty', () => {
    // Submit button disabled-state mirror of the 00030 CHECK constraint
    // (length >= 1). Whitespace-only payloads never leave the client.
  });
});
