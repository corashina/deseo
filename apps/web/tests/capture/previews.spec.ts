import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DateTime } from 'luxon';
import { admin, createEvent, createMemory, pinMessage, previewPhotos, rpc, sendMessage, test, type Account } from '../support/test';
import { ready } from '../layout/routes';

// Site previews with sample content: Alex and Sam. Runs only with CAPTURE=1.
// Output: .superpowers/design-capture/previews/<screen>-<width>[-dark].png. Convert to WebP for apps/site/public/images.
const out = resolve(import.meta.dirname, '../../../../.superpowers/design-capture/previews');
const zone = 'Europe/Warsaw';
const today = DateTime.now().setZone(zone).startOf('day');
const at = (days: number, hour: number, minute = 0) => today.plus({ days }).set({ hour, minute }).toUTC().toISO()!;
const day = (days: number) => today.plus({ days }).toISODate()!;

async function createTask(account: Account, pairId: string, title: string, assignee: string, dueDate: string) {
  const general = await admin.from('task_lists').select('id').eq('pair_id', pairId).eq('is_general', true).single();
  if (general.error) throw general.error;
  await rpc(account.client, 'create_task', { p_input: { id: randomUUID(), pair_id: pairId, list_id: general.data.id, title,
    assignee_id: assignee, due_date: dueDate }, p_command_id: randomUUID() });
}

test.describe.configure({ timeout: 180_000 });

test('capture site previews', async ({ browser, pair, signIn }) => {
  const { id, a: alex, b: sam } = await pair(['Alex', 'Sam']);
  await createEvent(alex, id, { owner: 'a', title: 'Coffee with Maya', starts_at: at(1, 10), ends_at: at(1, 11) });
  await createEvent(sam, id, { owner: 'b', title: 'Studio time', starts_at: at(1, 14), ends_at: at(1, 16) });
  await createEvent(sam, id, { title: 'Dinner at our favorite place', starts_at: at(1, 18, 30), ends_at: at(1, 20, 30) });
  await createEvent(alex, id, { title: 'Sunday market', starts_at: at(3, 9), ends_at: at(3, 11) });
  await createEvent(alex, id, { title: 'Our anniversary', starts_at: null, ends_at: null, start_date: day(12), end_date_exclusive: day(13),
    important_date: true });
  await createTask(alex, id, 'Book the train tickets', sam.id, day(0));
  await createTask(sam, id, 'Pick up flowers for dinner', alex.id, day(0));
  await pinMessage(sam, await sendMessage(sam, id, 'Spare keys are in the blue bowl by the door.'));
  await sendMessage(sam, id, 'Morning! Is coffee with Maya still at 10?');
  await sendMessage(alex, id, 'Yes, at the corner café. I will be back by noon.');
  await sendMessage(sam, id, 'Great. I booked our table for 18:30.');
  await sendMessage(alex, id, 'Perfect. I will bring the umbrella.');
  await createMemory(sam, id, 'The forest path after the rain', previewPhotos[1], day(-23));
  await createMemory(alex, id, 'Fog over the lake on our first morning', previewPhotos[0], day(-9));
  mkdirSync(out, { recursive: true });

  // Phones at 2x density. The large-screen Today at 1x is already sharp at its display size.
  const shots = [
    { width: 390, height: 960, scale: 2, screens: [['today', '/today', 'Today'], ['calendar', '/calendar?date=' + day(1), 'Calendar'],
      ['memories', '/memories', 'Memories']] },
    { width: 1440, height: 1100, scale: 1, screens: [['today', '/today', 'Today']] },
  ];
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const shot of shots) {
      const context = await browser.newContext({ viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: shot.scale, colorScheme });
      const page = await context.newPage();
      await signIn(page, alex);
      for (const [name, path, title] of shot.screens) {
        await page.goto(path);
        await ready(page, title);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: resolve(out, `${name}-${shot.width}${colorScheme === 'dark' ? '-dark' : ''}.png`) });
      }
      await context.close();
    }
  }
});
