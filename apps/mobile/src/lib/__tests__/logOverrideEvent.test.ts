import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logOverrideEvents } from '../logOverrideEvent';
import type { OverrideEventPayload } from '../logOverrideEvent';

const sampleEvents: OverrideEventPayload[] = [
  { item_name: 'olive oil', ai_location: 'fridge', user_location: 'pantry' },
  { item_name: 'butter', ai_location: 'pantry', user_location: 'fridge' },
];

describe('logOverrideEvents', () => {
  const mockFetch = vi.fn();
  const getToken = vi.fn();
  const getBaseUrl = vi.fn(() => 'http://localhost:3000');
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    mockFetch.mockReset();
    getToken.mockReset();
    warnSpy.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('short-circuits on empty events array (no fetch, no token read)', async () => {
    await logOverrideEvents([], getToken, getBaseUrl);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('POSTs to /api/v1/pantry/override-events with Bearer + JSON body on happy path', async () => {
    getToken.mockResolvedValue('test-token');
    mockFetch.mockResolvedValue({ ok: true });

    await logOverrideEvents(sampleEvents, getToken, getBaseUrl);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/pantry/override-events');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(init.body)).toEqual({ events: sampleEvents });
  });

  it('swallows fetch errors (console.warn, never throws)', async () => {
    getToken.mockResolvedValue('test-token');
    mockFetch.mockRejectedValue(new Error('network down'));

    await expect(
      logOverrideEvents(sampleEvents, getToken, getBaseUrl),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('warns but does not throw when the server returns a non-2xx status', async () => {
    getToken.mockResolvedValue('test-token');
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      logOverrideEvents(sampleEvents, getToken, getBaseUrl),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('skips the POST (with warn) when no auth token is available', async () => {
    getToken.mockResolvedValue(null);

    await logOverrideEvents(sampleEvents, getToken, getBaseUrl);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});
