import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ownerTones, theme } from '../../theme';

export function Avatar({ name, slot = 'a', size = 48 }: { name: string; slot?: 'a' | 'b'; size?: number }) {
  const tone = ownerTones[slot];
  return <View accessibilityLabel={name} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.soft }]}>
    <Text style={[size < 40 ? theme.typography.headline : theme.typography.section, { color: tone.color }]}>
      {name.trim().slice(0, 1).toLocaleUpperCase()}
    </Text>
  </View>;
}

/** Both partners' avatars as one control. STYLE.md opens pair settings from here. */
export function PairAvatars({ members, onPress }: { members: { displayName: string; slot: 'a' | 'b' }[]; onPress: () => void }) {
  const sorted = [...members].sort((left, right) => left.slot.localeCompare(right.slot));
  return <Pressable accessibilityRole="button" accessibilityLabel={`Your pair: ${sorted.map(member => member.displayName).join(' and ')}`}
    onPress={onPress} style={({ pressed }) => [styles.pair, pressed && styles.pressed]}>
    {sorted.map((member, index) => <View key={member.slot} style={[styles.ring, index > 0 && styles.overlap]}>
      <Avatar name={member.displayName} slot={member.slot} size={36} />
    </View>)}
  </Pressable>;
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', alignItems: 'center', minHeight: theme.touchTarget, paddingHorizontal: theme.space[1], borderRadius: theme.touchTarget / 2 },
  pressed: { backgroundColor: theme.colors.sidebar },
  ring: { borderRadius: 20, borderWidth: 2, borderColor: theme.colors.canvas },
  overlap: { marginLeft: -10 },
});
