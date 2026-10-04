import { StyleSheet } from 'react-native';
import tokens from '../../../../brand/tokens.json';

export const theme = {
  ...tokens,
  typography: StyleSheet.create({
    title: { fontSize: 28, lineHeight: 34, fontWeight: '700', color: tokens.colors.ink },
    section: { fontSize: 19, lineHeight: 25, fontWeight: '600', color: tokens.colors.ink },
    body: { fontSize: 16, lineHeight: 24, color: tokens.colors.ink },
    secondary: { fontSize: 13, lineHeight: 20, color: tokens.colors.muted },
  }),
};

export const ui = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, borderWidth: 1,
    borderRadius: theme.radius.card, padding: theme.space[5], gap: theme.space[4] },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.space[2] },
  stack: { gap: theme.space[5] },
});
