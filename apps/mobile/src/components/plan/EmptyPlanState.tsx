import React from 'react';
import { EmptyState } from '../ui/EmptyState';
import { EMPTY_STATE_IMAGES } from '../../constants/emptyStateImages';

interface EmptyPlanStateProps {
  onGenerate: () => void;
  loading?: boolean;
}

export function EmptyPlanState({ onGenerate, loading = false }: EmptyPlanStateProps) {
  return (
    <EmptyState
      visual={{ kind: 'image', uri: EMPTY_STATE_IMAGES.planEmpty }}
      title="No plan yet"
      subtitle="Generate a 7-day dinner plan from your pantry"
      action={{
        label: loading ? 'Generating...' : 'Generate this week',
        onPress: onGenerate,
      }}
    />
  );
}
