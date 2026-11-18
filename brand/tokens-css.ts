import tokens from './tokens.json';

// CSS variables from the tokens. The web portal and the public site use this text.
// Each color is light-dark(light, dark). The color scheme picks the value, so a page or element follows the device appearance with no script.
const cssName = (name: string) => '--' + name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
const declarations = (values: Record<string, string>) => Object.entries(values).map(([name, value]) => cssName(name) + ':' + value).join(';');
const colors = Object.fromEntries(Object.entries(tokens.colors).map(([name, light]) => [name, `light-dark(${light},${tokens.darkColors[name as keyof typeof tokens.darkColors]})`]));
const layout = { ...Object.fromEntries(Object.entries(tokens.space).map(([name, value]) => ['space-' + name, value + 'px'])),
  ...Object.fromEntries(Object.entries(tokens.radius).map(([name, value]) => ['radius-' + name, value + 'px'])), navTarget: tokens.touchTarget + 'px' };

export const tokenCss = `:root{${declarations(colors)};${declarations(layout)}}`;
