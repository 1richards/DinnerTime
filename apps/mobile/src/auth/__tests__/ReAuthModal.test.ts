/**
 * Red test stub (Phase 23 Wave 0) — component ships in 23-04.
 *
 * Imports `../ReAuthModal.js` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../ReAuthModal.js'" — that is the red signal.
 *
 * Wave 2 ships `apps/mobile/src/auth/ReAuthModal.tsx`:
 *   export function ReAuthModal(props: {
 *     visible: boolean;
 *     onDismiss: () => void;
 *     onSuccess: () => void;
 *   }): JSX.Element;
 *
 * The modal renders TextInput (password, secureTextEntry) + "Sign in" Pressable
 * + "Cancel" Pressable. On Sign-in tap: calls supabase.auth.signInWithPassword
 * with the current session email and the input password; on success fires
 * onSuccess; on error displays inline copy and stays mounted.
 *
 * Requirement: NFR-12 (ReAuthModal instead of force sign-out).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { email: 'user1@example.com' } },
        error: null,
      })),
      signInWithPassword: vi.fn(async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
    },
  },
}));

vi.mock('../../lib/supabase', () => ({ supabase }));

// @ts-expect-error — module does not exist yet (Wave 0 red stub; ships in 23-04)
const { ReAuthModal } = await import('../ReAuthModal.js');

// Walk a rendered element tree invoking any function-components to see deeper.
// vitest.setup.ts mocks View/Text/Pressable/TextInput as () => null, so
// we invoke function-components and fall through to children.
function walk(el: any, visit: (node: any) => void) {
  if (el == null || typeof el !== 'object') return;
  visit(el);
  if (typeof el.type === 'function') {
    try {
      const out = el.type(el.props);
      walk(out, visit);
    } catch {
      /* component may require hooks — fall through */
    }
  }
  const kids = el.props?.children;
  if (Array.isArray(kids)) for (const k of kids) walk(k, visit);
  else if (kids) walk(kids, visit);
}

describe('ReAuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a password TextInput and Sign in + Cancel Pressables', () => {
    const tree: any = ReAuthModal({
      visible: true,
      onDismiss: () => {},
      onSuccess: () => {},
    });

    const found: Array<{ type: any; props: any }> = [];
    walk(tree, (n) => found.push({ type: n.type, props: n.props ?? {} }));

    const hasPasswordInput = found.some(
      (n) =>
        typeof n.type === 'function' &&
        typeof n.type.name === 'string' &&
        /TextInput/.test(n.type.name) === false && // skip to identifier
        n.props.secureTextEntry === true,
    );
    // Tolerate either approach — React Native mocks expose .name. Just
    // require SOMETHING renders with secureTextEntry=true.
    const anySecureInput = found.some((n) => n.props.secureTextEntry === true);
    expect(anySecureInput || hasPasswordInput).toBe(true);

    // Sign in affordance present somewhere in the tree.
    const signInText = found.some((n) => {
      const c = n.props?.children;
      if (typeof c === 'string') return /sign in/i.test(c);
      if (Array.isArray(c)) return c.some((x) => typeof x === 'string' && /sign in/i.test(x));
      return false;
    });
    expect(signInText).toBe(true);
  });

  it('onSuccess fires after signInWithPassword resolves successfully', async () => {
    const onSuccess = vi.fn();
    const onDismiss = vi.fn();
    const tree: any = ReAuthModal({ visible: true, onDismiss, onSuccess });

    // Find the "Sign in" Pressable and invoke its onPress with the modal's
    // internal state already exercised via an imperative entrypoint — the
    // Wave 2 component MUST expose a testable handler. We accept either
    // pattern: (a) pressing via tree.props.onPress, or (b) the component
    // exposes a testable submit helper on the element.
    let onPress: ((...a: unknown[]) => unknown) | undefined;
    walk(tree, (n) => {
      const c = n.props?.children;
      const label =
        typeof c === 'string'
          ? c
          : Array.isArray(c)
          ? c.find((x) => typeof x === 'string')
          : undefined;
      if (typeof label === 'string' && /sign in/i.test(label) && typeof n.props?.onPress === 'function') {
        onPress = n.props.onPress;
      }
    });
    expect(onPress).toBeTypeOf('function');

    await (onPress as any)();
    // Depending on how the component wires inputs, either path is acceptable
    // so long as signInWithPassword is ultimately called.
    expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
    // After resolve, onSuccess fires. Allow a microtask to flush.
    await Promise.resolve();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('onDismiss fires when Cancel is pressed', () => {
    const onDismiss = vi.fn();
    const tree: any = ReAuthModal({ visible: true, onDismiss, onSuccess: () => {} });

    let cancelPress: ((...a: unknown[]) => unknown) | undefined;
    walk(tree, (n) => {
      const c = n.props?.children;
      const label =
        typeof c === 'string'
          ? c
          : Array.isArray(c)
          ? c.find((x) => typeof x === 'string')
          : undefined;
      if (typeof label === 'string' && /cancel/i.test(label) && typeof n.props?.onPress === 'function') {
        cancelPress = n.props.onPress;
      }
    });
    expect(cancelPress).toBeTypeOf('function');
    (cancelPress as any)();
    expect(onDismiss).toHaveBeenCalled();
  });
});
