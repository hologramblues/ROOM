const { test, expect } = require('@playwright/test');

/**
 * Toolchain smoke test — E2E layer. PLACEHOLDER, INTENTIONALLY SKIPPED.
 *
 * This spec is skipped because running it needs two things that are not set up
 * by `npm install` in this directory:
 *
 *   1. BROWSERS. The Playwright browser binaries are not downloaded on install
 *      (it is a ~150 MB per-browser download). Run this once:
 *          cd e2e && npm run install:browsers
 *
 *   2. A RUNNING APP. `webServer` is commented out in playwright.config.js
 *      because booting server/server.js requires MongoDB. Until a DB fixture
 *      exists, start the stack by hand in two terminals:
 *          cd server && npm start          # :3001
 *          cd client && npx craco start    # :3000
 *
 * Once both are done, change `test.skip` to `test` to verify the runner.
 * The real specs this layer is for are AUDIT.md §8.4–§8.6 (multi-tab collab,
 * offline/reconnect, cross-document state leak) plus §8.9 F4 (PDF export).
 */
test.skip('e2e toolchain: the app shell loads', async ({ page }) => {
  await page.goto('/');

  // Deliberately weak assertion — this proves the runner drives a real browser
  // against a real server, nothing about product behaviour.
  await expect(page).toHaveTitle(/.+/);
  await expect(page.locator('#root')).toBeAttached();
});
