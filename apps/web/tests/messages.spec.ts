import { randomUUID } from 'node:crypto';
import { test, expect, admin, rpc } from './support/test';
import { loseResponse } from './support/network';

// Importance 100: a retry after a lost response stores one message.
test('a retry after a lost send response creates one message', async ({ page, browser, pair, signIn }) => {
  const { id, a, b } = await pair();
  const body = 'See you at the station at six';
  await signIn(page, a);
  await page.goto('/messages');
  await loseResponse(page, '**/rest/v1/rpc/send_message');
  await page.getByLabel('Message', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const pending = page.getByTestId('pending-send');
  await expect(pending.getByText('Not sent')).toBeVisible();
  await pending.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(pending).toHaveCount(0);
  await expect(page.getByTestId('message-row').filter({ hasText: body })).toHaveCount(1);
  const stored = await admin.from('messages').select('id').eq('pair_id', id).eq('body', body);
  expect(stored.data).toHaveLength(1);
  const context = await browser.newContext();
  try {
    const partner = await context.newPage();
    await signIn(partner, b);
    await partner.goto('/messages');
    await expect(partner.getByTestId('message-row').filter({ hasText: body })).toHaveCount(1);
  } finally { await context.close(); }
});

// Importance 94: a pinned message shows on Today, and deleting the message removes the note.
test('a pinned note shows on Today until its message is deleted', async ({ page, browser, pair, signIn }) => {
  const { id, a, b } = await pair();
  const body = 'Bring the umbrella';
  await rpc(b.client, 'send_message', { p_pair_id: id, p_client_id: randomUUID(), p_body: body });
  const context = await browser.newContext();
  try {
    const partner = await context.newPage();
    await signIn(partner, b);
    await partner.goto('/messages');
    const row = partner.getByTestId('message-row').filter({ hasText: body });
    await row.getByRole('button', { name: 'Message actions' }).click();
    await row.getByRole('button', { name: 'Pin note', exact: true }).click();
    await expect(row.getByText('Sent · Pinned note')).toBeVisible();
    await signIn(page, a);
    await page.goto('/today');
    await expect(page.getByTestId('today-note')).toContainText(body);
    await row.getByRole('button', { name: 'Message actions' }).click();
    await row.getByRole('button', { name: 'Delete message', exact: true }).click();
    await partner.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await expect(partner.getByTestId('message-row').filter({ hasText: body })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByTestId('today-note')).toHaveCount(0);
  } finally { await context.close(); }
});
