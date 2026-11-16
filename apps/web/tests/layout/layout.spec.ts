import { test, expect } from '../support/test';
import { openScreen, screens, widths } from './routes';
import { checkLayout } from './rules';

// Importance 95: no side scroll (95), shell (92), clipped text (92), and 48px targets (90) on every screen.
// Route patterns name the tests, because test names must be known before fixtures exist.
const pattern = { event: ':eventId', list: ':listId', task: ':taskId', idea: ':ideaId', memory: ':memoryId' };

for (const screen of screens) {
  test(`layout of ${screen.path(pattern)}`, async ({ page, filledPair, account, pendingPair, pair, signIn }) => {
    await openScreen(page, screen, { filledPair, account, pendingPair, pair, signIn });
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(requestAnimationFrame));
      expect.soft(await checkLayout(page, screen.shell), `${screen.path(filledPair.ids)} at ${width}px`).toEqual([]);
    }
  });
}
