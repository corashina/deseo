import { test, expect, endPair } from '../support/test';
import { ready, screens, widths } from './routes';
import { checkLayout } from './rules';

// Importance 95: no side scroll (95), shell (92), clipped text (92), and 48px targets (90) on every screen.
// Route patterns name the tests, because test names must be known before fixtures exist.
const pattern = { event: ':eventId', list: ':listId', task: ':taskId', idea: ':ideaId', memory: ':memoryId' };

for (const screen of screens) {
  test(`layout of ${screen.path(pattern)}`, async ({ page, filledPair, account, pendingPair, pair, signIn }) => {
    // Create only the account this screen needs.
    const person = await {
      none: async () => null,
      pair: async () => filledPair.a,
      unpaired: () => account(),
      noProfile: () => account(null),
      pending: async () => (await pendingPair()).a,
      ended: async () => { const ended = await pair(); await endPair(ended.a, ended.id); return ended.a; },
    }[screen.as]();
    if (person) await signIn(page, person);
    if (screen.path(filledPair.ids) === '/verify') {
      // The code screen needs an email request first. Answer it here, so no email is sent.
      await page.route('**/auth/v1/otp', route => route.fulfill({ status: 200, json: {} }));
      await page.goto('/sign-in');
      await page.getByLabel('Email address').fill('layout@example.test');
      await page.getByRole('button', { name: 'Send code', exact: true }).click();
    } else {
      await page.goto(screen.path(filledPair.ids));
    }
    await ready(page, screen.title);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(requestAnimationFrame));
      expect.soft(await checkLayout(page, screen.shell), `${screen.path(filledPair.ids)} at ${width}px`).toEqual([]);
    }
  });
}
