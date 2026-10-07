import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { makeStyles, useTheme } from '../../theme';
import { Button } from './Button';

type Tone = 'info' | 'loading' | 'warning' | 'error';

/** Loading and plain info stay quiet; warnings and errors get a tinted card with an icon. */
export function Status({ message, actionLabel, onAction, tone = 'info' }: {
  message: string; actionLabel?: string; onAction?: () => void; tone?: Tone;
}) {
  const theme = useTheme();
  const styles = useStyles();
  const action = actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" compact /> : null;
  if (tone === 'loading') return <View style={styles.inline} accessibilityLiveRegion="polite">
    <ActivityIndicator color={theme.colors.muted} /><Text style={theme.typography.secondary}>{message}</Text>
  </View>;
  if (tone === 'info' && !action) return <Text accessibilityLiveRegion="polite" style={[theme.typography.body, styles.quiet]}>{message}</Text>;
  const tint = tone === 'error' ? styles.error : tone === 'warning' ? styles.warning : null;
  const color = tone === 'error' ? theme.colors.danger : tone === 'warning' ? theme.colors.warning : theme.colors.ink;
  return <View style={[theme.ui.card, tint]}>
    <View style={styles.message}>
      {tone !== 'info' && <Ionicons name={tone === 'error' ? 'alert-circle-outline' : 'cloud-offline-outline'} size={20} color={color} style={styles.icon} />}
      <Text accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite"
        style={[theme.typography.body, styles.text, { color }]}>{message}</Text>
    </View>
    {action}
  </View>;
}

const useStyles = makeStyles(theme => ({
  inline: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2], minHeight: theme.touchTarget },
  quiet: { color: theme.colors.muted },
  error: { backgroundColor: theme.colors.dangerSoft, borderColor: theme.colors.dangerSoft },
  warning: { backgroundColor: theme.colors.warningSoft, borderColor: theme.colors.warningSoft },
  message: { flexDirection: 'row', gap: theme.space[2], alignItems: 'flex-start' },
  icon: { marginTop: 2 },
  text: { flex: 1 },
}));
