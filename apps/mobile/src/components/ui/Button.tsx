import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../../theme';

export type IconName = keyof typeof Ionicons.glyphMap;

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  trailingIcon?: IconName;
  /** Size the button to its label instead of the full row. */
  compact?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, icon, trailingIcon, compact = false }: ButtonProps) {
  const inactive = loading || disabled;
  const color = variant === 'danger' ? theme.colors.danger : variant === 'text' ? theme.colors.link : theme.colors.onAction;
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress}
    style={({ pressed }) => [styles.base, styles[variant], (compact || variant === 'text') && styles.compact,
      variant === 'text' && styles.textBase, pressed && pressedStyles[variant], inactive && styles.inactive]}>
    {loading ? <ActivityIndicator color={color} /> : icon && <Ionicons name={icon} size={18} color={color} />}
    <Text style={[theme.typography.button, styles.label, { color }]}>{label}</Text>
    {trailingIcon && <Ionicons name={trailingIcon} size={16} color={color} />}
  </Pressable>;
}

const styles = StyleSheet.create({
  base: { minHeight: theme.touchTarget, paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], borderRadius: theme.radius.control,
    flexDirection: 'row', gap: theme.space[2], justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  compact: { alignSelf: 'flex-start' },
  textBase: { paddingHorizontal: theme.space[1] },
  primary: { backgroundColor: theme.colors.action, borderColor: theme.colors.actionBorder },
  secondary: { backgroundColor: theme.colors.surface, borderColor: theme.colors.control },
  text: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.danger },
  label: { flexShrink: 1, textAlign: 'center' },
  inactive: { opacity: 0.5 },
});

const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: theme.colors.actionHover },
  secondary: { backgroundColor: theme.colors.sidebar },
  text: { opacity: 0.6 },
  danger: { opacity: 0.8 },
});
