import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type {
  HouseholdMember,
  CuisineOption,
  SkillLevel,
} from '../types/preferences';

interface PreferencesState {
  members: HouseholdMember[];
  cuisinePreferences: CuisineOption[];
  skillLevel: SkillLevel;
  isLoading: boolean;

  loadPreferences: (profileId: string) => Promise<void>;
  addMember: (member: Omit<HouseholdMember, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateMember: (id: string, updates: Partial<HouseholdMember>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  updateCuisinePreferences: (profileId: string, prefs: CuisineOption[]) => Promise<void>;
  updateSkillLevel: (profileId: string, level: SkillLevel) => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  members: [],
  cuisinePreferences: [],
  skillLevel: 'beginner',
  isLoading: false,

  loadPreferences: async (profileId: string) => {
    set({ isLoading: true });
    try {
      // Fetch household members
      const { data: members, error: membersError } = await supabase
        .from('household_members')
        .select('*')
        .eq('profile_id', profileId);

      if (membersError) throw membersError;

      // Fetch profile for cuisine preferences and skill level
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('cuisine_preferences, skill_level, disliked_ingredients')
        .eq('id', profileId)
        .single();

      if (profileError) throw profileError;

      set({
        members: members ?? [],
        cuisinePreferences: (profile?.cuisine_preferences ?? []) as CuisineOption[],
        skillLevel: (profile?.skill_level ?? 'beginner') as SkillLevel,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  addMember: async (member) => {
    const { data, error } = await supabase
      .from('household_members')
      .insert(member)
      .select()
      .single();

    if (error) throw error;

    set((state) => ({
      members: [...state.members, data as HouseholdMember],
    }));
  },

  updateMember: async (id: string, updates: Partial<HouseholdMember>) => {
    const previousMembers = get().members;

    // Optimistic update
    set((state) => ({
      members: state.members.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));

    const { error } = await supabase
      .from('household_members')
      .update(updates)
      .eq('id', id);

    if (error) {
      // Rollback on error
      set({ members: previousMembers });
      throw error;
    }
  },

  deleteMember: async (id: string) => {
    const previousMembers = get().members;

    // Optimistic update
    set((state) => ({
      members: state.members.filter((m) => m.id !== id),
    }));

    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('id', id);

    if (error) {
      // Rollback on error
      set({ members: previousMembers });
      throw error;
    }
  },

  updateCuisinePreferences: async (profileId: string, prefs: CuisineOption[]) => {
    const previousPrefs = get().cuisinePreferences;

    // Optimistic update
    set({ cuisinePreferences: prefs });

    const { error } = await supabase
      .from('profiles')
      .update({ cuisine_preferences: prefs })
      .eq('id', profileId);

    if (error) {
      // Rollback on error
      set({ cuisinePreferences: previousPrefs });
      throw error;
    }
  },

  updateSkillLevel: async (profileId: string, level: SkillLevel) => {
    const previousLevel = get().skillLevel;

    // Optimistic update
    set({ skillLevel: level });

    const { error } = await supabase
      .from('profiles')
      .update({ skill_level: level })
      .eq('id', profileId);

    if (error) {
      // Rollback on error
      set({ skillLevel: previousLevel });
      throw error;
    }
  },
}));
