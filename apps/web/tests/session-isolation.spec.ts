import { test, expect } from '@playwright/test';
import { admin, localUrl, publicKey, createEntryFixture, cleanupEntryFixture } from './support/entry-fixtures';
import { loginWithLocalEmailCode, observeOwnSessionChanges } from './support/local-auth';
import { createClient } from '@supabase/supabase-js';
import { fixtureRpc } from './support/entry-fixtures';

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

// Importance: 100. A new pair must not inherit the previous pair's mounted invitation state.
test('same-account pair change clears mounted invitation state', async ({ page, context }) => {
  const fixture = await createEntryFixture('pending');
  const oldPair = fixture.pairId;
  const signals = await observeOwnSessionChanges(page, fixture.accountIds[0]);
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await page.goto('/pair/invite');
    await page.getByRole('button', { name: 'Create invitation code' }).click();
    await expect(page.locator('.invite-code')).toBeVisible();
    const oldToken = await page.locator('.invite-code').innerText();
    const refreshed = page.waitForResponse('**/rest/v1/rpc/get_pair_context');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await refreshed;
    await expect(page.locator('.invite-code')).toHaveText(oldToken);
    await expect.poll(signals.joined).toBe(true);
    const profile = await admin.from('profiles').select('version').eq('user_id', fixture.accountIds[0]).single();
    if (profile.error) throw profile.error;
    // Importance 100: finish the old membership's privacy recovery before creating another invitation.
    const version = profile.data.version + 1;
    const recovered = signals.prepareRecovery(version, () => fixture.pairId!, () =>
      signals.changes.some(change => change.table === 'profiles' && change.record.version === version)
      && signals.changes.some(change => change.table === 'pair_members' && change.record.pair_id === oldPair && typeof change.record.left_at === 'string')
      && signals.changes.some(change => change.table === 'pair_members' && change.record.pair_id === fixture.pairId && change.record.left_at === null));
    await context.setOffline(true);
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: fixture.email });
    if (link.error) throw link.error;
    const actor = createClient(localUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await actor.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
    if (login.error) throw login.error;
    await expect.poll(signals.joined).toBe(true);
    await fixtureRpc(actor, 'cancel_pending_pair', { p_pair_id: oldPair, p_command_id: crypto.randomUUID() });
    await expect.poll(signals.joined).toBe(true);
    fixture.pairId = (await fixtureRpc(actor, 'create_pair', { p_timezone: 'Europe/Warsaw', p_command_id: crypto.randomUUID() })).pairId;
    await context.setOffline(false);
    await recovered();
    await expect(page.getByRole('button', { name: 'Create invitation code', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create invitation code', exact: true })).toBeEnabled();
    await expect(page.locator('.invite-code')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy invitation link' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Create invitation code', exact: true }).click();
    await expect(page.locator('.invite-code')).not.toHaveText(oldToken);
  } finally {
    await cleanupEntryFixture({ ...fixture, accountIds: [], pairId: oldPair });
    await cleanupEntryFixture(fixture);
  }
});
