import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../../theme';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false }: ButtonProps) {
  const inactive = loading || disabled;
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress}
    style={({ pressed }) => [styles.base, styles[variant], (inactive || pressed) && styles.dim]}>
    {loading && <ActivityIndicator color={theme.colors.ink} />}
    <Text style={[styles.label, variant === 'danger' && styles.dangerLabel, variant === 'text' && styles.link]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  base: { minHeight: theme.touchTarget, paddingHorizontal: 16, paddingVertical: 12, borderRadius: theme.radius.control,
    flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  primary: { backgroundColor: theme.colors.action, borderColor: theme.colors.actionBorder },
  secondary: { backgroundColor: theme.colors.surface, borderColor: theme.colors.control },
  text: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.danger },
  label: { flexShrink: 1, color: theme.colors.onAction, fontSize: 16, lineHeight: 23, fontWeight: '600', textAlign: 'center' },
  dangerLabel: { color: theme.colors.danger }, link: { color: theme.colors.link }, dim: { opacity: 0.6 },
});
