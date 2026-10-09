import tseslint from 'typescript-eslint';

const nativeFeatures = ['auth', 'pair', 'calendar', 'today', 'memories', 'messages', 'tasks', 'notifications'];
const applications = [
  { name: 'mobile', features: nativeFeatures, restrictions: [] },
  { name: 'web', features: [...nativeFeatures, 'settings'], restrictions: [{
    regex: '(?:^|/)(?:apps/)?mobile(?:/|$)|^@deseo/mobile(?:/|$)',
    message: 'Import shared rules and data. Keep native screens separate.',
  }] },
];
const uiRestriction = {
  regex: '(?:^|/)features(?:/|$)|(?:^|/)lib/supabase(?:[.](?:[cm]?[jt]s|[jt]sx))?$|^@supabase/supabase-js(?:/|$)',
  message: 'UI controls must not import feature data or backend clients.',
};

function restrictedImports(patterns) {
  return {
    'no-restricted-imports': ['error', { patterns }],
    'no-restricted-syntax': ['error', ...patterns.map(({ regex, message }) => ({
      selector: `ImportExpression[source.value=/${regex.replaceAll('/', '\\/')}/]`,
      message,
    }))],
  };
}

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.expo/**', '**/dist/**', '**/.auth/**', '**/test-results/**', '**/playwright-report/**'] },
  ...tseslint.configs.recommended,
  { files: ['apps/mobile/src/**/*.{ts,tsx}'], rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-require-imports': ['error', { allow: ['\\.png$'] }],
  } },
  { files: ['apps/web/**/*.{ts,tsx}'], rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    ...restrictedImports(applications[1].restrictions),
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
  ...applications.flatMap(({ name, features, restrictions }) => [
    ...features.map(feature => ({
      files: [`apps/${name}/src/features/${feature}/**/*.{ts,tsx}`],
      rules: restrictedImports([...restrictions, {
        regex: `(?:^|/)(?:${features.filter(other => other !== feature).join('|')})/(?!index(?:[.]tsx?)?$)`,
        message: 'Import the feature public interface.',
      }]),
    })),
    {
      files: [`apps/${name}/src/components/ui/**/*.{ts,tsx}`],
      rules: restrictedImports([...restrictions, uiRestriction]),
    },
  ]),
);
