import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { test } from '../support/test';
import { openScreen, screens } from '../layout/routes';

// Screenshots and detector results for the impeccable review. Runs only with CAPTURE=1.
// Output: .superpowers/design-capture/<area>/<screen>-<width>[-dark].png and <screen>.detect.json.
const widths = [390, 768, 1024, 1440];
const root = resolve(import.meta.dirname, '../../../..');
const out = resolve(root, '.superpowers/design-capture');
const impeccable = resolve(root, '.claude/skills/impeccable/scripts/impeccable');
const debugPort = 9333;
const siteUrl = 'http://127.0.0.1:4175';
const pattern = { event: ':eventId', list: ':listId', task: ':taskId', idea: ':ideaId', memory: ':memoryId' };

// Each screen belongs to one review area. The shell area reads the Today and Calendar captures.
const areas: [RegExp, string][] = [
  [/^\/(sign-in|verify|no-such-page|profile|pair)\b/, 'entry'],
  [/^\/settings/, 'settings'],
  [/^\/today/, 'today'],
  [/^\/(calendar|events|ideas)/, 'calendar'],
  [/^\/memories/, 'memories'],
  [/^\/tasks/, 'tasks'],
];
const areaOf = (path: string) => areas.find(([match]) => match.test(path))?.[1] ?? 'other';
const slug = (path: string) => path.replace(/^\/|\/$/g, '').replace(/[/:.]+/g, '-') || 'home';

// Use a real window height, so layouts sized by the viewport (100dvh) render as users see them.
// The full-page shot then shows the rest of the page. Fixed full-height parts, such as the sidebar, end at the window height.
async function shoot(page: Page, width: number, file: string) {
  await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.screenshot({ path: file, fullPage: true });
}

async function capture(page: Page, area: string, path: string) {
  const dir = resolve(out, area);
  mkdirSync(dir, { recursive: true });
  for (const width of widths) await shoot(page, width, resolve(dir, `${slug(path)}-${width}.png`));
  // Dark mode follows the device. Capture the narrowest and widest widths.
  await page.emulateMedia({ colorScheme: 'dark' });
  // Let color transitions finish, so no shot catches a half-switched color.
  await page.waitForTimeout(300);
  for (const width of [390, 1440]) await shoot(page, width, resolve(dir, `${slug(path)}-${width}-dark.png`));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1440, height: 900 });
  // The detector attaches to this browser through its debug port and scans the open page at 1440px.
  const result = spawnSync(impeccable, ['detect', '--cdp', String(debugPort), '--target', new URL(page.url()).pathname, '--json'],
    { cwd: root, encoding: 'utf8', timeout: 90_000 });
  // Exit 2 means findings. Any other failure means the page was not scanned.
  if (result.status !== 0 && result.status !== 2) throw new Error(`detect ${path} failed: ${result.stderr}`);
  writeFileSync(resolve(dir, `${slug(path)}.detect.json`), result.stdout);
}

// One worker and one page at a time, so the detector finds the right page.
test.describe.configure({ mode: 'serial', timeout: 120_000 });

for (const screen of screens) {
  const path = screen.path(pattern);
  test(`capture ${path}`, async ({ page, filledPair, account, pendingPair, pair, signIn }) => {
    await openScreen(page, screen, { filledPair, account, pendingPair, pair, signIn });
    await capture(page, areaOf(path), path);
  });
}

for (const path of ['/', '/invite/', '/support/', '/privacy/', '/terms/', '/404.html']) {
  test(`capture site ${path}`, async ({ page }) => {
    await page.goto(siteUrl + path);
    await capture(page, 'site', path);
  });
}
