import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import * as AppleAuthentication from 'expo-apple-authentication';

interface AuthResult {
  data: unknown;
  error: Error | null;
}

export function useAuth() {
  const signOut = useAuthStore((s) => s.signOut);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) return { data: null, error };
        return { data, error: null };
      } catch (err) {
        return { data: null, error: err as Error };
      }
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) return { data: null, error };
        return { data, error: null };
      } catch (err) {
        return { data: null, error: err as Error };
      }
    },
    []
  );

  const signInWithApple = useCallback(async (): Promise<AuthResult> => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { data: null, error: new Error('No identity token from Apple') };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) return { data: null, error };

      // CRITICAL: Apple only provides full name on FIRST sign-in ever.
      // Capture and persist immediately.
      if (credential.fullName && data.user) {
        const givenName = credential.fullName.givenName ?? '';
        const familyName = credential.fullName.familyName ?? '';
        const fullName = `${givenName} ${familyName}`.trim();

        if (fullName) {
          await supabase.auth.updateUser({
            data: { full_name: fullName },
          });
        }
      }

      return { data, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  }, []);

  return {
    signInWithEmail,
    signUpWithEmail,
    signInWithApple,
    signOut,
  };
}
