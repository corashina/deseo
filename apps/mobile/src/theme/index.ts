import { StyleSheet } from 'react-native';
import tokens from '../../../../brand/tokens.json';

export const theme = {
  ...tokens,
  typography: StyleSheet.create({
    title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4, color: tokens.colors.ink },
    section: { fontSize: 19, lineHeight: 25, fontWeight: '600', color: tokens.colors.ink },
    headline: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: tokens.colors.ink },
    body: { fontSize: 16, lineHeight: 24, color: tokens.colors.ink },
    button: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
    secondary: { fontSize: 13, lineHeight: 20, color: tokens.colors.muted },
    badge: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
    figure: { fontSize: 34, lineHeight: 40, fontWeight: '700', color: tokens.colors.ink, fontVariant: ['tabular-nums'] },
  }),
};

export const ui = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.line, borderWidth: 1,
    borderRadius: theme.radius.card, padding: theme.space[5], gap: theme.space[3] },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.space[2] },
  stack: { gap: theme.space[3] },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.line },
});

export type Owner = 'a' | 'b' | 'together';

// Partner colors follow stable slots, never the viewer.
export const ownerTones = {
  a: { color: tokens.colors.rose, soft: tokens.colors.roseSoft, accent: tokens.colors.roseAccent },
  b: { color: tokens.colors.teal, soft: tokens.colors.tealSoft, accent: tokens.colors.tealAccent },
  together: { color: tokens.colors.shared, soft: tokens.colors.sharedSoft, accent: tokens.colors.sharedAccent },
} as const satisfies Record<Owner, { color: string; soft: string; accent: string }>;
