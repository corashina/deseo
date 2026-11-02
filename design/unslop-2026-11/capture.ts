import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { FIXED_IDS, ANNA_EMAIL } from '../../supabase/dev/web-fixtures.ts';

// Run after `npm run seed:web` with the preview on 4174. The display clock matches the seeded week.
const base = 'http://127.0.0.1:4174';
const out = new URL('./before/', import.meta.url).pathname;
const ids = { ...FIXED_IDS, groceriesListId: process.env.GROCERIES_LIST_ID ?? '' };
const signedOut = ['/welcome', '/sign-in'];
const signedIn = [
  '/today', '/calendar', '/events/new', `/events/${ids.sharedEventId}`, `/events/${ids.sharedEventId}/edit`, `/events/${ids.privateEventId}`,
  '/ideas', '/ideas/new', `/ideas/${ids.ideaId}`, `/ideas/${ids.ideaId}/edit`,
  '/memories', '/memories/new', `/memories/${ids.memoryId}`, `/memories/${ids.memoryId}/edit`,
  '/messages', '/notifications', '/tasks', '/tasks/new', `/tasks/${ids.taskId}`, `/tasks/${ids.taskId}/edit`, '/tasks/lists', `/tasks/lists/${ids.groceriesListId}`,
  '/settings', '/settings/profile', '/settings/pair', '/settings/notifications', '/settings/account',
];
const widths = [{ name: 'narrow', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 900 }];
const names = new Map(Object.entries(ids).map(([name, id]) => [id, name.replace(/Id$/, '')]));
const slug = (route: string) => route.replace(/^\//, '').replace(/[0-9a-f-]{36}/g, id => names.get(id) ?? 'id').replace(/\//g, '-');

async function code(email: string) {
  for (let i = 0; i < 30; i++) {
    const search = await (await fetch(`http://127.0.0.1:55724/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    const id = search.messages?.[0]?.ID;
    if (id) {
      const body = await (await fetch(`http://127.0.0.1:55724/api/v1/message/${id}`)).json();
      const match = (body.Text || body.HTML).match(/\b\d{6}\b/);
      if (match) return match[0];
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('No sign-in code arrived.');
}
async function signIn(page: Page) {
  await fetch('http://127.0.0.1:55724/api/v1/messages', { method: 'DELETE' });
  await page.goto(base + '/sign-in');
  await page.getByLabel('Email address').fill(ANNA_EMAIL);
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  await page.getByLabel('Sign-in code').fill(await code(ANNA_EMAIL));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(url => !url.pathname.startsWith('/verify') && !url.pathname.startsWith('/sign-in'));
}
async function shoot(page: Page, dir: string, route: string) {
  await page.goto(base + route);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${slug(route)}.png`, fullPage: true });
}

const browser = await chromium.launch();
for (const [index, size] of widths.entries()) {
  // Auth allows one code request per address every 20 seconds.
  if (index > 0) await new Promise(resolve => setTimeout(resolve, 25000));
  const dir = `${out}${size.name}`;
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: size.width < 500, hasTouch: size.width < 500, timezoneId: 'Europe/Warsaw', locale: 'en-GB' });
  const page = await context.newPage();
  for (const route of signedOut) await shoot(page, dir, route);
  await signIn(page);
  await page.clock.setSystemTime(new Date('2026-10-05T08:00:00Z'));
  for (const route of signedIn) await shoot(page, dir, route);
  await context.close();
}
await browser.close();
