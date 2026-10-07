import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { makeStyles, useTheme } from '../../theme';
import type { IconName } from './Button';

export function IconButton({ icon, label, onPress, dot = false, disabled = false }: {
  icon: IconName; label: string; onPress: () => void; dot?: boolean; disabled?: boolean;
}) {
  const theme = useTheme();
  const styles = useStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.target, pressed && styles.pressed, disabled && styles.inactive]}>
    <Ionicons name={icon} size={24} color={theme.colors.ink} />
    {dot && <View style={styles.dot} />}
  </Pressable>;
}

const useStyles = makeStyles(theme => ({
  target: { width: theme.touchTarget, height: theme.touchTarget, borderRadius: theme.touchTarget / 2, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: theme.colors.sidebar },
  inactive: { opacity: 0.5 },
  dot: { position: 'absolute', top: 11, right: 11, width: 10, height: 10, borderRadius: 5,
    backgroundColor: theme.colors.rose, borderWidth: 2, borderColor: theme.colors.canvas },
}));
