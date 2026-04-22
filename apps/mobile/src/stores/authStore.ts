import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { SkillLevel } from '../types/preferences';

export interface Profile {
  id: string;
  display_name: string | null;
  household_size: number;
  skill_level: SkillLevel;
  dietary_preferences: string[];
  cuisine_preferences: string[];
  disliked_ingredients: string[];
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoggedIn: boolean;
  isOnboarded: boolean;
  isLoading: boolean;
  profile: Profile | null;
  initialize: () => () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoggedIn: false,
  isOnboarded: false,
  isLoading: true,
  profile: null,

  initialize: () => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({
          session,
          user: session.user,
          isLoggedIn: true,
          isLoading: false,
        });

        // CRITICAL: Per Supabase docs, NEVER make supabase.* calls directly
        // inside an onAuthStateChange callback — the auth lock is held during
        // the callback and any Supabase request will deadlock. Defer with
        // setTimeout to escape the lock context.
        // https://supabase.com/docs/reference/javascript/auth-onauthstatechange
        setTimeout(async () => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          set({
            isOnboarded: profile?.onboarding_complete ?? false,
            profile: profile ?? null,
          });

          // Phase 23-06 (NFR-15): Correlate Sentry events with the authed
          // user id. Dynamic import keeps @sentry/react-native out of the
          // cold-start module graph — first event pays the init cost.
          try {
            const { setSentryUser } = await import('../lib/sentry');
            setSentryUser(session.user.id);
          } catch {
            // Sentry wrapper isn't critical — swallow load errors silently.
          }
        }, 0);
      } else {
        set({
          session: null,
          user: null,
          isLoggedIn: false,
          isOnboarded: false,
          isLoading: false,
          profile: null,
        });

        // Phase 23-06 (NFR-15): Clear the Sentry user on sign-out so
        // subsequent events are not attributed to the previous account.
        setTimeout(async () => {
          try {
            const { setSentryUser } = await import('../lib/sentry');
            setSentryUser(null);
          } catch {
            // non-critical
          }
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      isLoggedIn: false,
      isOnboarded: false,
      profile: null,
    });
  },
}));
