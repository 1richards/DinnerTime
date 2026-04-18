import { describe, it, expect, vi, beforeEach } from 'vitest';

// usePreventRemove is a React Navigation hook. We can't mount it under a node
// env without a renderer, so instead we mock it to a spy that captures the
// (isDirty, callback) invocation. Then we manually invoke the captured
// callback to assert Alert is called with the right shape.

const hoisted = vi.hoisted(() => ({
  preventRemoveSpy: vi.fn<(isDirty: boolean, cb: (ev: unknown) => void) => void>(),
  dispatchSpy: vi.fn(),
  alertSpy: vi.fn(),
}));
const { preventRemoveSpy, dispatchSpy, alertSpy } = hoisted;

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ dispatch: hoisted.dispatchSpy }),
  usePreventRemove: (isDirty: boolean, cb: (ev: unknown) => void) =>
    hoisted.preventRemoveSpy(isDirty, cb),
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: (...args: unknown[]) => hoisted.alertSpy(...args),
  },
}));

import { useDirtyFormGuard } from '../useDirtyFormGuard';

describe('useDirtyFormGuard', () => {
  beforeEach(() => {
    preventRemoveSpy.mockClear();
    alertSpy.mockClear();
    dispatchSpy.mockClear();
  });

  it('calls usePreventRemove with isDirty=true when form is dirty', () => {
    useDirtyFormGuard(true);
    expect(preventRemoveSpy).toHaveBeenCalledTimes(1);
    expect(preventRemoveSpy.mock.calls[0][0]).toBe(true);
  });

  it('calls usePreventRemove with isDirty=false when form is clean', () => {
    useDirtyFormGuard(false);
    expect(preventRemoveSpy).toHaveBeenCalledTimes(1);
    expect(preventRemoveSpy.mock.calls[0][0]).toBe(false);
  });

  it("invokes Alert.alert with 'Unsaved changes' title and 2 buttons when guard fires", () => {
    useDirtyFormGuard(true);
    const [, guardCb] = preventRemoveSpy.mock.calls[0];
    const navAction = { type: 'GO_BACK' };
    guardCb({ data: { action: navAction } });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alertSpy.mock.calls[0];
    expect(title).toBe('Unsaved changes');
    expect(typeof message).toBe('string');
    expect((message as string).length).toBeGreaterThan(0);
    expect(Array.isArray(buttons)).toBe(true);
    expect((buttons as unknown[])).toHaveLength(2);

    const [keep, discard] = buttons as Array<{ text: string; style: string }>;
    expect(keep.text).toBe('Keep editing');
    expect(keep.style).toBe('cancel');
    expect(discard.text).toBe('Discard');
    expect(discard.style).toBe('destructive');
  });

  it("'Discard' button dispatches data.action to continue navigation", () => {
    useDirtyFormGuard(true);
    const [, guardCb] = preventRemoveSpy.mock.calls[0];
    const navAction = { type: 'GO_BACK' };
    guardCb({ data: { action: navAction } });

    const buttons = alertSpy.mock.calls[0][2] as Array<{
      onPress?: () => void;
    }>;
    const discardBtn = buttons[1];
    expect(dispatchSpy).not.toHaveBeenCalled();
    discardBtn.onPress!();
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith(navAction);
  });

  it("'Keep editing' button has no onPress handler (default cancel)", () => {
    useDirtyFormGuard(true);
    const [, guardCb] = preventRemoveSpy.mock.calls[0];
    guardCb({ data: { action: { type: 'GO_BACK' } } });
    const buttons = alertSpy.mock.calls[0][2] as Array<{
      onPress?: () => void;
    }>;
    const keepBtn = buttons[0];
    expect(keepBtn.onPress).toBeUndefined();
  });
});
