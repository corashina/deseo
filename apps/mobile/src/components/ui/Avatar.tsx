import { Pressable, Text, View } from 'react-native';
import { makeStyles, useTheme } from '../../theme';

export function Avatar({ name, slot = 'a', size = 48 }: { name: string; slot?: 'a' | 'b'; size?: number }) {
  const theme = useTheme();
  const styles = useStyles();
  const tone = theme.ownerTones[slot];
  return <View accessibilityLabel={name} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.soft }]}>
    <Text style={[size < 40 ? theme.typography.headline : theme.typography.section, { color: tone.color }]}>
      {name.trim().slice(0, 1).toLocaleUpperCase()}
    </Text>
  </View>;
}

/** Both partners' avatars as one control. DESIGN.md opens pair settings from here. */
export function PairAvatars({ members, onPress }: { members: { displayName: string; slot: 'a' | 'b' }[]; onPress: () => void }) {
  const styles = useStyles();
  const sorted = [...members].sort((left, right) => left.slot.localeCompare(right.slot));
  return <Pressable accessibilityRole="button" accessibilityLabel={`Your pair: ${sorted.map(member => member.displayName).join(' and ')}`}
    onPress={onPress} style={({ pressed }) => [styles.pair, pressed && styles.pressed]}>
    {sorted.map((member, index) => <View key={member.slot} style={[styles.ring, index > 0 && styles.overlap]}>
      <Avatar name={member.displayName} slot={member.slot} size={36} />
    </View>)}
  </Pressable>;
}

const useStyles = makeStyles(theme => ({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', alignItems: 'center', minHeight: theme.touchTarget, paddingHorizontal: theme.space[1], borderRadius: theme.touchTarget / 2 },
  pressed: { backgroundColor: theme.colors.sidebar },
  ring: { borderRadius: 20, borderWidth: 2, borderColor: theme.colors.canvas },
  overlap: { marginLeft: -10 },
}));
