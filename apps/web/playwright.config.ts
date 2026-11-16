import { defineConfig } from '@playwright/test';

// Playwright enables worker colors. Remove the conflicting inherited setting.
delete process.env.NO_COLOR;

// CAPTURE=1 runs only the design capture for the impeccable review. See tests/capture/capture.spec.ts.
const capture = process.env.CAPTURE === '1';

export default defineConfig({
  testDir: './tests',
  testIgnore: capture ? [] : ['capture/**'],
  outputDir: '../../.superpowers/web-tests/results',
  fullyParallel: !capture,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: capture ? 1 : 4,
  reporter: [['list'], ['html', { outputFolder: '../../.superpowers/web-tests/report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: capture
    ? [{ name: 'capture', testMatch: 'capture/**', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 },
        launchOptions: { args: ['--remote-debugging-port=9333'] } } }]
    : [{ name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } }],
  webServer: [
    { command: 'npm run build && npm run preview', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
    ...(capture ? [{ command: 'npm run build --workspace @deseo/site && npm run preview --workspace @deseo/site',
      cwd: '../..', url: 'http://127.0.0.1:4175', reuseExistingServer: false }] : []),
  ],
});
