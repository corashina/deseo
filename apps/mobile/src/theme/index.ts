import { StyleSheet, useColorScheme } from 'react-native';
import tokens from '../../../../brand/tokens.json';

export type Owner = 'a' | 'b' | 'together';
type Colors = typeof tokens.colors;

function createTheme(colors: Colors, dark: boolean) {
  return {
    dark,
    colors,
    space: tokens.space,
    radius: tokens.radius,
    touchTarget: tokens.touchTarget,
    typography: StyleSheet.create({
      title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4, color: colors.ink },
      section: { fontSize: 19, lineHeight: 25, fontWeight: '600', color: colors.ink },
      headline: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
      body: { fontSize: 16, lineHeight: 24, color: colors.ink },
      button: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
      navigation: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
      secondary: { fontSize: 13, lineHeight: 20, color: colors.muted },
      badge: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
      figure: { fontSize: 34, lineHeight: 40, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
    }),
    ui: StyleSheet.create({
      card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1,
        borderRadius: tokens.radius.card, padding: tokens.space[5], gap: tokens.space[3] },
      row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: tokens.space[2] },
      stack: { gap: tokens.space[3] },
      separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
    }),
    // Partner colors follow stable slots, never the viewer.
    ownerTones: {
      a: { color: colors.rose, soft: colors.roseSoft, accent: colors.roseAccent },
      b: { color: colors.teal, soft: colors.tealSoft, accent: colors.tealAccent },
      together: { color: colors.shared, soft: colors.sharedSoft, accent: colors.sharedAccent },
    } satisfies Record<Owner, { color: string; soft: string; accent: string }>,
  };
}

export type Theme = ReturnType<typeof createTheme>;

const light = createTheme(tokens.colors, false);
const dark = createTheme(tokens.darkColors, true);

/** Returns the theme for the device appearance. Components render again when the person changes it. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Returns a hook for theme styles. The hook creates one StyleSheet per theme and reuses it. */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: Theme) => T): () => T {
  const cache = new Map<Theme, T>();
  return function useStyles() {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(factory(theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}
