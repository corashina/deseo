import { test, expect } from '@playwright/test';
import { createEntryFixture, cleanupEntryFixture, entryFixtureClient, admin } from './support/entry-fixtures';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';
// Importance 100: settings and sign-out remain available without an active pair.
test('unpaired accounts can save preferences and sign out', async ({ page }) => {
  const fixture = await createEntryFixture('unpaired');
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await page.goto('/settings/notifications');
    await expect(page.getByRole('heading', { name: 'Notification preferences', exact: true })).toBeVisible();
    await page.getByLabel('Message alerts').uncheck();
    await page.getByLabel('Default event reminder').selectOption('60');
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await expect(page.getByText('Preferences saved.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Message alerts')).not.toBeChecked();
    await expect(page.getByLabel('Default event reminder')).toHaveValue('60');
    await page.goto('/settings/account');
    await page.getByRole('button', { name: 'Sign out on this browser', exact: true }).click();
    await expect(page).toHaveURL(/\/welcome$/);
  } finally { await cleanupEntryFixture(fixture); }
});
// Importance 100: profile updates preserve event instants and detect stale edits.
test('profile edits preserve event instants', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    const client = await portalClient(ids.annaEmail);
    const before = (await client.from('events').select('starts_at,ends_at,timezone').eq('id', ids.sharedEventId).single()).data;
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/settings/profile');
    await page.getByLabel('Your name').fill('Anna updated');
    await page.getByLabel('Timezone', { exact: true }).fill('America/New_York');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await expect(page.getByText('Profile saved.', { exact: true })).toBeVisible();
    expect((await client.from('events').select('starts_at,ends_at,timezone').eq('id', ids.sharedEventId).single()).data).toEqual(before);
    await page.reload();
    await expect(page.getByLabel('Your name')).toHaveValue('Anna updated');
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 100: focus unlocks immutable settings attempts before late replies arrive.
for (const kind of ['profile', 'preferences'] as const) {
  test(`${kind} save survives focus and reconciles a lost response`, async ({ page }) => {
    const fixture = await createEntryFixture('unpaired');
    let release = () => {};
    const released = new Promise<void>(resolve => { release = resolve; });
    try {
      await loginWithLocalEmailCode(page, fixture.email);
      await page.goto(kind === 'profile' ? '/settings/profile' : '/settings/notifications');
      const input = page.getByLabel(kind === 'profile' ? 'Your name' : 'Notification timezone', { exact: true });
      await input.fill(kind === 'profile' ? 'Saved after focus' : 'America/New_York');
      const attempts: unknown[] = [];
      const command = kind === 'profile' ? 'save_profile' : 'save_notification_preferences';
      const retry = page.getByRole('button', { name: kind === 'profile' ? 'Retry profile' : 'Retry preferences', exact: true });
      await page.route('**/rest/v1/rpc/' + command, async route => {
        attempts.push(route.request().postDataJSON());
        if (attempts.length === 1) {
          await route.fetch();
          await page.evaluate(() => window.dispatchEvent(new Event('focus')));
          await expect(retry).toBeEnabled();
          await released;
          await route.abort();
        } else await route.continue();
      });
      await page.getByRole('button', { name: kind === 'profile' ? 'Save profile' : 'Save preferences', exact: true }).click();
      await expect(retry).toBeEnabled();
      await expect(input).toBeDisabled();
      await retry.click();
      await expect(page.getByText(kind === 'profile' ? 'Profile saved.' : 'Preferences saved.', { exact: true })).toBeVisible();
      release();
      expect(attempts).toHaveLength(1);
      await expect(input).toHaveValue(kind === 'profile' ? 'Saved after focus' : 'America/New_York');
      await expect(input).toBeEnabled();
    } finally { release(); await cleanupEntryFixture(fixture); }
  });
}

// Importance 100: failed native revocation must stay visible before global sign-out.
test('global sign-out retains controls when device revocation fails', async ({ page }) => {
  const fixture = await createEntryFixture('unpaired');
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await page.goto('/settings/account');
    await page.route('**/rest/v1/rpc/revoke_device', route => route.fulfill({ status: 503, json: { ok: false, error: { code: 'RETRYABLE' } } }));
    await page.getByRole('button', { name: 'Sign out on all devices', exact: true }).click();
    await expect(page.getByText('Sign-out failed. Try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out on all devices', exact: true })).toBeEnabled();
    await page.unroute('**/rest/v1/rpc/revoke_device');
    await page.getByRole('button', { name: 'Sign out on all devices', exact: true }).click();
    await expect(page).toHaveURL(/\/welcome$/);
  } finally { await cleanupEntryFixture(fixture); }
});

// Importance 100: definitive validation and version conflicts preserve drafts without retrying stale writes.
test('preferences validation and conflict require a deliberate new attempt', async ({ page }) => {
  const fixture = await createEntryFixture('unpaired');
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await page.goto('/settings/notifications');
    await page.getByLabel('Notification timezone').fill('Invalid/Timezone');
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await expect(page.getByLabel('Notification timezone')).toBeEnabled();
    await expect(page.getByLabel('Notification timezone')).toHaveValue('Invalid/Timezone');
    await page.getByLabel('Notification timezone').fill('America/New_York');
    const client = entryFixtureClient(fixture.email);
    const remote = await client.rpc('save_notification_preferences', { p_input: { messageAlerts: false, defaultEventReminderMinutes: 15, quietStart: null, quietEnd: null, timezone: 'Europe/Warsaw' }, p_expected_version: 0 });
    expect(remote.data.ok).toBe(true);
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await expect(page.getByText('Your preferences changed. Your draft is kept.')).toBeVisible();
    await expect(page.getByLabel('Notification timezone')).toHaveValue('America/New_York');
    await page.getByRole('button', { name: 'Discard changes and reload', exact: true }).click();
    await expect(page.getByLabel('Notification timezone')).toHaveValue('Europe/Warsaw');
    await page.getByLabel('Notification timezone').fill('America/New_York');
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await expect(page.getByText('Preferences saved.', { exact: true })).toBeVisible();
  } finally { await cleanupEntryFixture(fixture); }
});

// Importance 100: expired and disabled sessions must clear settings and direct shared links.
for (const state of ['expired', 'disabled'] as const) {
  test(`${state} session clears settings on focus`, async ({ page }) => {
    const fixture = await createEntryFixture('unpaired');
    try {
      await loginWithLocalEmailCode(page, fixture.email);
      await page.goto('/settings/profile');
      await page.getByLabel('Your name').fill('Private draft');
      if (state === 'expired') {
        await page.route('**/rest/v1/rpc/get_session_context', route => route.fulfill({ json: { ok: false, error: { code: 'UNAUTHENTICATED' } } }));
      } else {
        expect((await admin.from('profiles').update({ account_status: 'disabled' }).eq('user_id', fixture.accountIds[0])).error).toBeNull();
      }
      page.on('dialog', dialog => dialog.accept());
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(page).toHaveURL(/\/welcome$/);
      await expect(page.getByLabel('Your name')).toHaveCount(0);
      await page.goto('/settings/account'); await expect(page).toHaveURL(/\/welcome$/);
    } finally { await cleanupEntryFixture(fixture); }
  });
}



// Importance 90: preference controls need readable labels and usable pointer targets.
test('settings controls use the approved sizes at each viewport', async ({ page }) => {
  const fixture = await createEntryFixture('unpaired');
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await page.goto('/settings/notifications');
    for (const width of [1440, 390, 320, 768, 1024]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      const select = await page.getByLabel('Default event reminder').boundingBox();
      const checkbox = await page.getByLabel('Message alerts').boundingBox();
      expect(select!.height).toBeGreaterThanOrEqual(48);
      expect(checkbox!.width).toBeLessThanOrEqual(32);
      expect(checkbox!.height).toBeLessThanOrEqual(32);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  } finally { await cleanupEntryFixture(fixture); }
});

// Importance 100: focus unlocks global sign-out while the first revocation reply remains pending.
test('global sign-out focus unlocks a pending device revocation', async ({ page }) => {
  const fixture = await createEntryFixture('unpaired');
  let release = () => {};
  const released = new Promise<void>(resolve => { release = resolve; });
  let verifyUnlock = () => {};
  const unlocked = new Promise<void>(resolve => { verifyUnlock = resolve; });
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await page.goto('/settings/account');
    const attempts: unknown[] = [];
    const button = page.getByRole('button', { name: 'Sign out on all devices', exact: true });
    await page.route('**/rest/v1/rpc/revoke_device', async route => {
      attempts.push(route.request().postDataJSON());
      if (attempts.length === 1) {
        await route.fetch();
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await expect(button).toBeEnabled(); verifyUnlock();
        await released;
        await route.abort();
      } else await route.continue();
    });
    await button.click(); await unlocked;
    await button.click(); await expect(page).toHaveURL(/\/welcome$/);
    expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
  } finally { release(); await cleanupEntryFixture(fixture); }
});
