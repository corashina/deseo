import { test, expect, type Page, type Route } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createPortalPairFixture, cleanupPortalPairFixture, portalClient } from './support/fixtures';
import { admin } from './support/entry-fixtures';
import { loginWithLocalEmailCode } from './support/local-auth';
const asset = '../../supabase/dev/assets/sample-walk.jpg';
async function select(page: Page, count = 1) {
  await page.getByLabel('Photos', { exact: true }).setInputFiles(Array.from({ length: count }, () => asset));
  await expect(page.getByRole('img', { name: 'Selected photo', exact: true })).toHaveCount(count);
  await expect(page.getByRole('button', { name: 'Publish memory', exact: true })).toBeEnabled();
}
async function form(page: Page, caption: string) {
  await page.goto('/memories/new');
  await page.getByLabel('Memory date').fill('2026-10-05');
  await page.getByLabel('Caption', { exact: true }).fill(caption);
}
// Importance 98: real publication and prepared JPEG limits protect shared photos.
test('memories show private images and publish one to five prepared photos', async ({ page }) => {
  test.setTimeout(60000);
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/memories');
    await expect(page.getByRole('heading', { name: 'Memories', exact: true })).toBeVisible();
    await expect(page.locator('.memory-card img')).toHaveCount(2);
    for (const count of [1, 5]) {
      await form(page, 'Browser memory ' + count);
      // The existing feed orders by memory date, then UUID for tied dates.
      if (count === 5) await page.getByLabel('Memory date').fill('2026-10-06');
      await select(page, count);
      await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Browser memory ' + count, exact: true })).toBeVisible();
      await expect(page.locator('.memory-detail img')).toHaveCount(count);
      const client = await portalClient(ids.marekEmail);
      const memory = await client.rpc('get_memory', { p_memory_id: page.url().split('/').at(-1) });
      expect(memory.data.data.state).toBe('published');
      for (const photo of memory.data.data.photos) {
        expect(photo.fullBytes).toBeLessThanOrEqual(5242880);
        expect(photo.thumbBytes).toBeLessThanOrEqual(5242880);
        expect(Math.max(photo.width, photo.height)).toBeLessThanOrEqual(2560);
        expect(Math.max(photo.thumbWidth, photo.thumbHeight)).toBeLessThanOrEqual(512);
        expect(photo.validated).toBe(true);
      }
    }
    await page.goto('/today');
    await expect(page.getByTestId('today-memory').getByRole('heading', { name: 'Browser memory 5' })).toBeVisible();
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 96: selections must reject count, byte, and type violations and scale supported images.
test('photo preparation enforces limits and removes source metadata', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await form(page, 'Scaled photo');
    await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect(page.getByText('Choose at least one photo.', { exact: true })).toBeVisible();
    await page.getByLabel('Photos', { exact: true }).setInputFiles(Array.from({ length: 6 }, () => asset));
    await expect(page.getByText('Choose no more than five photos.', { exact: true })).toBeVisible();
    await page.getByLabel('Photos', { exact: true }).setInputFiles({ name: 'unsupported.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    await expect(page.getByText('Choose a JPEG, PNG, or WebP photo.', { exact: true })).toBeVisible();
    await page.getByLabel('Photos', { exact: true }).setInputFiles({ name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(30 * 1024 * 1024 + 1) });
    await expect(page.getByText('Choose a photo smaller than 30 MiB.', { exact: true })).toBeVisible();
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 3000; canvas.height = 1800;
      canvas.getContext('2d')!.fillRect(0, 0, 3000, 1800); return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.getByLabel('Photos', { exact: true }).setInputFiles({ name: 'wide.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(page.getByRole('img', { name: 'Selected photo', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Scaled photo', exact: true })).toBeVisible();
    const client = await portalClient(ids.annaEmail);
    const memory = (await client.rpc('get_memory', { p_memory_id: page.url().split('/').at(-1) })).data.data;
    expect(memory.photos[0]).toMatchObject({ width: 2560, height: 1536, thumbWidth: 512, thumbHeight: 307, validated: true });
    const { data } = await admin.storage.from('memory-photos').download(memory.photos[0].fullPath);
    expect(data!.type).toBe('image/jpeg');
    expect(Buffer.from(await data!.arrayBuffer()).includes(Buffer.from('ICC_PROFILE'))).toBe(false);
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 95: failures keep fields and bytes; removal releases the failed reservation.
test('failed upload keeps caption and date and lets the author remove a photo', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await form(page, 'Kept caption'); await select(page, 2);
    await page.route('**/storage/v1/object/memory-photos/**', route => route.abort());
    await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Caption', { exact: true })).toHaveValue('Kept caption');
    await expect(page.getByLabel('Memory date')).toHaveValue('2026-10-05');
    await page.getByRole('button', { name: 'Discard upload and change photos', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove photo 2', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Remove photo 2', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Selected photo', exact: true })).toHaveCount(1);
    await expect(page.getByLabel('Caption', { exact: true })).toBeEditable();
    await page.unroute('**/storage/v1/object/memory-photos/**');
    await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kept caption', exact: true })).toBeVisible();
    const client = await portalClient(ids.annaEmail);
    const feed = (await client.rpc('list_memories', { p_pair_id: ids.pairId, p_limit: 50 })).data.data.items;
    expect(feed.filter((memory: { caption: string }) => memory.caption === 'Kept caption')).toHaveLength(1);
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 95: a real quota rejection must release fields and retained photo controls.
test('quota rejection releases the draft and permits a smaller reservation', async ({ page }) => {
  test.setTimeout(60000);
  const ids = await createPortalPairFixture();
  try {
    const client = await portalClient(ids.annaEmail);
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await form(page, 'Quota draft'); await select(page, 2);
    const attempts: { p_input: { id: string; photos: { id: string; fullBytes: number; thumbBytes: number }[] }; p_command_id: string }[] = [];
    await page.route('**/rest/v1/rpc/reserve_memory', async route => {
      const input = route.request().postDataJSON(); attempts.push(input);
      if (attempts.length === 1) {
        const existing = await admin.from('memory_photos').select('full_bytes,thumb_bytes').eq('pair_id', ids.pairId);
        expect(existing.error).toBeNull();
        const used = existing.data!.reduce((bytes, photo) => bytes + photo.full_bytes + photo.thumb_bytes, 0);
        const first = input.p_input.photos[0];
        let fill = 1073741824 - used - first.fullBytes - first.thumbBytes;
        // Reserve the remaining quota through real commands. No image bytes are needed for pending records.
        while (fill >= 2) {
          const photos = [];
          while (fill >= 2 && photos.length < 5) {
            const bytes = Math.min(fill, 10 * 1024 * 1024);
            photos.push({ id: randomUUID(), fullBytes: Math.floor(bytes / 2), thumbBytes: Math.ceil(bytes / 2), width: 1, height: 1, thumbWidth: 1, thumbHeight: 1 });
            fill -= bytes;
          }
          const reservation = await client.rpc('reserve_memory', { p_input: { id: randomUUID(), pairId: ids.pairId, caption: 'Quota fixture', memoryDate: '2026-10-01', photos }, p_command_id: randomUUID() });
          expect(reservation.error).toBeNull(); expect(reservation.data.ok).toBe(true);
        }
      }
      await route.continue();
    });
    await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect(page.getByText('You reached the current limit.', { exact: true })).toBeVisible();
    expect((await admin.from('memories').select('id').eq('id', attempts[0].p_input.id)).data).toEqual([]);
    await expect(page.getByLabel('Caption', { exact: true })).toBeEditable();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    await page.getByRole('link', { name: 'Add memory', exact: true }).click();
    await expect(page.getByLabel('Caption', { exact: true })).toBeEditable();
    await expect(page.getByLabel('Caption', { exact: true })).toHaveValue('Quota draft');
    await expect(page.getByLabel('Memory date')).toHaveValue('2026-10-05');
    await expect(page.getByRole('img', { name: 'Selected photo', exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'Remove photo 2', exact: true }).click();
    await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Quota draft', exact: true })).toBeVisible();
    expect(attempts).toHaveLength(2);
    expect(attempts[1].p_command_id).not.toBe(attempts[0].p_command_id);
    expect(attempts[1].p_input.photos[0].id).toBe(attempts[0].p_input.photos[0].id);
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 98: uncertain discard replays its command, retains bytes, and creates one new publication.
for (const interruption of ['lost response', 'focus']) test('uncertain discard survives ' + interruption + ' and retains the draft', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await form(page, 'Retained after discard'); await select(page, 2);
    const reservations: { p_input: { photos: { id: string }[] } }[] = [];
    const deletions: unknown[] = []; let reads = 0;
    await page.route('**/rest/v1/rpc/reserve_memory', async route => { reservations.push(route.request().postDataJSON()); await route.continue(); });
    await page.route('**/rest/v1/rpc/get_memory', async route => { reads++; await route.continue(); });
    await page.route('**/storage/v1/object/memory-photos/**', route => route.abort());
    await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
    await page.unroute('**/storage/v1/object/memory-photos/**');
    await page.route('**/rest/v1/rpc/delete_memory', async route => {
      deletions.push(route.request().postDataJSON());
      if (deletions.length === 1) {
        await route.fetch();
        if (interruption === 'focus') await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await route.abort();
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Discard upload and change photos', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Discard upload and change photos', exact: true })).toBeEnabled();
    if (interruption === 'lost response') {
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('link', { name: 'Cancel', exact: true }).click();
      await page.getByRole('link', { name: 'Add memory', exact: true }).click();
    }
    await expect(page.getByLabel('Caption', { exact: true })).toHaveValue('Retained after discard');
    await expect(page.getByLabel('Memory date')).toHaveValue('2026-10-05');
    await expect(page.getByRole('img', { name: 'Selected photo', exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'Discard upload and change photos', exact: true }).click();
    await expect(page.getByLabel('Caption', { exact: true })).toBeEditable();
    expect(reads).toBe(1); expect(deletions).toHaveLength(2); expect(deletions[1]).toEqual(deletions[0]);
    await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Retained after discard', exact: true })).toBeVisible();
    await expect(page.locator('.memory-detail img')).toHaveCount(2);
    expect(reservations).toHaveLength(2);
    const oldIds = reservations[0].p_input.photos.map(photo => photo.id);
    expect(reservations[1].p_input.photos.every(photo => !oldIds.includes(photo.id))).toBe(true);
    const client = await portalClient(ids.marekEmail);
    const feed = (await client.rpc('list_memories', { p_pair_id: ids.pairId, p_limit: 50 })).data.data.items;
    expect(feed.filter((memory: { caption: string }) => memory.caption === 'Retained after discard')).toHaveLength(1);
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 98: a confirmed discard conflict must recover after a late real publication.
test('late publication releases a discard conflict and preserves the draft until recovery', async ({ page }) => {
  const ids = await createPortalPairFixture();
  let releasePublication = () => {};
  const released = new Promise<void>(resolve => { releasePublication = resolve; });
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await form(page, 'Late publication'); await select(page, 2);
    let publication: Route | undefined;
    let memoryId = '';
    const deletions: { p_expected_version: number }[] = [];
    await page.route('**/functions/v1/finalize-memory', async route => {
      const body = route.request().postDataJSON();
      if (body.action === 'publish' && !publication) {
        publication = route; memoryId = body.memoryId;
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await released;
        await route.abort();
      } else await route.continue();
    });
    await page.route('**/rest/v1/rpc/delete_memory', async route => {
      deletions.push(route.request().postDataJSON());
      // The form has read the pending version. Finish the held publication before deleting.
      const published = await publication!.fetch();
      expect(published.status()).toBe(200);
      const confirmed = await published.json();
      expect(confirmed.data.state).toBe('published');
      expect(confirmed.data.version).toBe(deletions[0].p_expected_version + 1);
      releasePublication();
      const rejected = await route.fetch();
      expect((await rejected.json()).error.code).toBe('CONFLICT');
      await route.fulfill({ response: rejected });
    });
    await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Discard upload and change photos', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Discard upload and change photos', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Caption', { exact: true })).toHaveValue('Late publication');
    await expect(page.getByLabel('Memory date')).toHaveValue('2026-10-05');
    await expect(page.getByRole('img', { name: 'Selected photo', exact: true })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Discard upload and change photos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Late publication', exact: true })).toBeVisible();
    expect(page.url().endsWith('/memories/' + memoryId)).toBe(true);
    expect(deletions).toHaveLength(1);
    const client = await portalClient(ids.marekEmail);
    const feed = (await client.rpc('list_memories', { p_pair_id: ids.pairId, p_limit: 50 })).data.data.items;
    expect(feed.filter((memory: { caption: string }) => memory.caption === 'Late publication')).toHaveLength(1);
  } finally { releasePublication(); await cleanupPortalPairFixture(ids); }
});
// Importance 98: uncertain immutable uploads and focus preserve one command and one publication.
test('lost upload response survives focus and publishes once without overwriting', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail); await form(page, 'One publication'); await select(page);
    const reservations: unknown[] = []; const paths: string[] = []; let interrupted = false;
    await page.route('**/rest/v1/rpc/reserve_memory', async route => { reservations.push(route.request().postDataJSON()); await route.continue(); });
    await page.route('**/storage/v1/object/memory-photos/**', async route => {
      paths.push(new URL(route.request().url()).pathname);
      if (!interrupted) {
        interrupted = true; await route.fetch();
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        // Importance 98: unlock while the old response remains pending, then ignore it.
        await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
        await route.abort();
      }
      else await route.continue();
    });
    await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Caption', { exact: true })).toHaveValue('One publication');
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'One publication', exact: true })).toBeVisible();
    expect(reservations[1]).toEqual(reservations[0]);
    expect(paths.filter(path => path.endsWith('/full.jpg'))).toHaveLength(1);
    const client = await portalClient(ids.marekEmail);
    const feed = (await client.rpc('list_memories', { p_pair_id: ids.pairId, p_limit: 50 })).data.data.items;
    expect(feed.filter((memory: { caption: string }) => memory.caption === 'One publication')).toHaveLength(1);
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 100: partner reads, author controls, conflicts, download, and deletion enforce access.
test('partner can view and download while only the author edits or deletes', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.marekEmail); await page.goto('/memories/' + ids.memoryId);
    await expect(page.locator('.memory-detail img')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit memory', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete memory', exact: true })).toHaveCount(0);
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download photo 1', exact: true }).click(); expect((await download).suggestedFilename()).toMatch(/\.jpg$/);
    await page.goto('/memories/' + ids.memoryId + '/edit'); await expect(page.getByRole('heading', { name: 'Memory unavailable', exact: true })).toBeVisible();
    const client = await portalClient(ids.marekEmail);
    expect((await client.rpc('delete_memory', { p_memory_id: ids.memoryId, p_expected_version: 1, p_command_id: randomUUID() })).data.error.code).toBe('FORBIDDEN');
    await page.getByRole('button', { name: 'Account menu', exact: true }).first().click(); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await loginWithLocalEmailCode(page, ids.annaEmail); await page.goto('/memories/' + ids.memoryId + '/edit');
    await page.getByLabel('Caption', { exact: true }).fill('Author draft');
    const anna = await portalClient(ids.annaEmail);
    const current = (await anna.rpc('get_memory', { p_memory_id: ids.memoryId })).data.data;
    expect((await anna.rpc('update_memory', { p_memory_id: ids.memoryId, p_expected_version: current.version, p_command_id: randomUUID(), p_input: { caption: 'Remote edit', memoryDate: current.memoryDate } })).data.ok).toBe(true);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByText('This memory changed. Your draft is kept.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Caption', { exact: true })).toHaveValue('Author draft');
    await page.getByRole('button', { name: 'Reload memory and discard draft', exact: true }).click();
    await page.getByLabel('Caption', { exact: true }).fill('Saved author caption');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Saved author caption', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete memory', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await expect(page).toHaveURL(/\/memories$/);
    expect((await client.rpc('get_memory', { p_memory_id: ids.memoryId })).data.error.code).toBe('FORBIDDEN');
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 95: focus unlocks detail downloads while late image bytes remain private.
test('focus unlocks a pending download without accepting its late response', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/memories/' + ids.memoryId);
    await expect(page.locator('.memory-detail img')).toBeVisible();
    let interrupted = false;
    await page.route('**/storage/v1/object/sign/memory-photos/**', async route => {
      if (!interrupted) {
        interrupted = true;
        const response = await route.fetch();
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await expect(page.getByRole('button', { name: 'Download photo 1', exact: true })).toBeEnabled();
        await route.fulfill({ response });
      } else await route.continue();
    });
    const downloads: string[] = [];
    page.on('download', download => downloads.push(download.suggestedFilename()));
    await page.getByRole('button', { name: 'Download photo 1', exact: true }).click();
    await expect(page.locator('.memory-detail img')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download photo 1', exact: true })).toBeEnabled();
    expect(downloads).toEqual([]);
    const nextDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download photo 1', exact: true }).click();
    expect((await nextDownload).suggestedFilename()).toMatch(/\.jpg$/);
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 98: a deletion keeps its command and version through focus and retries once.
test('focus preserves an uncertain deletion and replays its command', async ({ page }) => {
  const ids = await createPortalPairFixture();
  let confirmUnlock = () => {};
  const unlocked = new Promise<void>(resolve => { confirmUnlock = resolve; });
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.goto('/memories/' + ids.memoryId);
    await expect(page.locator('.memory-detail img')).toBeVisible();
    const attempts: unknown[] = [];
    let interrupted = false;
    await page.route('**/rest/v1/rpc/delete_memory', async route => {
      attempts.push(route.request().postDataJSON());
      if (!interrupted) {
        interrupted = true; await route.fetch();
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await expect(page.getByRole('button', { name: 'Retry deletion', exact: true })).toBeEnabled();
        confirmUnlock();
        await route.abort();
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Delete memory', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await unlocked;
    await page.getByRole('button', { name: 'Retry deletion', exact: true }).click();
    await expect(page).toHaveURL(/\/memories$/);
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 100: a revoked pair cannot complete an in-flight publication.
test('pair revocation during upload prevents publication', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail); await form(page, 'Revoked upload'); await select(page);
    let ended = false;
    await page.route('**/storage/v1/object/memory-photos/**', async route => {
      if (!ended) { ended = true; await route.fetch(); const result = await admin.from('pairs').update({ state: 'ended', ended_at: new Date().toISOString() }).eq('id', ids.pairId); expect(result.error).toBeNull(); }
      await route.continue();
    });
    await page.getByRole('button', { name: 'Publish memory', exact: true }).click();
    await expect.poll(async () => (await admin.from('memories').select('state').eq('pair_id', ids.pairId).eq('caption', 'Revoked upload')).data?.[0]?.state).toBe('deleting');
    expect((await admin.from('memories').select('id').eq('pair_id', ids.pairId).eq('caption', 'Revoked upload').eq('state', 'published')).data).toEqual([]);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('.memory-detail img')).toHaveCount(0);
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 100: private media refreshes once and object URLs disappear on sign-out.
test('media refreshes once and sign-out removes images and object URLs', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await page.addInitScript(() => {
      const active = new Set<string>(); const create = URL.createObjectURL.bind(URL); const revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = value => { const url = create(value); active.add(url); return url; };
      URL.revokeObjectURL = value => { active.delete(value); revoke(value); };
      Object.assign(window, { memoryObjectUrls: active });
    });
    await loginWithLocalEmailCode(page, ids.annaEmail);
    let calls = 0;
    await page.route('**/storage/v1/object/sign/memory-photos/**', async route => { calls++; if (calls === 1) await route.fulfill({ status: 403, body: '{}' }); else await route.continue(); });
    await page.goto('/memories/' + ids.memoryId);
    await expect(page.locator('.memory-detail img')).toBeVisible(); expect(calls).toBe(2);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('.memory-detail img')).toBeVisible();
    await page.getByRole('button', { name: 'Account menu', exact: true }).first().click(); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/welcome$/); await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { memoryObjectUrls: Set<string> }).memoryObjectUrls.size)).toBe(0);
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 100: forbidden private media stops after one refresh and shows recovery.
test('forbidden media refreshes once and shows recovery', async ({ page }) => {
  const ids = await createPortalPairFixture();
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    let calls = 0;
    await page.route('**/storage/v1/object/sign/memory-photos/**', async route => { calls++; await route.fulfill({ status: 403, body: '{}' }); });
    await page.goto('/memories/' + ids.memoryId);
    await expect(page.getByText('This photo is unavailable. Open the memory again.', { exact: true })).toBeVisible(); expect(calls).toBe(2);
  } finally { await cleanupPortalPairFixture(ids); }
});
// Importance 92: loaded routes must fit narrow, rail, and sidebar layouts.
test('loaded memory routes fit the shell and produce review captures', async ({ page }, info) => {
  const ids = await createPortalPairFixture();
  const folder = '../../.superpowers/sdd/2026-10-07-deseo-frontend-design/task-5-route-captures'; mkdirSync(folder, { recursive: true });
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    for (const [name, route] of [['feed', '/memories'], ['detail', '/memories/' + ids.memoryId], ['edit', '/memories/' + ids.memoryId + '/edit'], ['form', '/memories/new']]) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (name === 'feed' || name === 'detail') await expect(page.locator('main img').first()).toBeVisible();
      await page.screenshot({ path: folder + '/' + name + '-' + info.project.name + '.png', fullPage: true });
      for (const width of [320, 768, 1024]) { await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
      await page.setViewportSize(info.project.use.viewport!);
    }
  } finally { await cleanupPortalPairFixture(ids); }
});

// Importance 92: enlarged failure text must keep photo recovery visible and reachable.
test('failed feed photo remains reachable at doubled text and recovers without navigation', async ({ page }, info) => {
  const ids = await createPortalPairFixture();
  const folder = '../../.superpowers/sdd/2026-10-07-deseo-frontend-design/task-5-recovery';
  mkdirSync(folder, { recursive: true });
  try {
    await loginWithLocalEmailCode(page, ids.annaEmail);
    await page.route('**/functions/v1/get-memory-media', route => route.fulfill({ status: 200, json: { ok: false, error: { code: 'RETRYABLE' } } }));
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.goto('/today');
    const card = page.getByTestId('today-memory').locator('.memory-card');
    const retry = card.getByRole('button', { name: 'Retry photo', exact: true });
    await expect(retry).toBeVisible();
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll<HTMLElement>('body *')].map(element => [element, parseFloat(getComputedStyle(element).fontSize)] as const);
      for (const [element, size] of sizes) element.style.fontSize = size * 2 + 'px';
    });
    await retry.scrollIntoViewIfNeeded();
    await page.screenshot({ path: folder + '/failed-320-text-2-' + info.project.name + '.png', fullPage: true });
    const visible = await card.locator('.memory-image-state').evaluate(state => {
      return [...state.querySelectorAll('[role=alert], button')].every(element => {
        const box = element.getBoundingClientRect();
        let parent = element.parentElement;
        while (parent) {
          const style = getComputedStyle(parent);
          if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY)) {
            const frame = parent.getBoundingClientRect();
            if (box.top < frame.top || box.bottom > frame.bottom) return false;
          }
          parent = parent.parentElement;
        }
        return true;
      });
    });
    expect(visible, 'Photo error and Retry must fit within clipping ancestors').toBe(true);
    await retry.focus();
    await expect(retry).toBeFocused();
    await page.unroute('**/functions/v1/get-memory-media');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/today$/);
    await expect(card.locator('img')).toBeVisible();
    await page.screenshot({ path: folder + '/recovered-320-text-2-' + info.project.name + '.png', fullPage: true });
    const ratio = await card.locator('.memory-cover').evaluate(element => { const box = element.getBoundingClientRect(); return box.width / box.height; });
    expect(ratio).toBeCloseTo(1.5, 1);
    const photo = card.locator('img');
    await photo.scrollIntoViewIfNeeded();
    const box = (await photo.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(/\/memories\/[0-9a-f-]+$/);
    await page.goto('/memories/' + ids.memoryId);
    const image = page.locator('.memory-detail img').first();
    await expect(image).toBeVisible();
    const dimensions = await image.evaluate((element: HTMLImageElement) => { const box = element.getBoundingClientRect(); return { actual: box.width / box.height, full: element.naturalWidth / element.naturalHeight }; });
    expect(dimensions.actual).toBeCloseTo(dimensions.full, 2);
  } finally { await cleanupPortalPairFixture(ids); }
});
