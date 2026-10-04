import { Text, View } from 'react-native';
import { theme, ui } from '../../theme';
import { Button } from './Button';

export function Status({ message, actionLabel, onAction, tone = 'info' }: {
  message: string; actionLabel?: string; onAction?: () => void; tone?: 'error' | 'info';
}) {
  return <View style={ui.card}>
    <Text accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite"
      style={[theme.typography.body, tone === 'error' && { color: theme.colors.danger }]}>{message}</Text>
    {actionLabel && onAction && <Button label={actionLabel} onPress={onAction} variant="secondary" />}
  </View>;
}
