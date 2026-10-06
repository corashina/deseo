import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { confirmNavigation } from './support/navigation';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';

// Importance 98: real sends, private read cursors, and notes must work across both sessions.
test('Anna sends, Marek reads, and both notes appear', async ({ page, browser }, testInfo) => {
  const ids = await createPortalPairFixture();
  const partnerContext = await browser.newContext();
  const partner = await partnerContext.newPage();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/messages?view=notes');
    await expect(page.getByTestId('note-card')).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath('notes-' + testInfo.project.name + '.png'), fullPage: true });
    await page.goto('/today');
    await expect(page.getByTestId('today-note')).toContainText('I’ll bring flowers. See you tonight.');
    await page.goto('/messages');
    // Importance 94: a fresh message route must display each sent line on a separate visible line.
    const body = 'Dinner at seven?\nBring the map.';
    await page.getByLabel('Message', { exact: true }).fill(body);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByTestId('message-row').filter({ hasText: 'Dinner at seven?' })).toContainText('Sent');
    await loginWithLocalEmailCode(partner, ids.marekEmail);
    const marek = await portalClient(ids.marekEmail);
    await expect.poll(async () => (await marek.rpc('get_unread_count', { p_pair_id: ids.pairId })).data.data.count).toBeGreaterThan(0);
    await partner.goto('/messages');
    const received = partner.getByTestId('message-row').filter({ hasText: 'Dinner at seven?' }).locator('p');
    await expect(received).toHaveText(body);
    const lines = await received.evaluate(element => {
      const text = element.firstChild!;
      const second = text.textContent!.indexOf('\n') + 1;
      const range = document.createRange();
      range.setStart(text, 0); range.setEnd(text, 1);
      const firstTop = range.getBoundingClientRect().top;
      range.setStart(text, second); range.setEnd(text, second + 1);
      return { firstTop, secondTop: range.getBoundingClientRect().top };
    });
    expect(lines.secondTop).toBeGreaterThan(lines.firstTop);
    await expect.poll(async () => (await marek.rpc('get_unread_count', { p_pair_id: ids.pairId })).data.data.count).toBe(0);
    await partner.getByLabel('Message', { exact: true }).fill('Yes, see you there.');
    await partner.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByText('Yes, see you there.', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('messages-' + testInfo.project.name + '.png'), fullPage: true });
    await expect(page.getByText(/typing|read by|online now/i)).toHaveCount(0);
  } finally { await partnerContext.close(); await cleanupPortalPairFixture(ids); }
});

// Importance 100: author-only controls and server authorization protect messages.
test('each person can pin or delete only their own messages', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/messages');
    const own = page.getByTestId('message-row').filter({ hasText: 'I’m looking forward to dinner with you.' });
    const other = page.getByTestId('message-row').filter({ hasText: 'I’ll bring flowers. See you tonight.' });
    await expect(other.getByRole('button')).toHaveCount(0);
    await own.getByRole('button', { name: 'Unpin note', exact: true }).click();
    await own.getByRole('button', { name: 'Pin note', exact: true }).click();
    const marek = await portalClient(ids.marekEmail);
    for (const command of ['pin_message', 'unpin_message', 'delete_message']) {
      expect((await marek.rpc(command, { p_message_id: ids.annaMessageId, p_command_id: randomUUID() })).data.error.code).toBe('FORBIDDEN');
    }
    await own.getByRole('button', { name: 'Delete message', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await expect(own).toHaveCount(0);
    await page.getByRole('button', { name: 'Account menu', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await loginWithLocalEmailCode(page, ids.marekEmail);
    await page.goto('/messages');
    await other.getByRole('button', { name: 'Unpin note', exact: true }).click();
    await other.getByRole('button', { name: 'Pin note', exact: true }).click();
    await other.getByRole('button', { name: 'Delete message', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await expect(other).toHaveCount(0);
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 98: a lost acknowledgement must reconcile before retry after scope reset.
test('lost accepted response survives focus and reconciles one durable message', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/messages');
    const bodies: Array<{ p_client_id: string; p_body: string }> = [];
    await page.route('**/rest/v1/rpc/send_message', async route => {
      bodies.push(route.request().postDataJSON());
      await route.fetch();
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await route.abort();
    });
    await page.getByLabel('Message', { exact: true }).fill('Keep this exact send.');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry message', exact: true })).toBeEnabled();
    await page.getByLabel('Message', { exact: true }).fill('A newer composer draft');
    if (await page.getByRole('button', { name: 'Open navigation', exact: true }).isVisible()) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await confirmNavigation(page, () => page.getByRole('link', { name: 'Today', exact: true }).click(), true);
    await page.getByRole('link', { name: 'Reply', exact: true }).click();
    await expect(page.getByTestId('pending-send')).toContainText('Keep this exact send.');
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('A newer composer draft');
    const reconciles: unknown[] = [];
    await page.route('**/rest/v1/rpc/reconcile_message_sends', async route => { reconciles.push(route.request().postDataJSON()); await route.continue(); });
    await page.getByRole('button', { name: 'Retry message', exact: true }).click();
    await expect(page.getByTestId('pending-send')).toHaveCount(0);
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('A newer composer draft');
    await expect(page.getByTestId('message-row').filter({ hasText: 'Keep this exact send.' })).toHaveCount(1);
    expect(reconciles).toContainEqual({ p_pair_id: ids.pairId, p_client_ids: [bodies[0].p_client_id] });
    expect(bodies).toHaveLength(1);
    const client = await portalClient(ids.annaEmail);
    const replay = await client.rpc('send_message', { p_pair_id: ids.pairId, ...bodies[0] });
    expect(replay.data.ok).toBe(true);
    expect((await client.from('messages').select('id').eq('pair_id', ids.pairId).eq('client_id', bodies[0].p_client_id)).data).toHaveLength(1);
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 98: a deleted durable outcome must not recreate an uncertain message.
test('recovery accepts a deleted durable send without sending it again', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/messages');
    const bodies: Array<{ p_client_id: string; p_body: string }> = [];
    await page.route('**/rest/v1/rpc/send_message', async route => {
      bodies.push(route.request().postDataJSON());
      await route.fetch();
      await route.abort();
    });
    await page.getByLabel('Message', { exact: true }).fill('Deleted before recovery');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry message', exact: true })).toBeEnabled();
    const client = await portalClient(ids.annaEmail);
    const accepted = await client.from('messages').select('id').eq('pair_id', ids.pairId).eq('client_id', bodies[0].p_client_id).single();
    expect((await client.rpc('delete_message', { p_message_id: accepted.data!.id, p_command_id: randomUUID() })).data.ok).toBe(true);
    await page.getByLabel('Message', { exact: true }).fill('Keep the next draft');
    await page.getByRole('button', { name: 'Retry message', exact: true }).click();
    await expect(page.getByTestId('pending-send')).toHaveCount(0);
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('Keep the next draft');
    expect(bodies).toHaveLength(1);
    expect((await client.from('messages').select('id').eq('pair_id', ids.pairId).eq('client_id', bodies[0].p_client_id)).data).toHaveLength(0);
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 95: unsent text survives navigation, failures, offline state, and scope reset.
test('draft and failed send retain text and retry the immutable UUID', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/messages');
    await page.getByLabel('Message', { exact: true }).fill('My unsent draft');
    await page.context().setOffline(true);
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('My unsent draft');
    await page.context().setOffline(false);
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
    await page.getByRole('link', { name: 'Conversation', exact: true }).click();
    await confirmNavigation(page, () => page.getByRole('link', { name: 'Pinned notes', exact: true }).click(), true);
    await confirmNavigation(page, () => page.getByRole('link', { name: 'Conversation', exact: true }).click(), true);
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('My unsent draft');
    const bodies: unknown[] = [];
    await page.route('**/rest/v1/rpc/send_message', async route => {
      bodies.push(route.request().postDataJSON());
      if (bodies.length === 1) await route.abort(); else await route.continue();
    });
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByTestId('pending-send')).toContainText('My unsent draft');
    await expect(page.getByRole('button', { name: 'Retry message', exact: true })).toBeEnabled();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('button', { name: 'Retry message', exact: true }).click();
    await expect(page.getByTestId('pending-send')).toHaveCount(0);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 100: sign-out clears pending text, including late failed callbacks.
test('sign-out clears private sends before another account opens Messages', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/messages');
    let started!: () => void;
    let finish!: () => void;
    const requestStarted = new Promise<void>(resolve => { started = resolve; });
    const finishRequest = new Promise<void>(resolve => { finish = resolve; });
    await page.route('**/rest/v1/rpc/send_message', async route => { started(); await finishRequest; await route.abort(); });
    await page.getByLabel('Message', { exact: true }).fill('Anna private pending text');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await requestStarted;
    await page.getByRole('button', { name: 'Account menu', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    finish();
    await loginWithLocalEmailCode(page, ids.marekEmail);
    await page.goto('/messages');
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('');
    await expect(page.getByText('Anna private pending text', { exact: true })).toHaveCount(0);
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 98: pagination and new durable reads must retain the reader's position.
test('older messages paginate past fifty without scrolling for new messages', async ({ page }, testInfo) => {
  const ids = await createPortalPairFixture();
  try {
    const client = await portalClient(ids.annaEmail);
    for (let index = 0; index < 55; index++) {
      expect((await client.rpc('send_message', { p_pair_id: ids.pairId, p_client_id: randomUUID(), p_body: 'History message ' + index })).data.ok).toBe(true);
    }
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/messages');
    await page.getByRole('button', { name: 'Load older messages', exact: true }).click();
    await expect(page.getByTestId('message-row')).toHaveCount(57);
    const history = page.getByLabel('Conversation messages');
    await history.evaluate(element => { element.scrollTop = 240; });
    const oldScroll = await history.evaluate(element => element.scrollTop);
    const marek = await portalClient(ids.marekEmail);
    expect((await marek.rpc('send_message', { p_pair_id: ids.pairId, p_client_id: randomUUID(), p_body: 'New while reading history' })).data.ok).toBe(true);
    await expect(page.getByText('New while reading history', { exact: true })).toBeAttached();
    expect(await history.evaluate(element => element.scrollTop)).toBeCloseTo(oldScroll, -1);
    expect((await client.rpc('get_unread_count', { p_pair_id: ids.pairId })).data.data.count).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Latest messages', exact: true }).click();
    await expect.poll(async () => (await client.rpc('get_unread_count', { p_pair_id: ids.pairId })).data.data.count).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('conversation-' + testInfo.project.name + '.png'), fullPage: true });
    for (const width of [320, 768, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  } finally { await cleanupPortalPairFixture(ids); }
});
