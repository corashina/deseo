import { fileURLToPath } from 'node:url';
import { test, expect, admin } from './support/test';
import { failRequest } from './support/network';

const photos = ['lake.jpg', 'forest.jpg'].map(name => fileURLToPath(new URL('./support/photos/' + name, import.meta.url)));

// Importance 100: a failed photo upload keeps the caption, and a retry publishes one memory.
test('a retry after a failed photo upload publishes one memory', async ({ page, browser, pair, signIn }) => {
  const { id, a, b } = await pair();
  const caption = 'Morning walk by the lake';
  await signIn(page, a);
  await page.goto('/memories/new');
  await page.getByLabel('Photos', { exact: true }).setInputFiles(photos);
  await expect(page.getByText('2 photos selected.')).toBeVisible();
  await page.getByLabel('Caption').fill(caption);
  await failRequest(page, '**/storage/v1/object/memory-photos/**');
  await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible();
  await expect(page.getByLabel('Caption')).toHaveValue(caption);
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page).toHaveURL(/\/memories\/[0-9a-f-]{36}$/);
  const memories = await admin.from('memories').select('id, state').eq('pair_id', id);
  expect(memories.data).toHaveLength(1);
  expect(memories.data?.[0].state).toBe('published');
  const stored = await admin.from('memory_photos').select('id').eq('memory_id', memories.data![0].id);
  expect(stored.data).toHaveLength(2);
  const context = await browser.newContext();
  try {
    const partner = await context.newPage();
    await signIn(partner, b);
    await partner.goto('/memories/' + memories.data![0].id);
    await expect(partner.getByText(caption)).toBeVisible();
  } finally { await context.close(); }
});
