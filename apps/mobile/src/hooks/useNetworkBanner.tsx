import { useNetworkStore } from '../stores/networkStore';

/**
 * Thin selector hook for callers that want offline-banner logic without
 * mounting the OfflineBanner component itself.
 */
export function useNetworkBanner(): { isOnline: boolean; shouldShow: boolean } {
  const isOnline = useNetworkStore((s) => s.isOnline);
  return { isOnline, shouldShow: !isOnline };
}
