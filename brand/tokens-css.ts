import tokens from './tokens.json';

// CSS variables from the tokens. The web portal and the public site use this text.
// The device appearance picks the palette, and no script runs when it changes.
const cssName = (name: string) => '--' + name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
const declarations = (values: Record<string, string>) => Object.entries(values).map(([name, value]) => cssName(name) + ':' + value).join(';');
const layout = { ...Object.fromEntries(Object.entries(tokens.space).map(([name, value]) => ['space-' + name, value + 'px'])),
  ...Object.fromEntries(Object.entries(tokens.radius).map(([name, value]) => ['radius-' + name, value + 'px'])), navTarget: tokens.touchTarget + 'px' };

export const tokenCss = `:root{${declarations(tokens.colors)};${declarations(layout)}}@media (prefers-color-scheme: dark){:root{${declarations(tokens.darkColors)}}}`;
