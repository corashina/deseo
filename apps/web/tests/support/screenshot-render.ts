import { expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { createScreenshotFixtures } from './screenshot-fixtures';
import type { ScreenshotScenario } from './screenshot-scenarios';
import { readLocalCode } from './local-auth';
import { admin } from './entry-fixtures';
import { messageAction } from './message-actions';

export type CaptureFixtures = Awaited<ReturnType<typeof createScreenshotFixtures>>;
export type CaptureRole = 'signedOut' | 'anna' | 'marek' | 'exceptional' | 'empty' | 'unpaired' | 'pending' | 'ended' | 'logout' | 'fresh';
export function sceneRole(scene: ScreenshotScenario): CaptureRole {
  const { routeId: id, view } = scene;
  if (view === 'global-signout-failure') return 'logout';
  if (id === 'entry-profile') return 'fresh';
  if (id === 'task-list-detail' && view === 'empty') return 'exceptional';
  if (id === 'notifications' && view === 'list') return 'exceptional';
  if (view === 'ended' || id === 'pair-ended') return 'ended';
  if (id === 'settings-notifications' || view === 'unpaired' || ['pair-start', 'pair-join'].includes(id)) return 'unpaired';
  if (id === 'pair-invite' || id === 'pair-waiting') return 'pending';
  if (id.startsWith('entry-') || id === 'invite-entry' || id === 'unknown-route') return 'signedOut';
  if (view === 'empty') return 'empty';
  if (view === 'partner') return 'marek';
  if (['conflict', 'pending-deletion', 'pending-send', 'pending-action', 'upload-error', 'completion-error', 'verification', 'end-dialog', 'request-error', 'media-error', 'error', 'unavailable', 'planned', 'archived', 'remove-dialog'].includes(view)) return 'exceptional';
  return 'anna';
}

export function sceneUrl(scene: ScreenshotScenario, fixtures: CaptureFixtures, role: CaptureRole) {
  const ids = role === 'exceptional' ? fixtures.exceptional : fixtures.named;
  let url = scene.url.replace(':eventId', scene.view === 'private' || scene.view === 'share-dialog' ? ids.privateEventId : ids.sharedEventId)
    .replace(':taskId', ids.taskId).replace(':memoryId', ids.memoryId)
    .replace(':ideaId', scene.view === 'planned' ? fixtures.plannedId : scene.view === 'archived' ? fixtures.archivedId : ids.ideaId)
    .replace(':listId', scene.view === 'general' ? ids.generalListId : ['empty', 'remove-dialog'].includes(scene.view) ? fixtures.emptyListId : ids.groceriesListId);
  if (scene.routeId === 'unknown-route') url = '/no-such-page';
  if (scene.view === 'unavailable' && scene.routeId !== 'pair-join' && scene.routeId !== 'notifications') url = url.replace(/\/[^/]+$/, '/00000000-0000-4000-8000-000000000099');
  if (scene.routeId === 'calendar') url += '?date=2026-10-05&view=' + (['agenda', 'compare'].includes(scene.view) ? scene.view : 'month');
  if (scene.routeId === 'event-new' && scene.view === 'plan-date') url += '?idea=' + ids.ideaId;
  if (scene.routeId === 'messages' && scene.view === 'notes') url += '?view=notes';
  if (scene.routeId === 'tasks' && ['groceries', 'completed'].includes(scene.view)) url += '?list=' + ids.groceriesListId;
  return url;
}

export async function ready(page: Page) {
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/^Loading .+…$/)).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}
async function failure(page: Page, path: string, code = 'RETRYABLE') {
  await page.route('**/' + path, route => route.fulfill({ status: 200, json: { ok: false, error: { code } } }));
}
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

// Each state comes from a real page action, a real disposable row, or a controlled request failure.
export async function renderScene(page: Page, scene: ScreenshotScenario, fixtures: CaptureFixtures, role: CaptureRole) {
  const { routeId: id, view } = scene;
  let url = sceneUrl(scene, fixtures, role);
  let release = () => {};
  if (view === 'invited' || id === 'invite-entry') url = '/invite?token=' + (view === 'invalid' ? 'invalid' : fixtures.inviter.inviteToken);
  if (view === 'global-signout-failure') url = '/settings/account';
  if (id === 'entry-verify') {
    const email = `entry-${randomUUID()}@example.test`;
    const account = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (account.error || !account.data.user) throw new Error('Verification fixture failed');
    await fixtures.recordVerificationAccount(account.data.user.id);
    await page.goto('/sign-in');
    await page.getByLabel('Email address').fill(email);
    await button(page, 'Send code').click();
    await expect(page.getByLabel('Sign-in code')).toBeVisible();
    if (view === 'invalid-code') { await page.getByLabel('Sign-in code').fill('123'); await button(page, 'Sign in').click(); await expect(page.getByText('Enter six digits from your email.')).toBeVisible(); }
    return { url: '/verify', release };
  }
  if (view === 'request-error') {
    const path = id === 'event-detail' ? 'rest/v1/events?*' : id === 'task-detail' ? 'rest/v1/tasks?*' : id === 'idea-detail' ? 'rest/v1/date_ideas?*' : 'rest/v1/rpc/get_memory';
    await page.route('**/' + path, route => route.fulfill({ status: 503, json: { message: 'Controlled unavailable service' } }));
  }
  if (view === 'error') {
    const path = id === 'calendar' ? 'rest/v1/rpc/list_agenda' : id === 'today' ? 'rest/v1/rpc/get_today' : id === 'memories' ? 'rest/v1/rpc/list_memories' : id === 'messages' ? 'rest/v1/messages?*' : id === 'notifications' ? 'rest/v1/rpc/list_notifications' : 'auth/v1/otp';
    await page.route('**/' + path, route => route.fulfill({ status: id === 'messages' ? 400 : 503, json: { code: id === 'messages' ? 'PGRST000' : 'unexpected_failure', message: 'Controlled unavailable service' } }));
  }
  if (view === 'media-error') await failure(page, 'functions/v1/get-memory-media');
  await page.goto(url); await ready(page);
  if (id === 'memory-new') await expect(page.getByRole('heading', { name: 'Add memory', exact: true })).toBeVisible();
  if (view === 'request-error') await expect(page.locator('h1')).toContainText('We could not load this ');
  if (view === 'error' && id !== 'entry-email') await expect(page.getByRole('alert').filter({ hasText: 'We could not load' }).first()).toBeVisible();
  if (view === 'media-error') await expect(page.getByText('We could not load this photo.', { exact: true })).toBeVisible();
  if (view === 'unavailable' && id !== 'pair-join' && id !== 'notifications') await expect(page.getByText('You cannot open this content.', { exact: true })).toBeVisible();
  if (id === 'notifications' && view === 'list') await expect(button(page, 'Open').first()).toBeVisible();
  if (view === 'global-signout-failure') {
    let revoked = false;
    await page.route('**/rest/v1/rpc/revoke_device', async route => { const response = await route.fetch(); expect((await response.json()).ok).toBe(true); revoked = true; await route.fulfill({ response }); });
    await page.route('**/auth/v1/logout?scope=global', route => { expect(revoked).toBe(true); return route.fulfill({ status: 503, json: { code: 'unexpected_failure', msg: 'Auth unavailable' } }); });
    await button(page, 'Sign out on all devices').click();
    await expect(page.getByText('This browser is signed out. Other sessions may still be active.')).toBeVisible();
  }
  if (id === 'entry-email' && view === 'error') {
    await page.getByLabel('Email address').fill('anna@deseo.example.test'); await button(page, 'Send code').click();
    await expect(page.getByRole('alert')).toBeVisible();
  }
  if (id === 'pair-invite' && view !== 'default') {
    if (view === 'delivery-unconfirmed') await page.route('**/rest/v1/rpc/create_invite', route => route.abort());
    if (view === 'already-delivered') {
      let first = true;
      await page.route('**/rest/v1/rpc/create_invite', async route => { if (first) { first = false; const response = await route.fetch(); expect((await response.json()).ok).toBe(true); await route.abort(); } else await route.continue(); });
    }
    await button(page, 'Create invitation code').click();
    if (view === 'generated-code') await expect(page.locator('.invite-code')).toBeVisible();
    else { await expect(button(page, 'Retry invitation code')).toBeEnabled(); if (view === 'already-delivered') { await button(page, 'Retry invitation code').click(); await expect(page.getByText('The code was already delivered. Create a new invitation code to replace it.')).toBeVisible(); } }
  }
  if (id === 'pair-join' && view !== 'default') {
    await page.getByLabel('Invitation code').fill(view === 'review' ? fixtures.inviter.inviteToken! : '000000000000');
    await button(page, 'Review invitation').click();
    if (view === 'review') await expect(button(page, 'Join pair')).toBeVisible(); else await expect(page.getByRole('alert')).toBeVisible();
  }
  if (id === 'pair-waiting' && view === 'cancel-dialog') { await button(page, 'Cancel pending pair').click(); await expect(page.getByRole('dialog', { name: 'Cancel this pair?' })).toBeVisible(); }
  if (view === 'delete-dialog' || view === 'archive-dialog') {
    const kind = id.split('-')[0];
    if (kind === 'messages') await (await messageAction(page.locator('[data-message-id="' + fixtures.named.annaMessageId + '"]'), 'Delete message')).click();
    else await button(page, kind === 'idea' ? 'Archive idea' : 'Delete ' + kind).click();
    await expect(page.getByRole('dialog').last()).toBeVisible();
  }
  if (id === 'event-edit' && view === 'share-dialog') { await page.getByLabel('Visibility').selectOption('shared'); await button(page, 'Save changes').click(); await expect(page.getByRole('dialog', { name: 'Share this event?' })).toBeVisible(); }
  if (view === 'validation') {
    if (id === 'event-new') { await page.getByLabel('Title', { exact: true }).fill('Evening together'); await page.getByLabel('End time').fill('17:00'); await button(page, 'Save event').click(); }
    if (id === 'task-new') { await page.getByLabel('Title', { exact: true }).fill('   '); await button(page, 'Save task').click(); }
    if (id === 'idea-new') { await page.getByLabel('Title', { exact: true }).fill('A weekend trip'); await page.getByLabel('Link', { exact: true }).fill('http://example.test'); await button(page, 'Save idea').click(); }
    await expect(page.getByRole('alert').first()).toBeVisible();
  }
  if (view === 'conflict') {
    const command = id === 'event-edit' ? 'update_event' : id === 'task-edit' ? 'update_task' : id === 'idea-edit' ? 'update_date_idea' : id === 'memory-edit' ? 'update_memory' : id === 'settings-profile' ? 'save_profile' : 'save_notification_preferences';
    await failure(page, 'rest/v1/rpc/' + command, 'CONFLICT');
    const label = id === 'memory-edit' ? 'Caption' : id === 'settings-profile' ? 'Your name' : id === 'settings-notifications' ? 'Notification timezone' : 'Title';
    await page.getByLabel(label, { exact: true }).fill(id === 'settings-notifications' ? 'Europe/London' : 'My retained draft');
    await button(page, id === 'settings-profile' ? 'Save profile' : id === 'settings-notifications' ? 'Save preferences' : 'Save changes').click();
    await expect(page.getByText(/changed\. Your draft is kept\./).first()).toBeVisible();
  }
  if (id === 'memory-new' && view !== 'default') {
    await page.getByLabel('Caption', { exact: true }).fill('A quiet afternoon together.');
    await page.getByLabel('Photos', { exact: true }).setInputFiles('../../supabase/dev/assets/sample-walk.jpg');
    await expect(page.getByRole('img', { name: 'Selected photo', exact: true })).toBeVisible();
    if (view === 'upload-error') {
      await page.route('**/storage/v1/object/memory-photos/**', route => route.fulfill({ status: 503, json: { message: 'Controlled upload failure' } }));
      await button(page, 'Publish memory').click(); await expect(button(page, 'Retry save')).toBeEnabled();
    }
  }
  if (id === 'messages' && view === 'pending-send') {
    await page.route('**/rest/v1/rpc/send_message', route => route.abort());
    await page.getByLabel('Message', { exact: true }).fill('See you after work.'); await button(page, 'Send message').click();
    await expect(button(page, 'Retry message')).toBeEnabled();
  }
  if (id === 'messages' && view === 'pending-action') {
    await page.route('**/rest/v1/rpc/unpin_message', route => route.abort());
    await (await messageAction(page.locator('[data-message-id="' + fixtures.exceptional.annaMessageId + '"]'), 'Unpin note')).click();
    await expect(button(page, 'Retry change')).toBeEnabled();
  }
  if (view === 'pending-deletion') {
    const kind = id.split('-')[0];
    let committed = () => {}; const saved = new Promise<void>(resolve => { committed = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/rest/v1/rpc/delete_' + kind, async route => { const response = await route.fetch(); expect((await response.json()).ok).toBe(true); committed(); await gate; await route.abort().catch(() => {}); });
    await button(page, 'Delete ' + kind).click(); await button(page, 'Confirm deletion').click(); await saved;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(button(page, 'Retry deletion')).toBeEnabled();
  }
  if (id === 'tasks' && view === 'completion-error') { await page.route('**/rest/v1/rpc/set_task_completed', route => route.abort()); await page.getByRole('checkbox').first().check(); await expect(button(page, 'Retry completion')).toBeEnabled(); }
  if (id === 'task-lists' && view === 'create') await page.getByLabel('List name').fill('Weekend plans');
  if (view === 'move-dialog') { await button(page, 'Move tasks to General').click(); await expect(page.getByRole('dialog', { name: 'Move tasks to General?' })).toBeVisible(); }
  if (view === 'remove-dialog') { await button(page, 'Remove list').click(); await expect(page.getByRole('dialog', { name: 'Remove this list?' })).toBeVisible(); }
  if (id === 'ideas' && ['planned', 'archived'].includes(view)) { await button(page, view === 'planned' ? 'Planned' : 'Archived').click(); await expect(page.getByRole('link', { name: view === 'planned' ? 'Gallery visit' : 'Summer picnic', exact: true })).toBeVisible(); }
  if (id === 'notifications' && view === 'unavailable') {
    await failure(page, 'rest/v1/rpc/resolve_notification', 'FORBIDDEN'); await button(page, 'Open').first().click();
    await expect(page.getByText('This content is unavailable. Your pair or the source changed.')).toBeVisible();
  }
  if (id === 'settings-notifications' && view === 'quiet-hours') { await page.getByLabel('Quiet hours', { exact: true }).check(); await expect(page.getByLabel('Quiet hours start')).toBeVisible(); }
  if (id === 'settings-pair' && ['verification', 'end-dialog'].includes(view)) {
    await button(page, 'Send code to end pair').click(); await expect(page.getByLabel('Email verification code')).toBeVisible();
    if (view === 'end-dialog') { await page.getByLabel('Email verification code').fill(await readLocalCode(fixtures.exceptional.annaEmail)); await button(page, 'End pair').click(); await expect(page.getByRole('dialog', { name: 'End this pair?' })).toBeVisible(); }
  }
  return { url: id === 'invite-entry' || view === 'invited' ? '/invite?token=REDACTED' : url, release };
}
