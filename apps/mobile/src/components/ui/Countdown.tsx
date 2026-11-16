import { Text, View } from 'react-native';
import { makeStyles, useTheme } from '../../theme';

/** DESIGN.md date countdown: number, unit, event name, absolute date. */
export function Countdown({ days, title, date }: { days: number; title: string; date: string }) {
  const theme = useTheme();
  const styles = useStyles();
  const [figure, unit] = days === 0 ? ['Today', ''] : days === 1 ? ['1', 'day'] : [String(days), 'days'];
  return <View style={styles.row} accessible accessibilityLabel={`${title}, ${date}, ${days === 0 ? 'today' : `in ${figure} ${unit}`}`}>
    <View style={styles.figure}>
      <Text style={theme.typography.figure}>{figure}</Text>
      {!!unit && <Text style={theme.typography.secondary}>{unit}</Text>}
    </View>
    <View style={styles.text}>
      <Text style={theme.typography.headline}>{title}</Text>
      <Text style={theme.typography.secondary}>{date}</Text>
    </View>
  </View>;
}

const useStyles = makeStyles(theme => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space[4] },
  figure: { minWidth: 72, alignItems: 'center', paddingVertical: theme.space[2], paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.control, backgroundColor: theme.colors.note },
  text: { flex: 1, gap: theme.space[1] },
}));
