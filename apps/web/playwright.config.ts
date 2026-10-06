import { defineConfig } from '@playwright/test';

// Playwright enables worker colors. Remove the conflicting inherited setting.
delete process.env.NO_COLOR;

export default defineConfig({
  testDir: './tests',
  outputDir: '../../.superpowers/web-tests/results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: '../../.superpowers/web-tests/report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    { name: 'narrow', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
});
