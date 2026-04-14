import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';

/**
 * Detect Node SSR (Expo Router static export). Used to skip native storage
 * calls during server-side rendering; window is undefined in Node but exists
 * in React Native runtime.
 */
const isServerRender =
  typeof window === 'undefined' &&
  typeof globalThis.process !== 'undefined' &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  !!(globalThis.process as any).versions?.node;

/**
 * Noop storage used during SSR — Supabase auth client invokes storage at
 * module load time, but native AsyncStorage / SecureStore aren't available
 * inside Node. On a real device this is never used.
 */
class NoopStorage {
  async getItem(): Promise<string | null> {
    return null;
  }
  async setItem(): Promise<void> {}
  async removeItem(): Promise<void> {}
}

/**
 * LargeSecureStore: AES-256 encryption key in SecureStore, encrypted session in AsyncStorage.
 * Required because Supabase sessions exceed SecureStore's 2048-byte limit.
 *
 * Source: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native?auth-store=secure-store
 *
 * iOS Simulator fallback:
 * expo-secure-store requires the keychain-access-groups entitlement which
 * the dev-client build doesn't provision in the simulator, so every call
 * throws "A required entitlement isn't present". When that happens we fall
 * back to plain AsyncStorage for the whole session — acceptable for the
 * simulator (no secure enclave anyway) and for automated UAT. On a real
 * device SecureStore still works normally.
 */
let secureStoreAvailable: boolean | null = null;

async function isSecureStoreAvailable(): Promise<boolean> {
  if (secureStoreAvailable !== null) return secureStoreAvailable;
  try {
    // A harmless probe — set then read then delete a tiny value.
    await SecureStore.setItemAsync('__dt_secure_probe__', '1');
    await SecureStore.deleteItemAsync('__dt_secure_probe__');
    secureStoreAvailable = true;
  } catch {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[supabase] SecureStore unavailable, falling back to AsyncStorage.');
    }
    secureStoreAvailable = false;
  }
  return secureStoreAvailable;
}

class LargeSecureStore {
  private async _encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1)
    );
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    if (!(await isSecureStoreAvailable())) {
      return AsyncStorage.getItem(key);
    }
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return encrypted;
    return await this._decrypt(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    if (!(await isSecureStoreAvailable())) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!(await isSecureStoreAvailable())) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isServerRender ? new NoopStorage() : new LargeSecureStore(),
    autoRefreshToken: !isServerRender,
    persistSession: !isServerRender,
    detectSessionInUrl: false,
  },
});
