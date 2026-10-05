import tseslint from 'typescript-eslint';

const features = ['auth', 'pair', 'calendar', 'today', 'memories'];
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.expo/**', '**/dist/**', '**/.auth/**', '**/test-results/**', '**/playwright-report/**'] },
  ...tseslint.configs.recommended,
  { files: ['apps/mobile/src/**/*.{ts,tsx}'], rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': ['error', { allow: ['\\.png$'] }],
  } },
  { files: ['apps/web/**/*.{ts,tsx}'], rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-restricted-imports': ['error', { patterns: [{ group: ['**/apps/mobile/**', '@deseo/mobile/**'],
      message: 'Import shared rules and data. Keep native screens separate.' }] }],
  } },
  ...features.map(name => ({
    files: [`apps/mobile/src/features/${name}/**/*.{ts,tsx}`],
    rules: { 'no-restricted-imports': ['error', { patterns: features.filter(other => other !== name).map(other => ({
      regex: `(?:^|/)${other}/(?!index$)`,
      message: 'Import the feature public interface.',
    })) }] },
  })),
  { files: ['apps/mobile/src/components/ui/**/*.{ts,tsx}', 'apps/mobile/src/app/**/*.{ts,tsx}'], rules: {
    'no-restricted-imports': ['error', { patterns: [{ group: ['**/lib/supabase', '**/features/*/commands', '**/features/*/queries'],
      message: 'Use a feature public interface. UI controls must not access feature data.' }] }],
  } },
);
