import { vi } from 'vitest';

// Global module mocks for native/Expo surfaces used by cooking-mode hooks.
// These are defined globally so downstream screen tests inherit the same
// stub surface without re-mocking per file.

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn(),
  isSpeakingAsync: vi.fn().mockResolvedValue(false),
}));

vi.mock('expo-keep-awake', () => ({
  useKeepAwake: vi.fn(),
}));

vi.mock('@jamsch/expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    start: vi.fn(),
    stop: vi.fn(),
    requestPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  },
  useSpeechRecognitionEvent: vi.fn(),
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: vi.fn(() => () => {}),
    fetch: vi.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  },
}));
