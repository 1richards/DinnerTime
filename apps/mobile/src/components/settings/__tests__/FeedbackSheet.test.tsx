/**
 * Phase 25-01: FeedbackSheet component contract tests.
 *
 * Follows the tree-walker pattern established by
 * apps/mobile/src/auth/__tests__/ReAuthModal.test.ts and
 * apps/mobile/src/components/settings/__tests__/AboutSection.test.ts:
 *
 *   - vitest.setup.ts mocks React-Native primitives as `() => null` function
 *     components, so we invoke the outer <FeedbackSheet /> as a plain
 *     function and walk its element tree recursively.
 *   - `submitFeedback` is exported as a pure helper from the module so the
 *     POST contract can be asserted without spinning up a React renderer.
 *
 * The component itself splits into a stateless outer <FeedbackSheet />
 * (testable) and an inner <FeedbackForm /> that owns useState for live
 * input; mirrors the ReAuthModal outer/inner split pattern.
 *
 * Requirements: BETA-07 (in-app feedback UX), BETA-24 (feedback ingestion).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { authedFetch } = vi.hoisted(() => ({
  authedFetch: vi.fn(async () => ({
    ok: true,
    status: 201,
    json: async () => ({ id: 'fb-123' }),
  })),
}));

vi.mock('../../../lib/authedFetch', () => ({ authedFetch }));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.0.0',
      ios: { buildNumber: '42' },
    },
  },
}));

const mod = await import('../FeedbackSheet.js');
const { FeedbackSheet, submitFeedback } = mod;

function walk(el: any, visit: (node: any) => void) {
  if (el == null || typeof el !== 'object') return;
  visit(el);
  if (typeof el.type === 'function') {
    try {
      const out = el.type(el.props);
      walk(out, visit);
    } catch {
      /* hook boundary — fall through to children */
    }
  }
  const kids = el.props?.children;
  if (Array.isArray(kids)) for (const k of kids) walk(k, visit);
  else if (kids) walk(kids, visit);
}

describe('FeedbackSheet — render contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders message textarea + Send + Cancel when open', () => {
    const tree: any = FeedbackSheet({ open: true, onClose: () => {} });

    const found: Array<{ type: any; props: any }> = [];
    walk(tree, (n) => found.push({ type: n.type, props: n.props ?? {} }));

    // Multi-line TextInput with accessibilityLabel "Feedback message".
    const hasTextarea = found.some(
      (n) =>
        n.props.multiline === true ||
        n.props.accessibilityLabel === 'Feedback message',
    );
    expect(hasTextarea).toBe(true);

    // Send affordance present somewhere in the tree.
    const hasSend = found.some((n) => {
      const c = n.props?.children;
      if (typeof c === 'string') return /send/i.test(c);
      if (Array.isArray(c))
        return c.some((x) => typeof x === 'string' && /send/i.test(x));
      return false;
    });
    expect(hasSend).toBe(true);

    // Cancel affordance present.
    const hasCancel = found.some((n) => {
      const c = n.props?.children;
      if (typeof c === 'string') return /cancel/i.test(c);
      if (Array.isArray(c))
        return c.some((x) => typeof x === 'string' && /cancel/i.test(x));
      return false;
    });
    expect(hasCancel).toBe(true);
  });
});

describe('submitFeedback — POST /feedback contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs to /api/v1/feedback with message + app_version + build_number', async () => {
    await submitFeedback({ message: 'Works great!' });

    expect(authedFetch).toHaveBeenCalled();
    const call = (authedFetch as any).mock.calls[0] as [
      RequestInfo,
      RequestInit?,
    ];
    const [url, init] = call;
    expect(String(url)).toMatch(/\/api\/v1\/feedback$/);
    expect((init as RequestInit).method?.toUpperCase()).toBe('POST');

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.message).toBe('Works great!');
    // app_version + build_number are inferred from expo-constants mock.
    expect(body.app_version).toBe('1.0.0');
    expect(body.build_number).toBe('42');
  });

  it('resolves { ok: true, id } on 201', async () => {
    const result = await submitFeedback({ message: 'Thanks' });
    expect(result.ok).toBe(true);
    expect(result.id).toBe('fb-123');
  });

  it('resolves { ok: false, status } on 500', async () => {
    (authedFetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'insert_failed' }),
    });
    const result = await submitFeedback({ message: 'Will fail' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it('does NOT post whitespace-only message (client guard mirrors DB CHECK)', async () => {
    const result = await submitFeedback({ message: '   \n\t  ' });
    expect(result.ok).toBe(false);
    expect(authedFetch).not.toHaveBeenCalled();
  });
});
