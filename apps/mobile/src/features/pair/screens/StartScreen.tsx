import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { signOut } from '../../auth';
import { useCore } from '../context';
import { createPair } from '../commands';

export function StartScreen() {
  const { account, refresh, online } = useCore();
  const commandId = useRef(randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const create = async () => {
    setBusy(true); setError(undefined);
    const result = await createPair(account.timezone, commandId.current);
    if (!result.ok) { setError('We could not create your pair. Try again.'); setBusy(false); return; }
    await refresh(); router.replace('/');
  };
  return <Screen title="Plan together" subtitle="Invite your partner, or enter the code they sent you.">
    {error && <Status message={error} tone="error" />}
    {!online && <Status tone="warning" message="You are offline. Reconnect to create or join a pair." />}
    <Button label="Invite your partner" loading={busy} disabled={!online} onPress={() => { void create(); }} />
    <Button label="Enter invitation" variant="secondary" onPress={() => router.push('/(pair)/join')} />
    <Button label="Sign out" variant="text" onPress={() => { void signOut('local').catch(() => setError('We could not sign out. Try again.')); }} />
  </Screen>;
}
