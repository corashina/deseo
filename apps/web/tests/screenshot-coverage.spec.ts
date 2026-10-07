import { test, expect, type BrowserContext } from '@playwright/test';
import { mkdir, readFile, writeFile, stat, appendFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { routeManifest } from '../src/app/route-manifest';
import { screenshotScenarios, assertScenarioCoverage, type ScreenshotRecord } from './support/screenshot-scenarios';
import { createScreenshotFixtures } from './support/screenshot-fixtures';
import { renderScene, sceneRole, type CaptureRole } from './support/screenshot-render';
import { loginWithLocalEmailCode } from './support/local-auth';

const gallery = fileURLToPath(new URL('../../../docs/design/web-portal/', import.meta.url));
const scratch = fileURLToPath(new URL('../../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-10-capture/', import.meta.url));
const report = fileURLToPath(new URL('../../../.superpowers/sdd/2026-10-05-deseo-web-portal-implementation/task-10-report.md', import.meta.url));
const displayTime = new Date('2026-10-05T10:00:00+02:00');
// Capture records and JPEGs provide the evidence. Auth traces must stay outside the gallery.
test.use({ trace: 'off', actionTimeout: 15_000, navigationTimeout: 20_000 });
type State = Awaited<ReturnType<BrowserContext['storageState']>>;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

async function savedRecords(): Promise<ScreenshotRecord[]> {
  try { return JSON.parse(await readFile(gallery + 'coverage.json', 'utf8')).records; }
  catch { return []; }
}
async function writeGallery(records: ScreenshotRecord[]) {
  for (const record of records) {
    if (record.fixture === 'Anna + Marek / anna') record.fixture = 'Anna + Marek / Anna';
    if (record.fixture === 'Anna + Marek / marek') record.fixture = 'Anna + Marek / Marek';
  }
  records.sort((a, b) => screenshotScenarios.findIndex(scene => scene.routeId === a.routeId && scene.view === a.view) - screenshotScenarios.findIndex(scene => scene.routeId === b.routeId && scene.view === b.view) || b.viewport.width - a.viewport.width);
  const coverage = { displayDate: '2026-10-05', displayTime: '10:00', timezone: 'Europe/Warsaw', locale: 'en',
    routes: routeManifest.length, requiredViews: screenshotScenarios.length, requiredViewportPairs: screenshotScenarios.length * 2,
    nativePromptEvidence: 'apps/web/tests/navigation.spec.ts: detail reload, Back, sidebar, reload, and sign-out protect drafts', records };
  await writeFile(gallery + 'coverage.json', JSON.stringify(coverage, null, 2) + '\n');
  const introduction = `# Deseo portal screenshots\n\nOpen [the complete gallery](index.html). It shows desktop and narrow views with full-size links.\n\nI captured real product pages at 1440 × 1000 and 390 × 844.\nLong forms also have full-page images.\n\nThe display date is 5 October 2026, 10:00 Europe/Warsaw.\nBackend and Auth clocks keep their real time.\nNormal screens use the local Anna and Marek pair.\nOther screens use disposable local fixtures or controlled request failures.\nI masked invitation codes and verification codes before capture.\n\nThe manifest requires ${routeManifest.length} routes and ${screenshotScenarios.length} views.\nThe root route resolves to Welcome; its records link the Welcome image.\nInvitation entry also resolves to Welcome.\n\nBrowser confirmation prompts sit outside the product page.\nThe navigation suite verifies draft retention after dismissal and navigation after acceptance.\nPage images do not claim to show those native prompts.\n\nReference review: [Cupla](https://www.cupla.app/the-app/) and [Couply](https://www.couply.io/).\nDeseo keeps its pastel colors, Two voices icon, partner labels, and shared planning structure.\n\n## Captures\n\n`;
  const rows = screenshotScenarios.map(scene => {
    const views = records.filter(record => record.routeId === scene.routeId && record.view === scene.view);
    return `| ${scene.routeId} | ${scene.view} | ` + [1440, 390].map(width => {
      const record = views.find(item => item.viewport.width === width);
      return record ? `[${width}px](${record.file})` + (record.fullPageFile ? ` · [Full page](${record.fullPageFile})` : '') : 'Pending';
    }).join(' | ') + ' |';
  });
  await writeFile(gallery + 'README.md', introduction + '| Route | View | Desktop | Narrow |\n|---|---|---|---|\n' + rows.join('\n') + '\n');
  const cards = screenshotScenarios.filter(scene => scene.routeId !== 'entry-root').map(scene => {
    const views = records.filter(record => record.routeId === scene.routeId && record.view === scene.view);
    return `<section id="${scene.routeId}-${scene.view}"><h2>${escapeHtml(scene.routeId)} / ${escapeHtml(scene.view)}</h2><div class="pair">` + [1440, 390].map(width => {
      const record = views.find(item => item.viewport.width === width);
      return record ? `<figure><figcaption><strong>${width === 1440 ? 'Desktop' : 'Narrow'} · ${width} × ${record.viewport.height}</strong><p>${escapeHtml(record.heading)} · ${escapeHtml(record.fixture)}</p><p><code>${escapeHtml(record.renderedUrl)}</code></p><a href="${record.file}">Open full size</a>${record.fullPageFile ? ` · <a href="${record.fullPageFile}">Open full page</a>` : ''}</figcaption><a href="${record.file}"><img loading="lazy" src="${record.file}" alt="${escapeHtml(record.heading + ' ' + record.view + ' ' + width)}" width="${width}" height="${record.viewport.height}"></a></figure>` : '<p>Capture pending.</p>';
    }).join('') + '</div></section>';
  });
  await writeFile(gallery + 'index.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Deseo portal screenshots</title><style>body{margin:0;background:#faf7f5;color:#383547;font:16px/1.5 system-ui,sans-serif}header,main{max-width:1440px;margin:auto;padding:32px}h1{margin-top:0}a{color:#60527c}section{background:white;border:1px solid #e5dee8;border-radius:20px;padding:24px;margin:24px 0}section h2{overflow-wrap:anywhere}.pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,390px);gap:24px}figure{margin:0;min-width:0}figcaption{min-height:130px}img{display:block;width:100%;height:auto;border:1px solid #e5dee8;border-radius:12px}code{overflow-wrap:anywhere}nav{display:flex;gap:16px;flex-wrap:wrap}@media(max-width:767px){header,main{padding:16px}section{padding:20px}.pair{grid-template-columns:1fr}figcaption{min-height:0}}</style><header><h1>Deseo portal screenshots</h1><p>${screenshotScenarios.length} required views. Both requested browser sizes. Display date: 5 October 2026.</p><nav><a href="README.md">Capture index</a><a href="coverage.json">Coverage records</a></nav><p>Open an image to inspect its full size. Use the full-page link for long forms.</p><p>Root entry resolves to Welcome. Browser draft prompts belong to browser UI; the navigation suite verifies their behavior.</p></header><main>${cards.join('\n')}</main></html>\n`);
}

// Importance 90: a missing route/view declaration makes the requested gallery incomplete.
test('screenshot declarations cover the current route manifest', () => { assertScenarioCoverage(); });

// Importance 90: every manifest view needs actual image bytes at both requested viewport sizes.
test('complete screenshot gallery', async ({ browser }, info) => {
  test.skip(process.env.DESEO_CAPTURE !== '1', 'Set DESEO_CAPTURE=1 to regenerate real local captures.');
  test.setTimeout(1_800_000);
  const baseURL = info.project.use.baseURL!;
  assertScenarioCoverage(); await mkdir(gallery + 'images', { recursive: true }); await mkdir(scratch, { recursive: true });
  const ledgerFile = scratch + 'fixture-ledger-' + info.project.name + '-' + randomUUID() + '.json';
  const fixtures = await createScreenshotFixtures(ledgerFile);
  const width = info.project.name === 'desktop' ? 1440 : 390;
  const viewport = { width, height: width === 1440 ? 1000 : 844 };
  const states = new Map<CaptureRole, State>();
  const uiCodeAt = new Map<CaptureRole, number>();
  let sensitiveCodeAt = 0;
  const accounts: Record<Exclude<CaptureRole, 'signedOut'>, [string, string]> = {
    anna: [fixtures.named.annaEmail, fixtures.named.annaId], marek: [fixtures.named.marekEmail, fixtures.named.marekId],
    exceptional: [fixtures.exceptional.annaEmail, fixtures.exceptional.annaId], empty: [fixtures.empty.email, fixtures.empty.accountIds[0]],
    unpaired: [fixtures.unpaired.email, fixtures.unpaired.accountIds[0]], pending: [fixtures.pending.email, fixtures.pending.accountIds[0]],
    ended: [fixtures.ended.email, fixtures.ended.accountIds[0]], logout: [fixtures.logout.email, fixtures.logout.accountIds[0]],
    fresh: [fixtures.freshEmail, fixtures.freshId],
  };
  async function session(role: CaptureRole) {
    if (role === 'signedOut') return undefined;
    if (states.has(role)) return states.get(role);
    // Reuse named UI sessions only after checking their stored owner and real account gate.
    const path = scratch + 'session-' + role + '.json';
    if (role === 'anna' || role === 'marek') {
      try {
        const saved: { state: State; uiCodeAt: number } = JSON.parse(await readFile(path, 'utf8'));
        const stored = saved.state;
        const token = stored.origins.flatMap(origin => origin.localStorage).find(item => item.name.endsWith('-auth-token'));
        if (token && JSON.parse(token.value).user.id === accounts[role][1]) {
          uiCodeAt.set(role, saved.uiCodeAt);
          const restored = await browser.newContext({ storageState: stored, baseURL });
          try {
            const check = await restored.newPage(); await check.goto('/settings/profile');
            await expect(check.getByLabel('Your name')).toHaveValue(role === 'anna' ? 'Anna' : 'Marek');
            const current = await restored.storageState();
            const currentToken = current.origins.flatMap(origin => origin.localStorage).find(item => item.name.endsWith('-auth-token'));
            if (!currentToken || JSON.parse(currentToken.value).user.id !== accounts[role][1]) throw new Error('Restored account changed.');
            await writeFile(path, JSON.stringify({ state: current, uiCodeAt: saved.uiCodeAt }));
            states.set(role, current); return current;
          } finally { await restored.close(); }
        }
      } catch { /* Obtain a new normal UI email code after an expired local session. */ }
    }
    const wait = Math.max(0, (uiCodeAt.get(role) ?? 0) + 61_000 - Date.now());
    if (wait) { console.log('Waiting ' + Math.ceil(wait / 1000) + 's before a new UI sign-in.'); await new Promise(resolve => setTimeout(resolve, wait)); }
    const context = await browser.newContext({ viewport, timezoneId: 'Europe/Warsaw', locale: 'en-GB', baseURL });
    const page = await context.newPage(); page.on('dialog', dialog => void dialog.accept());
    await loginWithLocalEmailCode(page, accounts[role][0]);
    uiCodeAt.set(role, Date.now());
    const state = await context.storageState();
    const token = state.origins.flatMap(origin => origin.localStorage).find(item => item.name.endsWith('-auth-token'));
    expect(token && JSON.parse(token.value).user.id).toBe(accounts[role][1]);
    await writeFile(path, JSON.stringify({ state, uiCodeAt: uiCodeAt.get(role) })); states.set(role, state); await context.close(); return state;
  }
  try {
    let records = await savedRecords();
    const captureOrder = [...screenshotScenarios.filter(scene => scene.view !== 'pending-deletion'), ...screenshotScenarios.filter(scene => scene.view === 'pending-deletion')];
    for (const scene of captureOrder) {
      const key = scene.routeId + '/' + scene.view;
      if (process.env.DESEO_CAPTURE_FILTER && !new RegExp(process.env.DESEO_CAPTURE_FILTER).test(key)) continue;
      if (process.env.DESEO_CAPTURE_RESUME === '1' && records.some(record => record.routeId === scene.routeId && record.view === scene.view && record.viewport.width === width)) continue;
      const role = sceneRole(scene);
      const state = await session(role);
      if (scene.routeId === 'settings-pair' && ['verification', 'end-dialog'].includes(scene.view)) {
        const wait = Math.max(0, Math.max(uiCodeAt.get(role) ?? 0, sensitiveCodeAt) + 61_000 - Date.now());
        if (wait) { console.log('Waiting ' + Math.ceil(wait / 1000) + 's for the real OTP window.'); await new Promise(resolve => setTimeout(resolve, wait)); }
      }
      const context = await browser.newContext({ viewport, storageState: state, timezoneId: 'Europe/Warsaw', locale: 'en-GB', baseURL });
      const page = await context.newPage(); page.on('dialog', dialog => void dialog.accept());
      await page.clock.setFixedTime(displayTime);
      let release = () => {};
      try {
        console.log('Capture ' + width + ': ' + key);
        const rendered = await renderScene(page, scene, fixtures, role); release = rendered.release;
        if (scene.routeId === 'settings-pair' && ['verification', 'end-dialog'].includes(scene.view)) sensitiveCodeAt = Date.now();
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(img => img.src).map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); }))); });
        await page.evaluate(() => window.scrollTo(0, 0));
        const heading = await page.locator('h1').first().innerText();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const mask = [page.locator('.invite-code'), page.getByLabel('Invitation code', { exact: true }), page.getByLabel('Sign-in code', { exact: true }), page.getByLabel('Email verification code', { exact: true })];
        const file = 'images/' + scene.routeId + '-' + scene.view + '-' + width + '.jpg';
        const options = { type: 'jpeg' as const, quality: 82, mask, maskColor: '#DDD4EE', animations: 'disabled' as const };
        if (scene.routeId !== 'entry-root') await page.screenshot({ ...options, path: gallery + file });
        const fullPage = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight);
        const longForm = /-(new|edit)$/.test(scene.routeId) || scene.routeId.startsWith('settings-');
        const previous = records.find(record => record.routeId === scene.routeId && record.view === scene.view && record.viewport.width === width);
        const fullPageFile = fullPage || longForm || previous?.fullPageFile ? file.replace('.jpg', '-full.jpg') : undefined;
        if (fullPageFile && scene.routeId !== 'entry-root') await page.screenshot({ ...options, path: gallery + fullPageFile, fullPage: true });
        const currentUrl = new URL(page.url());
        const record: ScreenshotRecord = { ...scene, url: rendered.url, state: scene.view, fixture: role === 'anna' || role === 'marek' ? 'Anna + Marek / ' + role : 'disposable / ' + role,
          viewport, file: scene.routeId === 'entry-root' ? 'images/entry-welcome-default-' + width + '.jpg' : file,
          ...(fullPageFile && scene.routeId !== 'entry-root' ? { fullPageFile } : {}), renderedUrl: currentUrl.pathname + currentUrl.search, heading,
          ...(['entry-root', 'invite-entry'].includes(scene.routeId) ? { redirectTo: currentUrl.pathname } : {}) };
        records = records.filter(item => !(item.routeId === scene.routeId && item.view === scene.view && item.viewport.width === width));
        records.push(record); await writeGallery(records);
        await appendFile(report, '\n- Captured ' + key + ' at ' + width + 'px. Total records: ' + records.length + '.\n');
      } finally { release(); await context.close(); }
    }
  } finally { await fixtures.cleanup(); }
});

// Importance 90: coverage metadata must reference the full requested set and real JPEG files.
test('gallery records include both viewports and JPEG bytes', async ({ page }) => {
  const records = await savedRecords();
  for (const scene of screenshotScenarios) for (const width of [1440, 390]) {
    const key = scene.routeId + '/' + scene.view + '/' + width;
    const found = records.filter(record => record.routeId === scene.routeId && record.view === scene.view && record.viewport.width === width);
    expect(found, key).toHaveLength(1);
    expect(found[0].viewport.height, key).toBe(width === 1440 ? 1000 : 844);
    for (const file of [found[0].file, found[0].fullPageFile].filter(Boolean) as string[]) {
      const bytes = await readFile(gallery + file);
      expect((await stat(gallery + file)).size, key).toBeGreaterThan(1000);
      expect([...bytes.subarray(0, 3)], key).toEqual([255, 216, 255]);
    }
  }
  expect(records).toHaveLength(screenshotScenarios.length * 2);
  // Let the browser decode the files. Metadata alone cannot prove their physical dimensions.
  await page.goto(pathToFileURL(gallery + 'index.html').href);
  const decoded = await page.evaluate(async () => {
    const images = [...document.images];
    for (const image of images) image.loading = 'eager';
    await Promise.all(images.map(image => image.decode()));
    return images.map(image => ({ file: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight }));
  });
  for (const record of records.filter(item => item.routeId !== 'entry-root')) {
    expect(decoded.find(image => image.file === record.file), record.file).toMatchObject(record.viewport);
  }
  const fullFiles = records.filter(record => record.fullPageFile).map(record => record.fullPageFile!);
  const fullImages = await page.evaluate(async files => Promise.all(files.map(async file => {
    const image = new Image(); image.src = file; await image.decode();
    return { file, width: image.naturalWidth, height: image.naturalHeight };
  })), fullFiles);
  for (const record of records.filter(item => item.fullPageFile)) {
    const image = fullImages.find(item => item.file === record.fullPageFile)!;
    expect(image.width, record.fullPageFile).toBe(record.viewport.width);
    expect(image.height, record.fullPageFile).toBeGreaterThanOrEqual(record.viewport.height);
  }
});
