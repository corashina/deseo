import { StyleSheet, Text, View } from 'react-native';
import { ownerTones, theme, type Owner } from '../../theme';

export function Badge({ label, owner = 'together' }: { label: string; owner?: Owner }) {
  const tone = ownerTones[owner];
  return <View style={[styles.badge, { backgroundColor: tone.soft }]}>
    <Text style={[theme.typography.badge, { color: tone.color }]}>{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  badge: { borderRadius: theme.radius.badge, paddingHorizontal: theme.space[2], paddingVertical: theme.space[1], alignSelf: 'flex-start' },
});
