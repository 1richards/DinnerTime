import { vi } from 'vitest';

// Global module mocks for native/Expo surfaces used by cooking-mode hooks.
// These are defined globally so downstream screen tests inherit the same
// stub surface without re-mocking per file.

// react-native ships Flow-annotated source that vitest's bundler cannot
// parse. Tests that exercise pure logic never need the real module; they
// only need identifiable primitive references to assert element trees.
// Each primitive is a distinct dummy function-component so test code can
// match by reference (e.g. `el.type === View`).
vi.mock('react-native', () => {
  const View = (_props: unknown) => null;
  const Text = (_props: unknown) => null;
  const Pressable = (_props: unknown) => null;
  const TouchableOpacity = (_props: unknown) => null;
  const Image = (_props: unknown) => null;
  const ActivityIndicator = (_props: unknown) => null;
  const ScrollView = (_props: unknown) => null;
  const FlatList = (_props: unknown) => null;
  const Modal = (_props: unknown) => null;
  const TextInput = (_props: unknown) => null;
  const Alert = { alert: vi.fn() };
  const Platform = { OS: 'ios', select: (map: Record<string, unknown>) => map.ios };
  const StyleSheet = { create: <T,>(styles: T) => styles, flatten: (x: unknown) => x };
  const Dimensions = { get: () => ({ width: 390, height: 844 }) };
  const Animated = { View, Text, createAnimatedComponent: (c: unknown) => c };
  return {
    View,
    Text,
    Pressable,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    ScrollView,
    FlatList,
    Modal,
    TextInput,
    Alert,
    Platform,
    StyleSheet,
    Dimensions,
    Animated,
    default: {},
  };
});

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

// AsyncStorage stub — needed because Zustand persist middleware loads it
// at module import-time. Tests that need to inspect persisted state should
// re-mock this module locally with vi.hoisted for clean state.
vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (k: string) => store.get(k) ?? null),
      setItem: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: vi.fn(async (k: string) => {
        store.delete(k);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
    },
  };
});
