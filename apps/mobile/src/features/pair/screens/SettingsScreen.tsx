import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Status } from '../../../components/ui/Status';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import { Section } from '../../../components/ui/Section';
import { theme, ui } from '../../../theme';
import { requestSensitiveActionCode, verifySensitiveAction, signOut } from '../../auth';
import { toAppError } from '@deseo/domain/result';
import { useCore } from '../context';
import { endPair } from '../commands';

export function PairSettingsScreen() {
  const { pair, refresh, online } = useCore();
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const commandId = useRef(randomUUID());
  const proof = useRef<string | null>(null);
  const disconnect = async () => {
    if (pair.status !== 'active') return;
    setBusy(true); setError(undefined);
    try {
      if (!proof.current) {
        const verified = await verifySensitiveAction('end_pair', code);
        if (!verified.ok) { setError(verified.error.message ?? 'The code is invalid or expired. Request a new code.'); return; }
        proof.current = verified.data.proof;
      }
      const result = await endPair(pair.pairId, proof.current, commandId.current);
      if (!result.ok) { setError('We could not end this pair. Try again.'); return; }
      await refresh(); router.replace('/');
    } catch (cause) { setError(toAppError(cause).message); }
    finally { setBusy(false); }
  };
  const confirm = () => Alert.alert('End this pair?', 'Both people lose shared access. A new pair starts empty. This cannot be undone.', [
    { text: 'Keep pair', style: 'cancel' }, { text: 'End pair', style: 'destructive', onPress: () => { void disconnect(); } },
  ]);
  const send = async () => {
    setBusy(true); setError(undefined);
    const result = await requestSensitiveActionCode('end_pair');
    if (result.ok) { setSent(true); proof.current = null; }
    else setError(result.error.message ?? 'We could not send a code. Try again.');
    setBusy(false);
  };
  return <Screen>
    {pair.status === 'active' && <View style={styles.members}>
      {pair.members.map(member => <View key={member.userId} style={styles.member}>
        <Avatar name={member.displayName} slot={member.slot} size={56} />
        <Badge owner={member.slot} label={member.displayName} />
      </View>)}
    </View>}
    <View style={ui.card}>
      <Button label="Notification preferences" variant="text" icon="notifications-outline" trailingIcon="chevron-forward"
        onPress={() => router.push('/settings/notifications')} />
    </View>
    {error && <Status message={error} tone="error" />}
    {pair.status === 'active' && <Section card title="End this pair">
      <Text style={theme.typography.body}>Either person can end this pair. Shared access stops for both people. Your next pair starts empty.</Text>
      <Button label={sent ? 'Send a new code' : 'Send code to end pair'} variant="secondary" loading={busy} disabled={!online} onPress={() => { void send(); }} />
      {sent && <>
        <Field label="Email verification code" value={code} onChangeText={setCode} maxLength={6} keyboardType="number-pad" autoComplete="one-time-code" />
        <Button label="End pair" variant="danger" disabled={busy || !online || code.length !== 6} onPress={confirm} />
      </>}
    </Section>}
    <View style={ui.stack}>
      <Button label="Sign out on this device" variant="secondary" icon="log-out-outline" onPress={() => { void signOut('local').catch(cause => setError(toAppError(cause).message)); }} />
      <Button label="Sign out on all devices" variant="text" onPress={() => { void signOut('global').catch(cause => setError(toAppError(cause).message)); }} />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  members: { flexDirection: 'row', justifyContent: 'center', gap: theme.space[8], paddingVertical: theme.space[4] },
  member: { alignItems: 'center', gap: theme.space[2] },
});
