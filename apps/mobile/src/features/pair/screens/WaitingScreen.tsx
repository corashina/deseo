import { useEffect, useRef, useState } from 'react';
import { Alert, Share, Text } from 'react-native';
import { randomUUID } from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { getPrivateStorage } from '../../../lib/private-storage';
import { toAppError } from '@deseo/domain/result';
import { useTheme } from '../../../theme';
import { useCore } from '../context';
import { cancelPendingPair, createInvite } from '../commands';

export function WaitingScreen() {
  const theme = useTheme();
  const { account, pair, refresh, online } = useCore();
  const commandId = useRef(randomUUID());
  const cancelId = useRef(randomUUID());
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const pairId = 'pairId' in pair ? pair.pairId : '';
  useEffect(() => {
    let active = true;
    void getPrivateStorage().then(storage => storage.getDraft(account.id, pairId, 'invitation')).then(value => {
      if (!active || !value) return;
      const saved = JSON.parse(value) as { token: string; expiresAt: string };
      if (Date.parse(saved.expiresAt) > Date.now()) { setToken(saved.token); setExpiresAt(saved.expiresAt); }
    }).catch(cause => setError(toAppError(cause).message));
    return () => { active = false; };
  }, [account.id, pairId]);
  const generate = async () => {
    setBusy(true); setError(undefined);
    try {
      const result = await createInvite(pairId, commandId.current);
      if (!result.ok) { setError('We could not create an invitation. Try again.'); return; }
      commandId.current = randomUUID();
      if (!result.data.token) { setError('The last code could not be recovered. Create a new code.'); return; }
      await (await getPrivateStorage()).setDraft(account.id, pairId, 'invitation', JSON.stringify(result.data));
      setToken(result.data.token); setExpiresAt(result.data.expiresAt);
    } catch (cause) { setError(toAppError(cause).message); }
    finally { setBusy(false); }
  };
  const cancel = () => Alert.alert('Cancel invitation?', 'This closes the pending pair. You can then enter another invitation.', [
    { text: 'Keep invitation', style: 'cancel' },
    { text: 'Cancel invitation', style: 'destructive', onPress: () => { void (async () => {
      setBusy(true);
      const result = await cancelPendingPair(pairId, cancelId.current);
      if (!result.ok) { setError('We could not cancel the invitation. Try again.'); setBusy(false); return; }
      await refresh(); router.replace('/');
    })(); } },
  ]);
  if (pair.status !== 'pending') return null;
  const link = token ? `deseo-dev://invite?token=${token}` : '';
  return <Screen title="Invite your partner" subtitle="Your invitation works once and expires after 24 hours." onRefresh={() => { void refresh(); }}>
    {error && <Status message={error} tone="error" />}
    {token && <>
      <Text selectable style={theme.typography.title}>{token.match(/.{1,4}/g)?.join(' ')}</Text>
      <Text style={theme.typography.secondary}>Expires {new Date(expiresAt ?? pair.invite?.expiresAt ?? '').toLocaleString()}.</Text>
      <Button label="Share invitation" onPress={() => { void Share.share({ message: `Join me in Deseo. Code: ${token}. ${link}` }); }} />
      <Button label="Copy code" variant="secondary" onPress={() => { void Clipboard.setStringAsync(token).catch(() => setError('We could not copy the code.')); }} />
    </>}
    <Button label={token ? 'Create a new code' : 'Create invitation'} variant={token ? 'secondary' : 'primary'} loading={busy} disabled={!online} onPress={() => { void generate(); }} />
    <Button label="Check for your partner" variant="secondary" disabled={!online || busy} onPress={() => { void refresh(); }} />
    <Button label="Cancel invitation" variant="danger" disabled={!online || busy} onPress={cancel} />
  </Screen>;
}
