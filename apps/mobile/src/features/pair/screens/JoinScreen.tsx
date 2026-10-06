import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { getPendingInvite, setPendingInvite, clearPendingInvite, parseInviteLink, inviteTokenSchema } from '../../../lib/links';
import { toAppError } from '../../../lib/result';
import { theme } from '../../../theme';
import { useCore } from '../context';
import { acceptInvite, previewInvite } from '../commands';
import type { InvitePreview } from '../types';

export function JoinScreen() {
  const { pair, refresh, online } = useCore();
  const [value, setValue] = useState('');
  const [preview, setPreview] = useState<InvitePreview>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const commandId = useRef(randomUUID());
  useEffect(() => { void getPendingInvite().then(token => { if (token) setValue(token); }).catch(cause => setError(toAppError(cause).message)); }, []);
  const inspect = async () => {
    setBusy(true); setError(undefined);
    try {
      const token = parseInviteLink(value) ?? inviteTokenSchema.parse(value);
      await setPendingInvite(token); setValue(token);
      const result = await previewInvite(token);
      if (!result.ok) { setError(result.error.code === 'RATE_LIMITED' ? 'Wait 15 minutes before trying another code.' : 'This invitation is unavailable. Check the code or request a new one.'); return; }
      setPreview(result.data);
    } catch (cause) { setError(toAppError(cause).message); }
    finally { setBusy(false); }
  };
  const join = async () => {
    setBusy(true); setError(undefined);
    const result = await acceptInvite(value, commandId.current);
    if (!result.ok) { setError(result.error.code === 'ALREADY_PAIRED' ? 'Leave your current pair before joining another.' : 'This invitation is unavailable. Check the code or request a new one.'); setBusy(false); return; }
    await refresh(); router.replace('/(pair)/welcome');
  };
  if (pair.status === 'pending') return <Screen title="You have an invitation">
    <Status message="Cancel your pending invitation before joining another pair." actionLabel="View invitation" onAction={() => router.replace('/(pair)/waiting')} />
  </Screen>;
  return <Screen title={preview ? `Join ${preview.inviterName}?` : 'Enter invitation'}>
    {preview ? <>
      <Text style={theme.typography.body}>Your partner will see shared events, tasks, messages, and memories. Private events stay private.</Text>
      <Text style={theme.typography.secondary}>Timezone: {preview.timezone}</Text>
      <Button label="Join pair" loading={busy} disabled={!online} onPress={() => { void join(); }} />
    </> : <>
      <Field label="Invitation code or link" autoCapitalize="characters" autoCorrect={false} value={value}
        onChangeText={text => {
          setValue(text); setPreview(undefined); commandId.current = randomUUID();
          const code = inviteTokenSchema.safeParse(parseInviteLink(text) ?? text);
          if (code.success) void setPendingInvite(code.data).catch(cause => setError(toAppError(cause).message));
        }} />
      <Button label="Review invitation" loading={busy} disabled={!online || !value} onPress={() => { void inspect(); }} />
    </>}
    {error && <Status message={error} tone="error" />}
    {!online && <Status tone="warning" message="You are offline. Connect to review and join this pair." />}
    <Button label="Cancel" variant="secondary" onPress={() => { void clearPendingInvite().then(() => router.replace('/(pair)/start')).catch(cause => setError(toAppError(cause).message)); }} />
  </Screen>;
}
