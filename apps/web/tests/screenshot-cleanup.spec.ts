import { test, expect } from '@playwright/test';
import { AuthApiError } from '@supabase/supabase-js';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { admin } from './support/entry-fixtures';
import { createScreenshotFixtures } from './support/screenshot-fixtures';
import { cleanupScreenshotLedger, type ScreenshotLedger } from './support/screenshot-journal';

const scratch = fileURLToPath(new URL('../../../.superpowers/frontend-design/capture/', import.meta.url));
const readLedger = async (file: string): Promise<ScreenshotLedger> => JSON.parse(await readFile(file, 'utf8'));
const accountIds = (ledger: ScreenshotLedger) => [...(ledger.portal?.accountIds ?? []), ...Object.values(ledger.entries).flatMap(item => item.accountIds), ...(ledger.freshId ? [ledger.freshId] : []), ...ledger.verificationIds];
test.use({ trace: 'off' });

// Importance 95: successful cleanup must confirm disposal and retain the complete ownership journal.
test('successful screenshot cleanup retains ownership and confirms disposal', async () => {
  await mkdir(scratch, { recursive: true });
  const file = scratch + 'successful-cleanup-' + randomUUID() + '.json';
  const fixtures = await createScreenshotFixtures(file);
  try {
    const before = await readLedger(file);
    await fixtures.cleanup();
    const done = await readLedger(file);
    expect(done.cleaned).toBe(true);
    expect(accountIds(done)).toEqual(accountIds(before));
    expect(done.removedAccountIds.sort()).toEqual(accountIds(before).sort());
    for (const id of accountIds(done)) expect((await admin.auth.admin.getUserById(id)).error?.code).toBe('user_not_found');
    expect((await admin.from('pairs').select('state').eq('id', done.namedPairId!).single()).data?.state).toBe('active');
  } finally { await cleanupScreenshotLedger(file); }
});

// Importance 95: failed Auth deletions must retain all ownership IDs and support recovery from the saved journal.
for (const target of ['fresh', 'verification'] as const) test('failed ' + target + ' deletion keeps its journal and recovers', async () => {
  await mkdir(scratch, { recursive: true });
  const file = scratch + 'cleanup-regression-' + randomUUID() + '.json';
  const fixtures = await createScreenshotFixtures(file);
  const verification = await admin.auth.admin.createUser({ email: `entry-${randomUUID()}@example.test`, email_confirm: true });
  expect(verification.error).toBeNull();
  await fixtures.recordVerificationAccount(verification.data.user!.id);
  const failureId = target === 'fresh' ? fixtures.freshId : verification.data.user!.id;
  const before = await readLedger(file);
  const original = admin.auth.admin.deleteUser;
  try {
    admin.auth.admin.deleteUser = async (id, ...args) => id === failureId
      ? { data: { user: null }, error: new AuthApiError('Controlled Auth deletion failure', 503, 'unexpected_failure') }
      : original.call(admin.auth.admin, id, ...args);
    await expect(fixtures.cleanup()).rejects.toThrow('Controlled Auth deletion failure');
    const failed = await readLedger(file);
    expect(failed.cleaned).toBe(false);
    expect(accountIds(failed)).toEqual(accountIds(before));
    expect(failed.verificationIds).toContain(verification.data.user!.id);
    expect(failed.removedAccountIds).not.toContain(failureId);
    expect((await admin.auth.admin.getUserById(failureId)).data.user?.id).toBe(failureId);
    await expect(createScreenshotFixtures(file)).rejects.toThrow(/EEXIST/);
    expect(await readLedger(file)).toEqual(failed);
    admin.auth.admin.deleteUser = original;
    // Recover through saved ownership data, without the original fixture object's cleanup closure.
    await cleanupScreenshotLedger(file);
    const done = await readLedger(file);
    expect(done.cleaned).toBe(true);
    expect(accountIds(done)).toEqual(accountIds(before));
    expect(done.removedAccountIds.sort()).toEqual(accountIds(before).sort());
    for (const id of accountIds(done)) expect((await admin.auth.admin.getUserById(id)).error?.code).toBe('user_not_found');
    expect((await admin.from('pairs').select('state').eq('id', done.namedPairId!).single()).data?.state).toBe('active');
  } finally { admin.auth.admin.deleteUser = original; await cleanupScreenshotLedger(file); }
});

// Importance 95: setup must journal the first account before later creation or cleanup can fail.
test('setup failure preserves partial ownership when cleanup fails', async () => {
  await mkdir(scratch, { recursive: true });
  const file = scratch + 'setup-regression-' + randomUUID() + '.json';
  const create = admin.auth.admin.createUser; const remove = admin.auth.admin.deleteUser;
  let attempts = 0;
  try {
    admin.auth.admin.createUser = async input => ++attempts === 2
      ? { data: { user: null }, error: new AuthApiError('Controlled account creation failure', 503, 'unexpected_failure') }
      : create.call(admin.auth.admin, input);
    admin.auth.admin.deleteUser = async () => ({ data: { user: null }, error: new AuthApiError('Controlled cleanup failure', 503, 'unexpected_failure') });
    await expect(createScreenshotFixtures(file)).rejects.toThrow('Screenshot setup and cleanup failed. Ownership remains in the journal.');
    const failed = await readLedger(file);
    expect(failed.cleaned).toBe(false);
    expect(failed.portal?.accountIds).toHaveLength(1);
    expect(failed.portal?.pairId).toBeTruthy();
    expect(failed.portalContentStarted).toBe(false);
    expect(failed.removedAccountIds).toHaveLength(0);
    expect((await admin.auth.admin.getUserById(failed.portal!.accountIds[0])).data.user).not.toBeNull();
  } finally {
    admin.auth.admin.createUser = create; admin.auth.admin.deleteUser = remove;
    await cleanupScreenshotLedger(file);
    const done = await readLedger(file);
    expect(done.cleaned).toBe(true);
    expect(done.portal?.accountIds).toHaveLength(1);
    expect((await admin.auth.admin.getUserById(done.portal!.accountIds[0])).error?.code).toBe('user_not_found');
  }
});
