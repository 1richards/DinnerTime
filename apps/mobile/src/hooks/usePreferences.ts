import { useMutation } from '@tanstack/react-query';
import { usePreferencesStore } from '../stores/preferencesStore';
import type { HouseholdMember, CuisineOption, SkillLevel } from '../types/preferences';

/**
 * Hook for adding a new household member.
 * Wraps preferencesStore.addMember with useMutation for error/loading state.
 */
export function useAddMember() {
  const addMember = usePreferencesStore((s) => s.addMember);

  return useMutation({
    mutationFn: (member: Omit<HouseholdMember, 'id' | 'created_at' | 'updated_at'>) =>
      addMember(member),
  });
}

/**
 * Hook for updating an existing household member.
 * Wraps preferencesStore.updateMember with useMutation.
 */
export function useUpdateMember() {
  const updateMember = usePreferencesStore((s) => s.updateMember);

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<HouseholdMember> }) =>
      updateMember(id, updates),
  });
}

/**
 * Hook for deleting a household member.
 * Wraps preferencesStore.deleteMember with useMutation.
 */
export function useDeleteMember() {
  const deleteMember = usePreferencesStore((s) => s.deleteMember);

  return useMutation({
    mutationFn: (id: string) => deleteMember(id),
  });
}

/**
 * Hook for updating profile-level preferences (cuisine, skill level).
 * Generic updater that delegates to the appropriate store method.
 */
export function useUpdateProfile() {
  const updateCuisinePreferences = usePreferencesStore((s) => s.updateCuisinePreferences);
  const updateSkillLevel = usePreferencesStore((s) => s.updateSkillLevel);

  const cuisineMutation = useMutation({
    mutationFn: ({ profileId, prefs }: { profileId: string; prefs: CuisineOption[] }) =>
      updateCuisinePreferences(profileId, prefs),
  });

  const skillMutation = useMutation({
    mutationFn: ({ profileId, level }: { profileId: string; level: SkillLevel }) =>
      updateSkillLevel(profileId, level),
  });

  return {
    updateCuisine: cuisineMutation,
    updateSkill: skillMutation,
  };
}
