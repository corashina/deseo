import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { makeStyles, useTheme } from '../../theme';
import { Button } from './Button';

type Props = PropsWithChildren<{
  title: string;
  /** A text link beside the title, such as "View calendar". */
  link?: { label: string; onPress: () => void };
  card?: boolean;
}>;

export function Section({ title, link, card = false, children }: Props) {
  const theme = useTheme();
  const styles = useStyles();
  return <View style={card ? theme.ui.card : styles.plain}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={[theme.typography.section, styles.title]}>{title}</Text>
      {link && <Button label={link.label} variant="text" trailingIcon="chevron-forward" onPress={link.onPress} />}
    </View>
    {children}
  </View>;
}

const useStyles = makeStyles(theme => ({
  plain: { gap: theme.space[3], paddingTop: theme.space[2] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: theme.space[3], minHeight: theme.touchTarget, marginVertical: -theme.space[2] },
  title: { flexShrink: 1 },
}));
