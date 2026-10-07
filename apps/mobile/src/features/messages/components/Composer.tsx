import { forwardRef, useId } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { theme } from '../../../theme';

export const Composer = forwardRef<TextInput, {
  body: string; ready: boolean; online: boolean; full: boolean;
  onChange(body: string): void; onSend(): void;
}>(function Composer({ body, ready, online, full, onChange, onSend }, ref) {
  const labelId = useId();
  return <View style={styles.container}>
    <Text nativeID={labelId} style={theme.typography.secondary}>Message</Text>
    <TextInput ref={ref} accessibilityLabel="Message" accessibilityLabelledBy={labelId}
      placeholder="Write a message…" placeholderTextColor={theme.colors.muted}
      value={body} onChangeText={value => onChange(Array.from(value).slice(0, 4000).join(''))}
      multiline maxLength={8000} editable={ready}
      style={styles.input} textAlignVertical="top" selectionColor={theme.colors.focus} />
    <Button label="Send" onPress={onSend} disabled={!ready || !online || full || !body.trim()} />
  </View>;
});
const styles = StyleSheet.create({
  container: { gap: theme.space[2], padding: theme.space[4], flexShrink: 0, borderTopWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.canvas },
  input: { ...theme.typography.body, minHeight: 48, maxHeight: 128, padding: 12, borderWidth: 1,
    borderColor: theme.colors.control, borderRadius: theme.radius.control, backgroundColor: theme.colors.surface },
});
