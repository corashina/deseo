import { test, expect } from '@playwright/test';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { loginWithLocalEmailCode, readLocalCode } from './support/local-auth';
import { admin, createEntryFixture, cleanupEntryFixture } from './support/entry-fixtures';
import { randomUUID } from 'node:crypto';
// Importance 100: fresh verification, pair closure, and global revocation protect both viewers.
test('ending a pair requires a fresh code and removes both viewers access', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const ids = await createPortalPairFixture(); const partner = await browser.newContext();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    const loginCode = await readLocalCode(ids.annaEmail);
    const second = await partner.newPage(); await loginWithLocalEmailCode(second, ids.marekEmail);
    await second.goto('/events/' + ids.sharedEventId);
    await expect(second.getByRole('heading', { name: 'Dinner together', exact: true })).toBeVisible();
    await page.goto('/settings/pair');
    await expect(page.getByRole('button', { name: 'End pair', exact: true })).toHaveCount(0);
    // The same account must wait for the provider's sign-in OTP window.
    await page.waitForTimeout(61_000);
    await page.getByRole('button', { name: 'Send code to end pair', exact: true }).click();
    await expect(page.getByLabel('Email verification code')).toBeVisible();
    await page.getByLabel('Email verification code').fill(loginCode);
    await page.getByRole('button', { name: 'End pair', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm ending pair', exact: true }).click();
    await expect(page.getByText('The code is invalid or expired. Request a new code.')).toBeVisible();
    await page.getByRole('button', { name: 'Close end this pair?' }).click();
    await page.getByLabel('Email verification code').fill(await readLocalCode(ids.annaEmail));
    await page.getByRole('button', { name: 'End pair', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm ending pair', exact: true }).click();
    await expect(page.getByText('Your pair has ended. Shared content is unavailable.')).toBeVisible();
    await second.bringToFront(); await second.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(second).toHaveURL(/\/pair\/ended$/);
    await second.goto('/events/' + ids.sharedEventId); await expect(second).toHaveURL(/\/pair\/ended$/);
    await page.goto('/settings/notifications'); await expect(page.getByLabel('Notification timezone')).toBeVisible();
    await page.goto('/settings/account'); await expect(page.getByRole('button', { name: 'Sign out on this browser' })).toBeVisible();
    const anna = await portalClient(ids.annaEmail); expect((await anna.from('events').select('id').eq('id', ids.sharedEventId)).data).toEqual([]);
  } finally { await partner.close(); await cleanupPortalPairFixture(ids); }
});
test('global sign-out revokes native devices and another browser session', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const ids = await createPortalPairFixture(); const other = await browser.newContext();
  try {
    const client = await portalClient(ids.annaEmail);
    const registered = await client.rpc('register_device', { p_input: { installationId: randomUUID(), platform: 'ios', permission: 'denied', token: null } });
    expect(registered.data.ok).toBe(true);
    const second = await other.newPage();
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.waitForTimeout(61_000);
    await loginWithLocalEmailCode(second, ids.annaEmail);
    await page.goto('/settings/account');
    await page.getByRole('button', { name: 'Sign out on all devices', exact: true }).click();
    await expect(page).toHaveURL(/\/welcome$/);
    await second.reload(); await expect(second).toHaveURL(/\/welcome$/);
    const devices = await admin.from('devices').select('revoked_at').eq('user_id', ids.annaId);
    expect(devices.data?.length).toBe(1); expect(devices.data?.[0].revoked_at).not.toBeNull();
    expect((await client.rpc('get_session_context')).data?.ok).toBe(false);
  } finally { await other.close(); await cleanupPortalPairFixture(ids); }
});


// Importance 93: verification errors must be accessible inside the open confirmation dialog.
test('verification error remains accessible in the confirmation dialog', async ({ page }) => {
  const fixture = await createEntryFixture('active');
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await page.goto('/settings/pair');
    // Skip the second email during the Auth send limit. Local Auth rejects the wrong code.
    await page.route('**/auth/v1/otp*', route => route.fulfill({ json: {} }));
    await page.getByRole('button', { name: 'Send code to end pair', exact: true }).click();
    await page.getByLabel('Email verification code').fill('000000');
    await page.getByRole('button', { name: 'End pair', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm ending pair', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'End this pair?', exact: true });
    await expect(dialog.getByRole('alert')).toHaveText('The code is invalid or expired. Request a new code.');
    await page.getByRole('button', { name: 'Close end this pair?', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('The code is invalid or expired. Request a new code.');
  } finally { await cleanupEntryFixture(fixture); }
});
