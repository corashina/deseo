const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/src/**/*.test.ts', '**/src/**/*.test.tsx'],
  clearMocks: true,
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map(pattern =>
    pattern.replace('(?!(.pnpm|', '(?!(.pnpm|@deseo/domain|'),
  ),
};
