import { randomUUID } from 'node:crypto';
import { test, expect, admin, rpc } from './support/test';
import { readLocalCode } from './support/local-auth';

// Importance 100: fresh verification, pair closure, and global revocation protect both viewers.
test('ending a pair requires a fresh code and removes both viewers access', async ({ page, browser, pair, signIn }) => {
  const { id, a, b } = await pair();
  const eventId = randomUUID();
  await rpc(a.client, 'create_event', {
    p_input: { id: eventId, pair_id: id, title: 'Dinner together', owner: 'together',
      visibility: 'shared', timezone: 'Europe/Warsaw', repeat: 'none', starts_at: '2026-10-05T17:00:00Z', ends_at: '2026-10-05T19:00:00Z' },
    p_command_id: randomUUID(),
  });
  const partner = await browser.newContext();
  try {
    const second = await partner.newPage();
    await signIn(second, b);
    await second.goto('/events/' + eventId);
    await expect(second.getByRole('heading', { name: 'Dinner together', exact: true })).toBeVisible();
    await signIn(page, a);
    await page.goto('/settings/pair');
    await expect(page.getByRole('button', { name: 'End pair', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Send code to end pair', exact: true }).click();
    await expect(page.getByLabel('Email verification code')).toBeVisible();
    // Importance 93: a wrong code fails, and the error stays readable inside and after the dialog.
    await page.getByLabel('Email verification code').fill('000000');
    await page.getByRole('button', { name: 'End pair', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm ending pair', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'End this pair?', exact: true });
    await expect(dialog.getByRole('alert')).toHaveText('The code is invalid or expired. Request a new code.');
    await page.getByRole('button', { name: 'Close end this pair?', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('The code is invalid or expired. Request a new code.');
    await page.getByLabel('Email verification code').fill(await readLocalCode(a.email));
    await page.getByRole('button', { name: 'End pair', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm ending pair', exact: true }).click();
    await expect(page.getByText('Your pair has ended. Shared content is unavailable.')).toBeVisible();
    await second.bringToFront(); await second.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(second).toHaveURL(/\/pair\/ended$/);
    await second.goto('/events/' + eventId); await expect(second).toHaveURL(/\/pair\/ended$/);
    await page.goto('/settings/notifications'); await expect(page.getByLabel('Notification timezone')).toBeVisible();
    await page.goto('/settings/account'); await expect(page.getByRole('button', { name: 'Sign out on this browser' })).toBeVisible();
    expect((await a.client.from('events').select('id').eq('id', eventId)).data).toEqual([]);
  } finally { await partner.close(); }
});

test('global sign-out revokes native devices and another browser session', async ({ page, browser, pair, signIn }) => {
  const { a } = await pair();
  const registered = await a.client.rpc('register_device', { p_input: { installationId: randomUUID(), platform: 'ios', permission: 'denied', token: null } });
  expect(registered.data.ok).toBe(true);
  const other = await browser.newContext();
  try {
    const second = await other.newPage();
    await signIn(page, a);
    await signIn(second, a);
    await second.goto('/today');
    await expect(second.getByRole('button', { name: 'Account menu' })).toBeVisible();
    await page.goto('/settings/account');
    await page.getByRole('button', { name: 'Sign out on all devices', exact: true }).click();
    await expect(page).toHaveURL(/\/welcome$/);
    await second.reload(); await expect(second).toHaveURL(/\/welcome$/);
    const devices = await admin.from('devices').select('revoked_at').eq('user_id', a.id);
    expect(devices.data?.length).toBe(1); expect(devices.data?.[0].revoked_at).not.toBeNull();
    expect((await a.client.rpc('get_session_context')).data?.ok).toBe(false);
  } finally { await other.close(); }
});
