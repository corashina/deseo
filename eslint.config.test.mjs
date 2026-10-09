import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ESLint } from 'eslint';

// Importance: 95. These checks protect feature ownership and platform isolation.
const eslint = new ESLint({ cwd: fileURLToPath(new URL('.', import.meta.url)) });
const restrictedRules = new Set(['no-restricted-imports', 'no-restricted-syntax', 'no-restricted-globals']);
const nativeFeatures = ['auth', 'pair', 'calendar', 'today', 'memories', 'messages', 'tasks', 'notifications'];
const applications = [['mobile', nativeFeatures], ['web', [...nativeFeatures, 'settings']]];
const importForms = [
  path => `import { value } from '${path}';`,
  path => `import type { Value } from '${path}';`,
  path => `export { value } from '${path}';`,
  path => `export * from '${path}';`,
  path => `void import('${path}');`,
];

async function restricted(filePath, source) {
  const [result] = await eslint.lintText(source, { filePath });
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  assert.equal(result.messages.some(message => message.message.includes('ignored')), false, filePath);
  return result.messages.filter(message => restrictedRules.has(message.ruleId)).map(message => message.message);
}

async function rejects(filePath, path) {
  for (const source of importForms.map(form => form(path))) {
    assert.ok((await restricted(filePath, source)).length > 0, `${filePath}: ${source}`);
  }
}

async function allows(filePath, path) {
  for (const source of importForms.map(form => form(path))) {
    assert.deepEqual(await restricted(filePath, source), [], `${filePath}: ${source}`);
  }
}

for (const [application, features] of applications) {
  for (const feature of features) {
    test(`${application} ${feature} rejects other feature internals`, async () => {
      const filePath = `apps/${application}/src/features/${feature}/screens/Example.tsx`;
      for (const other of features.filter(name => name !== feature)) {
        await rejects(filePath, `../../${other}/queries`);
        await rejects(filePath, `../../${other}/pages/Example`);
      }
    });
    test(`${application} ${feature} allows own internals, public interfaces, and domain`, async () => {
      const filePath = `apps/${application}/src/features/${feature}/screens/Example.tsx`;
      await allows(filePath, '../queries');
      await allows(filePath, `../../${feature}/queries`);
      await allows(filePath, '@deseo/domain/today');
      for (const other of features.filter(name => name !== feature)) {
        await allows(filePath, `../../${other}`);
        await allows(filePath, `../../${other}/index`);
        await allows(filePath, `../../${other}/index.ts`);
      }
    });
  }
  test(`${application} UI controls reject feature data and backend clients`, async () => {
    const filePath = `apps/${application}/src/components/ui/Example.tsx`;
    for (const feature of features) {
      await rejects(filePath, `../../features/${feature}/queries`);
      await rejects(filePath, `../../features/${feature}/commands`);
      await rejects(filePath, `../../features/${feature}`);
    }
    await rejects(filePath, '../../lib/supabase');
    for (const extension of ['ts', 'js', 'tsx', 'jsx', 'mts', 'mjs', 'cts', 'cjs']) {
      await rejects(filePath, '../../lib/supabase.' + extension);
    }
    await rejects(filePath, '@supabase/supabase-js');
    await allows(filePath, '@deseo/domain/events');
    await allows(filePath, 'react');
    await allows(filePath, '../../theme/colors');
  });
  test(`${application} routes allow feature pages and screens`, async () => {
    const filePath = `apps/${application}/src/app/router.tsx`;
    for (const feature of features) {
      await allows(filePath, `../features/${feature}/pages/Example`);
      await allows(filePath, `../features/${feature}/screens/Example`);
      await allows(filePath, `../features/${feature}`);
    }
    assert.deepEqual(await restricted(filePath,
      "const Page = lazy(() => import('../features/today/pages/TodayPage'));"), []);
  });
  test(`${application} providers retain their session client access`, async () => {
    await allows(`apps/${application}/src/app/SessionProvider.tsx`, '../lib/supabase');
  });
}

test('browser native isolation survives feature and UI configuration', async () => {
  const filePaths = [
    ...applications[1][1].map(feature => `apps/web/src/features/${feature}/Example.tsx`),
    'apps/web/src/components/ui/Example.tsx',
    'apps/web/src/app/router.tsx',
    'apps/web/tests/Example.ts',
  ];
  for (const filePath of filePaths) {
    for (const path of ['../../../../mobile/src/features/tasks', '../../apps/mobile/src/app', '@deseo/mobile', '@deseo/mobile/features/tasks']) {
      await rejects(filePath, path);
    }
  }
});

test('domain retains platform import and browser state restrictions', async () => {
  const filePath = 'packages/domain/src/today/example.ts';
  for (const path of ['expo', 'expo-router', 'react-native', 'react-native-mmkv', '@deseo/web', '../../apps/web/src/app']) {
    assert.ok((await restricted(filePath, `import { value } from '${path}';`)).length > 0, path);
  }
  for (const source of ['window.location;', 'localStorage.getItem("key");', 'globalThis.document;', 'globalThis["sessionStorage"];']) {
    assert.ok((await restricted(filePath, source)).length > 0, source);
  }
  await allows(filePath, '@deseo/domain/events');
});
