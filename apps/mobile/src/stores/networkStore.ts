import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface NetworkState {
  isOnline: boolean;
}

export const useNetworkStore = create<NetworkState>(() => ({
  isOnline: true,
}));

// Module side-effect: wire NetInfo listener once on import. Treat
// isInternetReachable === null (unknown) as online, only `false` flips us
// offline. This matches the contract documented in 10-04 plan.
NetInfo.addEventListener((state) => {
  const isOnline =
    !!state.isConnected && state.isInternetReachable !== false;
  useNetworkStore.setState({ isOnline });
});
