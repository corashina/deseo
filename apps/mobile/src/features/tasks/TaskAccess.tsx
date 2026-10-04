import type { PropsWithChildren } from 'react';
import { Redirect } from 'expo-router';
import { usePairGate } from '../pair';
import { Screen } from '../../components/ui/Screen';
import { Status } from '../../components/ui/Status';
// New routes cannot depend on the core stack's list of protected routes.
export function TaskAccess({ children }: PropsWithChildren) {
  const gate = usePairGate();
  if (gate.checking) return <Screen title="Tasks"><Status message="Checking your pair…" /></Screen>;
  if (gate.error) return <Screen title="Tasks"><Status tone="error" message="We could not check your pair." actionLabel="Retry" onAction={() => { void gate.refresh(); }} /></Screen>;
  if (!gate.account || !gate.pair || gate.pair.status !== 'active') return <Redirect href="/" />;
  return <>{children}</>;
}
