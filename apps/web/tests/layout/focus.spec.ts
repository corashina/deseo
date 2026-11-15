import type { Page } from '@playwright/test';
import { test, expect } from '../support/test';
import { focusState } from './focus-ring';
import { ready } from './routes';

// Press Tab until the named element has focus. Fail after max presses.
async function tabTo(page: Page, name: string, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if ((await focusState(page))?.name === name) return;
  }
  throw new Error(`Tab did not reach ${name}`);
}

const openDialog = (page: Page) =>
  page.evaluate(() => document.activeElement?.closest('dialog[open]')?.getAttribute('aria-label') ?? null);

async function open(page: Page, path: string, title: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await ready(page, title);
}

test.beforeEach(async ({ page, filledPair, signIn }) => {
  await signIn(page, filledPair.a);
});

// Importance 90: the skip link saves a long Tab run on each page.
test('skip link moves focus to the main content', async ({ page }) => {
  await open(page, '/today', 'Today', 1440);
  await page.keyboard.press('Tab');
  expect(await focusState(page)).toMatchObject({ name: 'Skip to content', ring: true, inView: true });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('main');
});

// Importance 92: navigation is the main way between screens, on the sidebar and on the rail.
for (const width of [1440, 768]) {
  test(`navigation links follow in order with focus rings at ${width}px`, async ({ page }) => {
    await open(page, '/today', 'Today', width);
    await tabTo(page, 'Your pair');
    const stops = [await focusState(page)];
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
      stops.push(await focusState(page));
    }
    expect(stops.map(stop => stop?.name)).toEqual(['Your pair', 'Today', 'Calendar', 'Memories', 'Messages', 'Tasks', 'Notifications', 'Settings']);
    for (const stop of stops) expect.soft(stop, stop?.name).toMatchObject({ ring: true, inView: true });
  });
}

// Importance 95: the drawer is the only navigation on phones.
test('drawer keeps focus inside and returns it on close', async ({ page }) => {
  await open(page, '/today', 'Today', 390);
  await tabTo(page, 'Open navigation');
  await page.keyboard.press('Enter');
  await expect.poll(() => openDialog(page)).toBe('Navigation');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await openDialog(page)).toBe('Navigation');
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await openDialog(page)).toBe('Navigation');
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
  expect((await focusState(page))?.name).toBe('Open navigation');
  await page.keyboard.press('Enter');
  await expect.poll(() => openDialog(page)).toBe('Navigation');
  await tabTo(page, 'Calendar');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeHidden();
});

// Importance 95: keyboard users must not get lost or stuck in a dialog.
async function checkDialog(page: Page, trigger: string, dialog: string) {
  await tabTo(page, trigger);
  await page.keyboard.press('Enter');
  await expect.poll(() => openDialog(page)).toBe(dialog);
  const first = (await focusState(page))?.name;
  expect(first).toBe('Close ' + dialog.toLowerCase());
  await page.keyboard.press('Shift+Tab');
  expect(await openDialog(page)).toBe(dialog);
  expect((await focusState(page))?.name).not.toBe(first);
  await page.keyboard.press('Tab');
  expect((await focusState(page))?.name).toBe(first);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: dialog })).toBeHidden();
  expect((await focusState(page))?.name).toBe(trigger);
}

test('account menu and delete dialog trap focus and return it', async ({ page, filledPair }) => {
  await open(page, '/today', 'Today', 1440);
  await checkDialog(page, 'Account menu', 'Your account');
  await open(page, `/tasks/${filledPair.ids.task}`, 'Task', 1440);
  await checkDialog(page, 'Delete task', 'Delete this task?');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

// Importance 93: the event form is the longest form in the app.
test('event form fields follow in visual order with focus rings', async ({ page }) => {
  await open(page, '/events/new', 'Add event', 1440);
  await tabTo(page, 'Title');
  let last = await page.evaluate(() => document.activeElement!.getBoundingClientRect().toJSON() as DOMRect);
  for (let i = 0; i < 40; i++) {
    const state = await focusState(page);
    expect.soft(state, state?.name).toMatchObject({ ring: true, inView: true });
    expect.soft(state?.size, state?.name).toBeGreaterThan(0);
    await page.keyboard.press('Tab');
    const inMain = await page.evaluate(() => Boolean(document.activeElement?.closest('main')));
    if (!inMain) return;
    const next = await page.evaluate(() => document.activeElement!.getBoundingClientRect().toJSON() as DOMRect);
    const below = next.top >= last.bottom - 4;
    const sameRowRight = Math.abs(next.top - last.top) < 8 && next.left > last.left;
    expect.soft(below || sameRowRight, `${(await focusState(page))?.name} is out of visual order`).toBe(true);
    last = next;
  }
  throw new Error('Tab did not leave the event form');
});
