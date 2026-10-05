import { useSyncExternalStore } from 'react';
import { AppError } from '@deseo/domain/result';

export function isOnline(): boolean { return navigator.onLine; }
function subscribe(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}
export function useNetworkStatus(): boolean {
  return useSyncExternalStore(subscribe, isOnline);
}
export function assertOnline(): void {
  if (!isOnline()) throw new AppError({ code: 'RETRYABLE', message: 'You are offline. Connect before you submit.' });
}
