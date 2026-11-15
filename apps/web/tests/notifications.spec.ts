import { test, expect } from './support/test';

// Importance 92: reminder settings save in the browser, and the portal never asks for push permission.
test('notification settings save without browser push permission', async ({ page, account, signIn }) => {
  const a = await account();
  await page.addInitScript(() => {
    const calls = { permission: 0, subscribe: 0 };
    Object.assign(window, { pushCalls: calls });
    if ('Notification' in window) Notification.requestPermission = async () => { calls.permission++; return 'denied'; };
    if ('PushManager' in window) PushManager.prototype.subscribe = async () => { calls.subscribe++; throw new Error('Blocked by test'); };
  });
  page.on('dialog', dialog => { throw new Error('Unexpected dialog: ' + dialog.message()); });
  await signIn(page, a);
  await page.goto('/settings/notifications');
  await page.getByLabel('Message alerts').setChecked(false);
  await page.getByLabel('Default event reminder').selectOption('60');
  await page.getByLabel('Quiet hours', { exact: true }).check();
  await page.getByLabel('Quiet hours start').fill('23:00');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByText('Preferences saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Message alerts')).not.toBeChecked();
  await expect(page.getByLabel('Default event reminder')).toHaveValue('60');
  await expect(page.getByLabel('Quiet hours start')).toHaveValue('23:00');
  expect(await page.evaluate(() => (window as unknown as { pushCalls: object }).pushCalls)).toEqual({ permission: 0, subscribe: 0 });
});
