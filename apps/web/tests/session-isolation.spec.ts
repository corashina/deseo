import { test, expect } from '@playwright/test';
import { admin, localUrl, publicKey, createEntryFixture, cleanupEntryFixture } from './support/entry-fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';

// Importance: 100. Delayed reads and disabled accounts must expose no shared identity.
test('sign out before pair response prevents stale partner identity', async ({ page, context }) => {
  const fixture = await createEntryFixture('active');
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await expect(page.getByRole('heading', { name: 'Anna + Marek' })).toBeVisible();
    const second = await context.newPage();
    await second.goto('/');
    await expect(second.getByRole('button', { name: 'Account menu' })).toBeVisible();
    let release!: () => void;
    let received!: () => void;
    const arrived = new Promise<void>(resolve => { received = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/rest/v1/rpc/get_pair_context', async route => {
      const response = await route.fetch(); received(); await gate;
      await route.fulfill({ response }).catch(() => undefined);
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await arrived;
    await second.getByRole('button', { name: 'Account menu' }).click();
    await second.getByRole('button', { name: 'Sign out', exact: true }).click();
    release();
    await expect(page.getByRole('link', { name: 'Continue with email' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Marek');
  } finally { await cleanupEntryFixture(fixture); }
});
test('disabled account cannot restore a cached session', async ({ page }) => {
  const fixture = await createEntryFixture('active');
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    const jwt = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.endsWith('-auth-token'))!;
      return JSON.parse(localStorage.getItem(key)!).access_token as string;
    });
    const { error } = await admin.from('profiles').update({ account_status: 'disabled' }).eq('user_id', fixture.accountIds[0]);
    expect(error).toBeNull();
    await page.reload();
    await expect(page.locator('body')).not.toContainText('Marek');
    await expect(page.getByRole('link', { name: 'Continue with email' })).toBeVisible();
    const response = await fetch(`${localUrl}/rest/v1/rpc/get_pair_context`, {
      method: 'POST', headers: { apikey: publicKey, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }, body: '{}',
    });
    expect((await response.json()).ok).toBe(false);
  } finally { await cleanupEntryFixture(fixture); }
});
