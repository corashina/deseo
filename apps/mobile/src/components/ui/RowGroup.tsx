import { Children, Fragment, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, ui } from '../../theme';

/** One card for a list of rows, split by hairlines, so each row does not need its own card. */
export function RowGroup({ children }: PropsWithChildren) {
  const rows = Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;
  return <View style={styles.group}>
    {rows.map((row, index) => <Fragment key={index}>{index > 0 && <View style={ui.separator} />}{row}</Fragment>)}
  </View>;
}

const styles = StyleSheet.create({
  group: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, borderWidth: 1, borderRadius: theme.radius.card,
    paddingHorizontal: theme.space[4], overflow: 'hidden' },
});
