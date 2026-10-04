import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { AppError } from './result';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000, gcTime: 5 * 60_000 },
    mutations: { retry: false },
  },
});
let epoch = 0;
let requestController = new AbortController();
export function captureQueryScope() {
  const captured = epoch;
  const signal = requestController.signal;
  return {
    signal,
    assertCurrent() {
      if (captured !== epoch || signal.aborted) {
        throw new AppError({ code: 'UNAUTHENTICATED', message: 'Your account or pair changed. Open this screen again.' });
      }
    },
  };
}
export async function resetPrivateQueries(): Promise<void> {
  epoch += 1;
  requestController.abort();
  requestController = new AbortController();
  const oldQueries = queryClient.getQueryCache().getAll();
  const cancelled = queryClient.cancelQueries();
  queryClient.clear();
  await cancelled;
  // A cancelled fetch can schedule collection after its cache entry was removed.
  for (const query of oldQueries) query.destroy();
}
export function connectQueryLifecycle(): () => void {
  focusManager.setFocused(AppState.currentState === 'active');
  const appState = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
  const network = NetInfo.addEventListener((state) => {
    onlineManager.setOnline(state.isConnected === true && state.isInternetReachable !== false);
  });
  return () => { appState.remove(); network(); };
}
