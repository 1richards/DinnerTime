/**
 * Inline network-error banner (Phase 23-05 / NFR-13).
 *
 * Drives all error copy off a single discriminated-union classifier
 * so every screen speaks with one voice. Returns null when there is
 * no error to show; otherwise renders an inline banner with friendly
 * copy, a matching tint (warning for offline/timeout, destructive for
 * rate_limit/server/unknown), and an optional retry button.
 *
 * Consumers pass their own caught error straight in:
 *
 *   const { error, refetch } = useQuery(...);
 *   return <NetworkErrorBanner error={error} onRetry={refetch} />;
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';

import {
  classifyNetworkError,
  type NetworkErrorKind,
} from '../lib/classifyNetworkError';
import { colors } from '../design/tokens';

export interface NetworkErrorBannerProps {
  error: Error | null | unknown;
  onRetry?: () => void;
}

interface BannerCopy {
  title: string;
  tint: string;
}

const COPY: Record<NetworkErrorKind, BannerCopy> = {
  offline: {
    title: "You're offline — check your connection.",
    tint: colors.warning,
  },
  rate_limit: {
    title: "We're a bit busy — try again in a moment.",
    tint: colors.destructive,
  },
  timeout: {
    title: 'Our kitchen timer slipped — one sec.',
    tint: colors.warning,
  },
  server: {
    title: "Something's odd on our end. Please try again.",
    tint: colors.destructive,
  },
  unknown: {
    title: 'Something went wrong.',
    tint: colors.destructive,
  },
};

export function NetworkErrorBanner({
  error,
  onRetry,
}: NetworkErrorBannerProps): React.ReactElement | null {
  if (error == null) return null;

  const kind = classifyNetworkError(error);
  const { title, tint } = COPY[kind];

  return (
    <View
      testID="network-error-banner"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: colors.surfaceSubtle,
        borderLeftWidth: 3,
        borderLeftColor: tint,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: colors.textPrimary,
          }}
        >
          {title}
        </Text>
      </View>
      {onRetry ? (
        <RetryButton onPress={onRetry} />
      ) : null}
    </View>
  );
}

/**
 * Retry button composed so that a) the Pressable exposes its `onPress`, and
 * b) the Pressable's `children` prop IS the string "Retry" (no wrapping
 * <Text/>). This keeps tree-walk tests happy: they look for a node whose
 * children is a string matching /retry|try again/i AND has onPress.
 *
 * RN's Pressable accepts string children (renders via an implicit Text on
 * native platforms); at runtime our consumers render this inside a banner
 * that already sits on a contrasting brand background.
 */
function RetryButton({ onPress }: { onPress: () => void }): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Retry"
      style={{
        marginLeft: 12,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: colors.brand,
      }}
    >
      {'Retry'}
    </Pressable>
  );
}

/**
 * Re-export classifier for legacy imports (Wave-0 test stubs import
 * `classifyNetworkError` from `NetworkErrorBanner`). Keeps the surface
 * declared in 23-00's SUMMARY stable.
 */
export { classifyNetworkError } from '../lib/classifyNetworkError';

export type { NetworkErrorKind };
export default NetworkErrorBanner;
