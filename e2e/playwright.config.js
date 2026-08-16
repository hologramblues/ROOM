// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright config for the ROOMS end-to-end layer.
 *
 * This layer exists for the scenarios that CANNOT be expressed in jsdom —
 * above all the multi-tab collaboration specs in AUDIT.md §8.4–§8.6, which
 * need two real browser contexts talking to one Yjs WebSocket server.
 *
 * NOTE: browsers are NOT installed by `npm install` here (the postinstall
 * download is deliberately skipped). Run `npm run install:browsers` once
 * before un-skipping any spec. See README.md in this directory.
 */
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.js',

  // Collab specs are timing-sensitive; give them room but never hang CI.
  timeout: 30_000,
  expect: { timeout: 5_000 },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    // The CRA dev server. Override with E2E_BASE_URL to point at a deployed build.
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Intentionally NOT enabled yet.
  //
  // Booting the stack requires MongoDB (server/server.js connects at module
  // scope and the Yjs provider needs it too), so turning this on would make
  // `playwright test` fail on a machine without a database — even for specs
  // that are skipped. Enable it once the collab specs land and a DB fixture
  // exists; see TESTING.md.
  //
  // webServer: [
  //   {
  //     command: 'npm start --prefix ../server',
  //     url: 'http://localhost:3001/api/health',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 60_000,
  //   },
  //   {
  //     command: 'npx craco start --prefix ../client',
  //     url: 'http://localhost:3000',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 120_000,
  //   },
  // ],
});
