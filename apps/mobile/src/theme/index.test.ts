import tokens from '../../../../brand/tokens.json';

test('the dark palette defines the same color roles as the light palette', () => {
  expect(Object.keys(tokens.darkColors).sort()).toEqual(Object.keys(tokens.colors).sort());
});
