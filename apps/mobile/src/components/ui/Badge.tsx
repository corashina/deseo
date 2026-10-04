import { Text, View } from 'react-native';
import { theme } from '../../theme';

export function Badge({ label, owner = 'together' }: { label: string; owner?: 'a' | 'b' | 'together' }) {
  const color = owner === 'a' ? theme.colors.rose : owner === 'b' ? theme.colors.teal : theme.colors.shared;
  const backgroundColor = owner === 'a' ? theme.colors.roseSoft : owner === 'b' ? theme.colors.tealSoft : theme.colors.sharedSoft;
  return <View style={{ backgroundColor, borderRadius: theme.radius.badge, padding: 8, alignSelf: 'flex-start' }}>
    <Text style={{ fontSize: 13, lineHeight: 20, color, fontWeight: '600' }}>{label}</Text>
  </View>;
}
