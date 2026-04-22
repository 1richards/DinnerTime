/**
 * Red test stub (Phase 20 Wave 0) — production module ships in 20-03.
 *
 * Imports `../openInstacartCart` which is currently a stub that throws. Wave 3
 * (plan 20-03) ships the real deep-link-first helper:
 *   1. Linking.openURL(url) — iOS universal-link routes to Instacart app if
 *      installed, otherwise Safari.
 *   2. WebBrowser.openBrowserAsync(url) — fallback when Linking rejects.
 *
 * Requirement: SHOP-DC-03 (deep-link into Instacart app with web fallback).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { linkingMock, webBrowserMock } = vi.hoisted(() => {
  return {
    linkingMock: { openURL: vi.fn() },
    webBrowserMock: { openBrowserAsync: vi.fn() },
  };
});

vi.mock('react-native', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-native');
  return {
    ...actual,
    Linking: linkingMock,
  };
});

vi.mock('expo-web-browser', () => webBrowserMock);

import { openInstacartCart } from '../openInstacartCart';

describe('openInstacartCart', () => {
  beforeEach(() => {
    linkingMock.openURL.mockReset();
    webBrowserMock.openBrowserAsync.mockReset();
  });

  it('calls Linking.openURL first with the provided URL', async () => {
    linkingMock.openURL.mockResolvedValueOnce(true);
    webBrowserMock.openBrowserAsync.mockResolvedValueOnce({ type: 'opened' });

    await openInstacartCart('https://www.instacart.com/store/recipes/abc-123');

    expect(linkingMock.openURL).toHaveBeenCalledTimes(1);
    expect(linkingMock.openURL).toHaveBeenCalledWith(
      'https://www.instacart.com/store/recipes/abc-123',
    );
  });

  it('does NOT call WebBrowser.openBrowserAsync when Linking.openURL resolves', async () => {
    linkingMock.openURL.mockResolvedValueOnce(true);
    webBrowserMock.openBrowserAsync.mockResolvedValueOnce({ type: 'opened' });

    await openInstacartCart('https://www.instacart.com/store/recipes/abc-123');

    expect(webBrowserMock.openBrowserAsync).not.toHaveBeenCalled();
  });

  it('falls back to WebBrowser.openBrowserAsync when Linking.openURL rejects', async () => {
    linkingMock.openURL.mockRejectedValueOnce(new Error('no app handler'));
    webBrowserMock.openBrowserAsync.mockResolvedValueOnce({ type: 'opened' });

    await openInstacartCart('https://www.instacart.com/store/recipes/abc-123');

    expect(linkingMock.openURL).toHaveBeenCalledTimes(1);
    expect(webBrowserMock.openBrowserAsync).toHaveBeenCalledTimes(1);
    expect(webBrowserMock.openBrowserAsync).toHaveBeenCalledWith(
      'https://www.instacart.com/store/recipes/abc-123',
    );
  });
});
