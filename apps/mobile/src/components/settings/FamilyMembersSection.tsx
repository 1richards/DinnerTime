import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { useDeleteMember } from '../../hooks/usePreferences';
import { Button } from '../ui/Button';
import { MemberCard } from './MemberCard';
import { MemberFormModal } from './MemberFormModal';
import type { HouseholdMember } from '../../types/preferences';

interface FamilyMembersSectionProps {
  profileId: string;
  onMemberChanged?: () => void;
}

export function FamilyMembersSection({ profileId, onMemberChanged }: FamilyMembersSectionProps) {
  const members = usePreferencesStore((s) => s.members);
  const deleteMember = useDeleteMember();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);

  const handleEdit = (member: HouseholdMember) => {
    setEditingMember(member);
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingMember(null);
    setModalVisible(true);
  };

  const handleDelete = (member: HouseholdMember) => {
    Alert.alert(
      'Delete Member',
      `Are you sure you want to remove ${member.name} from your household?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMember.mutateAsync(member.id);
              onMemberChanged?.();
            } catch {
              // Error handled by mutation state
            }
          },
        },
      ]
    );
  };

  const handleSaved = () => {
    onMemberChanged?.();
  };

  return (
    <View>
      <Text className="text-lg font-bold text-warmGray-900 mb-3">
        Family Members
      </Text>

      {members.length === 0 ? (
        <Text className="text-sm text-warmGray-500 mb-4">
          Add family members to personalize meal suggestions for your household.
        </Text>
      ) : (
        members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            onPress={() => handleEdit(member)}
            onDelete={() => handleDelete(member)}
          />
        ))
      )}

      <Button
        title="Add Member"
        variant="outline"
        onPress={handleAdd}
        className="mt-1"
      />

      <MemberFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        member={editingMember}
        profileId={profileId}
        onSaved={handleSaved}
      />
    </View>
  );
}
