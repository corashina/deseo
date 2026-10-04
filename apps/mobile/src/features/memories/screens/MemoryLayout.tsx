import { useEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../auth';
import { usePairGate } from '../../pair';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { ensureMemoryLifecycle, getMemoryLifecycle, reconcileMemoryAccess, subscribeMemoryLifecycle } from '../lifecycle';

export function MemoryLayout() {
  return <MemoryAccessBoundary><Stack screenOptions={{ headerShown: false }} /></MemoryAccessBoundary>;
}
export function MemoryAccessBoundary({ children }: PropsWithChildren) {
  const { state } = useAuth();
  const gate = usePairGate();
  const access = useSyncExternalStore(subscribeMemoryLifecycle, getMemoryLifecycle);
  useEffect(() => { ensureMemoryLifecycle(); void reconcileMemoryAccess(); }, []);
  if (state.status === 'signedOut') return <Redirect href="/(auth)/welcome" />;
  if (state.status === 'error') return <Screen title="Memories"><Status tone="error" message={state.error.message}
    actionLabel="Retry" onAction={() => { void gate.refresh(); }} /></Screen>;
  if (state.status !== 'authenticated' || gate.checking || access.status === 'checking') return <Screen title="Memories"><Status message="Checking your access…" /></Screen>;
  if (gate.pair && gate.pair.status !== 'active') return <Redirect href="/" />;
  if (gate.error || access.status !== 'ready' || !gate.account || gate.pair?.status !== 'active'
    || access.accountId !== gate.account.id || access.pairId !== gate.pair.pairId) {
    return <Screen title="Memories"><Status tone="error" message={access.error ?? 'We could not check your access.'}
      actionLabel="Retry" onAction={() => { void gate.refresh(); void reconcileMemoryAccess(); }} /></Screen>;
  }
  return children;
}
