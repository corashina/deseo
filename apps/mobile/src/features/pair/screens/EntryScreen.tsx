import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../../auth';
import { usePairGate } from '../context';
import { getPendingInvite } from '../../../lib/links';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { Button } from '../../../components/ui/Button';
import { PrivateStorageError } from '../../../lib/private-storage';
import { Alert } from 'react-native';

export function EntryScreen() {
  const { state, refresh, retryStorage } = useAuth();
  const { pair, checking, error: pairError } = usePairGate();
  const [hasInvite, setHasInvite] = useState<boolean>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let current = true;
    setFailed(false); setHasInvite(undefined);
    void getPendingInvite().then(value => { if (current) setHasInvite(!!value); }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [state.status]);
  if (state.status === 'loading' || checking) return <Screen title="Deseo"><Status message="Checking your account…" /></Screen>;
  const error = state.status === 'error' ? state.error : pairError;
  if (error) return <Screen title="Connection needed">
    <Status message={error.message} tone="error" actionLabel="Try again" onAction={() => { void refresh(); }} />
    {error instanceof PrivateStorageError && <Button label="Reset local storage" variant="danger" onPress={() => Alert.alert('Reset local storage?',
      'This removes this device’s session and unsaved drafts. You must sign in again.', [{ text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => { void retryStorage(); } }])} />}
  </Screen>;
  if (state.status === 'signedOut') return <Redirect href="/(auth)/welcome" />;
  if (state.status === 'authenticated' && !state.account) return <Redirect href="/(auth)/profile" />;
  if (failed) return <Screen title="Private storage unavailable"><Status message="Restart the app to try again. Your invitation could not be read." tone="error" /></Screen>;
  if (pair?.status === 'active') return <Redirect href="/(tabs)/today" />;
  if (pair?.status === 'pending') return <Redirect href="/(pair)/waiting" />;
  if (hasInvite === undefined) return <Screen><Status message="Checking your invitation…" /></Screen>;
  if (hasInvite) return <Redirect href="/(pair)/join" />;
  if (pair?.status === 'ended') return <Redirect href="/(pair)/ended" />;
  return <Redirect href="/(pair)/start" />;
}
