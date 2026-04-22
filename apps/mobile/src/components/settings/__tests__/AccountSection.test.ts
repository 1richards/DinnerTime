/**
 * Red test stub (Phase 23 Wave 0) — component ships in 23-01.
 *
 * Imports `../AccountSection.js` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../AccountSection.js'" — that is the red signal.
 *
 * Wave 1 ships `apps/mobile/src/components/settings/AccountSection.tsx`:
 *   export function AccountSection(): JSX.Element;
 *
 * Renders 4 rows in the Settings Account group:
 *   - Change password → /settings/account/change-password
 *   - Change email    → /settings/account/change-email
 *   - Export data     → /settings/account/export
 *   - Delete account  → /settings/account/delete
 *
 * Requirement: NFR-03 / NFR-04 / NFR-07 (account-management UI).
 */
import { describe, it, expect, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push }),
  Link: (_props: unknown) => null,
}));

// @ts-expect-error — module does not exist yet (Wave 0 red stub; ships in 23-01)
const { AccountSection } = await import('../AccountSection.js');

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

describe('AccountSection', () => {
  it('renders 4 rows: Change password, Change email, Export data, Delete account', () => {
    const tree: any = AccountSection();
    const labels: string[] = [];
    walk(tree, (n) => {
      const c = n.props?.children;
      if (typeof c === 'string') labels.push(c);
      else if (Array.isArray(c)) for (const x of c) if (typeof x === 'string') labels.push(x);
    });

    expect(labels.some((l) => /change\s*password/i.test(l))).toBe(true);
    expect(labels.some((l) => /change\s*email/i.test(l))).toBe(true);
    expect(labels.some((l) => /export\s*data/i.test(l))).toBe(true);
    expect(labels.some((l) => /delete\s*account/i.test(l))).toBe(true);
  });

  it('Change password row routes to /settings/account/change-password', () => {
    const tree: any = AccountSection();
    let pressHandler: (() => void) | undefined;
    walk(tree, (n) => {
      const c = n.props?.children;
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.find((x) => typeof x === 'string') : undefined;
      if (typeof text === 'string' && /change\s*password/i.test(text) && typeof n.props?.onPress === 'function') {
        pressHandler = n.props.onPress;
      }
    });
    expect(pressHandler).toBeTypeOf('function');
    (pressHandler as any)();
    expect(push).toHaveBeenCalled();
    const arg = (push.mock.calls[0][0] ?? '').toString();
    expect(arg).toContain('change-password');
  });

  it('Delete account row routes to /settings/account/delete', () => {
    push.mockClear();
    const tree: any = AccountSection();
    let pressHandler: (() => void) | undefined;
    walk(tree, (n) => {
      const c = n.props?.children;
      const text = typeof c === 'string' ? c : Array.isArray(c) ? c.find((x) => typeof x === 'string') : undefined;
      if (typeof text === 'string' && /delete\s*account/i.test(text) && typeof n.props?.onPress === 'function') {
        pressHandler = n.props.onPress;
      }
    });
    expect(pressHandler).toBeTypeOf('function');
    (pressHandler as any)();
    expect(push).toHaveBeenCalled();
    const arg = (push.mock.calls[0][0] ?? '').toString();
    expect(arg).toContain('delete');
  });
});
