import tseslint from 'typescript-eslint';

const features = ['auth', 'pair', 'calendar', 'today', 'memories'];
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.expo/**', '**/dist/**'] },
  ...tseslint.configs.recommended,
  { files: ['apps/mobile/src/**/*.{ts,tsx}'], rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': ['error', { allow: ['\\.png$'] }],
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
