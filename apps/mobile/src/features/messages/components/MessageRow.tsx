import { memo, useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { DateTime } from 'luxon';
import { Button } from '../../../components/ui/Button';
import { theme, ui } from '../../../theme';
import type { PairMember } from '../../pair';
import type { Message } from '@deseo/domain/messages';
import type { PendingMessage } from '../types';

function MessageText({ body }: { body: string }) {
  const parts = useMemo(() => body.split(/(https?:\/\/[^\s<>]+)/g), [body]);
  const [linkError, setLinkError] = useState(false);
  return <><Text selectable style={theme.typography.body}>{parts.map((part, index) => /^https?:\/\//.test(part)
    ? <Text key={index} accessibilityRole="link" style={styles.link} onPress={() => {
      void Linking.openURL(part).catch(() => setLinkError(true));
    }}>{part}</Text> : part)}</Text>
    {linkError && <Text accessibilityRole="alert" style={styles.error}>We could not open this link.</Text>}
  </>;
}

export const MessageRow = memo(function MessageRow({ message, member, own, timezone, locale, disabled, onPin, onDelete }: {
  message: Message; member: PairMember; own: boolean; timezone: string; locale: string; disabled: boolean;
  onPin(message: Message): void; onDelete(message: Message): void;
}) {
  const timestamp = useMemo(() => DateTime.fromISO(message.createdAt).setZone(timezone).setLocale(locale)
    .toLocaleString(DateTime.DATETIME_MED), [message.createdAt, timezone, locale]);
  return <View style={[styles.row, own && styles.own]}>
    <View style={[styles.bubble, member.slot === 'a' ? styles.a : styles.b]}>
      <Text style={[theme.typography.secondary, member.slot === 'a' ? styles.nameA : styles.nameB]}>{member.displayName}</Text>
      <MessageText body={message.body} />
      <Text style={theme.typography.secondary}>{timestamp}{own ? ' · Sent' : ''}{message.pinnedAt ? ' · Note' : ''}</Text>
      {own && <Button label="Message actions" variant="text" disabled={disabled} onPress={() => {
        Alert.alert('Message actions', undefined, [
          { text: message.pinnedAt ? 'Unpin' : 'Pin as note', onPress: () => onPin(message) },
          { text: 'Delete message', style: 'destructive', onPress: () => onDelete(message) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }} />}
    </View>
  </View>;
});

export function PendingMessageRow({ message, member, online, onRetry, onDiscard }: {
  message: PendingMessage; member: PairMember; online: boolean;
  onRetry(id: string): void; onDiscard(id: string): void;
}) {
  return <View style={[styles.row, styles.own]}><View style={[styles.bubble, member.slot === 'a' ? styles.a : styles.b]}>
    <Text style={theme.typography.secondary}>{member.displayName}</Text>
    <Text selectable style={theme.typography.body}>{message.body}</Text>
    <Text accessibilityLiveRegion="polite" style={message.state === 'failed' ? styles.error : theme.typography.secondary}>
      {message.state === 'sending' ? 'Sending' : 'Failed. Send not confirmed.'}
    </Text>
    {message.state === 'failed' && <View style={ui.row}>
      <Button label="Retry" variant="secondary" disabled={!online} onPress={() => onRetry(message.clientId)} />
      <Button label="Discard" variant="text" onPress={() => onDiscard(message.clientId)} />
    </View>}
  </View></View>;
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-start', paddingHorizontal: theme.space[4], paddingVertical: theme.space[1] }, own: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], gap: theme.space[1], borderRadius: theme.radius.card },
  a: { backgroundColor: theme.colors.roseSoft }, b: { backgroundColor: theme.colors.tealSoft },
  nameA: { color: theme.colors.rose }, nameB: { color: theme.colors.teal },
  link: { color: theme.colors.link, textDecorationLine: 'underline' },
  error: { ...theme.typography.secondary, color: theme.colors.danger },
});
