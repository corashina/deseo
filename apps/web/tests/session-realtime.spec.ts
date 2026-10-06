import { test, expect, type Page } from '@playwright/test';
import { createEntryFixture, cleanupEntryFixture } from './support/entry-fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';

async function holdOwnChange(page: Page, table: 'profiles' | 'pair_members', userId: string) {
  let release = () => {};
  let delivered = false;
  let joined = false;
  let currentSocket = 0;
  await page.routeWebSocket('**/realtime/v1/websocket*', socket => {
    const generation = ++currentSocket;
    joined = false;
    const server = socket.connectToServer();
    server.onMessage(message => {
      let values;
      try { values = JSON.parse(String(message)); } catch { socket.send(message); return; }
      if (!Array.isArray(values)) { socket.send(message); return; }
      const [, , topic, event, payload] = values;
      if (generation === currentSocket && event === 'phx_reply' && payload?.status === 'ok'
        && String(topic).includes('portal-membership:')) joined = true;
      const change = payload?.data;
      if (generation === currentSocket && !delivered && event === 'postgres_changes' && change?.table === table && change.record?.user_id === userId) {
        delivered = true;
        release = () => socket.send(message);
      } else socket.send(message);
    });
  });
  return { release: () => release(), held: () => delivered, joined: () => joined };
}

// Importance 100: a real delayed profile signal must not abort a recovery after verified adoption.
test('represented profile signal does not abort lost-response reconciliation', async ({ page }) => {
  const fixture = await createEntryFixture('unpaired');
  const change = await holdOwnChange(page, 'profiles', fixture.accountIds[0]);
  let finishSave = () => {};
  const heldSave = new Promise<void>(resolve => { finishSave = resolve; });
  let finishRead = () => {};
  const heldRead = new Promise<void>(resolve => { finishRead = resolve; });
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    const navigation = page.getByRole('button', { name: 'Open navigation', exact: true });
    if (await navigation.isVisible()) await navigation.click();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Profile', exact: true }) }).click();
    await expect.poll(change.joined).toBe(true);
    await page.route('**/rest/v1/rpc/save_profile', async route => {
      await route.fetch();
      await heldSave;
      await route.abort();
    });
    await page.getByLabel('Your name', { exact: true }).fill('Verified profile');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await expect.poll(change.held).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('.sidebar-identity')).toContainText('Verified profile');
    let reconciliation = false;
    await page.route('**/rest/v1/rpc/get_session_context', async route => {
      const response = await route.fetch();
      reconciliation = true;
      await heldRead;
      await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Retry profile', exact: true }).click();
    await expect.poll(() => reconciliation).toBe(true);
    change.release();
    finishRead();
    await expect(page.getByText('Profile saved.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Your name', { exact: true })).toBeEnabled();
  } finally { finishRead(); finishSave(); change.release(); await cleanupEntryFixture(fixture); }
});

// Importance 100: a real delayed membership insert must not discard an invitation's one-shot delivery.
test('represented membership signal does not abort ordinary invitation delivery', async ({ page }) => {
  const fixture = await createEntryFixture('unpaired');
  const change = await holdOwnChange(page, 'pair_members', fixture.accountIds[0]);
  let finish = () => {};
  const held = new Promise<void>(resolve => { finish = resolve; });
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await expect.poll(change.joined).toBe(true);
    const created = page.waitForResponse('**/rest/v1/rpc/create_pair');
    await page.getByRole('button', { name: 'Create pair', exact: true }).click();
    const result = await (await created).json();
    expect(result.ok).toBe(true);
    fixture.pairId = result.data.pairId;
    await expect(page).toHaveURL(/\/pair\/waiting$/);
    await expect.poll(change.held).toBe(true);
    await page.getByRole('link', { name: 'Get invitation code', exact: true }).click();
    let committed = false;
    await page.route('**/rest/v1/rpc/create_invite', async route => {
      const response = await route.fetch();
      committed = true;
      await held;
      await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Create invitation code', exact: true }).click();
    await expect.poll(() => committed).toBe(true);
    change.release();
    finish();
    await expect(page.locator('.invite-code')).toHaveText(/^[0-9A-Z]{12}$/);
  } finally { finish(); change.release(); await cleanupEntryFixture(fixture); }
});
