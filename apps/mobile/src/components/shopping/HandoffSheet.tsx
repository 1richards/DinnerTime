/**
 * Phase 20 Wave 0 stub — real implementation lands in 20-03.
 *
 * Apple-Pay-style handoff sheet rendering three states from a discriminated
 * union (sending | success | error). Full component ships in Wave 2/3; this
 * stub renders a single <Text>stub</Text> so HandoffSheet.test.tsx imports
 * without "cannot find module" and fails on the "Sending to Instacart cart"
 * assertion instead.
 *
 * TODO(phase-20-03): ship SymbolIcon-driven layout, per-variant error copy,
 * onOpenCart / onRetry / onDismiss prop plumbing, NativeWind Phase 19 tokens.
 * See 20-RESEARCH.md Pattern 1.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { Text } from 'react-native';
import type { HandoffErrorVariant } from '../../shopping/classifyHandoffError';

export type HandoffState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | {
      kind: 'success';
      url: string;
      itemCount: number;
      appInstalled: boolean;
    }
  | {
      kind: 'error';
      variant: HandoffErrorVariant;
      url?: string;
    };

export interface HandoffSheetProps {
  state: HandoffState;
  onOpenCart?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function HandoffSheet(_props: HandoffSheetProps) {
  // Wave 0 stub body — Wave 2/3 replaces with real sheet.
  return <Text>stub</Text>;
}
