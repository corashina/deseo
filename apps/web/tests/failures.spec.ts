import { test, expect } from '@playwright/test';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';
import { confirmNavigation } from './support/navigation';
import { clickSidebar } from './support/navigation';

// Importance 95: lost acknowledgements must preserve immutable commands through focus and route remount.
for (const feature of ['event', 'task', 'idea'] as const) {
  test(feature + ' uncertain save unlocks on scope abort and survives remount', async ({ page }) => {
    const ids = await createPortalPairFixture();
    let release = () => {};
    try {
      await loginWithLocalEmailCode(page, ids.annaEmail);
      await page.goto('/' + feature + 's/new');
      await page.getByLabel('Title', { exact: true }).fill('Uncertain ' + feature);
      const bodies: unknown[] = [];
      let reached = () => {};
      const serverSaved = new Promise<void>(resolve => { reached = resolve; });
      const response = new Promise<void>(resolve => { release = resolve; });
      await page.route('**/rest/v1/rpc/' + (feature === 'idea' ? 'create_date_idea' : 'create_' + feature), async route => {
        bodies.push(route.request().postDataJSON());
        if (bodies.length === 1) { await route.fetch(); reached(); await response; await route.abort(); }
        else await route.continue();
      });
      await page.getByRole('button', { name: 'Save ' + feature, exact: true }).click();
      await serverSaved;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
      await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
      await confirmNavigation(page, () => page.getByRole('link', { name: 'Cancel', exact: true }).click(), true);
      await page.getByRole('link', { name: 'Add ' + feature, exact: true }).click();
      await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Uncertain ' + feature);
      release();
      await page.getByRole('button', { name: 'Retry save', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Uncertain ' + feature, exact: true })).toBeVisible();
      expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
      const partner = await portalClient(ids.marekEmail);
      const table = feature === 'idea' ? 'date_ideas' : feature + 's';
      const rows = await partner.from(table).select('id').eq('pair_id', ids.pairId).eq('title', 'Uncertain ' + feature);
      expect(rows.data).toHaveLength(1);
    } finally { release(); await cleanupPortalPairFixture(ids); }
  });
}

// Importance 95: reconnect must retain editable input and require a deliberate write.
test('offline forms retain input and reconnect never submits them', async ({ page, context }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    for (const [path, label, button] of [
      ['/events/new', 'Title', 'Save event'], ['/tasks/new', 'Title', 'Save task'],
      ['/ideas/new', 'Title', 'Save idea'], ['/memories/new', 'Caption', 'Publish memory'],
      ['/settings/profile', 'Your name', 'Save profile'],
      ['/settings/notifications', 'Notification timezone', 'Save preferences'],
      ['/tasks/lists', 'List name', 'Create list'],
    ]) {
      await page.goto(path);
      const input = page.getByLabel(label, { exact: true });
      await input.fill(label === 'Notification timezone' ? 'Europe/London' : 'Offline input');
      await context.setOffline(true);
      await expect(page.getByRole('button', { name: button, exact: true })).toBeDisabled();
      await expect(input).toHaveValue(label === 'Notification timezone' ? 'Europe/London' : 'Offline input');
      let writes = 0;
      const listener = (request: import('@playwright/test').Request) => { if (request.method() === 'POST' && /\/rpc\/(create_|update_|save_|set_)/.test(request.url())) writes++; };
      page.on('request', listener);
      await context.setOffline(false);
      await expect(page.getByRole('button', { name: button, exact: true })).toBeEnabled();
      await expect(input).toHaveValue(label === 'Notification timezone' ? 'Europe/London' : 'Offline input');
      expect(writes).toBe(0); page.off('request', listener);
      await confirmNavigation(page, () => page.getByRole('link', { name: 'Cancel', exact: true }).or(page.getByRole('link', { name: 'Return to settings', exact: true })).or(page.getByRole('link', { name: 'Return to tasks', exact: true })).first().click(), true);
    }
  } finally { await context.setOffline(false); await cleanupPortalPairFixture(ids); }
});

// Importance 95: Escape and Close must not dismiss a confirmation during an unresolved destructive request.
test('pending destructive confirmation blocks Escape and Close', async ({ page }) => {
  const ids = await createPortalPairFixture();
  let release = () => {};
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/' + ids.sharedEventId);
    let reached = () => {};
    const arrived = new Promise<void>(resolve => { reached = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/rest/v1/rpc/delete_event', async route => { reached(); await resume; await route.continue(); });
    await page.getByRole('button', { name: 'Delete event', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await arrived;
    const dialog = page.getByRole('dialog', { name: 'Delete this event?', exact: true });
    await expect(dialog.getByRole('button', { name: 'Close delete this event?', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
    release(); await expect(page).toHaveURL(/\/calendar$/);
  } finally { release(); await cleanupPortalPairFixture(ids); }
});

// Importance 95: an uncertain deletion must keep its original receipt through route Back.
test('event deletion keeps its receipt after focus and route Back', async ({ page }) => {
  const ids = await createPortalPairFixture();
  let release = () => {};
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/' + ids.sharedEventId);
    const bodies: unknown[] = [];
    let saved = () => {}; let finished = () => {};
    const reached = new Promise<void>(resolve => { saved = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    const returned = new Promise<void>(resolve => { finished = resolve; });
    await page.route('**/rest/v1/rpc/delete_event', async route => {
      bodies.push(route.request().postDataJSON());
      if (bodies.length === 1) { await route.fetch(); saved(); await resume; await route.abort(); finished(); }
      else await route.continue();
    });
    await page.getByRole('button', { name: 'Delete event', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await reached;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('heading', { name: 'Event unavailable', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry deletion', exact: true })).toBeEnabled();
    await page.getByRole('link', { name: 'Return to calendar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Retry deletion', exact: true })).toBeEnabled();
    release(); await returned;
    await page.getByRole('button', { name: 'Retry deletion', exact: true }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
  } finally { release(); await cleanupPortalPairFixture(ids); }
});

// Importance 95: a late successful response must not erase a remounted uncertain form or change its route.
test('late task success cannot restore an unmounted page or clear its retained attempt', async ({ page }) => {
  const ids = await createPortalPairFixture();
  let release = () => {};
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/tasks/new');
    await page.getByLabel('Title', { exact: true }).fill('Late task');
    const bodies: unknown[] = [];
    let saved = () => {}; let finished = () => {};
    const reached = new Promise<void>(resolve => { saved = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    const returned = new Promise<void>(resolve => { finished = resolve; });
    await page.route('**/rest/v1/rpc/create_task', async route => {
      bodies.push(route.request().postDataJSON());
      if (bodies.length === 1) { const response = await route.fetch(); saved(); await resume; await route.fulfill({ response }); finished(); }
      else await route.continue();
    });
    await page.getByRole('button', { name: 'Save task', exact: true }).click();
    await reached;
    await confirmNavigation(page, () => page.getByRole('link', { name: 'Cancel', exact: true }).click(), true);
    await page.getByRole('link', { name: 'Add task', exact: true }).click();
    release(); await returned;
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
    await expect(page).toHaveURL(/\/tasks\/new/);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Late task');
    // Reopen once more after the late response. The retained store must still contain the attempt.
    await confirmNavigation(page, () => page.getByRole('link', { name: 'Cancel', exact: true }).click(), true);
    await expect(page.getByRole('link', { name: 'Details: Late task', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Add task', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Late task');
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Late task', exact: true })).toBeVisible();
    expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
  } finally { release(); await cleanupPortalPairFixture(ids); }
});

// Importance 95: forbidden reads must not erase an already confirmed deletion intent and its uncertain receipt.
for (const feature of ['event', 'task'] as const) {
  test(feature + ' forbidden read keeps an uncertain deletion replay', async ({ page }) => {
    const ids = await createPortalPairFixture();
    let release = () => {};
    try {
      await loginWithLocalEmailCode(page, ids.annaEmail);
      await page.goto('/' + feature + 's/' + (feature === 'event' ? ids.sharedEventId : ids.taskId));
      const bodies: unknown[] = [];
      let saved = () => {}; let finished = () => {};
      const reached = new Promise<void>(resolve => { saved = resolve; });
      const resume = new Promise<void>(resolve => { release = resolve; });
      const returned = new Promise<void>(resolve => { finished = resolve; });
      await page.route('**/rest/v1/rpc/delete_' + feature, async route => {
        bodies.push(route.request().postDataJSON());
        if (bodies.length === 1) { await route.fetch(); saved(); await resume; await route.abort(); finished(); }
        else await route.continue();
      });
      await page.getByRole('button', { name: 'Delete ' + feature, exact: true }).click();
      await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
      await reached;
      await page.route('**/rest/v1/' + feature + 's?*', route => route.fulfill({ status: 403, json: { code: 'FORBIDDEN', message: 'Denied record detail' } }));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(page.getByRole('heading', { name: feature[0].toUpperCase() + feature.slice(1) + ' unavailable', exact: true })).toBeVisible();
      await expect(page.getByText('Denied record detail', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Retry deletion', exact: true })).toBeEnabled();
      release(); await returned;
      await page.unroute('**/rest/v1/' + feature + 's?*');
      await page.getByRole('button', { name: 'Retry deletion', exact: true }).click();
      await expect(page).toHaveURL(feature === 'event' ? /\/calendar$/ : /\/tasks$/);
      expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
    } finally { release(); await cleanupPortalPairFixture(ids); }
  });
}

// Importance 95: an unresolved note action must survive remount without copying rows or accepting another action.
test('lost unpin acknowledgement keeps its command through focus and remount', async ({ page }) => {
  const ids = await createPortalPairFixture();
  let release = () => {};
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/messages');
    const bodies: unknown[] = [];
    let saved = () => {}; let finished = () => {};
    const reached = new Promise<void>(resolve => { saved = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    const returned = new Promise<void>(resolve => { finished = resolve; });
    await page.route('**/rest/v1/rpc/unpin_message', async route => {
      bodies.push(route.request().postDataJSON());
      if (bodies.length === 1) { await route.fetch(); saved(); await resume; await route.abort(); finished(); }
      else await route.continue();
    });
    await page.locator('[data-message-id="' + ids.annaMessageId + '"]').getByRole('button', { name: 'Unpin note', exact: true }).click();
    await reached;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByRole('button', { name: 'Retry change', exact: true })).toBeEnabled();
    await expect(page.locator('[data-message-id="' + ids.annaMessageId + '"]').getByRole('button', { name: 'Pin note', exact: true })).toBeDisabled();
    await clickSidebar(page, 'Today');
    await page.getByRole('link', { name: 'Reply', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry change', exact: true })).toBeEnabled();
    await expect(page.locator('[data-message-id="' + ids.annaMessageId + '"]').getByRole('button', { name: 'Delete message', exact: true })).toBeDisabled();
    release(); await returned;
    await page.getByRole('button', { name: 'Retry change', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry change', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-message-id="' + ids.annaMessageId + '"]').getByRole('button', { name: 'Pin note', exact: true })).toBeEnabled();
    expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
  } finally { release(); await cleanupPortalPairFixture(ids); }
});
