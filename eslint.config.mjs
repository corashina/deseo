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
    'no-restricted-imports': ['error', { patterns: [{ group: ['**/apps/mobile', '**/apps/mobile/**', '**/mobile', '**/mobile/**', '@deseo/mobile', '@deseo/mobile/**'],
      message: 'Import shared rules and data. Keep native screens separate.' }] }],
  } },
  { files: ['packages/domain/src/**/*.ts'], rules: {
    'no-restricted-imports': ['error', { patterns: [{ group: [
      'expo', 'expo/**', 'expo-*', 'expo-*/**', '@expo/**',
      'react-native', 'react-native/**', 'react-native-*', 'react-native-*/**', '@react-native/**', '@react-native-*/**',
      '@deseo/mobile', '@deseo/mobile/**', '@deseo/web', '@deseo/web/**',
      '**/apps/**', '**/mobile/**', '**/web/**',
    ], message: 'Keep domain rules independent of applications and devices.' }, {
      regex: '^@deseo/(?!domain(?:/|$))',
      message: 'Keep application imports outside domain rules.',
    }] }],
    'no-restricted-globals': ['error', 'window', 'self', 'document', 'navigator', 'localStorage', 'sessionStorage',
      'location', 'indexedDB', 'caches', 'Notification', 'HTMLElement', 'FileReader'],
    'no-restricted-syntax': ['error', {
      selector: "MemberExpression[object.name='globalThis']:matches([property.name=/^(window|self|document|navigator|localStorage|sessionStorage|location|indexedDB|caches|Notification|HTMLElement|FileReader)$/], [property.value=/^(window|self|document|navigator|localStorage|sessionStorage|location|indexedDB|caches|Notification|HTMLElement|FileReader)$/])",
      message: 'Keep browser state outside domain rules.',
    }],
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
