import { test, expect, type Page } from '@playwright/test';
import { checkLayout } from './rules';
import { focusState } from './focus-ring';

// Importance: 91. A rule that never fires gives a false pass on every screen.
const base = '<style>:root { --focus: rgb(10, 20, 30); } body { margin: 0; } button { width: 48px; height: 48px; }</style>';
const shell = (sidebar: number, toggle: boolean) =>
  `<aside class="sidebar" style="position: fixed; left: 0; top: 0; height: 100px; width: ${sidebar}px; display: ${sidebar ? 'block' : 'none'}"></aside>`
  + `<button class="drawer-toggle" style="display: ${toggle ? 'inline-block' : 'none'}">Menu</button>`;

async function failures(page: Page, width: number, html: string, withShell = false) {
  await page.setViewportSize({ width, height: 800 });
  await page.setContent(base + html);
  return (await checkLayout(page, withShell)).map(failure => `${failure.rule} ${failure.selector}`);
}

test('clean page has no failures', async ({ page }) => {
  expect(await failures(page, 1440, shell(256, false) + '<button>Save</button>', true)).toEqual([]);
});

test('side scroll reports the outermost wide element only', async ({ page }) => {
  expect(await failures(page, 390, '<div class="wide" style="width: 2000px"><p class="inner">Text</p></div>'))
    .toEqual(['side-scroll html', 'side-scroll div.wide']);
});

test('shell must match the width band', async ({ page }) => {
  expect(await failures(page, 768, shell(256, false), true)).toEqual(['shell .sidebar']);
  expect(await failures(page, 390, shell(0, false), true)).toEqual(['shell .drawer-toggle']);
});

test('small targets fail and inline links pass', async ({ page }) => {
  expect(await failures(page, 1440, '<button class="small" style="width: 32px; height: 32px">x</button><p>Read <a href="#">the terms</a> first.</p>'))
    .toEqual(['target button.small']);
});

test('hidden overflow fails unless it is an intended ellipsis', async ({ page }) => {
  expect(await failures(page, 1440, '<div class="cut" style="width: 100px; overflow: hidden; white-space: nowrap">Averyveryveryveryveryverylongword</div>'))
    .toEqual(['clipped div.cut']);
  const name = '<span style="display: block; width: 40px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">Anna Kowalska-Nowak</span>';
  expect(await failures(page, 1440, `<header class="topbar"><button style="width: 120px"><span>A</span>${name}</button></header>`)).toEqual([]);
});

test('focus ring needs a solid focus-color outline', async ({ page }) => {
  await page.setContent(base + '<style>.ring:focus-visible { outline: 3px solid var(--focus); } .bare:focus-visible { outline: none; }</style><button class="ring">One</button><button class="bare">Two</button>');
  await page.keyboard.press('Tab');
  expect(await focusState(page)).toMatchObject({ name: 'One', ring: true, inView: true });
  await page.keyboard.press('Tab');
  expect(await focusState(page)).toMatchObject({ name: 'Two', ring: false });
});
