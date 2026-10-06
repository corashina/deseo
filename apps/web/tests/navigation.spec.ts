import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { loginWithLocalEmailCode, readLocalCode } from './support/local-auth';
import { confirmNavigation as guarded, clickSidebar } from './support/navigation';

// Importance 92: malformed, missing, and forbidden records must share safe recovery.
test('unknown routes and record IDs offer privacy-safe recovery', async ({ page }, info) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.marekEmail);
    const requests: string[] = [];
    page.on('request', request => { if (request.url().includes('/rest/v1/')) requests.push(request.url()); });
    for (const [path, title, target] of [
      ['events', 'Event', '/calendar'], ['tasks', 'Task', '/tasks'],
      ['ideas', 'Idea', '/ideas'], ['memories', 'Memory', '/memories'],
      ['tasks/lists', 'List', '/tasks/lists'],
    ]) {
      for (const suffix of ['', ...(path === 'tasks/lists' ? [] : ['/edit'])]) {
        await page.goto('/' + path + '/invalid-id' + suffix);
        await expect(page.getByRole('heading', { name: title + ' unavailable', exact: true })).toBeVisible();
        await expect(page.getByText('You cannot open this content.', { exact: true })).toBeVisible();
        await expect(page.locator('main a[href="' + target + '"]').last()).toBeVisible();
      }
    }
    expect(requests.some(url => url.includes('invalid-id'))).toBe(false);
    await page.goto('/events/' + ids.privateEventId);
    await expect(page.getByText('You cannot open this content.', { exact: true })).toBeVisible();
    expect((await page.getByRole('link', { name: 'Return to calendar', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await mkdir('../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-9-captures', { recursive: true });
    await page.screenshot({ path: '../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-9-captures/unavailable-' + info.project.name + '.png', fullPage: true });
    await page.goto('/events/00000000-0000-4000-8000-000000000001');
    await expect(page.getByText('You cannot open this content.', { exact: true })).toBeVisible();
    await page.goto('/no-such-route');
    await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to Deseo', exact: true })).toBeVisible();
    await mkdir('../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-9-captures', { recursive: true });
    await page.screenshot({ path: '../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-9-captures/not-found-' + info.project.name + '.png', fullPage: true });
    for (const width of [320, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 92: direct detail reload and guarded Back keep the server record and draft distinct.
test('detail reload, Back, sidebar, reload, and sign-out protect drafts', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    for (const [path, title] of [
      ['/events/' + ids.sharedEventId, 'Dinner together'], ['/tasks/' + ids.taskId, 'Book the pottery workshop'],
      ['/ideas/' + ids.ideaId, 'Pottery evening'], ['/memories/' + ids.memoryId, 'Our quiet walk through the park.'],
      ['/tasks/lists/' + ids.groceriesListId, 'Groceries'],
    ]) {
      await page.goto(path); await page.reload();
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.getByText('You cannot open this content.', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Keep this tab open and retry.', { exact: true })).toHaveCount(0);
    }
    await page.goto('/events/' + ids.sharedEventId);
    await page.getByRole('link', { name: 'Edit event', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Kept in memory');
    await guarded(page, () => page.goBack(), false);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Kept in memory');
    await guarded(page, () => page.goBack(), true);
    await page.getByRole('link', { name: 'Edit event', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Kept in memory');
    await guarded(page, () => page.getByRole('link', { name: 'Cancel', exact: true }).click(), false);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Kept in memory');
    // The browser cancels reload after dismissal. Playwright reload waits for a navigation that cannot finish.
    await guarded(page, () => page.evaluate(() => { setTimeout(() => location.reload(), 0); }), false);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Kept in memory');
    await guarded(page, () => clickSidebar(page, 'Settings'), false);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Kept in memory');
    // Close the narrow drawer after the cancelled account navigation.
    if (await page.getByRole('dialog', { name: 'Navigation', exact: true }).isVisible()) await page.keyboard.press('Escape');
    await guarded(page, () => clickSidebar(page, 'Settings'), true);
    // Retained drafts must still guard reload after the editor unmounts.
    await guarded(page, () => page.evaluate(() => { setTimeout(() => location.reload(), 0); }), false);
    await page.locator('main a[href="/settings/account"]').click();
    await page.getByRole('button', { name: 'Sign out on this browser', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome to Deseo', exact: true })).toBeVisible();
    const storage = await page.evaluate(() => ({ local: Object.values(localStorage), session: Object.values(sessionStorage) }));
    expect(JSON.stringify(storage)).not.toContain('Kept in memory');
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 95: request errors must offer a deliberate retry without exposing server details.
test('record request failure offers offline-safe recovery and hides server details', async ({ page }, info) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.route('**/rest/v1/events?*', route => route.fulfill({ status: 400, json: { code: 'PGRST000', message: 'Secret server detail' } }));
    await page.goto('/events/' + ids.sharedEventId);
    await expect(page.getByRole('heading', { name: 'We could not load this event', exact: true })).toBeVisible();
    await expect(page.getByText('Secret server detail', { exact: true })).toHaveCount(0);
    await mkdir('../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-9-captures', { recursive: true });
    await page.screenshot({ path: '../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-9-captures/request-error-' + info.project.name + '.png', fullPage: true });
    await page.context().setOffline(true);
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeDisabled();
    const rechecked = page.waitForResponse(response => new URL(response.url()).pathname === '/rest/v1/rpc/get_pair_context' && response.status() === 200);
    await page.context().setOffline(false);
    await rechecked;
    await expect(page.getByRole('heading', { name: 'We could not load this event', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
    await page.unroute('**/rest/v1/events?*');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dinner together', exact: true })).toBeVisible();
  } finally { await page.context().setOffline(false); await cleanupPortalPairFixture(ids); }
});

// Importance 95: real revocation must remove retained shared draft values and prepared private bytes.
test('pair revocation clears retained drafts and keeps ended account preferences usable', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/' + ids.sharedEventId + '/edit');
    await page.getByLabel('Title', { exact: true }).fill('Revoked event draft');
    await guarded(page, () => clickSidebar(page, 'Memories'), true);
    await page.getByRole('link', { name: 'Add memory', exact: true }).first().click();
    await page.getByLabel('Caption', { exact: true }).fill('Revoked photo draft');
    await page.getByLabel('Photos', { exact: true }).setInputFiles('../../supabase/dev/assets/sample-walk.jpg');
    await expect(page.getByRole('img', { name: 'Selected photo', exact: true })).toHaveCount(1);
    await guarded(page, () => page.getByRole('link', { name: 'Cancel', exact: true }).click(), true);
    const partner = await portalClient(ids.marekEmail);
    const request = async (code?: string) => {
      const response = await partner.functions.invoke('verify-sensitive-action', {
        body: { action: 'end_pair', ...(code ? { code } : {}) },
      });
      expect(response.error === null).toBe(true); expect(response.data?.ok === true).toBe(true); return response.data.data;
    };
    // Marek has used no email code in this case, so the provider's OTP window is clear.
    await request();
    const verified = await request(await readLocalCode(ids.marekEmail));
    const ended = await partner.rpc('end_pair', { p_pair_id: ids.pairId, p_verification_proof: verified.proof, p_command_id: randomUUID() });
    expect(ended.error).toBeNull(); expect(ended.data.ok).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page).toHaveURL(/\/pair\/ended$/);
    await expect(page.getByRole('img', { name: 'Selected photo', exact: true })).toHaveCount(0);
    let reloadDialogs = 0;
    const listen = (dialog: import('@playwright/test').Dialog) => { reloadDialogs++; void dialog.dismiss(); };
    page.on('dialog', listen);
    await page.reload();
    expect(reloadDialogs).toBe(0); page.off('dialog', listen);
    await page.goto('/settings/notifications');
    await page.getByLabel('Notification timezone').fill('Europe/London');
    let committed = () => {};
    const saved = new Promise<void>(resolve => { committed = resolve; });
    await page.route('**/rest/v1/rpc/save_notification_preferences', async route => {
      await route.fetch();
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(page.getByRole('button', { name: 'Retry preferences', exact: true })).toBeEnabled();
      await route.abort(); committed();
    });
    await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
    await saved;
    await page.getByRole('button', { name: 'Retry preferences', exact: true }).click();
    await expect(page.getByText('Preferences saved.', { exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByLabel('Notification timezone')).toHaveValue('Europe/London');
    await page.goto('/settings/account');
    await expect(page.getByRole('button', { name: 'Sign out on this browser', exact: true })).toBeVisible();
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 92: signed-out entry drafts must retain input through Back and guard a later reload.
test('email draft survives Back and guards reload after leaving the form', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('unsent@example.test');
  await guarded(page, () => page.getByRole('link', { name: 'Back', exact: true }).click(), true);
  await guarded(page, () => page.evaluate(() => { setTimeout(() => location.reload(), 0); }), false);
  await page.getByRole('link', { name: 'Continue with email', exact: true }).click();
  await expect(page.getByLabel('Email address')).toHaveValue('unsent@example.test');
});

// Importance 100: reads started during verification must abort before adopting verified pair closure.
test('pair closure cancels a held read started during account verification', async ({ page }) => {
  const ids = await createPortalPairFixture();
  let releasePair = () => {}; let releaseRead = () => {};
  try {
    // Manual verification must still close authority when the Realtime connection is unavailable.
    await page.routeWebSocket('**/realtime/v1/websocket*', socket => socket.close());
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/events/' + ids.sharedEventId);
    await expect(page.getByRole('heading', { name: 'Dinner together', exact: true })).toBeVisible();
    const partner = await portalClient(ids.marekEmail);
    const sent = await partner.functions.invoke('verify-sensitive-action', { body: { action: 'end_pair' } });
    expect(sent.error === null && sent.data?.ok === true).toBe(true);
    const verified = await partner.functions.invoke('verify-sensitive-action', { body: { action: 'end_pair', code: await readLocalCode(ids.marekEmail) } });
    expect(verified.error === null && verified.data?.ok === true).toBe(true);
    let pairRequested = () => {}; let readRequested = () => {}; let readFinished = () => {};
    const checking = new Promise<void>(resolve => { pairRequested = resolve; });
    const observed = new Promise<void>(resolve => { readRequested = resolve; });
    const returned = new Promise<void>(resolve => { readFinished = resolve; });
    const pairGate = new Promise<void>(resolve => { releasePair = resolve; });
    const readGate = new Promise<void>(resolve => { releaseRead = resolve; });
    let held: import('@playwright/test').Request | undefined;
    let cancelled = false;
    page.on('requestfailed', request => { if (request === held) cancelled = true; });
    await page.route('**/rest/v1/rpc/get_pair_context', async route => { pairRequested(); await pairGate; await route.continue(); });
    await page.route('**/rest/v1/rpc/list_agenda', async route => {
      held = route.request();
      const response = await route.fetch();
      const result = await response.json();
      expect(result.ok).toBe(true);
      expect(result.data.some((row: { id: string }) => row.id === ids.sharedEventId)).toBe(true);
      readRequested(); await readGate;
      try { if (!held.failure()) await route.fulfill({ response }); }
      finally { readFinished(); }
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await checking;
    // Open a page while verification waits, so it starts a real read under the previous authority.
    await clickSidebar(page, 'Calendar');
    await observed;
    const ended = await partner.rpc('end_pair', { p_pair_id: ids.pairId, p_verification_proof: verified.data.data.proof, p_command_id: randomUUID() });
    expect(ended.error === null && ended.data?.ok === true).toBe(true);
    releasePair();
    await expect(page).toHaveURL(/\/pair\/ended$/);
    await expect.poll(() => cancelled).toBe(true);
    releaseRead(); await returned;
    await expect(page.getByRole('heading', { name: 'Dinner together', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your pair has ended', exact: true })).toBeVisible();
  } finally { releasePair(); releaseRead(); await cleanupPortalPairFixture(ids); }
});
