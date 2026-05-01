import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Speech from 'expo-speech';
import { runStepSpeakerEffect } from '../useStepSpeaker';
import { useSettingsStore } from '../../stores/settingsStore';

// We can't mount React hooks in a node environment without a renderer, so
// we exercise the pure effect body directly. useStepSpeaker is a one-line
// wrapper: `useEffect(() => runStepSpeakerEffect(text, enabled), [text, enabled])`.
// Simulating mount/rerender/unmount means calling the function and invoking
// the returned cleanup in the same order React would.
//
// Phase quick-5 (ElevenLabs): the effect now posts to the backend, writes
// MP3 bytes to expo-file-system cache, and plays via expo-audio on the
// happy path — falling back to Speech.speak only when anything on the
// ElevenLabs path fails. We mock all three surfaces so the same pure
// effect body exercises both paths deterministically.

vi.mock('expo-audio', () => ({
  createAudioPlayer: vi.fn(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    release: vi.fn(),
  })),
}));
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///tmp/',
  writeAsStringAsync: vi.fn(async () => {}),
  EncodingType: { Base64: 'base64' },
}));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'test-token' } },
      })),
    },
  },
}));

import { createAudioPlayer } from 'expo-audio';

const speakMock = vi.mocked(Speech.speak);
const stopMock = vi.mocked(Speech.stop);
const createAudioPlayerMock = vi.mocked(createAudioPlayer);

// Two microtask ticks drains: (1) supabase.auth.getSession, (2) fetch.
// A third tick covers FileSystem.writeAsStringAsync before the player
// materializes. Use four to stay on the safe side of await scheduling.
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
  }
}

describe('useStepSpeaker (runStepSpeakerEffect)', () => {
  beforeEach(() => {
    speakMock.mockClear();
    stopMock.mockClear();
    createAudioPlayerMock.mockClear();
    // Default fetch: 200 with MP3 bytes. Individual tests override for failures.
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(10),
    })) as unknown as typeof fetch;
  });

  it('plays ElevenLabs MP3 via expo-audio on successful fetch (no Speech.speak fallback)', async () => {
    runStepSpeakerEffect('Chop onions', true);
    await flushMicrotasks();

    expect(createAudioPlayerMock).toHaveBeenCalledTimes(1);
    const playerResult = createAudioPlayerMock.mock.results[0];
    expect(playerResult?.value).toBeDefined();
    const player = playerResult?.value as { play: ReturnType<typeof vi.fn> };
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('releases prior player on cleanup when text changes (overlap prevention)', async () => {
    // Use distinct text not reused by other tests — the LRU cache is module-
    // scope and persists across tests in this file, so reusing "Chop onions"
    // would hit the cache from Test 1 and suppress the second fetch.
    const cleanup1 = runStepSpeakerEffect('Mince the garlic', true);
    await flushMicrotasks();

    const firstPlayer = createAudioPlayerMock.mock.results[0]?.value as {
      pause: ReturnType<typeof vi.fn>;
      release: ReturnType<typeof vi.fn>;
    };

    // React runs cleanup BEFORE the next effect when deps change.
    cleanup1?.();
    expect(firstPlayer.pause).toHaveBeenCalled();
    expect(firstPlayer.release).toHaveBeenCalled();

    runStepSpeakerEffect('Dice the shallots', true);
    await flushMicrotasks();

    // Two player creations total; one fetch per fresh-cache-miss text.
    expect(createAudioPlayerMock).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('never fetches, plays, or speaks when enabled=false', async () => {
    runStepSpeakerEffect('Chop onions', false);
    await flushMicrotasks();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(createAudioPlayerMock).not.toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('invokes player.pause + player.release AND Speech.stop on cleanup', async () => {
    const cleanup = runStepSpeakerEffect('Chop onions', true);
    await flushMicrotasks();
    const player = createAudioPlayerMock.mock.results[0]?.value as {
      pause: ReturnType<typeof vi.fn>;
      release: ReturnType<typeof vi.fn>;
    };

    cleanup?.();

    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.release).toHaveBeenCalledTimes(1);
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when text is undefined', async () => {
    runStepSpeakerEffect(undefined, true);
    await flushMicrotasks();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(createAudioPlayerMock).not.toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();
    expect(stopMock).not.toHaveBeenCalled();
  });

  it('on fetch success → player.play called, Speech.speak NOT called', async () => {
    runStepSpeakerEffect('Season the chicken', true);
    await flushMicrotasks();

    const player = createAudioPlayerMock.mock.results[0]?.value as {
      play: ReturnType<typeof vi.fn>;
    };
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('forwards persisted voiceId in POST body when settingsStore has one set', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(10),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    useSettingsStore.setState({ cookingVoiceId: 'XB0fDUnXU5powFXDhCwa' });

    runStepSpeakerEffect('Whisk the dressing.', true);
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      text: 'Whisk the dressing.',
      voiceId: 'XB0fDUnXU5powFXDhCwa',
    });

    // Reset for other tests in this file.
    useSettingsStore.setState({ cookingVoiceId: null });
  });

  it('omits voiceId from POST body when settingsStore.cookingVoiceId is null', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(10),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    useSettingsStore.setState({ cookingVoiceId: null });

    runStepSpeakerEffect('Toast the spices briefly.', true);
    await flushMicrotasks();

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ text: 'Toast the spices briefly.' });
    expect(body).not.toHaveProperty('voiceId');
  });

  it('on fetch failure (502) → Speech.speak IS called with en-US options', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 502,
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch;

    runStepSpeakerEffect('Heat the pan over medium heat.', true);
    await flushMicrotasks();

    expect(createAudioPlayerMock).not.toHaveBeenCalled();
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith(
      'Heat the pan over medium heat.',
      expect.objectContaining({
        language: 'en-US',
        rate: 0.95,
      }),
    );
  });
});
