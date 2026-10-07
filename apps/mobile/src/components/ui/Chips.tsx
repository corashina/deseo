import { Pressable, ScrollView, Text, View } from 'react-native';
import { makeStyles, useTheme, type Owner } from '../../theme';

export type ChipOption<T extends string> = { value: T; label: string; owner?: Owner };

/** A single-choice row of chips for views, filters, and lists. An owner adds that partner's color dot. */
export function Chips<T extends string>({ options, value, onChange, label }: {
  options: readonly ChipOption<T>[]; value: T; onChange: (value: T) => void; label: string;
}) {
  const theme = useTheme();
  const styles = useStyles();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={label}
    contentContainerStyle={styles.row} style={styles.scroll}>
    {options.map(option => {
      const selected = option.value === value;
      return <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected }}
        hitSlop={{ top: 4, bottom: 4 }} onPress={() => onChange(option.value)}
        style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && !selected && styles.pressed]}>
        {option.owner && <View style={[styles.dot, { backgroundColor: theme.ownerTones[option.owner].accent }]} />}
        <Text style={[theme.typography.button, { color: selected ? theme.colors.onAction : theme.colors.ink }]}>{option.label}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

const useStyles = makeStyles(theme => ({
  scroll: { flexGrow: 0, marginHorizontal: -theme.space[4] },
  row: { gap: theme.space[2], paddingHorizontal: theme.space[4] },
  chip: { minHeight: 40, paddingHorizontal: theme.space[4], borderRadius: theme.radius.control, flexDirection: 'row', alignItems: 'center',
    gap: theme.space[2], backgroundColor: theme.colors.sidebar, borderWidth: 1, borderColor: theme.colors.sidebar },
  selected: { backgroundColor: theme.colors.action, borderColor: theme.colors.actionBorder },
  pressed: { backgroundColor: theme.colors.sharedSoft },
  dot: { width: 10, height: 10, borderRadius: 5 },
}));
