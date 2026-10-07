import { test, expect, type Locator, type Page } from '@playwright/test';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createEntryFixture, cleanupEntryFixture } from './support/entry-fixtures';
import { loginWithLocalEmailCode, readLocalCode } from './support/local-auth';
import { messageAction } from './support/message-actions';

async function checkDialog(page: Page, trigger: Locator, title: string, returnTarget = trigger) {
  await trigger.focus(); await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog).toBeVisible();
  await mkdir('../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-9-captures', { recursive: true });
  await page.screenshot({ path: '../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-9-captures/' + title.toLowerCase().replace(/[^a-z]+/g, '-') + '-' + page.viewportSize()!.width + '.png', mask: [page.getByLabel('Email verification code'), page.getByLabel('Sign-in code'), page.locator('.invite-code')] });
  await expect(dialog.getByRole('button', { name: 'Close ' + title.toLowerCase(), exact: true })).toBeFocused();
  const buttons = dialog.getByRole('button');
  await buttons.last().focus(); await page.keyboard.press('Tab');
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(buttons.last()).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await expect(returnTarget).toBeFocused();
}
// Importance 93: native confirmation dialogs must contain focus and restore the trigger after Escape.
test('record confirmation dialogs support keyboard focus and Escape', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    for (const [path, button, title] of [
      ['/events/' + ids.sharedEventId, 'Delete event', 'Delete this event?'],
      ['/tasks/' + ids.taskId, 'Delete task', 'Delete this task?'],
      ['/ideas/' + ids.ideaId, 'Archive idea', 'Archive this idea?'],
      ['/memories/' + ids.memoryId, 'Delete memory', 'Delete this memory?'],
      ['/tasks/lists/' + ids.groceriesListId, 'Move tasks to General', 'Move tasks to General?'],
    ]) {
      await page.goto(path);
      await checkDialog(page, page.getByRole('button', { name: button, exact: true }), title);
    }
    const anna = await portalClient(ids.annaEmail);
    const empty = await anna.rpc('create_list', { p_pair_id: ids.pairId, p_name: 'Empty keyboard list', p_command_id: randomUUID() });
    expect(empty.error).toBeNull(); expect(empty.data.ok).toBe(true);
    await page.goto('/tasks/lists/' + empty.data.data.id);
    await checkDialog(page, page.getByRole('button', { name: 'Remove list', exact: true }), 'Remove this list?');
    await page.goto('/messages');
    const message = page.locator('[data-message-id="' + ids.annaMessageId + '"]');
    await checkDialog(page, await messageAction(message, 'Delete message'), 'Delete message?', message.getByRole('button', { name: 'Message actions', exact: true }));
    await page.goto('/events/' + ids.privateEventId + '/edit');
    await page.getByLabel('Visibility').selectOption('shared');
    await checkDialog(page, page.getByRole('button', { name: 'Save changes', exact: true }), 'Share this event?');
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 93: fresh verification and pair termination need safe keyboard cancellation.
test('pair termination supports Escape without discarding its verification input', async ({ page }) => {
  // The provider enforces a 60-second OTP window after the email-code login.
  test.setTimeout(90_000);
  const fixture = await createEntryFixture('active');
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await page.goto('/settings/pair');
    await page.waitForTimeout(61_000);
    await page.getByRole('button', { name: 'Send code to end pair', exact: true }).click();
    await expect(page.getByLabel('Email verification code')).toBeVisible();
    await page.getByLabel('Email verification code').fill(await readLocalCode(fixture.email));
    await checkDialog(page, page.getByRole('button', { name: 'End pair', exact: true }), 'End this pair?');
    await expect(page.getByLabel('Email verification code')).toHaveValue(/^\d{6}$/);
  } finally { await cleanupEntryFixture(fixture); }
});

// Importance 93: pending pair cancellation must remain safe and keyboard accessible.
test('pending pair cancellation supports Escape and focus restoration', async ({ page }) => {
  const fixture = await createEntryFixture('pending');
  try {
    await loginWithLocalEmailCode(page, fixture.email);
    await page.goto('/pair/waiting');
    await checkDialog(page, page.getByRole('button', { name: 'Cancel pending pair', exact: true }), 'Cancel this pair?');
  } finally { await cleanupEntryFixture(fixture); }
});
