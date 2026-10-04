import type { PropsWithChildren } from 'react';
import { usePairGate } from '../pair';
import { Screen } from '../../components/ui/Screen';
import { Status } from '../../components/ui/Status';

export function CalendarAccess({ children }: PropsWithChildren) {
  const gate = usePairGate();
  if (gate.checking) return <Screen title="Calendar"><Status message="Checking your pair…" /></Screen>;
  if (gate.error) return <Screen title="Calendar"><Status message="We could not check your pair." tone="error" actionLabel="Retry" onAction={() => { void gate.refresh(); }} /></Screen>;
  if (!gate.account || gate.pair?.status !== 'active') return <Screen title="Calendar"><Status message="Connect with your partner to open Calendar." /></Screen>;
  return children;
}
