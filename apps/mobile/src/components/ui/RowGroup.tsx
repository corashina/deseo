import { Children, Fragment, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { makeStyles, useTheme } from '../../theme';

/** One card for a list of rows, split by hairlines, so each row does not need its own card. */
export function RowGroup({ children }: PropsWithChildren) {
  const theme = useTheme();
  const styles = useStyles();
  const rows = Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;
  return <View style={styles.group}>
    {rows.map((row, index) => <Fragment key={index}>{index > 0 && <View style={theme.ui.separator} />}{row}</Fragment>)}
  </View>;
}

const useStyles = makeStyles(theme => ({
  group: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, borderWidth: 1, borderRadius: theme.radius.card,
    paddingHorizontal: theme.space[5], overflow: 'hidden' },
}));
