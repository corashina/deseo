import { defineConfig } from '@playwright/test';

// Playwright enables worker colors. Remove the conflicting inherited setting.
delete process.env.NO_COLOR;

export default defineConfig({
  testDir: './tests',
  outputDir: '../../.superpowers/web-tests/results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 4,
  reporter: [['list'], ['html', { outputFolder: '../../.superpowers/web-tests/report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
});
