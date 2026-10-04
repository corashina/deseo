import { Text, View } from 'react-native';
import { theme } from '../../theme';

export function Avatar({ name, slot = 'a' }: { name: string; slot?: 'a' | 'b' }) {
  return <View accessibilityLabel={name} style={{ minWidth: 48, minHeight: 48, padding: 10, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center', backgroundColor: slot === 'a' ? theme.colors.roseSoft : theme.colors.tealSoft }}>
    <Text style={{ ...theme.typography.section, color: slot === 'a' ? theme.colors.rose : theme.colors.teal }}>
      {name.trim().slice(0, 1).toLocaleUpperCase()}
    </Text>
  </View>;
}
