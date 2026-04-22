/**
 * Red test stub (Phase 23 Wave 0) — component ships in 23-02.
 *
 * Imports `../DeleteAccountSheet.js` which DOES NOT YET EXIST. Vitest will
 * report "Cannot find module '../DeleteAccountSheet.js'" — that is the red
 * signal.
 *
 * Wave 1 ships `apps/mobile/src/components/settings/DeleteAccountSheet.tsx`:
 *   export function DeleteAccountSheet(props: {
 *     visible: boolean;
 *     onDismiss: () => void;
 *   }): JSX.Element;
 *   export function canConfirmDelete(input: string): boolean;
 *
 * Two-step confirm guard: user must type "DELETE" (case-sensitive) AND tap
 * the red confirm button.
 *
 * Requirement: NFR-04 (delete account).
 */
import { describe, it, expect, vi } from 'vitest';

const { authedFetch, signOut } = vi.hoisted(() => ({
  authedFetch: vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ deleted: true }),
  })),
  signOut: vi.fn(async () => {}),
}));

vi.mock('../../../lib/authedFetch', () => ({ authedFetch }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: Object.assign(() => ({ signOut }), { getState: () => ({ signOut }) }),
}));

// @ts-expect-error — module does not exist yet (Wave 0 red stub; ships in 23-02)
const mod = await import('../DeleteAccountSheet.js');
const { canConfirmDelete } = mod;

describe('canConfirmDelete — type-DELETE guard', () => {
  it('returns false for empty string', () => {
    expect(canConfirmDelete('')).toBe(false);
  });

  it('returns false for "delete" (case-sensitive)', () => {
    expect(canConfirmDelete('delete')).toBe(false);
  });

  it('returns false for whitespace padding', () => {
    expect(canConfirmDelete(' DELETE ')).toBe(false);
  });

  it('returns true only for exact "DELETE"', () => {
    expect(canConfirmDelete('DELETE')).toBe(true);
  });
});

describe('DeleteAccountSheet', () => {
  it('POSTs to /account/delete on confirm and signs user out on success', async () => {
    // The exact way the component wires confirm is a Wave 1 decision. Test
    // asserts the public contract: given a user-provided confirmInput string,
    // the component's exported performDelete() helper fires the API call and
    // on-success clears the auth session.
    //
    // Wave 1 MUST expose performDelete as a named export (used here).
    // @ts-expect-error — Wave 0 red stub (helper not yet exported)
    const { performDelete } = mod;
    expect(typeof performDelete).toBe('function');
    await performDelete({ reason: 'switching apps' });

    expect(authedFetch).toHaveBeenCalled();
    const [url, init] = authedFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/account\/delete$/);
    expect((init as RequestInit).method?.toUpperCase()).toBe('POST');

    expect(signOut).toHaveBeenCalled();
  });
});
