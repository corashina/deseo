import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const { wallTimeChoices, resolveWallTime } = createRequire(import.meta.url)('@deseo/domain/calendar') as typeof import('@deseo/domain/calendar');
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';
import { randomUUID } from 'node:crypto';
// Importance: paired writes and conflicts 98; privacy 100; dates 96; responsive layout 92.
test('Warsaw daylight-saving requires an explicit valid time', () => {
  expect(() => wallTimeChoices('2026-03-29', '02:30', 'Europe/Warsaw')).toThrow();
  expect(wallTimeChoices('2026-10-25', '02:30', 'Europe/Warsaw')).toHaveLength(2);
  expect(() => resolveWallTime('2026-10-25', '02:30', 'Europe/Warsaw')).toThrow();
  expect(resolveWallTime('2026-10-25', '02:30', 'Europe/Warsaw', 120)).not.toBe(resolveWallTime('2026-10-25', '02:30', 'Europe/Warsaw', 60));
});
test('paired calendar persists shared writes and protects private events', async ({ page, browser }, testInfo) => {
  const ids = await createPortalPairFixture();
  const partner = await browser.newContext();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/calendar?view=month&date=2026-10-05&owner=all');
    await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Add event', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Shared test dinner');
    await page.screenshot({ path: testInfo.outputPath('event-new.png'), fullPage: true });
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Shared test dinner', exact: true })).toBeVisible();
    await expect(page.getByLabel('Remind me')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('event-detail.png'), fullPage: true });
    const url = page.url();
    const second = await partner.newPage();
    await loginWithLocalEmailCode(second, ids.marekEmail);
    await second.goto(url);
    await second.reload();
    await expect(second.getByRole('heading', { name: 'Shared test dinner', exact: true })).toBeVisible();
    await second.goto('/events/' + ids.privateEventId);
    await expect(second.getByRole('heading', { name: 'Event unavailable' })).toBeVisible();
    for (const view of ['month', 'agenda', 'compare']) {
      await page.goto('/calendar?view=' + view + '&date=2026-10-05&owner=all');
      if (view === 'month' && (page.viewportSize()?.width ?? 1440) < 768) await page.getByRole('button', { name: '10 October 2026', exact: true }).click();
      await expect(page.getByText('Weekend walk', { exact: true }).filter({ visible: true }).first()).toBeVisible();
      if (view === 'month' && (page.viewportSize()?.width ?? 1440) < 768) await page.getByRole('button', { name: '5 October 2026', exact: true }).click();
      await expect(page.getByText('Autumn break', { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('calendar-' + view + '.png'), fullPage: true });
    }
    expect(await page.locator('.view-tabs button').first().evaluate(button => getComputedStyle(button).borderRadius)).toBe('12px');
    expect(await page.locator('.owner-filters button').first().evaluate(button => getComputedStyle(button).borderRadius)).toBe('12px');
    for (const width of [320, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 320) expect(await page.locator('.calendar-card').evaluate(card => getComputedStyle(card).padding)).toBe('20px');
    }
  } finally { await partner.close(); await cleanupPortalPairFixture(ids); }
});
test('replayed commands create once and stale edits keep the draft', async ({ page }, testInfo) => {
  const ids = await createPortalPairFixture();
  try {
    const anna = await portalClient(ids.annaEmail);
    const input = { id: randomUUID(), pair_id: ids.pairId, title: 'Replay dinner', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', starts_at: '2026-10-05T16:00:00Z', ends_at: '2026-10-05T18:00:00Z', repeat: 'none' };
    const command = randomUUID();
    const first = await anna.rpc('create_event', { p_input: input, p_command_id: command });
    const replay = await anna.rpc('create_event', { p_input: input, p_command_id: command });
    expect(first.data.ok).toBe(true); expect(replay.data.data.id).toBe(input.id);
    expect((await anna.from('events').select('id').eq('id', input.id)).data).toHaveLength(1);
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/' + input.id + '/edit');
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Replay dinner');
    await page.screenshot({ path: testInfo.outputPath('event-edit.png'), fullPage: true });
    await page.getByLabel('Title', { exact: true }).fill('My unsaved dinner');
    await anna.rpc('update_event', { p_event_id: input.id, p_input: { ...input, title: 'Server changed dinner' }, p_expected_version: 1, p_command_id: randomUUID() });
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('This event changed. Your draft is kept.')).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('My unsaved dinner');
    await page.screenshot({ path: testInfo.outputPath('event-conflict.png'), fullPage: true });
  } finally { await cleanupPortalPairFixture(ids); }
});



// Importance 98: event edits, all-day ends, sharing, reminders, and deletion persist.
test('event controls preserve all-day dates, confirm sharing, and delete through commands', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/' + ids.privateEventId + '/edit');
    await page.getByLabel('Visibility').selectOption('shared');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Share this event?' })).toBeVisible();
    await page.getByRole('button', { name: 'Share event', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Anna’s private appointment', exact: true })).toBeVisible();
    const marek = await portalClient(ids.marekEmail);
    expect((await marek.from('events').select('id').eq('id', ids.privateEventId)).data).toHaveLength(1);
    await page.goto('/events/' + ids.breakEventId + '/edit');
    await expect(page.getByLabel('End date', { exact: true })).toHaveValue('2026-10-06');
    await page.getByLabel('End date', { exact: true }).fill('2026-10-08');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Autumn break', exact: true })).toBeVisible();
    expect((await marek.from('events').select('end_date_exclusive').eq('id', ids.breakEventId).single()).data?.end_date_exclusive).toBe('2026-10-09');
    await page.getByLabel('Remind me').selectOption('60');
    await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
    await expect(page.getByText('Reminder saved.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Remind me')).toHaveValue('60');
    await page.getByRole('button', { name: 'Delete event', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await expect(page).toHaveURL(/\/calendar/);
    expect((await marek.from('events').select('id').eq('id', ids.breakEventId)).data).toHaveLength(0);
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 100: offline submission stays disabled and entered input survives.
test('offline form keeps input and cannot submit', async ({ page, context }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/new?date=2026-10-05');
    await page.getByLabel('Title', { exact: true }).fill('Offline draft');
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Save event', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Offline draft');
    await context.setOffline(false);
    await expect(page.getByRole('button', { name: 'Save event', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Offline draft', exact: true })).toBeVisible();
  } finally { await context.setOffline(false); await cleanupPortalPairFixture(ids); }
});
// Importance 98: a lost acknowledgement and focus recheck cannot duplicate a saved event.
test('lost save acknowledgement keeps its command and retries after focus', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/new?date=2026-10-05');
    await page.getByLabel('Title', { exact: true }).fill('Unconfirmed dinner');
    const bodies: Array<{ p_command_id: string; p_input: { id: string } }> = [];
    await page.route('**/rest/v1/rpc/create_event', async route => {
      bodies.push(route.request().postDataJSON());
      if (bodies.length === 1) {
        await route.fetch();
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await route.abort();
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Save event', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Unconfirmed dinner', exact: true })).toBeVisible();
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
    const marek = await portalClient(ids.marekEmail);
    expect((await marek.from('events').select('id').eq('id', bodies[0].p_input.id)).data).toHaveLength(1);
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 96: date edits clear stale DST offsets and require a new overlap choice.
test('date-only edits cross DST and require fresh repeated-hour choices', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    const anna = await portalClient(ids.annaEmail);
    const eventId = randomUUID();
    const saved = await anna.rpc('create_event', {
      p_input: { id: eventId, pair_id: ids.pairId, title: 'Early plan', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', starts_at: '2026-10-05T00:30:00Z', ends_at: '2026-10-05T00:45:00Z', repeat: 'none' },
      p_command_id: randomUUID(),
    });
    expect(saved.data.ok).toBe(true);
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/' + eventId + '/edit');
    await page.getByLabel('Start date', { exact: true }).fill('2026-11-05');
    await page.getByLabel('End date', { exact: true }).fill('2026-11-05');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Early plan', exact: true })).toBeVisible();
    const november = await anna.from('events').select('starts_at,ends_at').eq('id', eventId).single();
    expect(new Date(november.data!.starts_at).toISOString()).toBe('2026-11-05T01:30:00.000Z');
    expect(new Date(november.data!.ends_at).toISOString()).toBe('2026-11-05T01:45:00.000Z');

    await page.getByRole('link', { name: 'Edit event', exact: true }).click();
    await page.getByLabel('Start date', { exact: true }).fill('2026-10-25');
    await page.getByLabel('End date', { exact: true }).fill('2026-10-25');
    await expect(page.getByLabel('Start occurrence')).toHaveValue('');
    await expect(page.getByLabel('End occurrence')).toHaveValue('');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await page.getByLabel('Start occurrence').selectOption('120');
    await page.getByLabel('End occurrence').selectOption('120');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Early plan', exact: true })).toBeVisible();
    const october = await anna.from('events').select('starts_at,ends_at').eq('id', eventId).single();
    expect(new Date(october.data!.starts_at).toISOString()).toBe('2026-10-25T00:30:00.000Z');
    expect(new Date(october.data!.ends_at).toISOString()).toBe('2026-10-25T00:45:00.000Z');
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 96: mounted repeated-hour selectors require a fresh choice after each edit.
for (const edit of ['date', 'time'] as const) {
  test(`mounted repeated-hour selectors clear choices after ${edit} edits`, async ({ page }) => {
    const ids = await createPortalPairFixture();
    try {
      const anna = await portalClient(ids.annaEmail);
      const eventId = randomUUID();
      const saved = await anna.rpc('create_event', {
        p_input: { id: eventId, pair_id: ids.pairId, title: 'Repeated hour plan', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', starts_at: '2026-10-25T00:30:00Z', ends_at: '2026-10-25T00:45:00Z', repeat: 'none' },
        p_command_id: randomUUID(),
      });
      expect(saved.data.ok).toBe(true);
      await loginWithLocalEmailCode(page, ids.annaEmail);
      await page.goto('/events/' + eventId + '/edit');
      await page.getByLabel('Start occurrence').selectOption('120');
      await page.getByLabel('End occurrence').selectOption('120');
      const startSelector = await page.getByLabel('Start occurrence').elementHandle();
      const endSelector = await page.getByLabel('End occurrence').elementHandle();
      if (edit === 'date') {
        await page.getByLabel('Start date', { exact: true }).fill('2027-10-31');
        await page.getByLabel('End date', { exact: true }).fill('2027-10-31');
      } else {
        await page.getByLabel('Start time', { exact: true }).fill('02:35');
        await page.getByLabel('End time', { exact: true }).fill('02:50');
      }
      expect(await startSelector!.evaluate(element => element.isConnected)).toBe(true);
      expect(await endSelector!.evaluate(element => element.isConnected)).toBe(true);
      await expect(page.getByLabel('Start occurrence')).toHaveValue('');
      await expect(page.getByLabel('End occurrence')).toHaveValue('');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Choose the first or second time below.' })).toHaveCount(2);
      await page.getByLabel('Start occurrence').selectOption('120');
      await page.getByLabel('End occurrence').selectOption('120');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Repeated hour plan', exact: true })).toBeVisible();
      const persisted = await anna.from('events').select('starts_at,ends_at,version').eq('id', eventId).single();
      expect(persisted.data!.version).toBe(2);
      expect(new Date(persisted.data!.starts_at).toISOString()).toBe(edit === 'date' ? '2027-10-31T00:30:00.000Z' : '2026-10-25T00:35:00.000Z');
      expect(new Date(persisted.data!.ends_at).toISOString()).toBe(edit === 'date' ? '2027-10-31T00:45:00.000Z' : '2026-10-25T00:50:00.000Z');
    } finally { await cleanupPortalPairFixture(ids); }
  });
}

// Importance 98: pending reminders keep command, payload, and version through remounts.
for (const changed of [true, false]) {
  test(`reminder lost acknowledgement survives focus remount with ${changed ? 'changed' : 'unchanged'} choice`, async ({ page }) => {
    const ids = await createPortalPairFixture();
    let releaseAcknowledgement = () => {};
    try {
      const anna = await portalClient(ids.annaEmail);
      const initial = await anna.rpc('set_reminder', {
        p_input: { id: randomUUID(), pairId: ids.pairId, eventId: ids.sharedEventId, taskId: null, minutesBefore: 15, remindAt: null, active: true, expectedVersion: null },
        p_command_id: randomUUID(),
      });
      expect(initial.data.ok).toBe(true);
      await loginWithLocalEmailCode(page, ids.annaEmail);
      await page.goto('/events/' + ids.sharedEventId);
      await expect(page.getByLabel('Remind me')).toHaveValue('15');
      if (changed) await page.getByLabel('Remind me').selectOption('60');

      const bodies: Array<{ p_command_id: string; p_input: { id: string; expectedVersion: number } }> = [];
      let saveReachedServer = () => {};
      const serverSaved = new Promise<void>(resolve => { saveReachedServer = resolve; });
      const acknowledgement = new Promise<void>(resolve => { releaseAcknowledgement = resolve; });
      await page.route('**/rest/v1/rpc/set_reminder', async route => {
        bodies.push(route.request().postDataJSON());
        if (bodies.length === 1) {
          await route.fetch();
          saveReachedServer();
          await acknowledgement;
          await route.abort();
        } else await route.continue();
      });
      await page.getByRole('button', { name: 'Save reminder', exact: true }).click();
      await serverSaved;
      page.once('dialog', dialog => void dialog.accept());
      await page.getByRole('link', { name: 'Return to calendar', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.getByRole('link', { name: /Dinner together/ }).first().click();
      await expect(page.getByRole('button', { name: 'Retry reminder', exact: true })).toBeEnabled();
      await expect(page.getByLabel('Remind me')).toBeDisabled();
      await expect(page.getByLabel('Remind me')).toHaveValue(changed ? '60' : '15');
      releaseAcknowledgement();
      await page.getByRole('button', { name: 'Retry reminder', exact: true }).click();
      await expect(page.getByText('Reminder saved.', { exact: true })).toBeVisible();
      expect(bodies).toHaveLength(2);
      expect(bodies[1]).toEqual(bodies[0]);
      expect(bodies[0].p_input.expectedVersion).toBe(initial.data.data.version);
      const persisted = await anna.from('reminders').select('id,version,minutes_before').eq('event_id', ids.sharedEventId).eq('user_id', ids.annaId);
      expect(persisted.data).toHaveLength(1);
      expect(persisted.data![0].version).toBe(initial.data.data.version + 1);
      expect(persisted.data![0].minutes_before).toBe(changed ? 60 : 15);
    } finally { releaseAcknowledgement(); await cleanupPortalPairFixture(ids); }
  });
}
