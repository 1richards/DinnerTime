import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase using vi.hoisted() for variable hoisting with vi.mock
const mockSupabase = vi.hoisted(() => {
  const chainable = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    return chain;
  };

  return {
    from: vi.fn(() => chainable()),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Must import after mock setup
import { usePreferencesStore } from '../preferencesStore';
import type { HouseholdMember } from '../../types/preferences';

const mockMember: HouseholdMember = {
  id: 'member-1',
  profile_id: 'profile-1',
  name: 'Alice',
  member_type: 'adult',
  age_range: null,
  dietary_restrictions: ['Vegetarian'],
  dietary_allergies: ['Nut Allergy'],
  disliked_ingredients: ['Mushrooms'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockProfile = {
  id: 'profile-1',
  cuisine_preferences: ['Italian', 'Mexican'],
  skill_level: 'intermediate',
  disliked_ingredients: ['Olives'],
};

describe('preferencesStore', () => {
  beforeEach(() => {
    // Reset the store state between tests
    usePreferencesStore.setState({
      members: [],
      cuisinePreferences: [],
      skillLevel: 'beginner',
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  describe('loadPreferences', () => {
    it('fetches members and profile, populates store', async () => {
      // Mock household_members query
      const membersChain: Record<string, unknown> = {};
      membersChain.select = vi.fn(() => membersChain);
      membersChain.eq = vi.fn(() => Promise.resolve({ data: [mockMember], error: null }));

      // Mock profiles query
      const profilesChain: Record<string, unknown> = {};
      profilesChain.select = vi.fn(() => profilesChain);
      profilesChain.eq = vi.fn(() => profilesChain);
      profilesChain.single = vi.fn(() => Promise.resolve({ data: mockProfile, error: null }));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'household_members') return membersChain;
        if (table === 'profiles') return profilesChain;
        return membersChain;
      });

      await usePreferencesStore.getState().loadPreferences('profile-1');

      const state = usePreferencesStore.getState();
      expect(state.members).toHaveLength(1);
      expect(state.members[0].name).toBe('Alice');
      expect(state.cuisinePreferences).toEqual(['Italian', 'Mexican']);
      expect(state.skillLevel).toBe('intermediate');
    });
  });

  describe('addMember', () => {
    it('inserts member into household_members and adds to store', async () => {
      const newMember = {
        profile_id: 'profile-1',
        name: 'Bob',
        member_type: 'adult' as const,
        age_range: null,
        dietary_restrictions: [] as string[],
        dietary_allergies: [] as string[],
        disliked_ingredients: [] as string[],
      };

      const returnedMember = {
        ...newMember,
        id: 'member-2',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const chain: Record<string, unknown> = {};
      chain.insert = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      chain.single = vi.fn(() => Promise.resolve({ data: returnedMember, error: null }));

      mockSupabase.from.mockReturnValue(chain);

      await usePreferencesStore.getState().addMember(newMember);

      const state = usePreferencesStore.getState();
      expect(state.members).toHaveLength(1);
      expect(state.members[0].name).toBe('Bob');
      expect(state.members[0].id).toBe('member-2');
    });
  });

  describe('updateMember', () => {
    it('updates a member by id and reflects in store', async () => {
      // Pre-populate store
      usePreferencesStore.setState({ members: [mockMember] });

      const chain: Record<string, unknown> = {};
      chain.update = vi.fn(() => chain);
      chain.eq = vi.fn(() => Promise.resolve({ data: null, error: null }));

      mockSupabase.from.mockReturnValue(chain);

      await usePreferencesStore.getState().updateMember('member-1', { name: 'Alice Updated' });

      const state = usePreferencesStore.getState();
      expect(state.members[0].name).toBe('Alice Updated');
    });
  });

  describe('deleteMember', () => {
    it('removes member from household_members and store', async () => {
      usePreferencesStore.setState({ members: [mockMember] });

      const chain: Record<string, unknown> = {};
      chain.delete = vi.fn(() => chain);
      chain.eq = vi.fn(() => Promise.resolve({ data: null, error: null }));

      mockSupabase.from.mockReturnValue(chain);

      await usePreferencesStore.getState().deleteMember('member-1');

      const state = usePreferencesStore.getState();
      expect(state.members).toHaveLength(0);
    });
  });

  describe('updateCuisinePreferences', () => {
    it('updates cuisine preferences on profile and store', async () => {
      const chain: Record<string, unknown> = {};
      chain.update = vi.fn(() => chain);
      chain.eq = vi.fn(() => Promise.resolve({ data: null, error: null }));

      mockSupabase.from.mockReturnValue(chain);

      await usePreferencesStore.getState().updateCuisinePreferences('profile-1', ['Thai', 'Japanese']);

      const state = usePreferencesStore.getState();
      expect(state.cuisinePreferences).toEqual(['Thai', 'Japanese']);
    });
  });

  describe('updateSkillLevel', () => {
    it('updates skill level on profile and store', async () => {
      const chain: Record<string, unknown> = {};
      chain.update = vi.fn(() => chain);
      chain.eq = vi.fn(() => Promise.resolve({ data: null, error: null }));

      mockSupabase.from.mockReturnValue(chain);

      await usePreferencesStore.getState().updateSkillLevel('profile-1', 'adventurous');

      const state = usePreferencesStore.getState();
      expect(state.skillLevel).toBe('adventurous');
    });
  });

  describe('dietary separation', () => {
    it('stores dietary_restrictions and dietary_allergies as separate arrays', () => {
      usePreferencesStore.setState({ members: [mockMember] });

      const state = usePreferencesStore.getState();
      const member = state.members[0];
      expect(member.dietary_restrictions).toEqual(['Vegetarian']);
      expect(member.dietary_allergies).toEqual(['Nut Allergy']);
      expect(member.dietary_restrictions).not.toEqual(member.dietary_allergies);
    });
  });

  describe('updateMemberDislikes', () => {
    it('replaces the full disliked_ingredients array (not appends)', async () => {
      usePreferencesStore.setState({ members: [mockMember] });

      const chain: Record<string, unknown> = {};
      chain.update = vi.fn(() => chain);
      chain.eq = vi.fn(() => Promise.resolve({ data: null, error: null }));

      mockSupabase.from.mockReturnValue(chain);

      // Replace dislikes entirely
      await usePreferencesStore.getState().updateMember('member-1', {
        disliked_ingredients: ['Olives', 'Celery'],
      });

      const state = usePreferencesStore.getState();
      // Should be the new array, not the old one plus new ones
      expect(state.members[0].disliked_ingredients).toEqual(['Olives', 'Celery']);
      expect(state.members[0].disliked_ingredients).not.toContain('Mushrooms');
    });
  });
});
