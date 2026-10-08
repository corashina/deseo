import { useId } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { makeStyles, useTheme } from '../../theme';

export type FieldProps = TextInputProps & { label: string; error?: string; hint?: string };

export function Field({ label, error, hint, style, ...props }: FieldProps) {
  const theme = useTheme();
  const styles = useStyles();
  const id = useId();
  return <View style={styles.container}>
    <Text nativeID={id} style={styles.label}>{label}</Text>
    <TextInput {...props} accessibilityLabel={label} accessibilityLabelledBy={id} accessibilityHint={error ?? hint}
      placeholderTextColor={theme.colors.muted} selectionColor={theme.colors.focus}
      style={[styles.input, props.multiline && styles.multiline, !!error && styles.invalid, style]} />
    {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
      : hint ? <Text style={theme.typography.secondary}>{hint}</Text> : null}
  </View>;
}

const useStyles = makeStyles(theme => ({
  container: { gap: theme.space[2] }, label: { ...theme.typography.button, color: theme.colors.ink },
  input: { ...theme.typography.body, minHeight: theme.touchTarget, paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.control, borderRadius: theme.radius.control },
  multiline: { minHeight: 112, textAlignVertical: 'top' }, invalid: { borderColor: theme.colors.danger },
  error: { ...theme.typography.secondary, color: theme.colors.danger },
}));
