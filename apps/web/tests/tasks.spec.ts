import { test, expect, admin } from './support/test';
import { failRequest } from './support/network';

// Importance 95: a failed reopen shows the saved state, and a retry reopens the task for both people.
test('a failed reopen keeps the completed task, and a retry reopens it', async ({ page, browser, pair, signIn }) => {
  const { id, a, b } = await pair();
  const title = 'Buy train tickets';
  await signIn(page, a);
  await page.goto('/tasks');
  await page.getByLabel('New task').fill(title);
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  const check = page.getByRole('checkbox', { name: 'Complete ' + title });
  await expect(check).not.toBeChecked();
  const context = await browser.newContext();
  try {
    const partner = await context.newPage();
    await signIn(partner, b);
    await partner.goto('/tasks');
    // The row is a controlled checkbox. It shows the change after the next render, so click and then wait.
    await partner.getByRole('checkbox', { name: 'Complete ' + title }).click();
    await expect(partner.getByText('Completed (1)', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByText('Completed (1)', { exact: true }).click();
    await expect(check).toBeChecked();
    await failRequest(page, '**/rest/v1/rpc/set_task_completed');
    await check.click();
    await expect(page.getByText('Completion failed.', { exact: true })).toBeVisible();
    await expect(check).toBeChecked();
    await page.getByRole('button', { name: 'Retry completion', exact: true }).click();
    await expect(check).not.toBeChecked();
    await partner.reload();
    await expect(partner.getByRole('checkbox', { name: 'Complete ' + title })).not.toBeChecked();
    const stored = await admin.from('tasks').select('completed_at').eq('title', title).eq('pair_id', id).single();
    expect(stored.data?.completed_at).toBeNull();
  } finally { await context.close(); }
});
