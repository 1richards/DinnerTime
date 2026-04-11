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
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        set({
          session,
          user: session.user,
          isLoggedIn: true,
          isLoading: false,
        });

        // Check profile for onboarding status
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        set({
          isOnboarded: profile?.onboarding_complete ?? false,
          profile: profile ?? null,
        });
      } else {
        set({
          session: null,
          user: null,
          isLoggedIn: false,
          isOnboarded: false,
          isLoading: false,
          profile: null,
        });
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
