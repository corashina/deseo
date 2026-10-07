import { test, expect } from '@playwright/test';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';
import { admin } from './support/entry-fixtures';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
// Importance 96: reminders use supported offsets and stored event timezone.
test('reminders use supported choices and all-day 09:00', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    const client = await portalClient(ids.annaEmail);
    const eventId = randomUUID();
    const created = await client.rpc('create_event', { p_input: { id: eventId, pair_id: ids.pairId, title: 'Future all-day event', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', start_date: '2030-10-05', end_date_exclusive: '2030-10-06', repeat: 'none' }, p_command_id: randomUUID() });
    expect(created.data.ok).toBe(true);
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/' + eventId);
    await expect(page.getByLabel('Remind me')).toBeVisible();
    expect(await page.getByLabel('Remind me').locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(['none', '15', '60', '1440']);
    await page.getByLabel('Remind me').selectOption('60');
    await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
    await expect(page.getByText('Reminder saved.', { exact: true })).toBeVisible();
    const reminder = await client.rpc('get_reminder', { p_event_id: eventId, p_task_id: null });
    expect(reminder.data.ok).toBe(true);
    expect(reminder.data.data.minutesBefore).toBe(60);
    expect(new Date(reminder.data.data.nextDueAt).toISOString()).toBe('2030-10-05T06:00:00.000Z');
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
    await expect(page.getByText('Your updates and reminders.')).toBeVisible();
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 100: notification links require current source access and mark only the viewer's row.
test('notification links reject deleted and private sources', async ({ page }, testInfo) => {
  const ids = await createPortalPairFixture();
  try {
    const notificationId = randomUUID();
    const row = { id: notificationId, user_id: ids.annaId, pair_id: ids.pairId, kind: 'event', source_id: ids.sharedEventId, occurrence: 'task-8-browser', source_version: 1, available_at: new Date().toISOString() };
    const inserted = await admin.from('notifications').insert(row); expect(inserted.error).toBeNull();
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'Event reminder' })).toBeVisible();
    const captures = fileURLToPath(new URL('../../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-8-captures', import.meta.url));
    await mkdir(captures, { recursive: true });
    await page.screenshot({ path: `${captures}/notifications-${testInfo.project.name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dinner together', exact: true })).toBeVisible();
    expect((await admin.from('notifications').select('read_at').eq('id', notificationId).single()).data?.read_at).not.toBeNull();
    await page.goBack();
    await expect(page.locator('main').getByText(/Unread/)).toHaveCount(0);
    await admin.from('events').delete().eq('id', ids.sharedEventId);
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.getByText('This content is unavailable. Your pair or the source changed.')).toBeVisible();
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await page.screenshot({ path: `${captures}/settings-${testInfo.project.name}.png`, fullPage: true });
    for (const route of ['profile', 'pair', 'notifications', 'account']) {
      await page.goto('/settings/' + route);
      await expect(page.locator('main h1')).toBeVisible();
      if (route === 'notifications') await expect(page.getByLabel('Notification timezone')).toBeVisible();
      await page.screenshot({ path: `${captures}/settings-${route}-${testInfo.project.name}.png`, fullPage: true });
    }
    for (const width of [320, 768, 1024]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  } finally { await cleanupPortalPairFixture(ids); }
});


// Importance 100: focus keeps reminder IDs, versions, and command payloads immutable.
test('reminder retry keeps its attempt through focus and a late response', async ({ page }) => {
  const ids = await createPortalPairFixture();
  let release = () => {};
  const released = new Promise<void>(resolve => { release = resolve; });
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/' + ids.sharedEventId);
    await page.getByLabel('Remind me').selectOption('60');
    const attempts: unknown[] = [];
    await page.route('**/rest/v1/rpc/set_reminder', async route => {
      attempts.push(route.request().postDataJSON());
      if (attempts.length === 1) {
        await route.fetch();
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await expect(page.getByRole('button', { name: 'Retry reminder', exact: true })).toBeEnabled();
        await released;
        await route.abort();
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry reminder', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Remind me')).toBeDisabled();
    await page.getByRole('button', { name: 'Retry reminder', exact: true }).click();
    await expect(page.getByText('Reminder saved.', { exact: true })).toBeVisible();
    expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
    release();
    await expect(page.getByLabel('Remind me')).toHaveValue('60');
    await expect(page.getByLabel('Remind me')).toBeEnabled();
  } finally { release(); await cleanupPortalPairFixture(ids); }
});

// Importance 100: read failures remain recoverable, and a revoked private source cannot open.
test('notification errors recover and private destinations remain unavailable', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    const notificationId = randomUUID();
    expect((await admin.from('notifications').insert({ id: notificationId, user_id: ids.marekId, pair_id: ids.pairId, kind: 'event', source_id: ids.privateEventId, source_version: 1, occurrence: 'task-8-private', available_at: new Date().toISOString() })).error).toBeNull();
    await loginWithLocalEmailCode(page, ids.marekEmail);
    await page.route('**/rest/v1/rpc/list_notifications', route => route.fulfill({ status: 503, json: { message: 'Source unavailable' } }));
    await page.goto('/notifications');
    await expect(page.getByText('We could not load notifications.')).toBeVisible();
    await page.unroute('**/rest/v1/rpc/list_notifications');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Event reminder', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.getByText('This content is unavailable. Your pair or the source changed.')).toBeVisible();
    expect((await admin.from('notifications').select('read_at').eq('id', notificationId).single()).data?.read_at).toBeNull();
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 96: task reminders store an explicit instant in the pair timezone.
test('task reminders save the chosen time and block completed tasks', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/tasks/' + ids.taskId);
    await page.getByLabel('Task reminder', { exact: true }).check();
    await page.getByLabel('Reminder date').fill('2030-10-05');
    await page.getByLabel('Reminder time').fill('10:00');
    await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
    await expect(page.getByText('Reminder saved.', { exact: true })).toBeVisible();
    const client = await portalClient(ids.annaEmail);
    const reminder = await client.rpc('get_reminder', { p_event_id: null, p_task_id: ids.taskId });
    expect(reminder.data.data.remindAt).toBe('2030-10-05T08:00:00+00:00');
    await admin.from('tasks').update({ completed_at: new Date().toISOString(), completed_by: ids.annaId }).eq('id', ids.taskId);
    await page.reload();
    await expect(page.getByText('Completed tasks do not send reminders.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save reminder', exact: true })).toBeDisabled();
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 100: rejection releases the attempt, while conflicts require current state before another write.
test('reminder rejection preserves choice and conflict reload creates a new attempt', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/' + ids.sharedEventId);
    await page.getByLabel('Remind me').selectOption('60');
    const attempts: { p_input: { id: string; expectedVersion: number | null }; p_command_id: string }[] = [];
    await page.route('**/rest/v1/rpc/set_reminder', async route => {
      attempts.push(route.request().postDataJSON());
      if (attempts.length === 1) await route.fulfill({ json: { ok: false, error: { code: 'VALIDATION' } } });
      else await route.continue();
    });
    await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
    await expect(page.getByLabel('Remind me')).toBeEnabled();
    await expect(page.getByLabel('Remind me')).toHaveValue('60');
    await page.getByLabel('Remind me').selectOption('15');
    await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
    await expect(page.getByText('Reminder saved.', { exact: true })).toBeVisible();
    expect(attempts[1].p_command_id).not.toBe(attempts[0].p_command_id);
    await page.getByLabel('Remind me').selectOption('1440');
    const client = await portalClient(ids.annaEmail);
    const current = (await client.rpc('get_reminder', { p_event_id: ids.sharedEventId, p_task_id: null })).data.data;
    expect((await client.rpc('set_reminder', { p_input: { id: current.id, pairId: ids.pairId, eventId: ids.sharedEventId, taskId: null, active: true, minutesBefore: 60, remindAt: null, expectedVersion: current.version }, p_command_id: randomUUID() })).data.ok).toBe(true);
    await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
    await expect(page.getByText('Your reminder changed. Your draft is kept.')).toBeVisible();
    await expect(page.getByLabel('Remind me')).toHaveValue('1440');
    await page.getByRole('button', { name: 'Discard changes and reload', exact: true }).click();
    await expect(page.getByLabel('Remind me')).toHaveValue('60');
    await page.getByLabel('Remind me').selectOption('1440');
    await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
    await expect(page.getByText('Reminder saved.', { exact: true })).toBeVisible();
    expect(attempts[3].p_input.expectedVersion).toBe(2);
    expect(attempts[3].p_command_id).not.toBe(attempts[2].p_command_id);
  } finally { await cleanupPortalPairFixture(ids); }
});
